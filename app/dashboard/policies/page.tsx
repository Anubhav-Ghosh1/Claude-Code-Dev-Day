"use client";

import { usePolicies } from "@/hooks/use-api";
import type { Policy } from "@/types/dashboard";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/empty-state";
import { fmtDuration, cn } from "@/lib/utils";

export default function PoliciesPage() {
  const { data, error } = usePolicies();
  const sorted = data ? [...data].sort((a, b) => b.priority - a.priority) : undefined;
  return (
    <>
      <PageHeader
        title="Policies"
        description="Hard rules evaluated before Claude sees a request. Deny always wins; higher priority is evaluated first."
      />
      {error && <ErrorState error={error} />}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {!sorted && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-56 rounded-lg" />)}
        {sorted?.map((p, i) => <PolicyCard key={p.policyId} policy={p} delay={i * 50} />)}
      </div>
    </>
  );
}

function PolicyCard({ policy: p, delay }: { policy: Policy; delay: number }) {
  const scope =
    p.scope.agentIds.length > 0
      ? `${p.scope.agentIds.length} specific agents`
      : Object.keys(p.scope.agentMetadata).length > 0
        ? Object.entries(p.scope.agentMetadata)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")
        : "All agents";
  return (
    <Card className="animate-rise px-5 py-4" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[14px] text-ink">{p.name}</div>
          <p className="mt-1 text-[12.5px] text-muted">{p.description}</p>
        </div>
        <div className="shrink-0 text-right font-mono text-[11px] text-muted">
          <div>
            priority <span className="text-ink-2">{p.priority}</span>
          </div>
          <div>v{p.version}</div>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {p.rules.map((r, i) => (
          <li key={i} className="flex items-start gap-3 rounded-md border border-line bg-page px-3 py-2">
            <span
              className={cn(
                "mt-px rounded px-1.5 py-px font-mono text-[10.5px] font-medium uppercase",
                r.effect === "deny" ? "bg-crit/15 text-[#e66767]" : "bg-good/15 text-good",
              )}
            >
              {r.effect}
            </span>
            <div className="min-w-0 space-y-1 font-mono text-[11.5px]">
              <div className="flex flex-wrap gap-1">
                {r.services.flatMap((svc) =>
                  r.actions.map((a) => (
                    <span key={`${svc}:${a}`} className="rounded bg-raised px-1.5 text-ink-2">
                      {svc}:{a}
                    </span>
                  )),
                )}
              </div>
              <div className="truncate text-muted" title={r.resources.join(", ")}>
                on {r.resources.join(", ")}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-[11.5px] text-muted">
        <span>
          scope <span className="text-ink-2">{scope}</span>
        </span>
        <span>
          max TTL <span className="text-ink-2">{fmtDuration(p.constraints.maxSessionDuration)}</span>
        </span>
        <span>
          escalations <span className="text-ink-2">{p.constraints.maxEscalationsPerSession}</span>
        </span>
        <span>
          regions <span className="text-ink-2">{p.constraints.allowedRegions.join(", ")}</span>
        </span>
      </div>
    </Card>
  );
}
