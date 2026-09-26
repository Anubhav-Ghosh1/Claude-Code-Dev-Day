import { Ban, CheckCircle2, Clock, OctagonAlert, TriangleAlert, Info, PauseCircle } from "lucide-react";
import type { AgentStatus, SessionStatus, Severity } from "@/types/dashboard";
import { cn } from "@/lib/utils";

// Status colors never carry meaning alone: every badge is icon + label.

const SESSION: Record<SessionStatus, { label: string; color: string; icon?: typeof Ban }> = {
  active: { label: "Active", color: "text-good" },
  completed: { label: "Completed", color: "text-muted", icon: CheckCircle2 },
  expired: { label: "Expired", color: "text-warn", icon: Clock },
  revoked: { label: "Revoked", color: "text-crit", icon: Ban },
};

export function LiveDot({ className }: { className?: string }) {
  return <span className={cn("inline-block size-2 animate-pulse-dot rounded-full bg-current", className)} aria-hidden />;
}

export function SessionStatusBadge({ status, large }: { status: SessionStatus; large?: boolean }) {
  const s = SESSION[status];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-page text-ink-2",
        large ? "px-3 py-1 text-[13px]" : "px-2 py-0.5 text-[11.5px]",
      )}
    >
      <span className={cn("flex items-center", s.color)}>{Icon ? <Icon size={large ? 14 : 12} /> : <LiveDot />}</span>
      {s.label}
    </span>
  );
}

const SEVERITY: Record<Severity, { label: string; color: string; icon: typeof Info }> = {
  info: { label: "Info", color: "text-muted", icon: Info },
  warning: { label: "Warning", color: "text-warn", icon: TriangleAlert },
  critical: { label: "Critical", color: "text-crit", icon: OctagonAlert },
};

export function SeverityIcon({ severity, size = 14 }: { severity: Severity; size?: number }) {
  const s = SEVERITY[severity];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex", s.color)} title={s.label}>
      <Icon size={size} aria-label={s.label} />
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
      <SeverityIcon severity={severity} size={13} />
      {SEVERITY[severity].label}
    </span>
  );
}

const AGENT: Record<AgentStatus, { label: string; color: string; icon?: typeof Ban }> = {
  active: { label: "Active", color: "text-good" },
  suspended: { label: "Suspended", color: "text-warn", icon: PauseCircle },
  revoked: { label: "Revoked", color: "text-crit", icon: Ban },
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const s = AGENT[status];
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-page px-2 py-0.5 text-[11.5px] text-ink-2">
      <span className={cn("flex items-center", s.color)}>
        {Icon ? <Icon size={12} /> : <span className="inline-block size-2 rounded-full bg-current" />}
      </span>
      {s.label}
    </span>
  );
}
