const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(agentId: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const key = `rate:${agentId}`;
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (entry.count >= maxPerMinute) {
    return false;
  }

  entry.count++;
  return true;
}
