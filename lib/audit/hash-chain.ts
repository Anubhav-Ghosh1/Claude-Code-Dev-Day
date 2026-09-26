import crypto from 'crypto';
import { AUDIT_GENESIS_SEED } from '@/lib/utils/constants';
import type { AuditAction } from '@/types/models';

export function computeGenesisHash(): string {
  return crypto.createHash('sha256').update(AUDIT_GENESIS_SEED).digest('hex');
}

function sortedStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

export function computeAuditHash(entry: {
  previousHash: string;
  logId: string;
  sequenceNumber: number;
  action: AuditAction;
  timestamp: Date;
  details: Record<string, unknown>;
}): string {
  const input = [
    entry.previousHash,
    entry.logId,
    entry.sequenceNumber.toString(),
    entry.action,
    entry.timestamp.toISOString(),
    sortedStringify(entry.details),
  ].join('|');

  return crypto.createHash('sha256').update(input).digest('hex');
}
