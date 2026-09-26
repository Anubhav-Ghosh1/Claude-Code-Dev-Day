import { connectDB } from '@/lib/db/connection';
import { AuditLog } from '@/lib/db/models/audit-log.model';
import { computeAuditHash, computeGenesisHash } from './hash-chain';
import type { AuditAction } from '@/types/models';

interface IntegrityResult {
  valid: boolean;
  brokenAt?: number;
  totalChecked: number;
  lastVerifiedAt: Date;
}

export async function verifyChainIntegrity(
  fromSequence?: number,
  toSequence?: number
): Promise<IntegrityResult> {
  await connectDB();

  const query: Record<string, unknown> = {};
  if (fromSequence !== undefined || toSequence !== undefined) {
    query.sequenceNumber = {};
    if (fromSequence !== undefined) (query.sequenceNumber as Record<string, number>).$gte = fromSequence;
    if (toSequence !== undefined) (query.sequenceNumber as Record<string, number>).$lte = toSequence;
  }

  const logs = await AuditLog.find(query).sort({ sequenceNumber: 1 }).lean();

  if (logs.length === 0) {
    return { valid: true, totalChecked: 0, lastVerifiedAt: new Date() };
  }

  let expectedPreviousHash = computeGenesisHash();

  if (fromSequence && fromSequence > 1) {
    const prev = await AuditLog.findOne({ sequenceNumber: fromSequence - 1 }).lean();
    if (prev) expectedPreviousHash = prev.hash;
  }

  for (const log of logs) {
    if (log.previousHash !== expectedPreviousHash) {
      return {
        valid: false,
        brokenAt: log.sequenceNumber,
        totalChecked: logs.indexOf(log) + 1,
        lastVerifiedAt: new Date(),
      };
    }

    const computedHash = computeAuditHash({
      previousHash: log.previousHash,
      logId: log.logId,
      sequenceNumber: log.sequenceNumber,
      action: log.action as AuditAction,
      timestamp: log.timestamp,
      details: log.details as Record<string, unknown>,
    });

    if (computedHash !== log.hash) {
      return {
        valid: false,
        brokenAt: log.sequenceNumber,
        totalChecked: logs.indexOf(log) + 1,
        lastVerifiedAt: new Date(),
      };
    }

    expectedPreviousHash = log.hash;
  }

  return { valid: true, totalChecked: logs.length, lastVerifiedAt: new Date() };
}
