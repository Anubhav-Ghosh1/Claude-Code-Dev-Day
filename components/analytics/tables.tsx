"use client";

import Link from "next/link";
import type { AnalyticsSummary } from "@/types/dashboard";
import { Card, CardHeader } from "@/components/ui/card";
import { AgentStatusBadge } from "@/components/shared/status";
import { ServiceIcon } from "@/components/shared/service-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { fmtNum, fmtPct } from "@/lib/utils";
import { C } from "./chart-theme";

export function TopDenied({ data }: { data: AnalyticsSummary }) {
  const max = Math.max(1, ...data.topDenied.map((d) => d.count));
  return (
    <Card>
      <CardHeader eyebrow="Most requested, never granted" title="Top denied actions" />
      {data.topDenied.length === 0 ? (
        <EmptyState title="Nothing denied in this range" />
      ) : (
        <ul className="divide-y divide-line px-5 pb-2">
          {data.topDenied.map((d) => (
            <li key={`${d.service}:${d.action}`} className="flex items-center gap-3 py-2.5">
              <ServiceIcon service={d.service} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[12.5px]">
                    <span className="text-muted">{d.service}:</span>
                    {d.action}
                  </span>
                  <span className="tabular font-mono text-[12.5px] text-ink">{fmtNum(d.count)}</span>
                </div>
                <div className="mt-1 h-[3px] rounded-full bg-line">
                  <div className="h-full rounded-full" style={{ width: `${(d.count / max) * 100}%`, background: C.s1 }} />
                </div>
                <div className="mt-1 truncate text-[11.5px] text-muted" title={d.topReason}>
                  {d.topReason}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function AgentLeaderboard({ data }: { data: AnalyticsSummary }) {
  return (
    <Card>
      <CardHeader eyebrow="Per agent" title="Agent leaderboard" actions={<Link href="/dashboard/agents" className="text-[12px] text-muted hover:text-ink-2">All agents →</Link>} />
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-y border-line text-left text-[11px] text-muted">
            <th className="py-2 pl-5 font-normal">Agent</th>
            <th className="py-2 text-right font-normal">Sessions</th>
            <th className="py-2 pl-4 font-normal">Denial rate</th>
            <th className="py-2 pr-5 text-right font-normal">Violations</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.agents.map((a) => (
            <tr key={a.agentId} className="hover:bg-raised/40">
              <td className="py-2.5 pl-5">
                <div className="font-mono text-[12px] text-ink">{a.name}</div>
                {a.status !== "active" && (
                  <div className="mt-1">
                    <AgentStatusBadge status={a.status} />
                  </div>
                )}
              </td>
              <td className="tabular py-2.5 text-right font-mono text-ink-2">{fmtNum(a.sessions)}</td>
              <td className="py-2.5 pl-4">
                <div className="flex items-center gap-2">
                  <div className="h-[3px] w-10 rounded-full bg-line">
                    <div className="h-full rounded-full bg-ink-2" style={{ width: `${Math.min(100, a.denialRate * 100)}%` }} />
                  </div>
                  <span className="tabular font-mono text-[11.5px] text-ink-2">{fmtPct(a.denialRate, 0)}</span>
                </div>
              </td>
              <td className="tabular py-2.5 pr-5 text-right font-mono">
                {a.violations ? <span className="text-ink">{a.violations}</span> : <span className="text-muted">0</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
