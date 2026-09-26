import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { connectDB } from '@/lib/db/connection';
import { Agent } from '@/lib/db/models/agent.model';
import { Session } from '@/lib/db/models/session.model';
import { Token } from '@/lib/db/models/token.model';
import { requireDashboardAuth } from '@/lib/auth/dashboard-auth';
import { validatePermissions } from '@/lib/validation/permission-validator';
import { detectOverPrivilege } from '@/lib/validation/over-privilege-detector';
import { tryValidateWithAI, isAIValidationEnabled, AI_MODEL } from '@/lib/validation/ai-validator';
import { issueCredentials, isMockMode } from '@/lib/aws/credential-broker';
import { permissionEntrySchema } from '@/lib/validation/schemas';
import { writeSessionAuditLogs } from '@/lib/audit/logger';
import { successResponse, errorResponse } from '@/lib/utils/response';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors/api-errors';
import type { AuditAction, AuditSeverity, ActorType } from '@/types/models';
import { DEFAULT_SESSION_TTL, MAX_GIST_LENGTH, MAX_SESSION_TTL } from '@/lib/utils/constants';

const dashboardSessionSchema = z.object({
  agentId: z.string().min(1),
  gist: z.string().min(1).max(MAX_GIST_LENGTH),
  permissions: z.array(permissionEntrySchema).min(1).max(50),
  estimatedDuration: z.number().int().min(60).max(MAX_SESSION_TTL),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireDashboardAuth('sessions.revoke');

    const body = await request.json();
    const parsed = dashboardSessionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestError('Validation failed', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    await connectDB();

    const agent = await Agent.findOne({ agentId: parsed.data.agentId });
    if (!agent) throw new NotFoundError('Agent', parsed.data.agentId);
    if (agent.status !== 'active') {
      throw new ForbiddenError(`Agent is ${agent.status}`);
    }

    const { granted, denied } = await validatePermissions(
      agent.agentId,
      (agent.metadata as Record<string, string>) || {},
      parsed.data.permissions
    );

    if (granted.length === 0) {
      throw new ForbiddenError('All requested permissions were denied by policy');
    }

    let aiValidation = null;
    if (isAIValidationEnabled()) {
      aiValidation = await tryValidateWithAI(parsed.data.gist, granted);
    }

    const { flags: overPrivilegeFlags, score: overPrivilegeScore } =
      detectOverPrivilege(parsed.data.permissions);

    const ttlSeconds = Math.min(
      parsed.data.estimatedDuration,
      DEFAULT_SESSION_TTL
    );

    const sessionId = `sess_${nanoid(20)}`;

    const credentials = await issueCredentials(
      sessionId,
      agent.agentId,
      granted,
      ttlSeconds
    );

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const token = await Token.create({
      tokenId: `tok_${nanoid(16)}`,
      sessionId,
      agentId: agent.agentId,
      accessKeyId: credentials.accessKeyId,
      encryptedSecretKey: credentials.encryptedSecretKey,
      encryptedSessionToken: credentials.encryptedSessionToken,
      encryptionKeyId: credentials.encryptionKeyId,
      iv: credentials.iv,
      authTag: credentials.authTag,
      roleArn: credentials.roleArn,
      inlinePolicy: credentials.inlinePolicy,
      issuedAt: now,
      expiresAt,
    });

    const session = await Session.create({
      sessionId,
      agentId: agent.agentId,
      gist: parsed.data.gist,
      requestedPermissions: parsed.data.permissions,
      grantedPermissions: granted,
      deniedPermissions: denied.map((d) => ({
        permission: d.permission,
        reason: d.reason,
        policyId: d.policyId,
      })),
      credentialRef: {
        tokenId: token.tokenId,
        roleArn: credentials.roleArn,
        accessKeyId: credentials.accessKeyId,
        expiration: expiresAt,
      },
      estimatedDuration: parsed.data.estimatedDuration,
      ttl: { issuedAt: now, expiresAt },
      overPrivilegeScore,
      overPrivilegeFlags,
      ...(aiValidation && { aiValidation: { ...aiValidation, model: AI_MODEL } }),
    });

    const auditEntries: Array<{
      actorType: ActorType;
      actorId: string;
      action: AuditAction;
      severity: AuditSeverity;
      details: Record<string, unknown>;
    }> = [
      {
        actorType: 'dashboard_user' as const,
        actorId: user.email,
        action: 'session.created' as const,
        severity: 'info' as const,
        details: {
          sessionId,
          agentId: agent.agentId,
          gist: parsed.data.gist,
          permissionsRequested: parsed.data.permissions.length,
          permissionsGranted: granted.length,
          permissionsDenied: denied.length,
          ttlSeconds,
          overPrivilegeScore,
          mockMode: isMockMode(),
          createdFrom: 'dashboard',
        },
      },
      {
        actorType: 'system' as const,
        actorId: 'system',
        action: 'credentials.issued' as const,
        severity: 'info' as const,
        details: {
          sessionId,
          tokenId: token.tokenId,
          accessKeyId: credentials.accessKeyId,
          roleArn: credentials.roleArn,
          expiresAt: expiresAt.toISOString(),
        },
      },
    ];

    for (const d of denied) {
      auditEntries.push({
        actorType: 'system' as const,
        actorId: 'system',
        action: 'permission.denied' as const,
        severity: 'warning' as const,
        details: {
          sessionId,
          permission: d.permission,
          reason: d.reason,
          policyId: d.policyId || 'none',
        },
      });
    }

    const aiFlags = aiValidation?.flaggedPermissions ?? [];
    if (overPrivilegeFlags.length || aiFlags.length) {
      const critical =
        overPrivilegeFlags.some((f) => f.severity === 'critical') || aiFlags.some((f) => f.severity === 'high');
      auditEntries.push({
        actorType: 'system' as const,
        actorId: 'system',
        action: 'overprivilege.detected' as const,
        severity: critical ? ('critical' as const) : ('warning' as const),
        details: {
          sessionId,
          score: overPrivilegeScore,
          ruleFlags: overPrivilegeFlags.map((f) => `${f.permission.service}:${f.permission.action}`),
          aiFlags: aiFlags.map((f) => `${f.permission.service}:${f.permission.action}`),
        },
      });
    }

    await writeSessionAuditLogs(sessionId, agent.agentId, auditEntries);

    return successResponse(
      {
        sessionId: session.sessionId,
        status: session.status,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
          expiration: expiresAt.toISOString(),
          region: process.env.AWS_REGION || 'us-east-1',
        },
        grantedPermissions: granted,
        deniedPermissions: denied,
        overPrivilegeFlags,
        ...(aiValidation && {
          aiValidation: {
            approved: aiValidation.approved,
            reasoning: aiValidation.reasoning,
            flaggedPermissions: aiValidation.flaggedPermissions,
            suggestedPermissions: aiValidation.suggestedPermissions,
            confidenceScore: aiValidation.confidenceScore,
          },
        }),
        ...(isMockMode() && { _mock: true }),
        ttl: {
          issuedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          durationSeconds: ttlSeconds,
        },
      },
      201
    );
  } catch (error) {
    return errorResponse(error);
  }
}
