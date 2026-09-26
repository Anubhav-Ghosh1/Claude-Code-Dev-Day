"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Ban, PauseCircle, Plus } from "lucide-react";
import type { Agent } from "@/types/dashboard";
import { useAgents, usePolicies } from "@/hooks/use-api";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/empty-state";
import { AgentStatusBadge } from "@/components/shared/status";
import { CopyText } from "@/components/shared/copy-text";
import { TimeAgo } from "@/components/shared/time-ago";
import { RegisterAgentDialog } from "@/components/agents/register-dialog";

type PendingAction = { agent: Agent; status: "suspended" | "revoked" } | null;

export default function AgentsPage() {
  const { data: agents, error, mutate } = useAgents();
  const { data: policies } = usePolicies();
  const policyNames = useMemo(() => new Map(policies?.map((p) => [p.policyId, p.name])), [policies]);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);

  const apply = async () => {
    if (!pending) return;
    try {
      await api.setAgentStatus(pending.agent.agentId, pending.status);
      await mutate();
      toast.success(`${pending.agent.name} ${pending.status}`);
    } catch (e) {
      toast.error("Action failed", { description: e instanceof Error ? e.message : String(e) });
    }
    setPending(null);
  };

  return (
    <>
      <PageHeader
        title="Agents"
        description="Each agent authenticates with its own API key and can only ever receive what its policies allow."
        actions={
          <Button variant="primary" onClick={() => setRegisterOpen(true)}>
            <Plus size={15} /> Register agent
          </Button>
        }
      />
      <Card>
        {error && <ErrorState error={error} />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] text-muted">
                <th className="py-2.5 pl-5 font-normal">Agent</th>
                <th className="py-2.5 font-normal">Agent ID · key prefix</th>
                <th className="py-2.5 font-normal">Status</th>
                <th className="py-2.5 font-normal">Policies</th>
                <th className="py-2.5 text-right font-normal">Active / total</th>
                <th className="py-2.5 pl-6 font-normal">Last active</th>
                <th className="py-2.5 pr-5 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!agents &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-5 py-4">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))}
              {agents?.map((a) => (
                <tr key={a.agentId} className="hover:bg-raised/40">
                  <td className="max-w-[300px] py-3 pl-5">
                    <div className="font-mono text-[12.5px] text-ink">{a.name}</div>
                    <div className="truncate text-[12px] text-muted" title={a.description}>
                      {a.description || "—"}
                    </div>
                    {Object.keys(a.metadata).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(a.metadata).map(([k, v]) => (
                          <span key={k} className="rounded bg-raised px-1.5 font-mono text-[10.5px] text-muted">
                            {k}:{v}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-3">
                    <CopyText value={a.agentId} className="text-[11.5px]" />
                    <div className="mt-0.5 font-mono text-[11.5px] text-muted">{a.apiKeyPrefix}••••</div>
                  </td>
                  <td className="py-3">
                    <AgentStatusBadge status={a.status} />
                  </td>
                  <td className="max-w-[220px] py-3">
                    <div className="flex flex-wrap gap-1">
                      {a.assignedPolicies.map((p) => (
                        <span key={p} className="rounded border border-line-strong px-1.5 font-mono text-[10.5px] text-ink-2">
                          {policyNames.get(p) ?? p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="tabular py-3 text-right font-mono text-[12px]">
                    <span className={a.activeSessions ? "text-ink" : "text-muted"}>{a.activeSessions ?? 0}</span>
                    <span className="text-muted"> / {a.totalSessions ?? 0}</span>
                  </td>
                  <td className="py-3 pl-6 text-[12px] text-muted">{a.lastActiveAt ? <TimeAgo iso={a.lastActiveAt} /> : "never"}</td>
                  <td className="py-3 pr-5">
                    <div className="flex justify-end gap-1.5">
                      {a.status === "active" && (
                        <Button size="sm" variant="ghost" onClick={() => setPending({ agent: a, status: "suspended" })}>
                          <PauseCircle size={13} /> Suspend
                        </Button>
                      )}
                      {a.status !== "revoked" && (
                        <Button size="sm" variant="ghost" onClick={() => setPending({ agent: a, status: "revoked" })}>
                          <Ban size={13} /> Revoke
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <RegisterAgentDialog open={registerOpen} onClose={() => setRegisterOpen(false)} policies={policies ?? []} onRegistered={() => mutate()} />

      <Dialog open={!!pending} onClose={() => setPending(null)} title={pending?.status === "revoked" ? "Revoke agent?" : "Suspend agent?"}>
        {pending && (
          <>
            <p className="text-[13px] leading-relaxed text-ink-2">
              <span className="font-mono text-ink">{pending.agent.name}</span>{" "}
              {pending.status === "revoked"
                ? "will be permanently blocked. Its API key stops working and it can never request credentials again."
                : "won't be able to request new credentials until reinstated. Existing tokens still expire on their normal TTL."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={apply}>
                {pending.status === "revoked" ? "Revoke agent" : "Suspend agent"}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
