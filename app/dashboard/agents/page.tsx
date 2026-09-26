"use client";

import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { Ban, ChevronRight, PauseCircle, Plus, Search } from "lucide-react";
import type { Agent, AgentStatus } from "@/types/dashboard";
import { useAgents, usePolicies } from "@/hooks/use-api";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, GuidedEmptyState } from "@/components/shared/empty-state";
import { AgentStatusBadge } from "@/components/shared/status";
import { CopyText } from "@/components/shared/copy-text";
import { TimeAgo } from "@/components/shared/time-ago";
import { RegisterAgentDialog } from "@/components/agents/register-dialog";
import { AgentUsagePanel } from "@/components/agents/agent-usage-panel";
import { cn } from "@/lib/utils";

type PendingAction = { agent: Agent; status: "suspended" | "revoked" } | null;

type SortKey = "name-asc" | "name-desc" | "last-active" | "sessions";

export default function AgentsPage() {
  const { data: agents, error, mutate } = useAgents();
  const { data: policies } = usePolicies();
  const policyNames = useMemo(() => new Map(policies?.map((p) => [p.policyId, p.name])), [policies]);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "">("");
  const [sort, setSort] = useState<SortKey>("name-asc");

  const filtered = useMemo(() => {
    if (!agents) return undefined;
    let list = [...agents];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q) || (a.description || "").toLowerCase().includes(q));
    }
    if (statusFilter) list = list.filter((a) => a.status === statusFilter);
    list.sort((a, b) => {
      switch (sort) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "last-active": return (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? "");
        case "sessions": return (b.totalSessions ?? 0) - (a.totalSessions ?? 0);
        default: return 0;
      }
    });
    return list;
  }, [agents, search, statusFilter, sort]);

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
      {agents && agents.length === 0 ? (
        <GuidedEmptyState
          title="No agents registered yet"
          description="Agents are AI services (like Claude Code) that request scoped AWS credentials through AgentVault. Each agent gets its own API key."
          steps={[
            { label: "Click \"Register agent\" above" },
            { label: "Fill in agent name, team, and environment" },
            { label: "Copy the API key — it's shown only once", detail: "AgentVault only stores a bcrypt hash. Give the key to your agent as the X-API-Key header." },
            { label: "Use the key in agent requests", code: "curl -X POST /api/v1/sessions \\\n  -H \"X-API-Key: avk_live_...\" \\\n  -d '{\"gist\": \"...\", \"permissions\": [...]}'" },
          ]}
          cta={{ label: "Register your first agent", onClick: () => setRegisterOpen(true) }}
          apiExample={{
            method: "POST",
            url: "http://localhost:3000/api/v1/agents",
            body: JSON.stringify({ name: "my-agent", description: "Demo agent", metadata: { team: "platform", environment: "staging" } }, null, 2),
          }}
        />
      ) : (
        <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative w-64">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <Input placeholder="Search agents…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AgentStatus | "")} className="w-40" aria-label="Status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="revoked">Revoked</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-44" aria-label="Sort">
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="last-active">Last active ↓</option>
            <option value="sessions">Sessions ↓</option>
          </Select>
          {filtered && <span className="tabular ml-auto pr-2 font-mono text-[11.5px] text-muted">{filtered.length} agents</span>}
        </div>
        {error && <ErrorState error={error} />}
        <div className="@container overflow-x-auto">
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
              {!filtered &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-5 py-4">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))}
              {filtered?.map((a) => {
                const open = expanded === a.agentId;
                return (
                <Fragment key={a.agentId}>
                <tr
                  onClick={() => setExpanded(open ? null : a.agentId)}
                  className={cn("cursor-pointer hover:bg-raised/40", open && "bg-raised/40")}
                >
                  <td className="max-w-[300px] py-3 pl-5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-label={`${open ? "Hide" : "Show"} usage for ${a.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpanded(open ? null : a.agentId);
                        }}
                        className="-ml-1 cursor-pointer rounded p-0.5 text-muted hover:bg-raised hover:text-ink"
                      >
                        <ChevronRight size={14} className={cn("transition-transform", open && "rotate-90")} />
                      </button>
                      <span className="font-mono text-[12.5px] text-ink">{a.name}</span>
                    </div>
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
                  <td className="py-3 pr-5" onClick={(e) => e.stopPropagation()}>
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
                {open && (
                  <tr className="bg-page/40">
                    <td colSpan={7} className="border-t border-line p-0">
                      {/* pinned to the visible width, so it doesn't scroll sideways with the wide table */}
                      <div className="sticky left-0 w-[100cqw]">
                        <AgentUsagePanel agent={a} policies={policies} />
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      <RegisterAgentDialog open={registerOpen} onClose={() => setRegisterOpen(false)} onRegistered={() => mutate()} />

      <Dialog open={!!pending} onClose={() => setPending(null)} title={pending?.status === "revoked" ? "Revoke agent?" : "Suspend agent?"}>
        {pending && (
          <>
            <p className="text-[13px] leading-relaxed text-ink-2">
              <span className="font-mono text-ink">{pending.agent.name}</span>{" "}
              {pending.status === "revoked"
                ? "will be permanently blocked. Its API key stops working and it can never request credentials again."
                : "won't be able to request new credentials. Tokens it already holds still expire on their normal TTL."}
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
