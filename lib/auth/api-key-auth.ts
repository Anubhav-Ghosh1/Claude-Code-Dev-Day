import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { Agent, IAgent } from '@/lib/db/models/agent.model';
import { verifyApiKey, extractPrefix } from '@/lib/crypto/api-key-generator';
import { UnauthorizedError, ForbiddenError, RateLimitError } from '@/lib/errors/api-errors';
import { Session } from '@/lib/db/models/session.model';
import { expireStaleSessions } from '@/lib/sessions/expire-stale';

export interface AuthenticatedAgent {
  agent: IAgent;
  sourceIp: string;
  userAgent: string;
}

export async function authenticateAgent(request: NextRequest): Promise<AuthenticatedAgent> {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) throw new UnauthorizedError('Missing X-API-Key header');

  await connectDB();

  const prefix = extractPrefix(apiKey);
  const agent = await Agent.findOne({ apiKeyPrefix: prefix });
  if (!agent) throw new UnauthorizedError('Invalid API key');

  const isValid = await verifyApiKey(apiKey, agent.apiKeyHash);
  if (!isValid) throw new UnauthorizedError('Invalid API key');

  if (agent.status !== 'active') {
    throw new ForbiddenError(`Agent is ${agent.status}`);
  }

  // Check active sessions limit (expire stale ones first so they don't count)
  await expireStaleSessions(true);
  const activeSessions = await Session.countDocuments({
    agentId: agent.agentId,
    status: 'active',
  });

  if (activeSessions >= agent.rateLimit.maxActiveSessions) {
    throw new RateLimitError(
      `Maximum concurrent sessions (${agent.rateLimit.maxActiveSessions}) reached`
    );
  }

  // Update last active
  agent.lastActiveAt = new Date();
  await agent.save();

  const sourceIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  return { agent, sourceIp, userAgent };
}
