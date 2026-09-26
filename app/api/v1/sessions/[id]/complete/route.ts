import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { Session } from '@/lib/db/models/session.model';
import { Token } from '@/lib/db/models/token.model';
import { authenticateAgent } from '@/lib/auth/api-key-auth';
import { completeSessionSchema } from '@/lib/validation/schemas';
import { writeSessionAuditLogs } from '@/lib/audit/logger';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { NotFoundError, ForbiddenError, ConflictError } from '@/lib/errors/api-errors';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { agent, sourceIp, userAgent } = await authenticateAgent(request);

    let summary: string | undefined;
    try {
      const body = await request.json();
      const parsed = completeSessionSchema.safeParse(body);
      if (parsed.success && parsed.data) {
        summary = parsed.data.summary;
      }
    } catch {
      // Empty body is fine
    }

    await connectDB();
    const { id } = await params;

    const session = await Session.findOne({ sessionId: id });
    if (!session) throw new NotFoundError('Session', id);
    if (session.agentId !== agent.agentId) throw new ForbiddenError('Session belongs to a different agent');
    if (session.status !== 'active') throw new ConflictError(`Session is ${session.status}, not active`);

    const now = new Date();
    const actualDuration = Math.floor(
      (now.getTime() - session.ttl.issuedAt!.getTime()) / 1000
    );

    // Revoke all tokens for this session
    await Token.updateMany(
      { sessionId: id, status: 'active' },
      { $set: { status: 'revoked', revokedAt: now } }
    );

    session.status = 'completed';
    session.completedAt = now;
    session.ttl.actualDuration = actualDuration;
    await session.save();

    await writeSessionAuditLogs(id, agent.agentId, [
      {
        actorType: 'agent',
        actorId: agent.agentId,
        action: 'session.completed',
        severity: 'info',
        details: {
          sessionId: id,
          summary,
          actualDuration,
          permissionsRequested: session.requestedPermissions.length,
          permissionsGranted: session.grantedPermissions.length,
          permissionsDenied: session.deniedPermissions.length,
          escalations: session.escalations.length,
        },
        sourceIp,
        userAgent,
      },
      {
        actorType: 'system',
        actorId: 'system',
        action: 'credentials.revoked',
        severity: 'info',
        details: { sessionId: id, reason: 'session_completed' },
        sourceIp,
        userAgent,
      },
    ]);

    const durationMin = Math.floor(actualDuration / 60);
    const durationStr = durationMin > 0 ? `${durationMin} minutes` : `${actualDuration} seconds`;

    return successResponse({
      sessionId: session.sessionId,
      status: 'completed',
      summary: {
        gist: session.gist,
        duration: actualDuration,
        durationHuman: durationStr,
        permissionsRequested: session.requestedPermissions.length,
        permissionsGranted: session.grantedPermissions.length,
        permissionsDenied: session.deniedPermissions.length,
        escalations: session.escalations.length,
        allCredentialsRevoked: true,
        completedAt: now.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
