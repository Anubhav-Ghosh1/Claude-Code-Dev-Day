"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "signin" | "register";
type Role = "admin" | "auditor" | "viewer";

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "admin", label: "Admin", description: "Full access — manage agents, policies, sessions" },
  { value: "auditor", label: "Auditor", description: "Read-only — view everything, export audit logs" },
  { value: "viewer", label: "Viewer", description: "Limited — view sessions and agents only" },
];

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setRole("viewer");
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
          role,
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
            <fieldset>
              <legend className="mb-2 text-[12px] font-medium text-ink-2">Role</legend>
              <div className="space-y-2">
                {ROLES.map((r) => (
                  <label
                    key={r.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-2.5 transition-colors ${
                      role === r.value
                        ? "border-[#9085e9]/60 bg-[#9085e9]/10"
                        : "border-line-strong hover:border-line-strong hover:bg-surface"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={role === r.value}
                      onChange={() => setRole(r.value)}
                      className="mt-0.5 accent-[#9085e9]"
                    />
                    <div>
                      <span className="text-[13px] font-medium text-ink">{r.label}</span>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{r.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>
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
            First time? Switch to <button onClick={() => switchMode("register")} className="text-[#9085e9] hover:underline cursor-pointer">Create account</button> or run{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10.5px] text-ink-2">npm run seed:admin</code>
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
