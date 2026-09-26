"use client";

import { useNow } from "@/hooks/use-now";
import type { Session } from "@/types/dashboard";
import { cn, fmtDuration } from "@/lib/utils";

function ttlState(s: Session, now: number) {
  const issued = new Date(s.ttl.issuedAt).getTime();
  const expires = new Date(s.ttl.expiresAt).getTime();
  const total = (expires - issued) / 1000;
  const used = s.status === "active" ? Math.min(total, (now - issued) / 1000) : s.ttl.actualDuration ?? total;
  return { total, used, remaining: Math.max(0, total - used), ratio: total ? used / total : 1 };
}

/** Thin bar: time used vs granted TTL. Live while the session is active. */
export function TtlBar({ session, className }: { session: Session; className?: string }) {
  const now = useNow(1000);
  const { ratio, remaining, used, total } = ttlState(session, now);
  const active = session.status === "active";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="h-1 w-full min-w-16 overflow-hidden rounded-full bg-line">
        <div
          className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", active ? (ratio > 0.85 ? "bg-warn" : "bg-ink-2") : "bg-line-strong")}
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </div>
      <span className="tabular w-[92px] shrink-0 text-right font-mono text-[11px] whitespace-nowrap text-muted">
        {active ? `${fmtDuration(remaining)} left` : `${fmtDuration(used)} / ${fmtDuration(total)}`}
      </span>
    </div>
  );
}

export function Countdown({ session }: { session: Session }) {
  const now = useNow(1000);
  const { remaining } = ttlState(session, now);
  const m = Math.floor(remaining / 60);
  const s = Math.floor(remaining % 60);
  return (
    <span className="tabular font-mono">
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

export { ttlState };
