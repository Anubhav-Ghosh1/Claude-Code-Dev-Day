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

const MAX_RETRIES = 3;

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  await connectDB();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { name: 'audit_log' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      const sequenceNumber = counter.seq;
      const previousHash = counter.currentHash || computeGenesisHash();
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

      // Update chain head with compare-and-swap
      const updated = await Counter.updateOne(
        { name: 'audit_log', currentHash: previousHash },
        { $set: { currentHash: hash } }
      );

      if (updated.modifiedCount === 0) {
        // Another write raced — retry
        continue;
      }

      return;
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) throw err;
    }
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
