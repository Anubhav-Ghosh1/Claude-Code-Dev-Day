import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { AuditLog } from '@/lib/db/models/audit-log.model';
import { errorResponse } from '@/lib/utils/response';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

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

    const logs = await AuditLog.find(filter)
      .sort({ sequenceNumber: 1 })
      .select('-__v -_id')
      .lean();

    if (format === 'csv') {
      const headers = [
        'logId', 'sequenceNumber', 'sessionId', 'agentId',
        'actorType', 'actorId', 'action', 'severity',
        'timestamp', 'hash', 'previousHash',
      ];
      const csvRows = [headers.join(',')];

      for (const log of logs) {
        const row = headers.map((h) => {
          const val = (log as Record<string, unknown>)[h];
          if (val instanceof Date) return val.toISOString();
          if (val === null || val === undefined) return '';
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        csvRows.push(row.join(','));
      }

      return new Response(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return new Response(JSON.stringify(logs, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
