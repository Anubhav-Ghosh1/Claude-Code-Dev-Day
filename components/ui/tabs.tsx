"use client";

import { cn } from "@/lib/utils";

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "-mb-px flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] transition-colors",
            value === t.value ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink-2",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="tabular rounded bg-raised px-1.5 py-px font-mono text-[10.5px] text-ink-2">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
