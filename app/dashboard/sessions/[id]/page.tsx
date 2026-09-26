"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Ban, Download, OctagonAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { useAgents, useSession } from "@/hooks/use-api";
import { api } from "@/lib/api/client";
import type { SessionDetail } from "@/types/dashboard";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/empty-state";
import { SessionStatusBadge } from "@/components/shared/status";
import { CopyText } from "@/components/shared/copy-text";
import { Countdown, TtlBar } from "@/components/shared/ttl";
import { PermissionLabel } from "@/components/shared/permission";
import { AiReasoningCard } from "@/components/sessions/ai-reasoning-card";
import { PermissionsDiff } from "@/components/sessions/permissions-diff";
import { EscalationTimeline } from "@/components/sessions/escalation-timeline";
import { AuditTrail } from "@/components/audit/audit-trail";
import { cn, fmtDateTime, fmtDuration, fmtNum } from "@/lib/utils";

type Tab = "overview" | "permissions" | "escalations" | "audit";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: s, error, mutate } = useSession(id);
  const { data: agents } = useAgents();
  const [tab, setTab] = useState<Tab>("overview");
  const [confirm, setConfirm] = useState(false);
  const [revoking, setRevoking] = useState(false);

  if (error) return <ErrorState error={error} />;
  if (!s) return <DetailSkeleton />;

  const agentName = agents?.find((a) => a.agentId === s.agentId)?.name ?? s.agentId;
  // The backend records the completion summary in the audit trail, not on the session.
  const outcome = s.auditTrail.find((e) => e.action === "session.completed")?.details.summary as string | undefined;

  const revoke = async () => {
    setRevoking(true);
    try {
      await api.revokeSession(s.sessionId);
      await mutate();
      toast.success("Session revoked", { description: `Token ${s.credentialRef.tokenId} is no longer valid.` });
      setConfirm(false);
    } catch (e) {
      toast.error("Revoke failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setRevoking(false);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${s.sessionId}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <Link href="/dashboard/sessions" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink-2">
        <ArrowLeft size={14} /> All sessions
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <SessionStatusBadge status={s.status} large />
            <CopyText value={s.sessionId} className="text-[15px] text-ink" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
            <span>
              agent <span className="font-mono text-ink-2">{agentName}</span>
            </span>
            <span>
              role <span className="font-mono text-ink-2">{s.credentialRef.roleArn.split("/").pop()}</span>
            </span>
            <span>
              key <span className="font-mono text-ink-2">{s.credentialRef.accessKeyId}</span>
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportJson}>
            <Download size={14} /> Export
          </Button>
          {s.status === "active" && (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              <Ban size={14} /> Revoke
            </Button>
          )}
        </div>
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "permissions", label: "Permissions", count: s.requestedPermissions.length + s.escalations.reduce((a, e) => a + e.requestedPermissions.length, 0) },
          { value: "escalations", label: "Escalations", count: s.escalations.length },
          { value: "audit", label: "Audit trail", count: s.auditTrail.length },
        ]}
      />

      <div className="mt-5">
        {tab === "overview" && <OverviewTab s={s} outcome={outcome} />}
        {tab === "permissions" && <PermissionsDiff session={s} />}
        {tab === "escalations" && <EscalationTimeline session={s} outcome={outcome} />}
        {tab === "audit" && (
          <Card>
            <CardHeader eyebrow="Hash-chained" title="Audit trail for this session" />
            <div className="border-t border-line">
              <AuditTrail entries={s.auditTrail} agentName={agentName} />
            </div>
          </Card>
        )}
      </div>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Revoke this session?">
        <p className="text-[13px] leading-relaxed text-ink-2">
          The agent&apos;s token <span className="font-mono text-ink">{s.credentialRef.tokenId}</span> stops working immediately and the
          session is marked revoked. This is recorded in the audit log and can&apos;t be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={revoke} disabled={revoking}>
            <Ban size={14} /> {revoking ? "Revoking…" : "Revoke now"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function OverviewTab({ s, outcome }: { s: SessionDetail; outcome?: string }) {
  const ttlTotal = (new Date(s.ttl.expiresAt).getTime() - new Date(s.ttl.issuedAt).getTime()) / 1000;
  const credentialSets = 1 + s.escalations.filter((e) => e.grantedPermissions.length).length;
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-7">
        <Card className="px-6 py-5">
          <div className="eyebrow mb-2">Agent&apos;s stated task</div>
          <blockquote className="text-[19px] leading-snug tracking-tight text-ink">&ldquo;{s.gist}&rdquo;</blockquote>
          {outcome && <p className="mt-3 text-[13px] text-muted">Outcome: {outcome}</p>}
          {s.revocationReason && <p className="mt-3 text-[13px] text-muted">Revoked: {s.revocationReason}</p>}
        </Card>
        <AiReasoningCard review={s.aiValidation} />
      </div>
      <div className="space-y-4 xl:col-span-5">
        <Card className="px-5 py-4">
          <div className="flex items-baseline justify-between">
            <div className="eyebrow">Token lifetime</div>
            {s.status === "active" && (
              <span className="text-[12px] text-muted">
                expires in <span className="text-[15px] text-ink"><Countdown session={s} /></span>
              </span>
            )}
          </div>
          <TtlBar session={s} className="mt-3" />
          <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
            {[
              ["Issued", fmtDateTime(s.ttl.issuedAt)],
              ["Expires", fmtDateTime(s.ttl.expiresAt)],
              ["Granted TTL", fmtDuration(ttlTotal)],
              ["Actual duration", s.ttl.actualDuration !== undefined ? fmtDuration(s.ttl.actualDuration) : "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted">{k}</dt>
                <dd className="tabular mt-0.5 font-mono text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="grid grid-cols-3 divide-x divide-line">
          {[
            ["Credential sets", credentialSets],
            ["API calls", s.usageCount],
            ["Escalations", s.escalations.length],
          ].map(([k, v]) => (
            <div key={k} className="px-5 py-4">
              <div className="eyebrow">{k}</div>
              <div className="tabular mt-1.5 text-[24px] font-semibold">{fmtNum(Number(v))}</div>
            </div>
          ))}
        </Card>

        <RiskCard s={s} />
      </div>
    </div>
  );
}

function RiskCard({ s }: { s: SessionDetail }) {
  const score = s.overPrivilegeScore ?? 0;
  const level = score >= 0.6 ? { label: "High", icon: OctagonAlert, color: "text-crit", bar: "bg-crit" } : score >= 0.3 ? { label: "Elevated", icon: TriangleAlert, color: "text-warn", bar: "bg-warn" } : { label: "Low", icon: ShieldCheck, color: "text-good", bar: "bg-good" };
  return (
    <Card className="px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="eyebrow">Over-privilege score</div>
        <span className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
          <level.icon size={14} className={level.color} /> {level.label}
        </span>
      </div>
      <div className="mt-2 flex items-end gap-4">
        <div className="tabular text-[34px] leading-none font-semibold">{score.toFixed(2)}</div>
        <div className="mb-1.5 flex-1">
          <div className="relative h-1.5 rounded-full bg-line">
            <div className={cn("absolute inset-y-0 left-0 rounded-full", level.bar)} style={{ width: `${score * 100}%` }} />
            {[0.3, 0.6].map((t) => (
              <span key={t} className="absolute -top-1 -bottom-1 w-px bg-line-strong" style={{ left: `${t * 100}%` }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted">
            <span>0</span>
            <span>0.3</span>
            <span>0.6</span>
            <span>1</span>
          </div>
        </div>
      </div>
      {s.overPrivilegeFlags.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-line pt-3">
          {s.overPrivilegeFlags.map((f, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className={f.severity === "critical" ? "mt-1 text-crit" : "mt-1 text-warn"}>
                {f.severity === "critical" ? <OctagonAlert size={14} /> : <TriangleAlert size={14} />}
              </span>
              <div className="min-w-0">
                <PermissionLabel permission={f.permission} />
                <p className="mt-1 text-[12px] text-muted">{f.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-96" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-4 xl:grid-cols-12">
        <Skeleton className="h-80 rounded-lg xl:col-span-7" />
        <Skeleton className="h-80 rounded-lg xl:col-span-5" />
      </div>
    </div>
  );
}
