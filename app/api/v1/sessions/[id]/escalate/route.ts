import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db/connection';
import { Session } from '@/lib/db/models/session.model';
import { Token } from '@/lib/db/models/token.model';
import { authenticateAgent } from '@/lib/auth/api-key-auth';
import { validatePermissions } from '@/lib/validation/permission-validator';
import { issueCredentials } from '@/lib/aws/credential-broker';
import { escalateSessionSchema } from '@/lib/validation/schemas';
import { writeSessionAuditLogs } from '@/lib/audit/logger';
import { successResponse, errorResponse } from '@/lib/utils/response';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
} from '@/lib/errors/api-errors';
import { MAX_ESCALATIONS_DEFAULT } from '@/lib/utils/constants';
import type { AuditAction, AuditSeverity, ActorType } from '@/types/models';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { agent, sourceIp, userAgent } = await authenticateAgent(request);

    const body = await request.json();
    const parsed = escalateSessionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestError('Validation failed', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    await connectDB();
    const { id } = await params;

    const session = await Session.findOne({ sessionId: id });
    if (!session) throw new NotFoundError('Session', id);
    if (session.agentId !== agent.agentId) throw new ForbiddenError('Session belongs to a different agent');
    if (session.status !== 'active') throw new ConflictError(`Session is ${session.status}, not active`);

    if (session.escalations.length >= MAX_ESCALATIONS_DEFAULT) {
      throw new RateLimitError(`Maximum escalations (${MAX_ESCALATIONS_DEFAULT}) reached for this session`);
    }

    const { granted, denied } = await validatePermissions(
      agent.agentId,
      (agent.metadata as Record<string, string>) || {},
      parsed.data.additionalPermissions
    );

    const escalationId = `esc_${nanoid(12)}`;
    const escalationStatus = denied.length === 0 ? 'approved' : granted.length > 0 ? 'partially_approved' : 'denied';

    if (granted.length === 0) {
      const escalation = {
        escalationId,
        requestedAt: new Date(),
        reason: parsed.data.reason,
        requestedPermissions: parsed.data.additionalPermissions,
        status: 'denied' as const,
        grantedPermissions: [],
        deniedPermissions: denied,
        resolvedAt: new Date(),
      };

      (session.escalations as unknown[]).push(escalation);
      await session.save();

      await writeSessionAuditLogs(id, agent.agentId, [{
        actorType: 'agent' as ActorType,
        actorId: agent.agentId,
        action: 'escalation.denied' as AuditAction,
        severity: 'warning' as AuditSeverity,
        details: { escalationId, reason: parsed.data.reason, deniedCount: denied.length },
        sourceIp,
        userAgent,
      }]);

      throw new ForbiddenError('All escalated permissions were denied');
    }

    // Revoke old token
    if (session.credentialRef?.tokenId) {
      await Token.updateOne(
        { tokenId: session.credentialRef.tokenId },
        { $set: { status: 'revoked', revokedAt: new Date() } }
      );
    }

    // Combine original granted + new granted
    const allGranted = [...session.grantedPermissions, ...granted];
    const remainingTtl = Math.max(
      900,
      Math.floor((session.ttl.expiresAt!.getTime() - Date.now()) / 1000) + 900
    );

    const credentials = await issueCredentials(
      session.sessionId,
      agent.agentId,
      allGranted as Array<{ service: string; action: string; resource: string; effect: 'Allow' | 'Deny' }>,
      remainingTtl
    );

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + remainingTtl * 1000);

    const newToken = await Token.create({
      tokenId: `tok_${nanoid(16)}`,
      sessionId: session.sessionId,
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
      expiresAt: newExpiresAt,
    });

    const escalation = {
      escalationId,
      requestedAt: now,
      reason: parsed.data.reason,
      requestedPermissions: parsed.data.additionalPermissions,
      status: escalationStatus as 'approved' | 'partially_approved' | 'denied',
      grantedPermissions: granted,
      deniedPermissions: denied,
      resolvedAt: now,
    };

    (session.escalations as unknown[]).push(escalation);
    session.grantedPermissions = allGranted as typeof session.grantedPermissions;
    session.credentialRef = {
      tokenId: newToken.tokenId,
      roleArn: credentials.roleArn,
      accessKeyId: credentials.accessKeyId,
      expiration: newExpiresAt,
    };
    session.ttl.expiresAt = newExpiresAt;
    await session.save();

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
        actorType: 'agent',
        actorId: agent.agentId,
        action: 'escalation.requested',
        severity: 'info',
        details: { escalationId, reason: parsed.data.reason, requestedCount: parsed.data.additionalPermissions.length },
        sourceIp,
        userAgent,
      },
      {
        actorType: 'system',
        actorId: 'system',
        action: `escalation.${escalationStatus}` as AuditAction,
        severity: escalationStatus === 'approved' ? 'info' : 'warning',
        details: { escalationId, grantedCount: granted.length, deniedCount: denied.length },
        sourceIp,
        userAgent,
      },
      {
        actorType: 'system',
        actorId: 'system',
        action: 'credentials.issued',
        severity: 'info',
        details: { tokenId: newToken.tokenId, accessKeyId: credentials.accessKeyId, expiresAt: newExpiresAt.toISOString() },
        sourceIp,
        userAgent,
      },
    ];

    await writeSessionAuditLogs(id, agent.agentId, auditEntries);

    return successResponse({
      sessionId: session.sessionId,
      status: 'active',
      escalation: {
        escalationId,
        status: escalationStatus,
        requestedPermissions: parsed.data.additionalPermissions,
        grantedPermissions: granted,
        deniedPermissions: denied,
        resolvedAt: now.toISOString(),
      },
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
        expiration: newExpiresAt.toISOString(),
        region: process.env.AWS_REGION || 'us-east-1',
      },
      allGrantedPermissions: allGranted,
      ttl: {
        issuedAt: session.ttl.issuedAt!.toISOString(),
        expiresAt: newExpiresAt.toISOString(),
        durationSeconds: remainingTtl,
      },
      totalEscalations: session.escalations.length,
      remainingEscalations: MAX_ESCALATIONS_DEFAULT - session.escalations.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
