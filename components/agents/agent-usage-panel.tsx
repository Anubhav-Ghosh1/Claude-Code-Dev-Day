"use client";

import { useState } from "react";
import { Download, FileText, KeyRound, TriangleAlert } from "lucide-react";
import type { Agent, Policy } from "@/types/dashboard";
import { claudeMd, curlSnippets, samplePermission } from "@/lib/agent-guide";
import { appUrl } from "@/lib/app-url";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { CodeBlock } from "@/components/shared/code-block";

type View = "curl" | "claude";

/** Expanded agent row: how to call AgentVault as this agent, plus a CLAUDE.md for their repo. */
export function AgentUsagePanel({ agent, policies }: { agent: Agent; policies?: Policy[] }) {
  const [view, setView] = useState<View>("curl");
  // Pasted key lives only in this component's memory: never stored, never sent to the server.
  const [apiKey, setApiKey] = useState("");
  const baseUrl = appUrl();
  const sample = samplePermission(policies);
  const keyOk = /^avk_(live|test)_[A-Za-z0-9]{8,}$/.test(apiKey.trim());
  const keyMismatch = keyOk && !apiKey.trim().startsWith(agent.apiKeyPrefix);
  const c = curlSnippets(baseUrl, agent, sample, { apiKey: keyOk && !keyMismatch ? apiKey.trim() : undefined });

  const download = () => {
    const blob = new Blob([claudeMd(baseUrl, agent, sample)], { type: "text/markdown" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "CLAUDE.md" });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4 px-5 py-5">
      {agent.status !== "active" && (
        <div className="flex gap-2.5 rounded-md border border-warn/50 bg-warn/10 px-3.5 py-2.5 text-[12.5px] text-ink-2">
          <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warn" />
          This agent is {agent.status}. Its requests are rejected until it&apos;s active again.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<View>
          label="Usage guide view"
          value={view}
          onChange={setView}
          options={[
            { value: "curl", label: "curl" },
            { value: "claude", label: "CLAUDE.md" },
          ]}
        />
        <Button size="sm" onClick={download}>
          <Download size={13} /> Download CLAUDE.md
        </Button>
      </div>

      {view === "curl" ? (
        <>
          <div className="rounded-md border border-line bg-page px-4 py-3">
            <label className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 text-[12.5px] text-ink-2">
                <KeyRound size={14} className="text-muted" /> Agent key
              </span>
              <Input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Paste the key starting with ${agent.apiKeyPrefix}`}
                className="h-8 max-w-sm flex-1 font-mono text-[12px]"
              />
            </label>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
              {keyMismatch
                ? `That key belongs to a different agent. This one starts with ${agent.apiKeyPrefix}.`
                : keyOk
                  ? "Key filled into the commands below. It stays in this page only and is never saved or sent."
                  : "The key is the only credential the agent needs. It was shown once at registration; paste it to fill the commands. Lost it? Revoke this agent and register a new one."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <div className="min-w-0 space-y-3">
              <CodeBlock label="1 · Open a session for the task" code={c.request} />
              <CodeBlock label="2 · Call AWS through AgentVault" code={c.awsCall} />
            </div>
            <div className="min-w-0 space-y-3">
              <CodeBlock label="3 · Ask for more access (optional)" code={c.escalate} />
              <CodeBlock label="4 · Finish — always" code={c.complete} />
              <p className="text-[12px] leading-relaxed text-muted">
                No AWS keys involved: AgentVault makes each AWS call itself, only within what the session allows. Needs{" "}
                <code className="font-mono text-ink-2">curl</code> and <code className="font-mono text-ink-2">jq</code>.
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-2">
            <FileText size={15} className="mt-0.5 shrink-0 text-muted" />
            Put this file in the root of the repo the agent works in. Claude Code reads <code className="font-mono">CLAUDE.md</code>{" "}
            automatically. It reads the key from <code className="font-mono">AGENTVAULT_API_KEY</code> instead of containing it, so it&apos;s
            safe to commit.
          </p>
          <CodeBlock label="CLAUDE.md" code={claudeMd(baseUrl, agent, sample)} maxHeight={440} />
        </div>
      )}
    </div>
  );
}
