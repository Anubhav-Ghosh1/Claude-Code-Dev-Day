import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db/connection';
import { AuditLog } from '@/lib/db/models/audit-log.model';
import { Counter } from '@/lib/db/models/counter.model';
import { computeAuditHash, computeGenesisHash } from './hash-chain';
import type { AuditAction, AuditSeverity, ActorType } from '@/types/models';

interface AuditEntry {
  sessionId?: string;
  agentId?: string;
  actorType: ActorType;
  actorId: string;
  action: AuditAction;
  severity: AuditSeverity;
  details: Record<string, unknown>;
  sourceIp?: string;
  userAgent?: string;
}

const MAX_RETRIES = 10;

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  await connectDB();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Read the current chain head (creating it on first use).
    const head = await Counter.findOneAndUpdate(
      { name: 'audit_log' },
      { $setOnInsert: { seq: 0, currentHash: '' } },
      { new: true, upsert: true }
    );

    const sequenceNumber = head.seq + 1;
    const previousHash = head.currentHash || computeGenesisHash();
    const logId = `alog_${nanoid(24)}`;
    const timestamp = new Date();

    const hash = computeAuditHash({
      previousHash,
      logId,
      sequenceNumber,
      action: entry.action,
      timestamp,
      details: entry.details,
    });

    // Claim the slot before inserting: only succeeds if no other writer advanced
    // the chain since we read it, so the chain can never fork or duplicate.
    const claimed = await Counter.findOneAndUpdate(
      { name: 'audit_log', seq: head.seq, currentHash: head.currentHash },
      { $set: { seq: sequenceNumber, currentHash: hash } }
    );

    if (!claimed) {
      await new Promise((r) => setTimeout(r, 5 + Math.random() * 20 * (attempt + 1)));
      continue;
    }

    await AuditLog.create({
      logId,
      sequenceNumber,
      sessionId: entry.sessionId,
      agentId: entry.agentId,
      actorType: entry.actorType,
      actorId: entry.actorId,
      action: entry.action,
      severity: entry.severity,
      details: entry.details,
      previousHash,
      hash,
      timestamp,
      sourceIp: entry.sourceIp,
      userAgent: entry.userAgent,
    });

    return;
  }

  throw new Error('Failed to write audit log after maximum retries');
}

export async function writeSessionAuditLogs(
  sessionId: string,
  agentId: string,
  entries: Omit<AuditEntry, 'sessionId' | 'agentId'>[]
): Promise<void> {
  for (const entry of entries) {
    await writeAuditLog({
      ...entry,
      sessionId,
      agentId,
    });
  }
}
