"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle2, ShieldAlert, Terminal, XCircle } from "lucide-react";
import type { CliDeviceRequest } from "@/types/dashboard";
import { api } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/errors";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { fmtDateTime } from "@/lib/utils";

/**
 * Device-flow approval: `agentvault login` prints a short code and opens this page.
 * The signed-in user confirms the code matches their terminal, then approves it.
 * Backend endpoints: docs/USER_LEVEL_ACCESS.md.
 */
export default function CliAuthorizePage() {
  return (
    <Suspense>
      <Authorize />
    </Suspense>
  );
}

type State =
  | { step: "enter" }
  | { step: "confirm"; device: CliDeviceRequest }
  | { step: "done"; approved: boolean }
  | { step: "error"; message: string };

const CODE = /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/;

function describe(e: unknown) {
  if (e instanceof ApiClientError) {
    if (e.code === "HTTP_ERROR" && e.status === 404) return "CLI sign-in isn’t enabled on this server yet.";
    if (e.status === 404 || e.status === 410) return "That code isn’t valid or has expired. Run agentvault login again.";
    return e.message;
  }
  return "Something went wrong. Try again.";
}

function Authorize() {
  const params = useSearchParams();
  const { data: auth } = useSession();
  const initial = (params.get("code") ?? "").toUpperCase();
  const [code, setCode] = useState(initial);
  const [state, setState] = useState<State>({ step: "enter" });
  const [busy, setBusy] = useState(false);

  const lookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const res = await api.cli.lookupDevice(code.trim());
      setState({ step: "confirm", device: res.data! });
    } catch (err) {
      setState({ step: "error", message: describe(err) });
    } finally {
      setBusy(false);
    }
  };

  const decide = async (approve: boolean, device: CliDeviceRequest) => {
    setBusy(true);
    try {
      await (approve ? api.cli.approveDevice(device.userCode) : api.cli.denyDevice(device.userCode));
      setState({ step: "done", approved: approve });
    } catch (err) {
      setState({ step: "error", message: describe(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[460px] pt-10">
      <Card className="px-7 py-7">
        <div className="mb-5 flex size-10 items-center justify-center rounded-lg border border-line bg-page text-ink-2">
          <Terminal size={18} />
        </div>

        {state.step === "enter" && (
          <form onSubmit={lookup}>
            <h1 className="text-[18px] font-semibold tracking-tight">Connect a terminal</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              Enter the code shown by <code className="font-mono text-ink-2">agentvault login</code>.
            </p>
            <Input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              maxLength={9}
              aria-label="Device code"
              className="mt-5 h-11 text-center font-mono text-[17px] tracking-[0.2em]"
            />
            <Button type="submit" variant="primary" className="mt-4 w-full" disabled={!CODE.test(code.trim()) || busy}>
              {busy ? "Checking…" : "Continue"}
            </Button>
          </form>
        )}

        {state.step === "confirm" && (
          <>
            <h1 className="text-[18px] font-semibold tracking-tight">Allow this terminal?</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              Agents started from it will request credentials as{" "}
              <span className="text-ink-2">{auth?.user?.email ?? "you"}</span>, and can never get more access than you have.
            </p>
            <div className="mt-5 rounded-lg border border-line bg-page px-4 py-3.5 text-center">
              <div className="eyebrow">Check this matches your terminal</div>
              <div className="mt-1.5 font-mono text-[22px] tracking-[0.2em] text-ink">{state.device.userCode}</div>
            </div>
            <dl className="mt-4 grid grid-cols-[88px_1fr] gap-y-1.5 text-[12.5px]">
              <dt className="text-muted">Client</dt>
              <dd className="text-ink-2">{state.device.clientName}</dd>
              <dt className="text-muted">Requested</dt>
              <dd className="text-ink-2">{fmtDateTime(state.device.requestedAt)}</dd>
            </dl>
            <p className="mt-4 flex gap-2 text-[12px] leading-relaxed text-muted">
              <ShieldAlert size={14} className="mt-0.5 shrink-0 text-warn" />
              Only approve a code you started yourself. Never approve one someone sent you.
            </p>
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" onClick={() => decide(false, state.device)} disabled={busy}>
                Deny
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => decide(true, state.device)} disabled={busy}>
                Allow
              </Button>
            </div>
          </>
        )}

        {state.step === "done" && (
          <div className="text-center">
            {state.approved ? (
              <CheckCircle2 size={28} className="mx-auto text-good" />
            ) : (
              <XCircle size={28} className="mx-auto text-muted" />
            )}
            <h1 className="mt-3 text-[18px] font-semibold tracking-tight">{state.approved ? "Terminal connected" : "Request denied"}</h1>
            <p className="mt-1.5 text-[13px] text-muted">
              {state.approved ? "You can close this tab and return to your terminal." : "The terminal was not given access."}
            </p>
          </div>
        )}

        {state.step === "error" && (
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight">Couldn’t connect</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{state.message}</p>
            <Button className="mt-5 w-full" onClick={() => setState({ step: "enter" })}>
              Try another code
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
