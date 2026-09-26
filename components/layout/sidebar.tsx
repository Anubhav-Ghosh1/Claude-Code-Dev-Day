"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, FileLock2, LayoutDashboard, LogOut, ScrollText, ShieldCheck } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useSessions } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/sessions", label: "Sessions", icon: FileLock2 },
  { href: "/dashboard/audit", label: "Audit log", icon: ScrollText },
  { href: "/dashboard/agents", label: "Agents", icon: Bot },
  { href: "/dashboard/policies", label: "Policies", icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data } = useSessions({ status: "active", limit: 1 });
  const active = data?.pagination?.total;

  return (
    <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-line bg-page/80 backdrop-blur">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-5 pt-5 pb-6">
        <VaultMark />
        <div>
          <div className="text-[15px] font-semibold tracking-tight">AgentVault</div>
          <div className="eyebrow !text-[9.5px]">credential broker</div>
        </div>
      </Link>

      <nav className="flex flex-col gap-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const on = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] transition-colors",
                on ? "bg-raised text-ink" : "text-muted hover:bg-surface hover:text-ink-2",
              )}
            >
              {on && <span className="absolute top-2 bottom-2 -left-3 w-0.5 rounded-r bg-ink" />}
              <Icon size={16} strokeWidth={1.75} />
              {label}
              {label === "Sessions" && active !== undefined && active > 0 && (
                <span className="tabular ml-auto flex items-center gap-1.5 font-mono text-[11px] text-ink-2">
                  <span className="size-1.5 rounded-full bg-good" />
                  {active}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 p-4">
        <UserBlock />
      </div>
    </aside>
  );
}

function UserBlock() {
  const { data: session } = useSession();
  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role || "viewer";
  const initials = (user?.name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2.5 px-1">
      <div className="flex size-7 items-center justify-center rounded-full bg-raised font-mono text-[11px] text-ink-2">
        {initials}
      </div>
      <div className="min-w-0 flex-1 text-[12px] leading-tight">
        <div className="truncate text-ink-2">{user?.name || "User"}</div>
        <div className="text-muted">{role}</div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/auth/signin" })}
        className="rounded p-1 text-muted transition-colors hover:bg-surface hover:text-ink-2"
        title="Sign out"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}

function VaultMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
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
  );
}
