import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { AuditLog } from '@/lib/db/models/audit-log.model';
import { verifyChainIntegrity } from '@/lib/audit/integrity-checker';
import { paginatedResponse, errorResponse } from '@/lib/utils/response';
import { parsePagination } from '@/lib/utils/pagination';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination({
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    const filter: Record<string, unknown> = {};

    const sessionId = searchParams.get('sessionId');
    if (sessionId) filter.sessionId = sessionId;

    const agentId = searchParams.get('agentId');
    if (agentId) filter.agentId = agentId;

    const action = searchParams.get('action');
    if (action) filter.action = { $in: action.split(',') };

    const severity = searchParams.get('severity');
    if (severity) filter.severity = severity;

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from || to) {
      filter.timestamp = {};
      if (from) (filter.timestamp as Record<string, Date>).$gte = new Date(from);
      if (to) (filter.timestamp as Record<string, Date>).$lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    const integrity = await verifyChainIntegrity();

    const response = paginatedResponse(logs, total, page, limit);
    const body = await response.json();
    const head = await AuditLog.findOne().sort({ sequenceNumber: -1 }).select('hash sequenceNumber').lean();
    body.chainIntegrity = {
      verified: integrity.valid,
      lastVerifiedAt: integrity.lastVerifiedAt.toISOString(),
      totalEntries: integrity.totalChecked,
      ...(integrity.brokenAt !== undefined && { brokenAt: integrity.brokenAt }),
      ...(head && { headHash: head.hash, headSequence: head.sequenceNumber }),
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
