import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Kpi } from "@/types/dashboard";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Better = "up" | "down" | "neutral";

export function KpiCard({
  label,
  kpi,
  format,
  better,
  sub,
  alert,
  deltaMode = "relative",
  delay = 0,
}: {
  label: string;
  kpi: Kpi;
  format: (n: number) => string;
  better: Better;
  sub?: React.ReactNode;
  alert?: boolean;
  deltaMode?: "relative" | "points";
  delay?: number;
}) {
  const diff = kpi.value - kpi.previous;
  const pct = deltaMode === "points" ? diff * 100 : kpi.previous ? (diff / kpi.previous) * 100 : 0;
  const flat = Math.abs(pct) < 0.5;
  const good = better === "neutral" || flat ? null : (diff > 0) === (better === "up");
  const Arrow = flat ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <Card
      className={cn("relative animate-rise overflow-hidden px-5 pt-4 pb-3", alert && "border-crit/50")}
      style={{ animationDelay: `${delay}ms` }}
    >
      {alert && <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-crit/10 to-transparent" />}
      <div className="eyebrow">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-[28px] leading-none font-semibold tracking-tight whitespace-nowrap">{format(kpi.value)}</div>
        <Sparkline values={kpi.spark} />
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] whitespace-nowrap">
        <span
          className={cn(
            "tabular flex items-center gap-0.5 font-mono",
            good === null ? "text-ink-2" : good ? "text-good" : "text-[#e66767]",
          )}
        >
          <Arrow size={13} />
          {flat ? "flat" : `${pct > 0 ? "+" : ""}${pct.toFixed(deltaMode === "points" ? 1 : 0)}${deltaMode === "points" ? "pp" : "%"}`}
        </span>
        <span className="text-muted">vs prev. period</span>
      </div>
      {sub && <div className="mt-0.5 truncate text-[11.5px] text-muted">{sub}</div>}
    </Card>
  );
}

/** Hand-rolled SVG sparkline: one 1.5px line, last point marked. */
function Sparkline({ values }: { values: number[] }) {
  const w = 72;
  const h = 28;
  if (values.length < 2) return <svg width={w} height={h} />;
  const max = Math.max(...values, 1e-9);
  const min = Math.min(...values, 0);
  const x = (i: number) => (i / (values.length - 1)) * (w - 4) + 2;
  const y = (v: number) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = values.length - 1;
  return (
    <svg width={w} height={h} className="shrink-0 overflow-visible" aria-hidden>
      <path d={`${d}L${x(last)},${h}L${x(0)},${h}Z`} fill="url(#spark-fill)" opacity={0.5} />
      <path d={d} fill="none" stroke="#c3c2b7" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r={2.5} fill="#ffffff" stroke="#1a1a19" strokeWidth={2} />
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#c3c2b7" stopOpacity={0.25} />
          <stop offset="1" stopColor="#c3c2b7" stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
}
