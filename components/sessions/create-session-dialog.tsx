"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, KeyRound, Copy, Check, Eye, EyeOff, TriangleAlert } from "lucide-react";
import type { Agent, PermissionEntry, DashboardSessionResult } from "@/types/dashboard";
import { api } from "@/lib/api/client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { maskSecret } from "@/lib/utils";

const EMPTY_PERM: PermissionEntry = {
  service: "",
  action: "",
  resource: "",
  effect: "Allow",
};

export function CreateSessionDialog({
  open,
  onClose,
  agents,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  agents: Agent[];
  onCreated: () => void;
}) {
  const [agentId, setAgentId] = useState("");
  const [gist, setGist] = useState("");
  const [permissions, setPermissions] = useState<PermissionEntry[]>([{ ...EMPTY_PERM }]);
  const [duration, setDuration] = useState(1800);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DashboardSessionResult | null>(null);

  const activeAgents = agents.filter((a) => a.status === "active");

  const close = () => {
    setAgentId("");
    setGist("");
    setPermissions([{ ...EMPTY_PERM }]);
    setDuration(1800);
    setResult(null);
    setError(null);
    onClose();
  };

  const updatePerm = (idx: number, patch: Partial<PermissionEntry>) => {
    const next = [...permissions];
    next[idx] = { ...next[idx], ...patch };
    setPermissions(next);
  };

  const addPerm = () => setPermissions([...permissions, { ...EMPTY_PERM }]);

  const removePerm = (idx: number) => {
    if (permissions.length <= 1) return;
    setPermissions(permissions.filter((_, i) => i !== idx));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const cleaned = permissions
      .map((p) => ({ ...p, service: p.service.trim(), action: p.action.trim(), resource: p.resource.trim() }))
      .filter((p) => p.service && p.action && p.resource);

    if (!cleaned.length) {
      setError("Add at least one permission");
      setSaving(false);
      return;
    }

    try {
      const res = await api.createSession({
        agentId,
        gist: gist.trim(),
        permissions: cleaned,
        estimatedDuration: duration,
      });
      setResult(res.data!);
      onCreated();
      toast.success(`Session ${res.data!.sessionId} created`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const valid = agentId && gist.trim().length > 0 && permissions.some((p) => p.service.trim() && p.action.trim() && p.resource.trim());

  return (
    <Dialog open={open} onClose={close} title={result ? "Session created" : "Create credential session"} width={660}>
      {result ? (
        <CredentialReveal result={result} onDone={close} />
      ) : (
        <form onSubmit={submit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {/* Agent selector */}
          <label className="block">
            <Label>Agent</Label>
            <Select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">Select an agent…</option>
              {activeAgents.map((a) => (
                <option key={a.agentId} value={a.agentId}>
                  {a.name} ({a.agentId})
                </option>
              ))}
            </Select>
          </label>

          {/* Gist */}
          <label className="block">
            <Label hint="What is the agent doing?">Gist</Label>
            <Input
              placeholder="Deploy user-service Lambda with DynamoDB table for user profiles"
              value={gist}
              onChange={(e) => setGist(e.target.value)}
            />
          </label>

          {/* Duration */}
          <label className="block">
            <Label hint="60–43200 seconds">Estimated duration (seconds)</Label>
            <Input
              type="number"
              min={60}
              max={43200}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </label>

          {/* Permissions */}
          <fieldset>
            <div className="mb-2 flex items-center justify-between">
              <Label>Permissions</Label>
              <Button type="button" size="sm" variant="ghost" onClick={addPerm}>
                <Plus size={13} /> Add permission
              </Button>
            </div>
            <div className="space-y-3">
              {permissions.map((perm, idx) => (
                <div key={idx} className="rounded-md border border-line-strong bg-page p-3">
                  <div className="mb-2 flex justify-end">
                    {permissions.length > 1 && (
                      <button type="button" onClick={() => removePerm(idx)} className="cursor-pointer rounded p-1 text-muted hover:bg-raised hover:text-crit">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="block">
                      <span className="mb-0.5 block text-[11px] text-muted">Service</span>
                      <Input
                        placeholder="lambda"
                        value={perm.service}
                        onChange={(e) => updatePerm(idx, { service: e.target.value })}
                        className="font-mono text-[12px]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-0.5 block text-[11px] text-muted">Action</span>
                      <Input
                        placeholder="CreateFunction"
                        value={perm.action}
                        onChange={(e) => updatePerm(idx, { action: e.target.value })}
                        className="font-mono text-[12px]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-0.5 block text-[11px] text-muted">Resource (ARN)</span>
                      <Input
                        placeholder="arn:aws:lambda:us-east-1:123456789012:function:*"
                        value={perm.resource}
                        onChange={(e) => updatePerm(idx, { resource: e.target.value })}
                        className="font-mono text-[12px]"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          {error && <p className="rounded-md border border-crit/50 bg-crit/10 px-3 py-2 text-[12.5px] text-ink-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!valid || saving}>
              <KeyRound size={14} /> {saving ? "Creating…" : "Create session"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function CredentialReveal({ result, onDone }: { result: DashboardSessionResult; onDone: () => void }) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const copyField = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyAll = () => {
    const text = [
      `AWS_ACCESS_KEY_ID=${result.credentials.accessKeyId}`,
      `AWS_SECRET_ACCESS_KEY=${result.credentials.secretAccessKey}`,
      `AWS_SESSION_TOKEN=${result.credentials.sessionToken}`,
      `AWS_DEFAULT_REGION=${result.credentials.region}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopiedField("all");
    toast.success("All credentials copied as env vars");
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border border-good/50 bg-good/10 px-4 py-3">
        <Check size={16} className="mt-0.5 shrink-0 text-good" />
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          Session <span className="font-mono text-ink">{result.sessionId}</span> created.
          {result._mock && <span className="ml-1 text-warn">(mock credentials)</span>}
        </p>
      </div>

      <div className="flex gap-3 rounded-md border border-warn/50 bg-warn/10 px-4 py-3">
        <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          <span className="text-ink">These credentials are shown once.</span> Copy them now. Closing this dialog clears them.
        </p>
      </div>

      <div className="rounded-md border border-line-strong bg-page p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase text-muted">Credentials</span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setRevealed((r) => !r)}>
              {revealed ? <EyeOff size={13} /> : <Eye size={13} />} {revealed ? "Hide" : "Reveal"}
            </Button>
            <Button size="sm" variant="ghost" onClick={copyAll}>
              {copiedField === "all" ? <Check size={13} /> : <Copy size={13} />} Copy all as env
            </Button>
          </div>
        </div>
        {[
          { label: "Access Key ID", value: result.credentials.accessKeyId, secret: false },
          { label: "Secret Access Key", value: result.credentials.secretAccessKey, secret: true },
          { label: "Session Token", value: result.credentials.sessionToken, secret: true },
        ].map(({ label, value, secret }) => (
          <div key={label}>
            <div className="mb-0.5 flex items-center justify-between">
              <span className="text-[11px] text-muted">{label}</span>
              <button
                onClick={() => copyField(label, value)}
                aria-label={`Copy ${label}`}
                className="cursor-pointer rounded p-0.5 text-muted hover:text-ink"
              >
                {copiedField === label ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
            <div className="break-all rounded bg-raised px-2 py-1 font-mono text-[11.5px] text-ink-2 select-all">
              {secret && !revealed ? maskSecret(value) : value}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3 text-[11.5px]">
          <div>
            <span className="text-muted">Region</span>
            <div className="font-mono text-ink-2">{result.credentials.region}</div>
          </div>
          <div>
            <span className="text-muted">Expires</span>
            <div className="font-mono text-ink-2">{new Date(result.credentials.expiration).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {result.deniedPermissions.length > 0 && (
        <div className="rounded-md border border-warn/50 bg-warn/10 px-3 py-2 text-[12px] text-ink-2">
          <span className="font-medium text-ink">{result.deniedPermissions.length} permission(s) denied</span>
          <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-muted">
            {result.deniedPermissions.map((d, i) => (
              <li key={i}>{d.permission.service}:{d.permission.action} — {d.reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="primary" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
