import type { AuditLog } from "@/types/dashboard";
import { fmtDuration } from "@/lib/utils";

/** One human-readable line per audit entry, used by the feed and the audit table. */
export function describeEvent(e: AuditLog, agentName?: string): string {
  const d = e.details as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const who = agentName ?? e.agentId ?? "agent";
  // Backend stores permissions as objects; tolerate plain "svc:Action" strings too.
  const perm = (p: any) => (p && typeof p === "object" ? `${p.service}:${p.action}` : p ?? "permission"); // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (e.action) {
    case "session.created":
      return `${who} requested ${d.permissionsRequested ?? "?"} permissions — "${d.gist ?? ""}"`;
    case "permission.denied":
      return `Denied ${perm(d.permission)}: ${d.reason}`;
    case "permission.granted":
      return `Granted ${perm(d.permission)}`;
    case "policy.violated":
      return `Blocked ${perm(d.attempted ?? d.permission)} — outside token scope`;
    case "overprivilege.detected":
      return `Over-privilege flagged · risk ${Number(d.score ?? 0).toFixed(2)}${d.aiFlags?.length ? ` · Claude flagged ${d.aiFlags.join(", ")}` : ""}`;
    case "credentials.issued":
      return `Issued ${d.tokenId}${d.expiresAt ? ` · expires ${new Date(d.expiresAt).toLocaleTimeString("en-US", { hour12: false })}` : ""}`;
    case "credentials.rotated":
      return `Credentials rotated`;
    case "credentials.revoked":
      return `Token ${d.tokenId ?? ""} revoked`;
    case "escalation.requested":
      return `${who} asked for more access: ${d.reason}`;
    case "escalation.approved":
      return `Escalation approved · +${d.grantedCount ?? 0} permissions`;
    case "escalation.partially_approved":
      return `Escalation partially approved · ${d.grantedCount ?? 0} granted, ${d.deniedCount ?? 0} denied`;
    case "escalation.denied":
      return `Escalation denied · ${d.deniedCount ?? 0} permissions${d.reason ? ` — ${d.reason}` : ""}`;
    case "session.completed":
      return `${who} completed in ${fmtDuration(d.actualDuration ?? 0)}${d.summary ? ` — ${d.summary}` : ""}`;
    case "session.expired":
      return `Session expired after ${fmtDuration(d.ttlSeconds ?? 0)} TTL`;
    case "session.revoked":
      return `Session revoked by ${d.revokedBy ?? "admin"}${d.reason ? ` — ${d.reason}` : ""}`;
    case "agent.registered":
      return `Agent ${d.name ?? who} registered`;
    case "agent.suspended":
      return `Agent ${agentName ?? d.name ?? who} suspended${d.reason ? ` — ${d.reason}` : ""}`;
    case "agent.revoked":
      return `Agent ${agentName ?? d.name ?? who} revoked`;
    case "policy.created":
      return `Policy ${d.name ?? d.policyId} created`;
    case "policy.updated":
      return `Policy ${d.policyId} updated to v${d.version}${d.change ? ` — ${d.change}` : ""}`;
    case "policy.disabled":
      return `Policy ${d.policyId} disabled`;
    case "integrity.check.passed":
      return "Scheduled hash-chain verification passed";
    case "integrity.check.failed":
      return "Hash-chain verification FAILED";
    default:
      return e.action;
  }
}
