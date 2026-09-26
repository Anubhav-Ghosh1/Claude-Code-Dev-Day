"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, TriangleAlert } from "lucide-react";
import type { RegisterAgentResult } from "@/types/dashboard";
import { api } from "@/lib/api/client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { CopyText } from "@/components/shared/copy-text";

const EMPTY = { name: "", description: "", team: "", environment: "staging", rpm: 30, maxSessions: 5 };

export function RegisterAgentDialog({ open, onClose, onRegistered }: { open: boolean; onClose: () => void; onRegistered: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const [result, setResult] = useState<RegisterAgentResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The key lives only in this component's state; closing the dialog drops it for good.
  const close = () => {
    setForm(EMPTY);
    setResult(null);
    setError(null);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.registerAgent({
        name: form.name.trim(),
        description: form.description.trim(),
        metadata: { ...(form.team && { team: form.team }), environment: form.environment },
        rateLimit: { maxRequestsPerMinute: form.rpm, maxActiveSessions: form.maxSessions },
      });
      setResult(res.data!);
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const valid = /^[a-z0-9][a-z0-9-]{2,63}$/.test(form.name.trim());

  return (
    <Dialog open={open} onClose={close} title={result ? "Agent registered" : "Register agent"} width={540}>
      {result ? (
        <ApiKeyReveal result={result} onDone={close} />
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <Label hint="lowercase, digits, dashes">Name</Label>
            <Input autoFocus placeholder="invoice-reader-agent" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="font-mono" />
          </label>
          <label className="block">
            <Label>Description</Label>
            <Input placeholder="What does this agent do?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <Label>Team</Label>
              <Input placeholder="finance" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} />
            </label>
            <label className="block">
              <Label>Environment</Label>
              <Select value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}>
                <option value="staging">staging</option>
                <option value="production">production</option>
              </Select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <Label>Requests / min</Label>
              <Input type="number" min={1} max={600} value={form.rpm} onChange={(e) => setForm({ ...form, rpm: Number(e.target.value) })} />
            </label>
            <label className="block">
              <Label>Max active sessions</Label>
              <Input type="number" min={1} max={50} value={form.maxSessions} onChange={(e) => setForm({ ...form, maxSessions: Number(e.target.value) })} />
            </label>
          </div>
          {error && <p className="rounded-md border border-crit/50 bg-crit/10 px-3 py-2 text-[12.5px] text-ink-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!valid || saving}>
              <KeyRound size={14} /> {saving ? "Registering…" : "Register & issue key"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function ApiKeyReveal({ result, onDone }: { result: RegisterAgentResult; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-md border border-warn/50 bg-warn/10 px-4 py-3">
        <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          <span className="text-ink">Copy this key now — it won&apos;t be shown again.</span> AgentVault only stores a bcrypt hash. Give it to{" "}
          <span className="font-mono text-ink">{result.name}</span> as the <span className="font-mono text-ink">X-API-Key</span> header.
        </p>
      </div>
      <div className="rounded-md border border-line-strong bg-page p-4">
        <div className="eyebrow mb-2">API key</div>
        <div className="font-mono text-[13px] break-all text-ink select-all">{result.apiKey}</div>
        <Button
          size="sm"
          className="mt-3"
          onClick={() => {
            navigator.clipboard.writeText(result.apiKey);
            setCopied(true);
            toast.success("API key copied");
          }}
        >
          {copied ? "Copied" : "Copy key"}
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-[12px]">
        <div>
          <dt className="text-muted">Agent ID</dt>
          <dd className="mt-0.5">
            <CopyText value={result.agentId} className="text-[12px]" />
          </dd>
        </div>
        <div>
          <dt className="text-muted">Key prefix (for lookup)</dt>
          <dd className="mt-0.5 font-mono text-ink-2">{result.apiKeyPrefix}</dd>
        </div>
      </dl>
      <div className="flex justify-end">
        <Button variant="primary" onClick={onDone}>
          I&apos;ve stored it — done
        </Button>
      </div>
    </div>
  );
}
