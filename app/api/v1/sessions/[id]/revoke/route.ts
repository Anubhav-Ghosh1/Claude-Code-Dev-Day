import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { Session } from '@/lib/db/models/session.model';
import { revokeSession } from '@/lib/sessions/revoke';
import { requireDashboardAuth } from '@/lib/auth/dashboard-auth';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { NotFoundError, ConflictError } from '@/lib/errors/api-errors';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDashboardAuth('sessions.revoke');

    await connectDB();
    const { id } = await params;
    let body: Record<string, unknown> = {};
    try { body = await _request.json(); } catch { /* empty body ok */ }
    const reason = typeof body.reason === 'string' && body.reason ? (body.reason as string).slice(0, 256) : 'Revoked from dashboard';

    const session = await Session.findOne({ sessionId: id });
    if (!session) throw new NotFoundError('Session', id);
    if (session.status !== 'active') throw new ConflictError(`Session is ${session.status}, not active`);

    const revoked = await revokeSession(
      session,
      { actorType: 'dashboard_user', actorId: user.email },
      reason
    );
    if (!revoked) throw new ConflictError('Session is no longer active');

    const updated = await Session.findOne({ sessionId: id }).select('-__v');
    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
