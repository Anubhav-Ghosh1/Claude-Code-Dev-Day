import Link from "next/link";
import { Inter } from "next/font/google";
import { AccessFlow, HashChain, LogoMark, StepIcon } from "@/components/landing/illustrations";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const STEPS = [
  { n: "01", icon: "signin", title: "Sign in", body: "You log in once from the terminal. Your agents act on your behalf." },
  { n: "02", icon: "declare", title: "Declare", body: "The agent states its task and the exact permissions it wants." },
  { n: "03", icon: "validate", title: "Check", body: "Anything beyond your limit or the agent’s is denied. Claude flags what the task doesn’t need." },
  { n: "04", icon: "issue", title: "Issue", body: "A token scoped to what was approved, valid for minutes, not months." },
  { n: "05", icon: "expire", title: "Expire", body: "Access ends when the task finishes or the timer runs out." },
] as const;

const PRINCIPLES = [
  { title: "Least privilege", body: "An agent never gets more than the person running it, and only what the task needs." },
  { title: "Time-bound", body: "Every credential carries its own expiry. There is nothing to remember to rotate." },
  { title: "Tamper-evident log", body: "Each audit entry includes the hash of the one before it, so any edit breaks the chain." },
  { title: "Tied to a person", body: "Every request records who signed in, so each action traces back to someone." },
];

const AUDIT = [
  { seq: "1042", action: "session.created", detail: "arun via s3-reader-agent", hash: "9f3a61c0" },
  { seq: "1043", action: "permission.denied", detail: "s3:DeleteObject", hash: "b27e04d9" },
  { seq: "1044", action: "credentials.issued", detail: "ttl 15m", hash: "4c18fa2e" },
  { seq: "1045", action: "session.completed", detail: "4m 12s", hash: "e05d7b13" },
];

export default function Home() {
  return (
    <div className={`${inter.className} min-h-screen bg-[#fafaf9] text-[#171717] antialiased`}>
      <header className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
          <LogoMark />
          AgentVault
        </Link>
        <nav className="flex items-center gap-7 text-[14px] text-[#525252]">
          <a href="#how" className="hidden hover:text-[#171717] sm:inline">
            How it works
          </a>
          <a href="#audit" className="hidden hover:text-[#171717] sm:inline">
            Audit
          </a>
          <Link href="/auth/signin?callbackUrl=/dashboard" className="hover:text-[#171717]">
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-[1080px] px-6 pt-16 pb-24 sm:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
          <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e7e5e4] bg-white py-1 pr-3 pl-2 text-[12.5px] text-[#525252]">
            <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden>
              <path d="M0 -6 C1.1 -1.1 1.1 -1.1 6 0 C1.1 1.1 1.1 1.1 0 6 C-1.1 1.1 -1.1 1.1 -6 0 C-1.1 -1.1 -1.1 -1.1 0 -6Z" fill="#d97757" />
            </svg>
            Policy engine + Claude review
          </div>
          <h1 className="max-w-[760px] text-[40px] leading-[1.08] font-semibold tracking-[-0.035em] sm:text-[56px]">
            Give AI agents the access they need. Nothing more.
          </h1>
          <p className="mt-6 max-w-[520px] text-[17px] leading-[1.6] text-[#525252]">
            AgentVault issues short-lived, scoped cloud credentials to AI agents, on behalf of the person who signed in.
            Every request is checked against your limits and reviewed by Claude, and every decision is logged.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center rounded-lg bg-[#171717] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#404040]"
            >
              Open dashboard
            </Link>
            <a
              href="#how"
              className="inline-flex h-11 items-center rounded-lg px-4 text-[14px] font-medium text-[#404040] transition-colors hover:bg-[#f0f0ee]"
            >
              How it works
            </a>
          </div>
          </div>
          <div className="-mx-2 sm:mx-0">
            <AccessFlow />
          </div>
          </div>

          {/* The product, not an illustration of it */}
          <div className="mt-20 overflow-hidden rounded-xl border border-[#e7e5e4] bg-white">
            <div className="flex items-center justify-between border-b border-[#f0efed] px-5 py-3 text-[12px] text-[#737373]">
              <span>Agent requests access</span>
              <span className="font-mono">POST /api/v1/sessions</span>
            </div>
            <div className="grid md:grid-cols-2">
              <pre className="overflow-x-auto border-b border-[#f0efed] p-5 font-mono text-[12.5px] leading-[1.75] text-[#404040] md:border-r md:border-b-0">
                {`{
  "gist": "Read reports/q3.csv and summarize it",
  "permissions": [
    "s3:GetObject",
    "s3:ListBucket",
    "s3:DeleteObject"
  ],
  "estimatedDuration": 900
}`}
              </pre>
              <div className="p-5 font-mono text-[12.5px] leading-[1.75]">
                <div className="text-[#737373]">201 Created</div>
                <dl className="mt-3 grid grid-cols-[88px_1fr] gap-y-2">
                  <dt className="text-[#a3a3a3]">granted</dt>
                  <dd className="text-[#171717]">s3:GetObject, s3:ListBucket</dd>
                  <dt className="text-[#a3a3a3]">denied</dt>
                  <dd className="text-[#171717]">
                    s3:DeleteObject
                    <span className="block font-sans text-[13px] text-[#737373]">Outside this agent’s limit. Claude agrees: reading a file doesn’t need delete.</span>
                  </dd>
                  <dt className="text-[#a3a3a3]">for</dt>
                  <dd className="text-[#171717]">arun@acme.dev · via CLI</dd>
                  <dt className="text-[#a3a3a3]">expires</dt>
                  <dd className="text-[#171717]">in 15 minutes</dd>
                  <dt className="text-[#a3a3a3]">logged</dt>
                  <dd className="text-[#171717]">#1044 · 4c18fa2e…</dd>
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-[#e7e5e4]">
          <div className="mx-auto max-w-[1080px] px-6 py-24">
            <h2 className="text-[13px] font-medium text-[#737373]">How it works</h2>
            <ol className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-7">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-[10px] border border-[#e7e5e4] bg-white text-[#171717]">
                      <StepIcon step={s.icon} />
                    </span>
                    <span className="font-mono text-[12px] text-[#a3a3a3]">{s.n}</span>
                  </div>
                  <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.01em]">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.6] text-[#525252]">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Principles + audit */}
        <section id="audit" className="border-t border-[#e7e5e4]">
          <div className="mx-auto grid max-w-[1080px] gap-16 px-6 py-24 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="max-w-[420px] text-[28px] leading-[1.2] font-semibold tracking-[-0.025em]">
                Every decision is on the record.
              </h2>
              <dl className="mt-10 space-y-7">
                {PRINCIPLES.map((p) => (
                  <div key={p.title}>
                    <dt className="text-[15px] font-medium">{p.title}</dt>
                    <dd className="mt-1 max-w-[440px] text-[15px] leading-[1.6] text-[#525252]">{p.body}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="self-start overflow-hidden rounded-xl border border-[#e7e5e4] bg-white">
              <div className="flex items-center justify-between border-b border-[#f0efed] px-5 py-3 text-[12px] text-[#737373]">
                <span>Audit log</span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-[#10b981]" />
                  Chain verified
                </span>
              </div>
              <div className="border-b border-[#f0efed] bg-[#fcfcfb] px-3 py-2">
                <HashChain />
              </div>
              <ol className="divide-y divide-[#f5f5f4] font-mono text-[12.5px]">
                {AUDIT.map((e) => (
                  <li key={e.seq} className="grid grid-cols-[52px_1fr_auto] items-baseline gap-4 px-5 py-3.5">
                    <span className="text-[#a3a3a3]">#{e.seq}</span>
                    <span className="min-w-0">
                      <span className="text-[#171717]">{e.action}</span>
                      <span className="block truncate text-[#737373]">{e.detail}</span>
                    </span>
                    <span className="text-[#a3a3a3]">{e.hash}…</span>
                  </li>
                ))}
              </ol>
              <p className="border-t border-[#f0efed] px-5 py-3 text-[12.5px] leading-[1.6] text-[#737373]">
                Each hash covers the previous entry. Change one line and every entry after it stops verifying.
              </p>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="border-t border-[#e7e5e4]">
          <div className="mx-auto flex max-w-[1080px] flex-col items-start justify-between gap-6 px-6 py-20 sm:flex-row sm:items-center">
            <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Start with one agent.</h2>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center rounded-lg bg-[#171717] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#404040]"
            >
              Open dashboard
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e7e5e4]">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-3 px-6 py-8 text-[13px] text-[#a3a3a3]">
          <span>AgentVault</span>
          <span>Built at Claude Code Dev Day, 2026</span>
        </div>
      </footer>
    </div>
  );
}
