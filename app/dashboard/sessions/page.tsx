"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import type { SessionStatus } from "@/types/dashboard";
import { useAgents, useSessions } from "@/hooks/use-api";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { ErrorState, GuidedEmptyState } from "@/components/shared/empty-state";
import { SessionsTable } from "@/components/sessions/sessions-table";
import { CreateSessionDialog } from "@/components/sessions/create-session-dialog";
import { fmtNum } from "@/lib/utils";

const LIMIT = 20;

export default function SessionsPage() {
  const [status, setStatus] = useState<SessionStatus | "">("");
  const [agentId, setAgentId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const { data, error, isLoading, mutate } = useSessions({ status: status || undefined, agentId: agentId || undefined, search: deferredSearch, page, limit: LIMIT });
  const { data: agents } = useAgents();
  const names = useMemo(() => new Map(agents?.map((a) => [a.agentId, a.name])), [agents]);
  const pg = data?.pagination;

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Sessions"
        description="One session per task: what the agent asked for, what it was granted, and how long its token lived."
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> Create session
          </Button>
        }
      />
      {data && data.data?.length === 0 && !status && !agentId && !deferredSearch ? (
        <GuidedEmptyState
          title="No credential sessions yet"
          description="A session is a scoped, time-bound set of AWS credentials issued to an agent for a specific task. Here's how to create one:"
          steps={[
            { label: "Register an agent", detail: "Go to the Agents page and click \"Register agent\". You'll get an API key." },
            { label: "Create a policy", detail: "Go to the Policies page and define what AWS services and actions the agent is allowed to use." },
            { label: "Click \"Create session\" above", detail: "Pick the agent, describe what it's doing (the gist), and list the AWS permissions it needs." },
            { label: "Get scoped credentials back", code: "{\n  \"credentials\": {\n    \"accessKeyId\": \"ASIAMOCK...\",\n    \"secretAccessKey\": \"mock-secret-...\",\n    \"sessionToken\": \"mock-session-token-...\",\n    \"expiration\": \"2026-09-26T12:00:00Z\"\n  }\n}" },
          ]}
          cta={{ label: "Create your first session", onClick: () => setCreateOpen(true) }}
          apiExample={{
            method: "POST",
            url: "http://localhost:3000/api/v1/sessions",
            body: JSON.stringify({
              gist: "Deploy user-service Lambda with DynamoDB table",
              permissions: [
                { service: "lambda", action: "CreateFunction", resource: "arn:aws:lambda:us-east-1:123456789012:function:user-service-*" },
                { service: "dynamodb", action: "CreateTable", resource: "arn:aws:dynamodb:us-east-1:123456789012:table/user-profiles" },
              ],
              estimatedDuration: 1800,
            }, null, 2),
          }}
        />
      ) : (
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative w-72">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <Input placeholder="Search gist or session ID…" value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} className="pl-8" />
          </div>
          <Select value={status} onChange={(e) => resetPage(setStatus)(e.target.value as SessionStatus | "")} className="w-40" aria-label="Status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </Select>
          <Select value={agentId} onChange={(e) => resetPage(setAgentId)(e.target.value)} className="w-56" aria-label="Agent">
            <option value="">All agents</option>
            {agents?.map((a) => (
              <option key={a.agentId} value={a.agentId}>
                {a.name}
              </option>
            ))}
          </Select>
          {pg && <span className="tabular ml-auto pr-2 font-mono text-[11.5px] text-muted">{fmtNum(pg.total)} sessions</span>}
        </div>
        {error ? <ErrorState error={error} /> : <SessionsTable sessions={data?.data} loading={isLoading && !data} agentNames={names} />}
        {pg && pg.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[12px] text-muted">
            <span className="tabular font-mono">
              Page {pg.page} of {pg.totalPages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                <ChevronLeft size={14} /> Prev
              </Button>
              <Button size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pg.totalPages}>
                Next <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </Card>
      )}

      <CreateSessionDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        agents={agents ?? []}
        onCreated={() => mutate()}
      />
    </>
  );
}
