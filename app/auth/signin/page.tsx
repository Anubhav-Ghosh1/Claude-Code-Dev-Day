"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "signin" | "register";
// useSearchParams needs a Suspense boundary or the page can't be prerendered (breaks `next build`).
export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

/** Only same-site paths: never bounce a user to another origin after sign-in. */
function safeCallback(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/dashboard";
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallback(searchParams.get("callbackUrl"));

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setError("");
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    resetForm();
  };

  const handleSignIn = async (e: React.FormEvent) => {
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim(),
          // No role: self-registration must never choose its own role. New accounts are viewers;
          // an admin promotes them. (The API still accepts `role` — see docs/USER_LEVEL_ACCESS.md.)
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error?.message || "Registration failed");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl,
      });

      setLoading(false);

      if (result?.error) {
        setError("Account created but sign-in failed. Try signing in manually.");
        setMode("signin");
      } else if (result?.url) {
        router.push(result.url);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-[400px]">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl border border-line bg-surface">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="1" y="1" width="26" height="26" rx="6" stroke="#383835" />
              <circle cx="14" cy="14" r="7" stroke="#c3c2b7" strokeWidth="1.5" />
              <circle cx="14" cy="14" r="2" fill="#9085e9" />
              {[0, 60, 120, 180, 240, 300].map((a) => (
                <line
                  key={a}
                  x1="14"
                  y1="5.2"
                  x2="14"
                  y2="7"
                  stroke="#c3c2b7"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  transform={`rotate(${a} 14 14)`}
                />
              ))}
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">AgentVault</h1>
          <p className="mt-1 text-[13px] text-muted">Least-privilege credentials for AI agents</p>
        </div>

        {/* Mode toggle */}
        <div className="mb-6 flex rounded-lg border border-line bg-page p-1">
          {(["signin", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 rounded-md py-2 text-[13px] font-medium transition-colors cursor-pointer ${
                mode === m
                  ? "bg-[#9085e9] text-white shadow-sm"
                  : "text-muted hover:text-ink-2"
              }`}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={mode === "signin" ? handleSignIn : handleRegister} className="space-y-4">
          {mode === "register" && (
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Name</span>
              <input
                type="text"
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13px] text-ink outline-none transition-colors focus:border-[#9085e9] focus:ring-1 focus:ring-[#9085e9]/30"
                placeholder="Your name"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Email</span>
            <input
              type="email"
              autoFocus={mode === "signin"}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13px] text-ink outline-none transition-colors focus:border-[#9085e9] focus:ring-1 focus:ring-[#9085e9]/30"
              placeholder="admin@company.com"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Password</span>
            <input
              type="password"
              required
              minLength={mode === "register" ? 6 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13px] text-ink outline-none transition-colors focus:border-[#9085e9] focus:ring-1 focus:ring-[#9085e9]/30"
              placeholder={mode === "register" ? "Min. 6 characters" : "••••••••"}
            />
          </label>

          {mode === "register" && (
            <p className="text-[11.5px] leading-snug text-muted">New accounts start as viewers. An admin can grant more access.</p>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-lg bg-[#9085e9] text-[13px] font-medium text-white transition-colors hover:bg-[#7b6fd6] disabled:opacity-50 cursor-pointer"
          >
            {loading
              ? mode === "signin"
                ? "Signing in..."
                : "Creating account..."
              : mode === "signin"
                ? "Sign in"
                : "Create account & sign in"}
          </button>
        </form>

        {mode === "signin" && (
          <p className="mt-6 text-center text-[11px] text-muted">
            First time? Switch to <button onClick={() => switchMode("register")} className="text-[#9085e9] hover:underline cursor-pointer">Create account</button>
          </p>
        )}

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-3 text-[10px] tracking-[0.12em] uppercase text-muted">
          <span>Scoped credentials</span>
          <span className="text-line-strong">·</span>
          <span>Policy enforcement</span>
          <span className="text-line-strong">·</span>
          <span>Immutable audit trail</span>
        </div>
      </div>
    </div>
  );
}
