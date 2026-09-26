import { connectDB } from '@/lib/db/connection';
import { Session } from '@/lib/db/models/session.model';
import { Token } from '@/lib/db/models/token.model';
import { writeSessionAuditLogs } from '@/lib/audit/logger';

const MIN_INTERVAL_MS = 5_000;
let lastRun = 0;
let running: Promise<void> | null = null;

/**
 * Lazy TTL expiry: marks active sessions past ttl.expiresAt as expired and
 * revokes their tokens. Called from read paths instead of a cron job;
 * throttled so dashboard polling doesn't hammer the database.
 */
export async function expireStaleSessions(force = false): Promise<void> {
  if (running) return running;
  if (!force && Date.now() - lastRun < MIN_INTERVAL_MS) return;
  running = run().finally(() => {
    lastRun = Date.now();
    running = null;
  });
  return running;
}

async function run() {
  await connectDB();
  const now = new Date();
  const stale = await Session.find({ status: 'active', 'ttl.expiresAt': { $lte: now } });

  for (const session of stale) {
    // Conditional update so two concurrent sweeps can't both expire (and double-log) a session.
    const issuedAt = session.ttl.issuedAt?.getTime() ?? session.createdAt.getTime();
    const expiresAt = session.ttl.expiresAt!.getTime();
    const actualDuration = Math.round((expiresAt - issuedAt) / 1000);
    const res = await Session.updateOne(
      { sessionId: session.sessionId, status: 'active' },
      { $set: { status: 'expired', 'ttl.actualDuration': actualDuration } }
    );
    if (res.modifiedCount === 0) continue;

    await Token.updateMany({ sessionId: session.sessionId, status: 'active' }, { $set: { status: 'expired' } });
    await writeSessionAuditLogs(session.sessionId, session.agentId, [
      {
        actorType: 'system',
        actorId: 'system',
        action: 'session.expired',
        severity: 'info',
        details: { sessionId: session.sessionId, ttlSeconds: actualDuration },
      },
      {
        actorType: 'system',
        actorId: 'system',
        action: 'credentials.revoked',
        severity: 'info',
        details: { sessionId: session.sessionId, tokenId: session.credentialRef?.tokenId, reason: 'ttl_expired' },
      },
    ]);
  }
}
