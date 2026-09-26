import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtNum(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function fmtPct(ratio: number, digits = 1) {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** 252 → "4m 12s", 3600 → "1h 0m", 42 → "42s" */
export function fmtDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return s % 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s / 60}m`;
  const m = Math.floor((s % 3600) / 60);
  return m ? `${Math.floor(s / 3600)}h ${m}m` : `${Math.floor(s / 3600)}h`;
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function shortHash(hash: string, n = 12) {
  return hash.slice(0, n);
}

/** "arn:aws:s3:::demo-bucket/reports/*" → "demo-bucket/reports/*" */
export function shortArn(arn: string) {
  if (arn === "*") return "* (all resources)";
  const parts = arn.split(":");
  return parts.length >= 6 ? parts.slice(5).join(":") || arn : arn;
}

/** "ASIAE29DW9ILENQV77HN" → "ASIA••••77HN". For identifiers that shouldn't be shown in full. */
export function maskSecret(value: string, keep = 4) {
  if (value.length <= keep * 2) return "•".repeat(value.length);
  return `${value.slice(0, keep)}••••${value.slice(-keep)}`;
}
