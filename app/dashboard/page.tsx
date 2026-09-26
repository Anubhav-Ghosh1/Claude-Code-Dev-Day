"use client";

import { useState } from "react";
import type { AnalyticsRange } from "@/types/dashboard";
import { useAnalytics } from "@/hooks/use-api";
import { PageHeader } from "@/components/layout/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/analytics/kpi-card";
import { DecisionsByService, DecisionsOverTime, DenialsBySource, RiskDistribution } from "@/components/analytics/charts";
import { AgentLeaderboard, TopDenied } from "@/components/analytics/tables";
import { LiveActivityFeed } from "@/components/analytics/live-activity-feed";
import { fmtDuration, fmtNum, fmtPct } from "@/lib/utils";

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "14d", label: "14d" },
];

export default function OverviewPage() {
  const [range, setRange] = useState<AnalyticsRange>("7d");
  const { data, error } = useAnalytics(range);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Every credential an agent asked for, what it actually got, and why."
        actions={<Segmented label="Time range" options={RANGES} value={range} onChange={setRange} />}
      />
      {error && <ErrorState error={error} />}
      {!data ? (
        <OverviewSkeleton />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            <KpiCard label="Active sessions" kpi={data.kpis.activeSessions} format={fmtNum} better="neutral" sub="tokens alive now" delay={0} />
            <KpiCard label="Tokens issued" kpi={data.kpis.tokensIssued} format={fmtNum} better="neutral" sub="incl. escalations" delay={50} />
            <KpiCard
              label="Denial rate"
              kpi={data.kpis.denialRate}
              format={(n) => fmtPct(n)}
              better="neutral"
              deltaMode="points"
              sub="of requested perms"
              delay={100}
            />
            <KpiCard
              label="Avg token lifetime"
              kpi={data.kpis.avgTokenLifetime}
              format={fmtDuration}
              better="neutral"
              sub={`of ${fmtDuration(data.kpis.avgTokenLifetime.avgGrantedSeconds)} granted`}
              delay={150}
            />
            <KpiCard
              label="Critical events"
              kpi={data.kpis.criticalEvents}
              format={fmtNum}
              better="down"
              sub="violations + flags"
              alert={data.kpis.criticalEvents.value > 0}
              delay={200}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <DecisionsOverTime data={data} className="xl:col-span-8" />
            <DenialsBySource data={data} className="xl:col-span-4" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-8">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <DecisionsByService data={data} />
                <RiskDistribution data={data} />
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <TopDenied data={data} />
                <AgentLeaderboard data={data} />
              </div>
            </div>
            {/* feed fills the column height and scrolls instead of stretching the row */}
            <div className="min-h-[480px] xl:relative xl:col-span-4">
              <LiveActivityFeed limit={30} className="xl:absolute xl:inset-0" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Skeleton className="h-[340px] rounded-lg xl:col-span-8" />
        <Skeleton className="h-[340px] rounded-lg xl:col-span-4" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[300px] rounded-lg" />
        <Skeleton className="h-[300px] rounded-lg" />
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
    </div>
  );
}
