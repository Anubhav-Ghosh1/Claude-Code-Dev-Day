"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsRange, AnalyticsSummary } from "@/types/dashboard";
import { fmtNum, fmtPct } from "@/lib/utils";
import { ChartCard, Legend, MiniTable, TooltipBox } from "./chart-card";
import { C, axisProps } from "./chart-theme";
import { EmptyState } from "@/components/shared/empty-state";

/* eslint-disable @typescript-eslint/no-explicit-any -- Recharts tooltip payloads are loosely typed */

function bucketLabel(iso: string, range: AnalyticsRange, long = false) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const hour = `${String(d.getHours()).padStart(2, "0")}:00`;
  if (range === "24h") return long ? `${day}, ${hour}` : hour;
  return long ? `${day}, ${hour}` : day;
}

// ---------- decisions over time ----------

export function DecisionsOverTime({ data, className }: { data: AnalyticsSummary; className?: string }) {
  const rows = data.timeseries.map((b) => ({ ...b, label: bucketLabel(b.bucketStart, data.range) }));
  const totals = rows.reduce((a, r) => ({ g: a.g + r.granted, d: a.d + r.denied }), { g: 0, d: 0 });
  return (
    <ChartCard
      className={className}
      eyebrow="Least privilege at work"
      title="Permission decisions over time"
      legend={
        <Legend
          items={[
            { label: "Granted", color: C.granted, value: fmtNum(totals.g) },
            { label: "Denied", color: C.denied, value: fmtNum(totals.d) },
          ]}
        />
      }
      table={
        <MiniTable
          head={["Period", "Granted", "Denied"]}
          rows={data.timeseries.map((b) => [bucketLabel(b.bucketStart, data.range, true), b.granted, b.denied])}
        />
      }
    >
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="label" {...axisProps} minTickGap={28} />
            <YAxis {...axisProps} axisLine={false} allowDecimals={false} width={44} />
            <Tooltip
              cursor={{ stroke: C.axis, strokeWidth: 1 }}
              content={({ active, payload }: any) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={bucketLabel(payload[0].payload.bucketStart, data.range, true)}
                    rows={[
                      { label: "Granted", color: C.granted, value: fmtNum(payload[0].payload.granted) },
                      { label: "Denied", color: C.denied, value: fmtNum(payload[0].payload.denied) },
                    ]}
                  />
                ) : null
              }
            />
            {(["granted", "denied"] as const).map((k) => (
              <Area
                key={k}
                dataKey={k}
                type="monotone"
                stroke={C[k]}
                strokeWidth={2}
                fill={C[k]}
                fillOpacity={0.14}
                activeDot={{ r: 4, stroke: C.surface, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ---------- policy blocks vs Claude flags (split bar, not a 2-slice donut) ----------

export function DenialsBySource({ data, className }: { data: AnalyticsSummary; className?: string }) {
  const { policy, aiFlagged } = data.bySource;
  const total = policy + aiFlagged;
  const aiShare = total ? aiFlagged / total : 0;
  return (
    <ChartCard className={className} eyebrow="Two layers of review" title="Policy blocks vs Claude flags">
      <div className="flex h-full flex-col justify-between gap-6 px-2 pt-2">
        <div>
          <div className="text-[44px] leading-none font-semibold tracking-tight">{fmtNum(aiFlagged)}</div>
          <p className="mt-2 max-w-xs text-[13px] leading-snug text-ink-2">
            permissions <span className="text-ink">Claude flagged</span> as unnecessary for the stated task — after they passed every policy rule.
          </p>
        </div>
        {total ? (
          <div>
            <div className="flex h-3 w-full gap-[2px]" role="img" aria-label={`Policy blocks ${policy}, Claude flags ${aiFlagged}`}>
              <div className="rounded-l-[4px]" style={{ width: `${(1 - aiShare) * 100}%`, background: C.s1 }} title={`Policy blocks: ${policy}`} />
              <div className="rounded-r-[4px]" style={{ width: `${aiShare * 100}%`, background: C.s2 }} title={`Claude flags: ${aiFlagged}`} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                { label: "Policy blocks", sub: "hard deny, never issued", color: C.s1, n: policy },
                { label: "Claude flags", sub: "advisory, not needed for task", color: C.s2, n: aiFlagged },
              ].map((s) => (
                <div key={s.label} className="rounded-md border border-line bg-page px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[12px] text-ink-2">
                    <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
                    {s.label}
                  </div>
                  <div className="tabular mt-1 font-mono text-[18px] text-ink">
                    {fmtNum(s.n)} <span className="text-[11px] text-muted">{fmtPct(total ? s.n / total : 0, 0)}</span>
                  </div>
                  <div className="text-[11px] text-muted">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title="Nothing blocked or flagged in this range" />
        )}
      </div>
    </ChartCard>
  );
}

// ---------- decisions by service ----------

export function DecisionsByService({ data, className }: { data: AnalyticsSummary; className?: string }) {
  const rows = data.byService;
  return (
    <ChartCard
      className={className}
      eyebrow="Where access goes"
      title="Decisions by service"
      legend={
        <Legend
          items={[
            { label: "Granted", color: C.granted },
            { label: "Denied", color: C.denied },
          ]}
        />
      }
      table={<MiniTable head={["Service", "Granted", "Denied"]} rows={rows.map((r) => [r.service, r.granted, r.denied])} />}
    >
      <div style={{ height: Math.max(160, rows.length * 34 + 30) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 4 }} barCategoryGap={9}>
            <CartesianGrid horizontal={false} stroke={C.grid} />
            <XAxis type="number" {...axisProps} allowDecimals={false} />
            <YAxis type="category" dataKey="service" {...axisProps} axisLine={false} width={80} tick={{ fill: C.ink2, fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={({ active, payload }: any) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={payload[0].payload.service}
                    rows={[
                      { label: "Granted", color: C.granted, value: fmtNum(payload[0].payload.granted) },
                      { label: "Denied", color: C.denied, value: fmtNum(payload[0].payload.denied) },
                    ]}
                  />
                ) : null
              }
            />
            {/* 2px surface stroke = the gap between stacked segments */}
            <Bar dataKey="granted" stackId="s" fill={C.granted} stroke={C.surface} strokeWidth={2} radius={[4, 0, 0, 4]} isAnimationActive={false} />
            <Bar dataKey="denied" stackId="s" fill={C.denied} stroke={C.surface} strokeWidth={2} radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ---------- risk distribution ----------

export function RiskDistribution({ data, className }: { data: AnalyticsSummary; className?: string }) {
  const rows = data.riskBuckets;
  const high = rows.filter((r) => r.min >= 0.6).reduce((a, r) => a + r.count, 0);
  const total = rows.reduce((a, r) => a + r.count, 0);
  return (
    <ChartCard
      className={className}
      eyebrow="Over-privilege score"
      title="Sessions by risk score"
      legend={
        <span className="text-[12px] text-muted">
          <span className="tabular font-mono text-ink-2">{fmtNum(high)}</span> of {fmtNum(total)} sessions scored ≥ 0.6
        </span>
      }
      table={<MiniTable head={["Score", "Sessions"]} rows={rows.map((r) => [r.label, r.count])} />}
    >
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: -12 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} axisLine={false} allowDecimals={false} width={44} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={({ active, payload }: any) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={`Risk ${payload[0].payload.label}`}
                    rows={[{ label: "Sessions", color: C.s1, value: fmtNum(payload[0].payload.count) }]}
                  />
                ) : null
              }
            />
            <Bar dataKey="count" fill={C.s1} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.label} fillOpacity={r.min >= 0.6 ? 1 : 0.55} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
