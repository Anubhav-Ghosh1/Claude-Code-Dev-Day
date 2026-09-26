"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { ChainIntegrity } from "@/types/dashboard";
import { cn, fmtDateTime, fmtNum, shortHash } from "@/lib/utils";

export function IntegrityBanner({ integrity, controls }: { integrity: ChainIntegrity; controls?: React.ReactNode }) {
  const ok = integrity.verified;
  return (
    <div
      className={cn(
        "relative mb-4 flex flex-wrap items-center gap-4 overflow-hidden rounded-lg border px-5 py-4",
        ok ? "border-line bg-surface" : "border-crit/60 bg-crit/10",
      )}
      role="status"
    >
      <span className={cn("flex size-10 items-center justify-center rounded-full border", ok ? "border-good/40 text-good" : "border-crit/60 text-crit")}>
        {ok ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn("text-[15px] font-medium", ok ? "text-ink" : "text-ink")}>
          {ok ? "Chain verified" : "INTEGRITY VIOLATION DETECTED"}
        </div>
        <div className="mt-0.5 text-[12.5px] text-muted">
          {ok ? (
            <>
              All <span className="tabular text-ink-2">{fmtNum(integrity.totalEntries)}</span> entries re-hashed from genesis — every hash matches.
            </>
          ) : (
            <>
              Entry <span className="font-mono text-ink">#{integrity.brokenAt}</span> doesn&apos;t match its recorded hash. It was modified after
              it was written; nothing after it can be trusted.
            </>
          )}
          <span className="ml-2 font-mono text-[11px]">checked {fmtDateTime(integrity.lastVerifiedAt)}</span>
        </div>
      </div>
      {integrity.headHash && (
        <div className="hidden text-right md:block">
          <div className="eyebrow">Chain head</div>
          <div className="font-mono text-[12px] text-ink-2">{shortHash(integrity.headHash, 16)}…</div>
        </div>
      )}
      {controls}
    </div>
  );
}
