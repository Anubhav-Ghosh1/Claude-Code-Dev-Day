import { Session, ISession } from '@/lib/db/models/session.model';
import { Token } from '@/lib/db/models/token.model';
import { writeSessionAuditLogs } from '@/lib/audit/logger';
import type { ActorType } from '@/types/models';

/**
 * Revoke an active session: invalidate its tokens and log it.
 * Returns false if the session was no longer active (lost a race).
 */
export async function revokeSession(
  session: ISession,
  actor: { actorType: ActorType; actorId: string },
  reason: string
): Promise<boolean> {
  const now = new Date();
  const issuedAt = session.ttl.issuedAt?.getTime() ?? session.createdAt.getTime();
  const actualDuration = Math.max(0, Math.round((now.getTime() - issuedAt) / 1000));

  const res = await Session.updateOne(
    { sessionId: session.sessionId, status: 'active' },
    { $set: { status: 'revoked', revokedAt: now, revocationReason: reason, 'ttl.actualDuration': actualDuration } }
  );
  if (res.modifiedCount === 0) return false;

  await Token.updateMany({ sessionId: session.sessionId, status: 'active' }, { $set: { status: 'revoked', revokedAt: now } });
  await writeSessionAuditLogs(session.sessionId, session.agentId, [
    {
      ...actor,
      action: 'session.revoked',
      severity: 'warning',
      details: { sessionId: session.sessionId, reason, revokedBy: actor.actorId },
    },
    {
      actorType: 'system',
      actorId: 'system',
      action: 'credentials.revoked',
      severity: 'info',
      details: { sessionId: session.sessionId, tokenId: session.credentialRef?.tokenId, reason: 'session_revoked' },
    },
  ]);
  return true;
}
