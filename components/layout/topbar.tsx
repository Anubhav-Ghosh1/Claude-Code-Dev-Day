"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Link2, ShieldAlert } from "lucide-react";
import { useAuditLogs, LIVE_INTERVAL } from "@/hooks/use-api";
import { LiveDot } from "@/components/shared/status";
import { cn, fmtNum, shortHash } from "@/lib/utils";

const TITLES: Record<string, string> = {
  dashboard: "Overview",
  sessions: "Sessions",
  audit: "Audit log",
  agents: "Agents",
  policies: "Policies",
  cli: "CLI",
  authorize: "Authorize",
};

export function Topbar() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean); // ["dashboard", "sessions", "sess_…"]
  const crumbs = parts.map((p, i) => ({
    href: "/" + parts.slice(0, i + 1).join("/"),
    label: TITLES[p] ?? p,
    mono: !TITLES[p],
  }));

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-line bg-page/85 px-8 backdrop-blur">
      <nav className="flex min-w-0 items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={c.href} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight size={13} className="shrink-0 text-line-strong" />}
            {i === crumbs.length - 1 ? (
              <span className={cn("truncate text-ink", c.mono && "font-mono text-[12px]")}>{c.label}</span>
            ) : (
              <Link href={c.href} className="text-muted hover:text-ink-2">
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-5">
        <ChainRibbon />
        <span className="flex items-center gap-2 font-mono text-[11px] text-muted" title={`Polling every ${LIVE_INTERVAL / 1000}s`}>
          <LiveDot className="text-good" />
          LIVE
        </span>
      </div>
    </header>
  );
}

/** The signature element: the audit chain head, always visible. */
function ChainRibbon() {
  const { data } = useAuditLogs({ limit: 1 });
  if (!data) return <div className="h-7 w-64 animate-pulse rounded-md bg-surface" />;
  const { chainIntegrity: c } = data;
  const head = data.data[0];
  return (
    <Link
      href="/dashboard/audit"
      className={cn(
        "flex h-7 items-center gap-2.5 rounded-md border px-2.5 font-mono text-[11px] transition-colors",
        c.verified ? "border-line text-muted hover:border-line-strong" : "border-crit/60 bg-crit/10 text-ink",
      )}
      title={c.verified ? "Hash chain verified end-to-end" : `Chain broken at #${c.brokenAt}`}
    >
      {c.verified ? <Link2 size={13} className="text-good" /> : <ShieldAlert size={13} className="text-crit" />}
      <span className="tabular text-ink-2">#{fmtNum(head?.sequenceNumber ?? 0)}</span>
      <span key={head?.hash} className="animate-rise">{shortHash(c.headHash ?? head?.hash ?? "", 10)}…</span>
      <span className={c.verified ? "text-good" : "text-crit"}>{c.verified ? "verified" : "TAMPERED"}</span>
    </Link>
  );
}
