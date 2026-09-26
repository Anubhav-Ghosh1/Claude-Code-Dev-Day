"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { AuditAction, Severity } from "@/types/dashboard";
import { useAgents, useAuditLogs } from "@/hooks/use-api";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { SeverityBadge } from "@/components/shared/status";
import { IntegrityBanner } from "@/components/audit/integrity-banner";
import { EntryDetails } from "@/components/audit/audit-trail";
import { describeEvent } from "@/lib/describe-event";
import { cn, fmtDateTime, fmtNum } from "@/lib/utils";

const ACTION_GROUPS: Record<string, { label: string; actions: AuditAction[] }> = {
  sessions: { label: "Session lifecycle", actions: ["session.created", "session.completed", "session.expired", "session.revoked"] },
  credentials: { label: "Credentials", actions: ["credentials.issued", "credentials.rotated", "credentials.revoked"] },
  denials: { label: "Denials & violations", actions: ["permission.denied", "policy.violated", "overprivilege.detected"] },
  escalations: { label: "Escalations", actions: ["escalation.requested", "escalation.approved", "escalation.partially_approved", "escalation.denied"] },
  admin: { label: "Agents & policies", actions: ["agent.registered", "agent.suspended", "agent.revoked", "policy.created", "policy.updated", "policy.disabled"] },
  integrity: { label: "Integrity checks", actions: ["integrity.check.passed", "integrity.check.failed"] },
};

const LIMIT = 25;

export default function AuditPage() {
  const [severity, setSeverity] = useState<Severity | "">("");
  const [group, setGroup] = useState("");
  const [agentId, setAgentId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const filters = {
    severity: severity || undefined,
    action: group ? ACTION_GROUPS[group].actions : undefined,
    agentId: agentId || undefined,
    sessionId: sessionId.trim() || undefined,
    page,
    limit: LIMIT,
  };
  const { data, error } = useAuditLogs(filters);
  const { data: agents } = useAgents();
  const names = useMemo(() => new Map(agents?.map((a) => [a.agentId, a.name])), [agents]);
  const pg = data?.pagination;

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const exportData = (format: "csv" | "json") => {
    Object.assign(document.createElement("a"), { href: api.auditExportUrl(format), download: `audit-logs.${format}` }).click();
  };

  const broken = data?.chainIntegrity.brokenAt;

  // Newest-first paging: entry #n sits (total - n) rows from the top of the unfiltered log.
  const jumpToBroken = () => {
    if (broken === undefined || !data) return;
    setSeverity("");
    setGroup("");
    setAgentId("");
    setSessionId("");
    setPage(Math.floor((data.chainIntegrity.totalEntries - broken) / LIMIT) + 1);
    setOpen(null);
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only and hash-chained: every entry includes the hash of the one before, so any edit breaks the chain."
        actions={
          <>
            <Button onClick={() => exportData("csv")}>
              <Download size={14} /> CSV
            </Button>
            <Button onClick={() => exportData("json")}>
              <Download size={14} /> JSON
            </Button>
          </>
        }
      />

      {data ? (
        <IntegrityBanner
          integrity={data.chainIntegrity}
          controls={
            <div className="flex gap-2">
              {broken !== undefined && (
                <Button size="sm" onClick={jumpToBroken}>
                  Jump to #{broken}
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <Skeleton className="mb-4 h-[74px] rounded-lg" />
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <Select value={group} onChange={(e) => reset(setGroup)(e.target.value)} className="w-52" aria-label="Action type">
            <option value="">All actions</option>
            {Object.entries(ACTION_GROUPS).map(([k, g]) => (
              <option key={k} value={k}>
                {g.label}
              </option>
            ))}
          </Select>
          <Select value={severity} onChange={(e) => reset(setSeverity)(e.target.value as Severity | "")} className="w-40" aria-label="Severity">
            <option value="">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </Select>
          <Select value={agentId} onChange={(e) => reset(setAgentId)(e.target.value)} className="w-52" aria-label="Agent">
            <option value="">All agents</option>
            {agents?.map((a) => (
              <option key={a.agentId} value={a.agentId}>
                {a.name}
              </option>
            ))}
          </Select>
          <Input placeholder="Session ID (sess_…)" value={sessionId} onChange={(e) => reset(setSessionId)(e.target.value)} className="w-60 font-mono" />
          {pg && <span className="tabular ml-auto pr-2 font-mono text-[11.5px] text-muted">{fmtNum(pg.total)} entries</span>}
        </div>

        {error && <ErrorState error={error} />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] text-muted">
                <th className="w-20 py-2.5 pl-5 font-normal">Seq</th>
                <th className="w-40 py-2.5 font-normal">Time</th>
                <th className="w-28 py-2.5 font-normal">Severity</th>
                <th className="py-2.5 font-normal">Event</th>
                <th className="w-44 py-2.5 font-normal">Actor</th>
                <th className="w-44 py-2.5 pr-5 font-normal">Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!data &&
                Array.from({ length: 12 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-5 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))}
              {data?.data.map((e) => {
                const isBroken = broken !== undefined && e.sequenceNumber === broken;
                const untrusted = broken !== undefined && e.sequenceNumber > broken;
                return (
                  <Fragment key={e.logId}>
                    <tr
                      onClick={() => setOpen(open === e.logId ? null : e.logId)}
                      className={cn("cursor-pointer hover:bg-raised/40", isBroken && "bg-crit/15 hover:bg-crit/20", untrusted && "opacity-60")}
                    >
                      <td className="tabular py-2.5 pl-5 font-mono text-[11.5px] text-ink-2">
                        #{e.sequenceNumber}
                        {isBroken && <span className="ml-1.5 text-crit">✕</span>}
                      </td>
                      <td className="py-2.5 font-mono text-[11px] text-muted">{fmtDateTime(e.timestamp)}</td>
                      <td className="py-2.5">
                        <SeverityBadge severity={e.severity} />
                      </td>
                      <td className="max-w-0 py-2.5 pr-4">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded bg-raised px-1.5 py-px font-mono text-[10.5px] text-ink-2">{e.action}</span>
                          <span className="truncate text-ink-2">{describeEvent(e, e.agentId ? names.get(e.agentId) : undefined)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-[11.5px] text-muted">
                        {e.actorType === "agent" ? names.get(e.actorId) ?? e.actorId : e.actorType === "system" ? "system" : e.actorId}
                      </td>
                      <td className="py-2.5 pr-5 font-mono text-[11.5px]">
                        {e.sessionId ? (
                          <Link href={`/dashboard/sessions/${e.sessionId}`} onClick={(ev) => ev.stopPropagation()} className="text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
                            {e.sessionId.slice(0, 15)}…
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                    {open === e.logId && (
                      <tr className="bg-page/60">
                        <td colSpan={6} className="px-5 py-4">
                          <EntryDetails entry={e} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {data && data.data.length === 0 && <EmptyState title="No audit entries match these filters" />}
        </div>

        {pg && pg.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[12px] text-muted">
            <span className="tabular font-mono">
              Page {pg.page} of {fmtNum(pg.totalPages)}
            </span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                <ChevronLeft size={14} /> Newer
              </Button>
              <Button size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pg.totalPages}>
                Older <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
