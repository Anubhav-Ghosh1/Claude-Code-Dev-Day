"use client";

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { AuditLog } from "@/types/dashboard";
import { SeverityIcon } from "@/components/shared/status";
import { JsonViewer } from "@/components/shared/json-viewer";
import { describeEvent } from "@/lib/describe-event";
import { cn, fmtDateTime } from "@/lib/utils";
import { HashPreview } from "./hash-preview";

/** Chronological audit entries with expandable details. Used by the session detail page. */
export function AuditTrail({ entries, agentName }: { entries: AuditLog[]; agentName?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ol className="divide-y divide-line">
      {entries.map((e) => (
        <Fragment key={e.logId}>
          <li
            onClick={() => setOpen(open === e.logId ? null : e.logId)}
            className="grid cursor-pointer grid-cols-[18px_150px_minmax(0,1fr)_120px_16px] items-center gap-3 px-5 py-2.5 hover:bg-raised/40"
          >
            <SeverityIcon severity={e.severity} size={13} />
            <span className="font-mono text-[11px] text-muted">{fmtDateTime(e.timestamp)}</span>
            <div className="min-w-0">
              <span className="mr-2 rounded bg-raised px-1.5 py-px font-mono text-[10.5px] text-ink-2">{e.action}</span>
              <span className="text-[12.5px] text-ink-2">{describeEvent(e, agentName)}</span>
            </div>
            <HashPreview hash={e.hash} className="text-right" />
            <ChevronRight size={14} className={cn("text-muted transition-transform", open === e.logId && "rotate-90")} />
          </li>
          {open === e.logId && (
            <li className="bg-page/60 px-5 py-4">
              <EntryDetails entry={e} />
            </li>
          )}
        </Fragment>
      ))}
    </ol>
  );
}

export function EntryDetails({ entry }: { entry: AuditLog }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <div className="eyebrow mb-2">Details</div>
        <JsonViewer value={entry.details} />
      </div>
      <dl className="space-y-3 text-[12px]">
        {[
          ["Sequence", `#${entry.sequenceNumber}`],
          ["Log ID", entry.logId],
          ["Actor", `${entry.actorType} · ${entry.actorId}`],
          ["Previous hash", entry.previousHash],
          ["Hash", entry.hash],
          ["Source", [entry.sourceIp, entry.userAgent].filter(Boolean).join(" · ") || "—"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="eyebrow mb-0.5">{k}</dt>
            <dd className="font-mono text-[11.5px] break-all text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
