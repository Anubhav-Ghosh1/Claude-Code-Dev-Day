import { ArrowUpRight, Ban, CheckCircle2, Clock, KeyRound } from "lucide-react";
import type { Session } from "@/types/dashboard";
import { Card } from "@/components/ui/card";
import { fmtDateTime, fmtDuration, cn } from "@/lib/utils";

interface Step {
  at: string;
  icon: typeof Ban;
  tone: string;
  title: string;
  body?: React.ReactNode;
}

export function EscalationTimeline({ session, outcome }: { session: Session; outcome?: string }) {
  const steps: Step[] = [
    {
      at: session.createdAt,
      icon: KeyRound,
      tone: "text-ink-2",
      title: "Session created — credentials issued",
      body: `${session.grantedPermissions.length} granted, ${session.deniedPermissions.length} denied · TTL ${fmtDuration(
        (new Date(session.ttl.expiresAt).getTime() - new Date(session.ttl.issuedAt).getTime()) / 1000,
      )}`,
    },
    ...session.escalations.map<Step>((e, i) => ({
      at: e.requestedAt,
      icon: ArrowUpRight,
      tone: e.status === "approved" ? "text-good" : e.status === "denied" ? "text-crit" : "text-warn",
      title: `Escalation #${i + 1} — ${e.status.replace("_", " ")}`,
      body: (
        <>
          <p className="text-ink-2">&ldquo;{e.reason}&rdquo;</p>
          <p className="mt-1 font-mono text-[11.5px]">
            {e.grantedPermissions.map((p) => `+${p.service}:${p.action}`).join("  ")}
            {e.deniedPermissions.map((d) => `  ✕ ${d.permission.service}:${d.permission.action}`).join("")}
          </p>
        </>
      ),
    })),
  ];
  const end = session.status === "active" ? null : new Date(new Date(session.ttl.issuedAt).getTime() + (session.ttl.actualDuration ?? 0) * 1000).toISOString();
  if (end) {
    steps.push({
      at: end,
      icon: session.status === "completed" ? CheckCircle2 : session.status === "expired" ? Clock : Ban,
      tone: session.status === "completed" ? "text-muted" : session.status === "expired" ? "text-warn" : "text-crit",
      title: `Session ${session.status} — credentials revoked`,
      body: outcome ?? `after ${fmtDuration(session.ttl.actualDuration ?? 0)}`,
    });
  }

  return (
    <Card className="px-6 py-5">
      {session.escalations.length === 0 && <p className="mb-4 text-[12.5px] text-muted">This agent never needed more access than it first asked for.</p>}
      <ol className="relative">
        {steps.map((s, i) => (
          <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
            {i < steps.length - 1 && <span className="absolute top-7 bottom-1 left-[13px] w-px bg-line-strong" />}
            <span className={cn("z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong bg-page", s.tone)}>
              <s.icon size={14} />
            </span>
            <div className="min-w-0 pt-0.5 text-[13px]">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-ink">{s.title}</span>
                <span className="font-mono text-[11px] text-muted">{fmtDateTime(s.at)}</span>
              </div>
              {s.body && <div className="mt-1 text-[12.5px] text-muted">{s.body}</div>}
            </div>
          </li>
        ))}
        {session.status === "active" && (
          <li className="relative mt-6 flex items-center gap-4 text-[12.5px] text-muted">
            <span className="flex size-7 items-center justify-center">
              <span className="size-2 animate-pulse-dot rounded-full bg-good text-good" />
            </span>
            In progress…
          </li>
        )}
      </ol>
    </Card>
  );
}
