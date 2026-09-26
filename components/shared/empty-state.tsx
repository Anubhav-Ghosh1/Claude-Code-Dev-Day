"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Inbox, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Inbox size={20} className="text-muted" />
      <div className="text-[13px] text-ink-2">{title}</div>
      {hint && <div className="max-w-xs text-[12px] text-muted">{hint}</div>}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="m-5 rounded-md border border-crit/40 bg-crit/10 px-4 py-3 text-[13px] text-ink-2">
      Couldn&apos;t load data: {error instanceof Error ? error.message : String(error)}
    </div>
  );
}

interface Step {
  label: string;
  detail?: string;
  code?: string;
}

interface ApiExample {
  method: string;
  url: string;
  body: string;
}

export function GuidedEmptyState({
  title,
  description,
  steps,
  cta,
  apiExample,
}: {
  title: string;
  description: string;
  steps: Step[];
  cta: { label: string; onClick: () => void };
  apiExample?: ApiExample;
}) {
  const [apiOpen, setApiOpen] = useState(false);

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-raised">
          <Inbox size={20} className="text-muted" />
        </div>
        <h3 className="text-[16px] font-semibold tracking-tight text-ink">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted">{description}</p>
      </div>

      <div className="mt-8 rounded-lg border border-line bg-surface px-5 py-4">
        <div className="eyebrow mb-3">How to get started</div>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong bg-raised font-mono text-[11px] text-ink-2">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="text-[13px] text-ink-2">{step.label}</div>
                {step.detail && (
                  <div className="mt-1 text-[12px] leading-relaxed text-muted">{step.detail}</div>
                )}
                {step.code && (
                  <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-page px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-2">
                    {step.code}
                  </pre>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-5 flex justify-center">
        <Button variant="primary" onClick={cta.onClick}>
          {cta.label}
        </Button>
      </div>

      {apiExample && (
        <div className="mt-6">
          <button
            onClick={() => setApiOpen(!apiOpen)}
            className="flex w-full cursor-pointer items-center gap-2 text-[12px] text-muted hover:text-ink-2"
          >
            {apiOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Terminal size={13} />
            Or use the API
          </button>
          {apiOpen && (
            <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-page px-4 py-3 font-mono text-[11px] leading-relaxed text-ink-2">
              {`curl -X ${apiExample.method} ${apiExample.url} \\\n  -H "Content-Type: application/json" \\\n  -d '${apiExample.body}'`}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
