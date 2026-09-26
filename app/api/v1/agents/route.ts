import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db/connection';
import { Agent } from '@/lib/db/models/agent.model';
import { generateApiKey, hashApiKey, extractPrefix } from '@/lib/crypto/api-key-generator';
import { registerAgentSchema } from '@/lib/validation/schemas';
import { successResponse, paginatedResponse, errorResponse } from '@/lib/utils/response';
import { parsePagination } from '@/lib/utils/pagination';
import { writeAuditLog } from '@/lib/audit/logger';
import { BadRequestError, ConflictError } from '@/lib/errors/api-errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerAgentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestError('Validation failed', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    await connectDB();

    const existing = await Agent.findOne({ name: parsed.data.name });
    if (existing) throw new ConflictError(`Agent '${parsed.data.name}' already exists`);

    const agentId = `agt_${nanoid(16)}`;
    const apiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(apiKey);
    const apiKeyPrefix = extractPrefix(apiKey);

    const agent = await Agent.create({
      agentId,
      name: parsed.data.name,
      description: parsed.data.description,
      apiKeyHash,
      apiKeyPrefix,
      assignedPolicies: [],
      metadata: parsed.data.metadata || {},
      rateLimit: {
        maxRequestsPerMinute: parsed.data.rateLimit?.maxRequestsPerMinute ?? 30,
        maxActiveSessions: parsed.data.rateLimit?.maxActiveSessions ?? 5,
      },
    });

    await writeAuditLog({
      agentId,
      actorType: 'system',
      actorId: 'system',
      action: 'agent.registered',
      severity: 'info',
      details: { agentId, name: agent.name, metadata: agent.metadata },
    });

    return successResponse(
      {
        agentId: agent.agentId,
        name: agent.name,
        apiKey,
        apiKeyPrefix,
        status: agent.status,
        assignedPolicies: agent.assignedPolicies,
        rateLimit: agent.rateLimit,
        createdAt: agent.createdAt.toISOString(),
        _warning: 'Store the apiKey securely. It will not be shown again.',
      },
      201
    );
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

    const [agents, total] = await Promise.all([
      Agent.find(filter)
        .select('-apiKeyHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Agent.countDocuments(filter),
    ]);

    return paginatedResponse(agents, total, page, limit);
  } catch (error) {
    return errorResponse(error);
  }
}
