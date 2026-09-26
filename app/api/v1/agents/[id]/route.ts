import { NextRequest } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db/connection';
import { Agent } from '@/lib/db/models/agent.model';
import { Session } from '@/lib/db/models/session.model';
import { writeAuditLog } from '@/lib/audit/logger';
import { revokeSession } from '@/lib/sessions/revoke';
import { requireDashboardAuth } from '@/lib/auth/dashboard-auth';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { BadRequestError, ConflictError, NotFoundError } from '@/lib/errors/api-errors';

const updateAgentStatusSchema = z.object({ status: z.enum(['suspended', 'revoked']) });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDashboardAuth('agents.write');

    const parsed = updateAgentStatusSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new BadRequestError('Validation failed', { errors: parsed.error.flatten().fieldErrors });
    }

    await connectDB();
    const { id } = await params;
    const agent = await Agent.findOne({ agentId: id });
    if (!agent) throw new NotFoundError('Agent', id);
    if (agent.status === 'revoked') throw new ConflictError('Agent is revoked; this cannot be changed');
    if (agent.status === parsed.data.status) throw new ConflictError(`Agent is already ${agent.status}`);

    agent.status = parsed.data.status;
    await agent.save();

    const actor = { actorType: 'dashboard_user' as const, actorId: user.email };
    await writeAuditLog({
      agentId: agent.agentId,
      ...actor,
      action: parsed.data.status === 'suspended' ? 'agent.suspended' : 'agent.revoked',
      severity: 'warning',
      details: { agentId: agent.agentId, name: agent.name, revokedBy: user.email },
    });

    if (parsed.data.status === 'revoked') {
      const active = await Session.find({ agentId: agent.agentId, status: 'active' });
      for (const session of active) await revokeSession(session, actor, 'Agent revoked');
    }

    const updated = await Agent.findOne({ agentId: id }).select('-apiKeyHash -__v');
    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
