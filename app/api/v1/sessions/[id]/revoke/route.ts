import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { Session } from '@/lib/db/models/session.model';
import { revokeSession } from '@/lib/sessions/revoke';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { NotFoundError, ConflictError } from '@/lib/errors/api-errors';

// Dashboard-triggered revoke. No dashboard auth yet (NextAuth is Phase 5) — actor is "dashboard".
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' && body.reason ? body.reason.slice(0, 256) : 'Revoked from dashboard';

    const session = await Session.findOne({ sessionId: id });
    if (!session) throw new NotFoundError('Session', id);
    if (session.status !== 'active') throw new ConflictError(`Session is ${session.status}, not active`);

    const revoked = await revokeSession(session, { actorType: 'dashboard_user', actorId: 'dashboard' }, reason);
    if (!revoked) throw new ConflictError('Session is no longer active');

    const updated = await Session.findOne({ sessionId: id }).select('-__v');
    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
