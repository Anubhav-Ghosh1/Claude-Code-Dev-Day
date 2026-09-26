import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { Session } from '@/lib/db/models/session.model';
import { AuditLog } from '@/lib/db/models/audit-log.model';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { NotFoundError } from '@/lib/errors/api-errors';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const session = await Session.findOne({ sessionId: id }).select('-__v');
    if (!session) throw new NotFoundError('Session', id);

    const auditLogs = await AuditLog.find({ sessionId: id })
      .sort({ sequenceNumber: 1 })
      .select('-__v')
      .lean();

    return successResponse({
      ...session.toObject(),
      auditTrail: auditLogs,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
