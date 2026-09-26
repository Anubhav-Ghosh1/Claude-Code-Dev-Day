"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight, ShieldAlert } from "lucide-react";
import type { Session } from "@/types/dashboard";
import { SessionStatusBadge } from "@/components/shared/status";
import { TtlBar } from "@/components/shared/ttl";
import { TimeAgo } from "@/components/shared/time-ago";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export function SessionsTable({ sessions, loading, agentNames }: { sessions?: Session[]; loading?: boolean; agentNames: Map<string, string> }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-[11px] text-muted">
            <th className="py-2.5 pl-5 font-normal">Status</th>
            <th className="py-2.5 font-normal">Session · agent</th>
            <th className="py-2.5 font-normal">Gist</th>
            <th className="py-2.5 font-normal">Permissions</th>
            <th className="w-56 py-2.5 font-normal">TTL</th>
            <th className="py-2.5 pr-5 text-right font-normal">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {loading &&
            Array.from({ length: 10 }, (_, i) => (
              <tr key={i}>
                <td colSpan={6} className="px-5 py-3.5">
                  <Skeleton className="h-5 w-full" />
                </td>
              </tr>
            ))}
          {sessions?.map((s) => {
            const escalations = s.escalations.length;
            const risky = (s.overPrivilegeScore ?? 0) >= 0.6;
            return (
              <tr
                key={s.sessionId}
                onClick={() => router.push(`/dashboard/sessions/${s.sessionId}`)}
                className={cn("group cursor-pointer transition-colors hover:bg-raised/50", s.status === "active" && "bg-good/[0.03]")}
              >
                <td className="py-3 pl-5">
                  <SessionStatusBadge status={s.status} />
                </td>
                <td className="py-3 pr-4">
                  <div className="font-mono text-[12px] text-ink">{s.sessionId.slice(0, 17)}…</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted">{agentNames.get(s.agentId) ?? s.agentId}</div>
                </td>
                <td className="max-w-[380px] py-3 pr-4">
                  <div className="truncate text-ink-2" title={s.gist}>
                    {s.gist}
                  </div>
                </td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <span className="tabular font-mono text-[12px]">
                    <span className="text-ink">{s.grantedPermissions.length}</span>
                    <span className="text-muted"> granted</span>
                    {s.deniedPermissions.length > 0 && (
                      <>
                        <span className="text-muted"> / </span>
                        <span className="text-ink">{s.deniedPermissions.length}</span>
                        <span className="text-muted"> denied</span>
                      </>
                    )}
                  </span>
                  <div className="mt-1 flex gap-1.5">
                    {escalations > 0 && (
                      <span className="inline-flex items-center gap-1 rounded border border-line-strong px-1.5 text-[10.5px] text-ink-2">
                        <ArrowUpRight size={11} /> {escalations} escalation{escalations > 1 && "s"}
                      </span>
                    )}
                    {risky && (
                      <span className="inline-flex items-center gap-1 rounded border border-line-strong px-1.5 text-[10.5px] text-ink-2">
                        <ShieldAlert size={11} className="text-crit" /> risk {s.overPrivilegeScore?.toFixed(2)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <TtlBar session={s} />
                </td>
                <td className="py-3 pr-5 text-right text-[12px] whitespace-nowrap text-muted">
                  <TimeAgo iso={s.createdAt} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sessions && sessions.length === 0 && <EmptyState title="No sessions match these filters" hint="Try clearing the search or picking another status." />}
    </div>
  );
}
