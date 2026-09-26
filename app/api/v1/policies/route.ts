import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db/connection';
import { Policy } from '@/lib/db/models/policy.model';
import { createPolicySchema } from '@/lib/validation/schemas';
import { successResponse, paginatedResponse, errorResponse } from '@/lib/utils/response';
import { parsePagination } from '@/lib/utils/pagination';
import { writeAuditLog } from '@/lib/audit/logger';
import { BadRequestError } from '@/lib/errors/api-errors';
import { requireDashboardAuth } from '@/lib/auth/dashboard-auth';

export async function POST(request: NextRequest) {
  try {
    const user = await requireDashboardAuth('policies.write');
    const body = await request.json();
    const parsed = createPolicySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestError('Validation failed', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    await connectDB();

    const policyId = `pol_${nanoid(12)}`;
    const policy = await Policy.create({
      policyId,
      ...parsed.data,
      scope: {
        agentIds: parsed.data.scope?.agentIds || [],
        agentMetadata: parsed.data.scope?.agentMetadata || {},
      },
      constraints: {
        maxSessionDuration: parsed.data.constraints?.maxSessionDuration ?? 3600,
        maxEscalationsPerSession: parsed.data.constraints?.maxEscalationsPerSession ?? 3,
        maxConcurrentSessions: parsed.data.constraints?.maxConcurrentSessions ?? 5,
        allowedRegions: parsed.data.constraints?.allowedRegions || [],
      },
      priority: parsed.data.priority ?? 0,
    });

    await writeAuditLog({
      actorType: 'dashboard_user',
      actorId: user.email,
      action: 'policy.created',
      severity: 'info',
      details: { policyId, name: policy.name, rulesCount: policy.rules.length },
    });

    return successResponse(policy, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination({
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    const filter: Record<string, unknown> = {};
    const status = searchParams.get('status');
    if (status) filter.status = status;

    const [policies, total] = await Promise.all([
      Policy.find(filter).sort({ priority: -1, createdAt: -1 }).skip(skip).limit(limit),
      Policy.countDocuments(filter),
    ]);

    return paginatedResponse(policies, total, page, limit);
  } catch (error) {
    return errorResponse(error);
  }
}
