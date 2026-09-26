"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else if (result?.url) {
      router.push(result.url);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl border border-line bg-surface">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <rect x="1" y="1" width="26" height="26" rx="6" stroke="#383835" />
              <circle cx="14" cy="14" r="7" stroke="#c3c2b7" strokeWidth="1.5" />
              <circle cx="14" cy="14" r="2" fill="#9085e9" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">AgentVault</h1>
          <p className="mt-1 text-[13px] text-muted">Sign in to the dashboard</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Email</span>
            <input
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13px] text-ink outline-none transition-colors focus:border-ink-2 focus:ring-1 focus:ring-ink-2/30"
              placeholder="admin@company.com"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13px] text-ink outline-none transition-colors focus:border-ink-2 focus:ring-1 focus:ring-ink-2/30"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-lg bg-[#9085e9] text-[13px] font-medium text-white transition-colors hover:bg-[#7b6fd6] disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-muted">
          First time? Run <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10.5px] text-ink-2">npm run seed:admin</code> to create the admin account.
        </p>
      </div>
    </div>
  );
}
