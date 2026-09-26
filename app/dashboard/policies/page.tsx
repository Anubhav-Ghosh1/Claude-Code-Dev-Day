"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Ban, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { usePolicies } from "@/hooks/use-api";
import type { Policy } from "@/types/dashboard";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, GuidedEmptyState } from "@/components/shared/empty-state";
import { PolicyEditorDialog } from "@/components/policies/policy-editor-dialog";
import { fmtDuration, cn } from "@/lib/utils";

type PolicySort = "priority-desc" | "priority-asc" | "name-asc" | "newest";

export default function PoliciesPage() {
  const { data, error, mutate } = usePolicies();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | undefined>();
  const [disableTarget, setDisableTarget] = useState<Policy | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "disabled" | "">("");
  const [sort, setSort] = useState<PolicySort>("priority-desc");

  const filtered = useMemo(() => {
    if (!data) return undefined;
    let list = [...data];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
    }
    if (statusFilter) list = list.filter((p) => p.status === statusFilter);
    list.sort((a, b) => {
      switch (sort) {
        case "priority-desc": return b.priority - a.priority;
        case "priority-asc": return a.priority - b.priority;
        case "name-asc": return a.name.localeCompare(b.name);
        case "newest": return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
        default: return 0;
      }
    });
    return list;
  }, [data, search, statusFilter, sort]);

  const openCreate = () => {
    setEditingPolicy(undefined);
    setEditorOpen(true);
  };

  const openEdit = (p: Policy) => {
    setEditingPolicy(p);
    setEditorOpen(true);
  };

  const disablePolicy = async () => {
    if (!disableTarget) return;
    try {
      await api.deletePolicy(disableTarget.policyId);
      await mutate();
      toast.success(`Policy "${disableTarget.name}" disabled`);
    } catch (e) {
      toast.error("Failed to disable policy", { description: e instanceof Error ? e.message : String(e) });
    }
    setDisableTarget(null);
  };

  const enablePolicy = async (p: Policy) => {
    try {
      await api.updatePolicy(p.policyId, { name: p.name, rules: p.rules });
      await mutate();
      toast.success(`Policy "${p.name}" re-enabled`);
    } catch (e) {
      toast.error("Failed", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <>
      <PageHeader
        title="Policies"
        description="Hard rules evaluated before Claude sees a request. Deny always wins; higher priority is evaluated first."
        actions={
          <Button variant="primary" onClick={openCreate}>
            <Plus size={15} /> Create policy
          </Button>
        }
      />
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative w-64">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input placeholder="Search policies…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "active" | "disabled" | "")} className="w-36" aria-label="Status">
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as PolicySort)} className="w-40" aria-label="Sort">
          <option value="priority-desc">Priority ↓</option>
          <option value="priority-asc">Priority ↑</option>
          <option value="name-asc">Name A–Z</option>
          <option value="newest">Newest first</option>
        </Select>
        {filtered && <span className="tabular ml-auto pr-2 font-mono text-[11.5px] text-muted">{filtered.length} policies</span>}
      </Card>

      {error && <ErrorState error={error} />}
      {data && data.length === 0 ? (
        <GuidedEmptyState
          title="No policies defined"
          description="Policies control what AWS permissions agents can request. Without policies, all permissions are denied by default (deny-first)."
          steps={[
            { label: "Click \"Create policy\" above" },
            { label: "Add rules — each rule allows or denies specific AWS services, actions, and resources", code: "ALLOW  lambda:*, s3:*, dynamodb:*\n  on arn:aws:*:us-east-1:123456789012:*\n\nDENY   iam:*, organizations:*, sts:*\n  on *" },
            { label: "Set constraints", detail: "Max session duration, max escalations per session, and allowed AWS regions." },
            { label: "Set priority", detail: "Higher priority policies are evaluated first. At equal priority, deny always wins." },
          ]}
          cta={{ label: "Create your first policy", onClick: openCreate }}
          apiExample={{
            method: "POST",
            url: "http://localhost:3000/api/v1/policies",
            body: JSON.stringify({
              name: "staging-deploy",
              rules: [
                { effect: "allow", services: ["lambda", "s3", "dynamodb"], actions: ["*"], resources: ["arn:aws:*:us-east-1:123456789012:*"] },
                { effect: "deny", services: ["iam", "sts"], actions: ["*"], resources: ["*"] },
              ],
              priority: 10,
            }, null, 2),
          }}
        />
      ) : (
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {!filtered && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-56 rounded-lg" />)}
        {filtered?.map((p, i) => (
          <PolicyCard
            key={p.policyId}
            policy={p}
            delay={i * 50}
            onEdit={() => openEdit(p)}
            onDisable={() => setDisableTarget(p)}
            onEnable={() => enablePolicy(p)}
          />
        ))}
      </div>
      )}

      <PolicyEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        policy={editingPolicy}
        onSaved={() => mutate()}
      />

      <Dialog open={!!disableTarget} onClose={() => setDisableTarget(null)} title="Disable policy?">
        {disableTarget && (
          <>
            <p className="text-[13px] leading-relaxed text-ink-2">
              <span className="font-mono text-ink">{disableTarget.name}</span> will stop being evaluated against new
              session requests. Existing sessions are not affected. You can re-enable it later.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDisableTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={disablePolicy}>
                Disable policy
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}

function PolicyCard({
  policy: p,
  delay,
  onEdit,
  onDisable,
  onEnable,
}: {
  policy: Policy;
  delay: number;
  onEdit: () => void;
  onDisable: () => void;
  onEnable: () => void;
}) {
  const scope =
    p.scope.agentIds.length > 0
      ? `${p.scope.agentIds.length} specific agents`
      : Object.keys(p.scope.agentMetadata).length > 0
        ? Object.entries(p.scope.agentMetadata)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")
        : "All agents";

  const disabled = p.status === "disabled";
  const allowCount = p.rules.filter((r) => r.effect === "allow").length;
  const denyCount = p.rules.filter((r) => r.effect === "deny").length;

  const totalPerms = p.rules.reduce((sum, r) => sum + r.services.length * r.actions.length, 0);

  return (
    <Card className={cn("animate-rise overflow-hidden", disabled && "opacity-50")} style={{ animationDelay: `${delay}ms` }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-raised">
              <ShieldCheck size={15} className={disabled ? "text-muted" : "text-accent"} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[14px] font-semibold text-ink">{p.name}</span>
                {disabled && (
                  <span className="rounded-md bg-crit/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-[#e66767]">
                    disabled
                  </span>
                )}
              </div>
              {p.description && <p className="mt-0.5 text-[12px] leading-snug text-muted">{p.description}</p>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onEdit}
            className="cursor-pointer rounded-md p-1.5 text-muted transition-colors hover:bg-raised hover:text-ink"
            title="Edit policy"
          >
            <Pencil size={14} />
          </button>
          {disabled ? (
            <button
              onClick={onEnable}
              className="cursor-pointer rounded-md p-1.5 text-muted transition-colors hover:bg-good/15 hover:text-good"
              title="Re-enable"
            >
              <RotateCcw size={14} />
            </button>
          ) : (
            <button
              onClick={onDisable}
              className="cursor-pointer rounded-md p-1.5 text-muted transition-colors hover:bg-crit/15 hover:text-[#e66767]"
              title="Disable policy"
            >
              <Ban size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Meta strip — compact row with all key info */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line bg-page/40 px-5 py-1.5 text-[11px]">
        <span className="text-muted">P<span className="font-mono text-ink-2">{p.priority}</span></span>
        <span className="text-line-strong">·</span>
        <span className="text-muted">v<span className="font-mono text-ink-2">{p.version}</span></span>
        <span className="text-line-strong">·</span>
        {allowCount > 0 && <span className="font-mono text-good">{allowCount} allow</span>}
        {allowCount > 0 && denyCount > 0 && <span className="text-line-strong">·</span>}
        {denyCount > 0 && <span className="font-mono text-[#e66767]">{denyCount} deny</span>}
        <span className="text-line-strong">·</span>
        <span className="text-muted"><span className="font-mono text-ink-2">{totalPerms}</span> permissions</span>
        <span className="ml-auto text-muted">{scope}</span>
      </div>

      {/* Rules */}
      <div className="space-y-px border-t border-line">
        {p.rules.map((r, i) => {
          const permCount = r.services.length * r.actions.length;
          return (
            <div key={i} className="px-5 py-2.5">
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className={cn(
                    "rounded px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wider",
                    r.effect === "deny"
                      ? "bg-crit/15 text-[#e66767]"
                      : "bg-good/15 text-good"
                  )}
                >
                  {r.effect}
                </span>
                <span className="text-[10.5px] text-muted">
                  {permCount} permission{permCount !== 1 ? "s" : ""}
                </span>
                <div className="ml-auto font-mono text-[10.5px] text-muted">
                  <span className="text-ink-2/40">on </span>
                  <span className="text-ink-2/70" title={r.resources.join(", ")}>
                    {r.resources.length === 1 && r.resources[0] === "*"
                      ? "all resources"
                      : r.resources.length > 2
                        ? `${r.resources.length} resources`
                        : r.resources.join(", ")}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {r.services.flatMap((svc) =>
                  r.actions.map((a) => (
                    <span
                      key={`${svc}:${a}`}
                      className={cn(
                        "rounded px-2 py-0.5 font-mono text-[11px]",
                        r.effect === "deny"
                          ? "border border-crit/20 bg-crit/5 text-ink-2"
                          : "border border-good/20 bg-good/5 text-ink-2"
                      )}
                    >
                      {svc}:{a}
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Constraints footer — single compact row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-page/40 px-5 py-2 text-[11px]">
        <span><span className="text-muted">TTL </span><span className="font-mono text-ink-2">{fmtDuration(p.constraints.maxSessionDuration)}</span></span>
        <span><span className="text-muted">Escalations </span><span className="font-mono text-ink-2">{p.constraints.maxEscalationsPerSession}</span></span>
        <span><span className="text-muted">Regions </span><span className="font-mono text-ink-2">{p.constraints.allowedRegions.join(", ") || "Any"}</span></span>
      </div>
    </Card>
  );
}

