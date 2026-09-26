import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db/connection';
import { Session } from '@/lib/db/models/session.model';
import { Token } from '@/lib/db/models/token.model';
import { authenticateAgent } from '@/lib/auth/api-key-auth';
import { validatePermissions } from '@/lib/validation/permission-validator';
import { detectOverPrivilege } from '@/lib/validation/over-privilege-detector';
import { tryValidateWithAI, isAIValidationEnabled, AI_MODEL } from '@/lib/validation/ai-validator';
import { expireStaleSessions } from '@/lib/sessions/expire-stale';
import { issueCredentials, isMockMode } from '@/lib/aws/credential-broker';
import { createSessionSchema } from '@/lib/validation/schemas';
import { checkRateLimit } from '@/lib/rate-limit/limiter';
import { writeSessionAuditLogs } from '@/lib/audit/logger';
import { successResponse, paginatedResponse, errorResponse } from '@/lib/utils/response';
import { parsePagination } from '@/lib/utils/pagination';
import {
  BadRequestError,
  ForbiddenError,
  RateLimitError,
} from '@/lib/errors/api-errors';
import type { AuditAction, AuditSeverity, ActorType } from '@/types/models';
import { DEFAULT_SESSION_TTL } from '@/lib/utils/constants';

export async function POST(request: NextRequest) {
  try {
    const { agent, sourceIp, userAgent } = await authenticateAgent(request);

    if (!checkRateLimit(agent.agentId, agent.rateLimit.maxRequestsPerMinute)) {
      throw new RateLimitError('Too many requests per minute');
    }

    const body = await request.json();
    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestError('Validation failed', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    await connectDB();

    const { granted, denied } = await validatePermissions(
      agent.agentId,
      (agent.metadata as Record<string, string>) || {},
      parsed.data.permissions
    );

    if (granted.length === 0) {
      const suggestions = denied.map(d => ({
        denied: `${d.permission.service}:${d.permission.action}` + (d.permission.resource ? ` on ${d.permission.resource}` : ''),
        reason: d.reason,
        suggestion: d.suggestion,
        ...(d.suggestedPermission && { retryWith: d.suggestedPermission }),
      }));
      throw new ForbiddenError('All requested permissions were denied. See suggestions for how to fix your request.', {
        suggestions,
        hint: 'Retry the same API call with corrected permissions as shown in each suggestion. Use specific resource ARNs, not wildcards.',
      });
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

    const credentials = await issueCredentials(
      `sess_${nanoid(20)}`,
      agent.agentId,
      granted,
      ttlSeconds
    );

    const sessionId = `sess_${nanoid(20)}`;
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
      sourceIp?: string;
      userAgent?: string;
    }> = [
      {
        actorType: 'agent' as const,
        actorId: agent.agentId,
        action: 'session.created' as const,
        severity: 'info' as const,
        details: {
          sessionId,
          gist: parsed.data.gist,
          permissionsRequested: parsed.data.permissions.length,
          permissionsGranted: granted.length,
          permissionsDenied: denied.length,
          ttlSeconds,
          overPrivilegeScore,
          mockMode: isMockMode(),
          ...(aiValidation && {
            aiApproved: aiValidation.approved,
            aiConfidence: aiValidation.confidenceScore,
            aiFlaggedCount: aiValidation.flaggedPermissions.length,
          }),
        },
        sourceIp,
        userAgent,
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
        sourceIp,
        userAgent,
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
        sourceIp,
        userAgent,
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

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    await expireStaleSessions();

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination({
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    const filter: Record<string, unknown> = {};
    const status = searchParams.get('status');
    if (status) filter.status = status;

    const agentId = searchParams.get('agentId');
    if (agentId) filter.agentId = agentId;

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from || to) {
      filter.createdAt = {};
      if (from) (filter.createdAt as Record<string, Date>).$gte = new Date(from);
      if (to) (filter.createdAt as Record<string, Date>).$lte = new Date(to);
    }

    const search = searchParams.get('search');
    if (search) filter.gist = { $regex: search, $options: 'i' };

    const sortField = searchParams.get('sort') || '-createdAt';
    const sortDir = sortField.startsWith('-') ? -1 : 1;
    const sortKey = sortField.replace(/^-/, '');

    const [sessions, total] = await Promise.all([
      Session.find(filter)
        .sort({ [sortKey]: sortDir })
        .skip(skip)
        .limit(limit)
        .select('-__v'),
      Session.countDocuments(filter),
    ]);

    return paginatedResponse(sessions, total, page, limit);
  } catch (error) {
    return errorResponse(error);
  }
}
