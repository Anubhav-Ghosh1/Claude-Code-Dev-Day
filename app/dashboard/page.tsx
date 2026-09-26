"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, ShieldCheck, KeyRound } from "lucide-react";
import type { AnalyticsRange } from "@/types/dashboard";
import { useAnalytics } from "@/hooks/use-api";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
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

  const isEmpty =
    data &&
    data.kpis.activeSessions.value === 0 &&
    data.kpis.tokensIssued.value === 0 &&
    data.kpis.criticalEvents.value === 0;

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
        <div className="space-y-6">
          {/* Welcome banner — only when no activity */}
          {isEmpty && <WelcomeBanner />}

          {/* KPIs — hero row, no section label */}
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

          {/* Section: Permission decisions */}
          <Section title="Permission decisions" description="How agents' requests are evaluated against your policies over time" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <DecisionsOverTime data={data} className="xl:col-span-8" />
            <DenialsBySource data={data} className="xl:col-span-4" />
          </div>

          {/* Section: Risk & compliance */}
          <Section title="Risk & compliance" description="Over-privilege detection and service-level access patterns" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DecisionsByService data={data} />
            <RiskDistribution data={data} />
          </div>

          {/* Section: Team activity */}
          <Section title="Team activity" description="Agent performance, top denials, and real-time audit stream" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-8">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <TopDenied data={data} />
                <AgentLeaderboard data={data} />
              </div>
            </div>
            <div className="min-h-[480px] xl:relative xl:col-span-4">
              <LiveActivityFeed limit={30} className="xl:absolute xl:inset-0" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mt-2 mb-1">
      <h2 className="text-[15px] font-medium text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>}
    </div>
  );
}

const STEPS = [
  {
    num: 1,
    title: "Register an agent",
    desc: "Give each AI agent its own identity and API key",
    href: "/dashboard/agents",
    icon: Bot,
  },
  {
    num: 2,
    title: "Define policies",
    desc: "Set rules for what AWS services agents can access",
    href: "/dashboard/policies",
    icon: ShieldCheck,
  },
  {
    num: 3,
    title: "Create a session",
    desc: "Agent requests credentials → policies evaluate → scoped token issued",
    href: "/dashboard/sessions",
    icon: KeyRound,
  },
];

function WelcomeBanner() {
  return (
    <Card className="animate-rise border-accent/40 bg-accent/[0.04] px-6 py-6">
      <div className="mb-5">
        <h2 className="text-[18px] font-semibold tracking-tight text-ink">Welcome to AgentVault</h2>
        <p className="mt-1 text-[13px] text-muted">Get started in 3 steps</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <Link
            key={s.num}
            href={s.href}
            className="group flex gap-3.5 rounded-lg border border-line-strong bg-surface px-4 py-3.5 transition-colors hover:border-accent/50 hover:bg-raised"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-[14px] font-semibold text-accent">
              {s.num}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13px] font-medium text-ink group-hover:text-accent">
                <s.icon size={14} />
                {s.title}
              </div>
              <p className="mt-0.5 text-[12px] leading-snug text-muted">{s.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-4 w-48 rounded" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Skeleton className="h-[340px] rounded-lg xl:col-span-8" />
        <Skeleton className="h-[340px] rounded-lg xl:col-span-4" />
      </div>
      <Skeleton className="h-4 w-40 rounded" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-[300px] rounded-lg" />
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
    </div>
  );
}
