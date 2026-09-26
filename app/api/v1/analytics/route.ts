import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { Session } from '@/lib/db/models/session.model';
import { AuditLog } from '@/lib/db/models/audit-log.model';
import { Agent } from '@/lib/db/models/agent.model';
import { expireStaleSessions } from '@/lib/sessions/expire-stale';
import { computeAnalytics, RANGES, type AnalyticsInput } from '@/lib/analytics/compute';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { BadRequestError } from '@/lib/errors/api-errors';
import type { AnalyticsRange } from '@/types/dashboard';

/** GET /api/v1/analytics?range=24h|7d|14d — dashboard overview aggregates. */
export async function GET(request: NextRequest) {
  try {
    const range = (new URL(request.url).searchParams.get('range') || '7d') as AnalyticsRange;
    if (!(range in RANGES)) throw new BadRequestError(`range must be one of ${Object.keys(RANGES).join(', ')}`);

    await connectDB();
    await expireStaleSessions();

    // Current + previous period, so KPIs can show change.
    const since = new Date(Date.now() - 2 * RANGES[range].length);
    const [sessions, events, agents] = await Promise.all([
      Session.find({ $or: [{ createdAt: { $gte: since } }, { status: 'active' }] }).select('-__v').lean(),
      AuditLog.find({ timestamp: { $gte: since }, $or: [{ severity: 'critical' }, { action: 'policy.violated' }] })
        .select('action severity agentId timestamp')
        .lean(),
      Agent.find().select('agentId name status').lean(),
    ]);

    // Round-trip through JSON so Dates become the ISO strings the shared calculator expects.
    const input = JSON.parse(JSON.stringify({ sessions, events, agents })) as AnalyticsInput;
    return successResponse(computeAnalytics(input, range));
  } catch (error) {
    return errorResponse(error);
  }
}
