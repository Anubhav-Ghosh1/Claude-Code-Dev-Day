"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

/** Card with a Chart | Table toggle — every chart has a table view. */
export function ChartCard({
  eyebrow,
  title,
  legend,
  table,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  legend?: React.ReactNode;
  table?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        eyebrow={eyebrow}
        title={title}
        actions={
          table && (
            <Segmented
              label={`${title} view`}
              value={view}
              onChange={setView}
              options={[
                { value: "chart", label: "Chart" },
                { value: "table", label: "Table" },
              ]}
            />
          )
        }
      />
      {legend && view === "chart" && <div className="px-5 pb-1">{legend}</div>}
      <div className="flex-1 px-3 pb-4">{view === "chart" ? children : <div className="px-2">{table}</div>}</div>
    </Card>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[12px] text-ink-2">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
          {i.value && <span className="tabular font-mono text-[11px] text-muted">{i.value}</span>}
        </span>
      ))}
    </div>
  );
}

export function MiniTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-64 overflow-auto">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-line text-left text-muted">
            {head.map((h, i) => (
              <th key={h} className={cn("py-1.5 font-normal", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60">
              {r.map((c, j) => (
                <td key={j} className={cn("tabular py-1.5 text-ink-2", j > 0 && "text-right font-mono")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tooltip body shared by all Recharts charts. Text in ink; the swatch carries identity. */
export function TooltipBox({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; color: string; value: string }[];
}) {
  return (
    <div className="min-w-40 rounded-md border border-line-strong bg-raised px-3 py-2 shadow-xl">
      <div className="mb-1.5 font-mono text-[11px] text-muted">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 text-[12px]">
          <span className="flex items-center gap-1.5 text-ink-2">
            <span className="size-2 rounded-[2px]" style={{ background: r.color }} />
            {r.label}
          </span>
          <span className="tabular font-mono text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
