"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import type { Policy, PolicyRule, CreatePolicyInput } from "@/types/dashboard";
import { api } from "@/lib/api/client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const EMPTY_RULE: PolicyRule = { effect: "allow", services: [""], actions: ["*"], resources: ["*"] };

const EMPTY_FORM: CreatePolicyInput = {
  name: "",
  description: "",
  rules: [{ ...EMPTY_RULE }],
  scope: { agentIds: [], agentMetadata: {} },
  constraints: {
    maxSessionDuration: 3600,
    maxEscalationsPerSession: 3,
    maxConcurrentSessions: 5,
    allowedRegions: [],
  },
  priority: 0,
};

function policyToForm(p: Policy): CreatePolicyInput {
  return {
    name: p.name,
    description: p.description,
    rules: p.rules.map((r) => ({ ...r })),
    scope: { agentIds: [...p.scope.agentIds], agentMetadata: { ...p.scope.agentMetadata } },
    constraints: { ...p.constraints },
    priority: p.priority,
  };
}

export function PolicyEditorDialog({
  open,
  onClose,
  policy,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  policy?: Policy;
  onSaved: () => void;
}) {
  const editing = !!policy;
  const [form, setForm] = useState<CreatePolicyInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regionsText, setRegionsText] = useState("");

  // Re-initialise the form whenever the dialog opens for a different policy (or a new one).
  // Done during render rather than in an effect, so there's no extra render with stale values.
  const formKey = open ? `${policy?.policyId ?? "new"}:${policy?.version ?? 0}` : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (formKey !== loadedKey) {
    setLoadedKey(formKey);
    if (formKey) {
      setForm(policy ? policyToForm(policy) : { ...EMPTY_FORM, rules: [{ ...EMPTY_RULE }] });
      setRegionsText(policy ? policy.constraints.allowedRegions.join(", ") : "");
      setError(null);
    }
  }

  const updateRule = (idx: number, patch: Partial<PolicyRule>) => {
    const rules = [...form.rules];
    rules[idx] = { ...rules[idx], ...patch };
    setForm({ ...form, rules });
  };

  const addRule = () => setForm({ ...form, rules: [...form.rules, { ...EMPTY_RULE }] });

  const removeRule = (idx: number) => {
    if (form.rules.length <= 1) return;
    setForm({ ...form, rules: form.rules.filter((_, i) => i !== idx) });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: CreatePolicyInput = {
      ...form,
      rules: form.rules.map((r) => ({
        ...r,
        services: r.services.map((s) => s.trim()).filter(Boolean),
        actions: r.actions.map((a) => a.trim()).filter(Boolean),
        resources: r.resources.map((res) => res.trim()).filter(Boolean),
      })),
      constraints: {
        ...form.constraints,
        allowedRegions: regionsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
    };

    try {
      if (editing) {
        await api.updatePolicy(policy!.policyId, payload);
        toast.success(`Policy "${payload.name}" updated`);
      } else {
        await api.createPolicy(payload);
        toast.success(`Policy "${payload.name}" created`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const valid = form.name.trim().length > 0 && form.rules.length > 0 && form.rules.every((r) => r.services.some((s) => s.trim()));

  return (
    <Dialog open={open} onClose={onClose} title={editing ? "Edit policy" : "Create policy"} width={620}>
      <form onSubmit={submit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        {/* Name + Priority */}
        <div className="grid grid-cols-[1fr_100px] gap-3">
          <label className="block">
            <Label>Name</Label>
            <Input
              autoFocus
              placeholder="staging-lambda-deploy"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="font-mono"
            />
          </label>
          <label className="block">
            <Label hint="0–1000">Priority</Label>
            <Input
              type="number"
              min={0}
              max={1000}
              value={form.priority ?? 0}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            />
          </label>
        </div>

        {/* Description */}
        <label className="block">
          <Label>Description</Label>
          <Input
            placeholder="What this policy controls"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>

        {/* Rules */}
        <fieldset>
          <div className="mb-2 flex items-center justify-between">
            <Label>Rules</Label>
            <Button type="button" size="sm" variant="ghost" onClick={addRule}>
              <Plus size={13} /> Add rule
            </Button>
          </div>
          <div className="space-y-3">
            {form.rules.map((rule, idx) => (
              <RuleEditor
                key={idx}
                rule={rule}
                onChange={(patch) => updateRule(idx, patch)}
                onRemove={() => removeRule(idx)}
                canRemove={form.rules.length > 1}
              />
            ))}
          </div>
        </fieldset>

        {/* Constraints */}
        <fieldset>
          <Label>Constraints</Label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted">Max session (sec)</span>
              <Input
                type="number"
                min={60}
                max={43200}
                value={form.constraints?.maxSessionDuration ?? 3600}
                onChange={(e) =>
                  setForm({ ...form, constraints: { ...form.constraints, maxSessionDuration: Number(e.target.value) } })
                }
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted">Max escalations</span>
              <Input
                type="number"
                min={0}
                max={10}
                value={form.constraints?.maxEscalationsPerSession ?? 3}
                onChange={(e) =>
                  setForm({ ...form, constraints: { ...form.constraints, maxEscalationsPerSession: Number(e.target.value) } })
                }
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted">Max concurrent</span>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.constraints?.maxConcurrentSessions ?? 5}
                onChange={(e) =>
                  setForm({ ...form, constraints: { ...form.constraints, maxConcurrentSessions: Number(e.target.value) } })
                }
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-[11px] text-muted">Allowed regions (comma-separated, empty = all)</span>
            <Input
              placeholder="us-east-1, eu-west-1"
              value={regionsText}
              onChange={(e) => setRegionsText(e.target.value)}
            />
          </label>
        </fieldset>

        {error && <p className="rounded-md border border-crit/50 bg-crit/10 px-3 py-2 text-[12.5px] text-ink-2">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!valid || saving}>
            <ShieldCheck size={14} /> {saving ? "Saving…" : editing ? "Update policy" : "Create policy"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function RuleEditor({
  rule,
  onChange,
  onRemove,
  canRemove,
}: {
  rule: PolicyRule;
  onChange: (patch: Partial<PolicyRule>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-md border border-line-strong bg-page p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ effect: rule.effect === "allow" ? "deny" : "allow" })}
            className={cn(
              "cursor-pointer rounded px-2 py-0.5 font-mono text-[11px] font-medium uppercase transition-colors",
              rule.effect === "deny" ? "bg-crit/15 text-[#e66767]" : "bg-good/15 text-good"
            )}
          >
            {rule.effect}
          </button>
          <span className="text-[11px] text-muted">click to toggle</span>
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove} className="cursor-pointer rounded p-1 text-muted hover:bg-raised hover:text-crit">
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div className="grid gap-2">
        <label className="block">
          <span className="mb-0.5 block text-[11px] text-muted">Services (comma-separated)</span>
          <Input
            placeholder="lambda, s3, dynamodb"
            value={rule.services.join(", ")}
            onChange={(e) =>
              onChange({ services: e.target.value.split(",").map((s) => s.trim()) })
            }
            className="font-mono text-[12px]"
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] text-muted">Actions (comma-separated, * = all)</span>
          <Input
            placeholder="CreateFunction, UpdateFunctionCode"
            value={rule.actions.join(", ")}
            onChange={(e) =>
              onChange({ actions: e.target.value.split(",").map((s) => s.trim()) })
            }
            className="font-mono text-[12px]"
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] text-muted">Resources (comma-separated ARN patterns)</span>
          <Input
            placeholder="arn:aws:*:us-east-1:123456789012:*"
            value={rule.resources.join(", ")}
            onChange={(e) =>
              onChange({ resources: e.target.value.split(",").map((s) => s.trim()) })
            }
            className="font-mono text-[12px]"
          />
        </label>
      </div>
    </div>
  );
}
