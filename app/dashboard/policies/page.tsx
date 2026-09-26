"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Ban, RotateCcw } from "lucide-react";
import { usePolicies } from "@/hooks/use-api";
import type { Policy } from "@/types/dashboard";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/empty-state";
import { PolicyEditorDialog } from "@/components/policies/policy-editor-dialog";
import { fmtDuration, cn } from "@/lib/utils";

export default function PoliciesPage() {
  const { data, error, mutate } = usePolicies();
  const sorted = data ? [...data].sort((a, b) => b.priority - a.priority) : undefined;
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | undefined>();
  const [disableTarget, setDisableTarget] = useState<Policy | null>(null);

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
      {error && <ErrorState error={error} />}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {!sorted && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-56 rounded-lg" />)}
        {sorted?.map((p, i) => (
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

  return (
    <Card className={cn("animate-rise px-5 py-4", disabled && "opacity-60")} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[14px] text-ink">{p.name}</span>
            {disabled && (
              <span className="rounded bg-muted/20 px-1.5 py-px text-[10px] font-medium uppercase text-muted">
                disabled
              </span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] text-muted">{p.description}</p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right font-mono text-[11px] text-muted">
            <div>
              priority <span className="text-ink-2">{p.priority}</span>
            </div>
            <div>v{p.version}</div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={onEdit}
              className="cursor-pointer rounded p-1.5 text-muted hover:bg-raised hover:text-ink"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            {disabled ? (
              <button
                onClick={onEnable}
                className="cursor-pointer rounded p-1.5 text-muted hover:bg-good/15 hover:text-good"
                title="Re-enable"
              >
                <RotateCcw size={13} />
              </button>
            ) : (
              <button
                onClick={onDisable}
                className="cursor-pointer rounded p-1.5 text-muted hover:bg-crit/15 hover:text-[#e66767]"
                title="Disable"
              >
                <Ban size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {p.rules.map((r, i) => (
          <li key={i} className="flex items-start gap-3 rounded-md border border-line bg-page px-3 py-2">
            <span
              className={cn(
                "mt-px rounded px-1.5 py-px font-mono text-[10.5px] font-medium uppercase",
                r.effect === "deny" ? "bg-crit/15 text-[#e66767]" : "bg-good/15 text-good"
              )}
            >
              {r.effect}
            </span>
            <div className="min-w-0 space-y-1 font-mono text-[11.5px]">
              <div className="flex flex-wrap gap-1">
                {r.services.flatMap((svc) =>
                  r.actions.map((a) => (
                    <span key={`${svc}:${a}`} className="rounded bg-raised px-1.5 text-ink-2">
                      {svc}:{a}
                    </span>
                  ))
                )}
              </div>
              <div className="truncate text-muted" title={r.resources.join(", ")}>
                on {r.resources.join(", ")}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-[11.5px] text-muted">
        <span>
          scope <span className="text-ink-2">{scope}</span>
        </span>
        <span>
          max TTL <span className="text-ink-2">{fmtDuration(p.constraints.maxSessionDuration)}</span>
        </span>
        <span>
          escalations <span className="text-ink-2">{p.constraints.maxEscalationsPerSession}</span>
        </span>
        <span>
          regions <span className="text-ink-2">{p.constraints.allowedRegions.join(", ") || "any"}</span>
        </span>
      </div>
    </Card>
  );
}
