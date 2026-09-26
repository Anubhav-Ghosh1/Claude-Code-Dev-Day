import type { Agent, AnalyticsRange, AnalyticsSummary, AuditLog, Kpi, PermissionEntry, Session } from '@/types/dashboard';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const RANGES: Record<AnalyticsRange, { length: number; bucket: number }> = {
  '24h': { length: DAY, bucket: HOUR },
  '7d': { length: 7 * DAY, bucket: 6 * HOUR },
  '14d': { length: 14 * DAY, bucket: 12 * HOUR },
};

export interface AnalyticsInput {
  sessions: Session[]; // created in [now - 2·range, now] plus any still active
  events: Pick<AuditLog, 'action' | 'severity' | 'agentId' | 'timestamp'>[]; // critical + violations in the same window
  agents: Pick<Agent, 'agentId' | 'name' | 'status'>[];
}

const t = (iso: string) => new Date(iso).getTime();
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function decisions(s: Session) {
  const granted: PermissionEntry[] = [...s.grantedPermissions, ...s.escalations.flatMap((e) => e.grantedPermissions)];
  const denied = [...s.deniedPermissions, ...s.escalations.flatMap((e) => e.deniedPermissions)];
  return { granted, denied };
}

function endTime(s: Session, now: number) {
  if (s.status === 'active') return now;
  return t(s.ttl.issuedAt) + (s.ttl.actualDuration ?? 0) * 1000;
}

interface WindowStats {
  sessions: Session[];
  granted: number;
  denied: number;
  tokens: number;
  lifetimes: number[];
  grantedTtls: number[];
  critical: number;
}

function windowStats(input: AnalyticsInput, from: number, to: number): WindowStats {
  const sessions = input.sessions.filter((s) => t(s.createdAt) >= from && t(s.createdAt) < to);
  let granted = 0;
  let denied = 0;
  let tokens = 0;
  const lifetimes: number[] = [];
  const grantedTtls: number[] = [];
  for (const s of sessions) {
    const d = decisions(s);
    granted += d.granted.length;
    denied += d.denied.length;
    tokens += 1 + s.escalations.filter((e) => e.grantedPermissions.length).length;
    if (s.status !== 'active' && s.ttl.actualDuration !== undefined) {
      lifetimes.push(s.ttl.actualDuration);
      grantedTtls.push((t(s.ttl.expiresAt) - t(s.ttl.issuedAt)) / 1000);
    }
  }
  const critical = input.events.filter((e) => e.severity === 'critical' && t(e.timestamp) >= from && t(e.timestamp) < to).length;
  return { sessions, granted, denied, tokens, lifetimes, grantedTtls, critical };
}

const rate = (w: WindowStats) => (w.granted + w.denied ? w.denied / (w.granted + w.denied) : 0);

export function computeAnalytics(input: AnalyticsInput, range: AnalyticsRange, now = Date.now()): AnalyticsSummary {
  const { length, bucket } = RANGES[range];
  const from = now - length;
  const current = windowStats(input, from, now);
  const previous = windowStats(input, from - length, from);
  const concurrentAt = (at: number) => input.sessions.filter((s) => t(s.ttl.issuedAt) <= at && endTime(s, now) > at).length;

  const buckets = Array.from({ length: Math.round(length / bucket) }, (_, i) => {
    const start = from + i * bucket;
    return { start, stats: windowStats(input, start, start + bucket) };
  });

  const kpi = (value: number, prev: number, spark: number[]): Kpi => ({ value, previous: prev, spark });
  let lastLifetime = 0;
  const lifetimeSpark = buckets.map((b) => (lastLifetime = avg(b.stats.lifetimes) || lastLifetime));

  const bySource = { policy: 0, aiFlagged: 0 };
  const services = new Map<string, { granted: number; denied: number }>();
  const denials = new Map<string, { service: string; action: string; count: number; reasons: Map<string, number> }>();
  for (const s of current.sessions) {
    const d = decisions(s);
    bySource.aiFlagged += s.aiValidation?.flaggedPermissions?.length ?? 0;
    for (const g of d.granted) {
      const row = services.get(g.service) ?? { granted: 0, denied: 0 };
      row.granted++;
      services.set(g.service, row);
    }
    for (const x of d.denied) {
      bySource.policy++;
      const row = services.get(x.permission.service) ?? { granted: 0, denied: 0 };
      row.denied++;
      services.set(x.permission.service, row);
      const key = `${x.permission.service}:${x.permission.action}`;
      const agg = denials.get(key) ?? { service: x.permission.service, action: x.permission.action, count: 0, reasons: new Map() };
      agg.count++;
      agg.reasons.set(x.reason, (agg.reasons.get(x.reason) ?? 0) + 1);
      denials.set(key, agg);
    }
  }

  const riskBuckets = [0, 0.2, 0.4, 0.6, 0.8].map((min) => ({
    label: `${min.toFixed(1)}–${(min + 0.2).toFixed(1)}`,
    min,
    max: min + 0.2,
    count: current.sessions.filter((s) => {
      const score = s.overPrivilegeScore ?? 0;
      return score >= min && (score < min + 0.2 || min === 0.8);
    }).length,
  }));

  const violations = input.events.filter((e) => e.action === 'policy.violated' && t(e.timestamp) >= from);
  const agents = input.agents
    .map((a) => {
      const mine = current.sessions.filter((s) => s.agentId === a.agentId);
      let g = 0;
      let d = 0;
      for (const s of mine) {
        const x = decisions(s);
        g += x.granted.length;
        d += x.denied.length;
      }
      return {
        agentId: a.agentId,
        name: a.name,
        status: a.status,
        sessions: mine.length,
        denialRate: g + d ? d / (g + d) : 0,
        violations: violations.filter((v) => v.agentId === a.agentId).length,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);

  return {
    range,
    generatedAt: new Date(now).toISOString(),
    bucketSeconds: bucket / 1000,
    kpis: {
      activeSessions: kpi(
        input.sessions.filter((s) => s.status === 'active').length,
        concurrentAt(now - length),
        buckets.map((b) => concurrentAt(b.start + bucket)),
      ),
      tokensIssued: kpi(current.tokens, previous.tokens, buckets.map((b) => b.stats.tokens)),
      denialRate: kpi(rate(current), rate(previous), buckets.map((b) => rate(b.stats))),
      avgTokenLifetime: {
        ...kpi(avg(current.lifetimes), avg(previous.lifetimes), lifetimeSpark),
        avgGrantedSeconds: avg(current.grantedTtls),
      },
      criticalEvents: kpi(current.critical, previous.critical, buckets.map((b) => b.stats.critical)),
    },
    timeseries: buckets.map((b) => ({
      bucketStart: new Date(b.start).toISOString(),
      granted: b.stats.granted,
      denied: b.stats.denied,
    })),
    bySource,
    byService: [...services.entries()]
      .map(([service, v]) => ({ service, ...v }))
      .sort((a, b) => b.granted + b.denied - (a.granted + a.denied)),
    riskBuckets,
    topDenied: [...denials.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((d) => ({
        service: d.service,
        action: d.action,
        count: d.count,
        topReason: [...d.reasons.entries()].sort((a, b) => b[1] - a[1])[0][0],
      })),
    agents,
  };
}
