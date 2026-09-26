"use client";

import useSWR from "swr";
import { api } from "@/lib/api/client";
import type { AnalyticsRange, AuditLogFilters, SessionFilters } from "@/types/dashboard";

/** Live views poll; SWR keeps the previous data on screen while refetching. */
export const LIVE_INTERVAL = 3000;
const live = { refreshInterval: LIVE_INTERVAL, keepPreviousData: true };

export function useAnalytics(range: AnalyticsRange) {
  return useSWR(["analytics", range], () => api.getAnalytics(range).then((r) => r.data!), live);
}

export function useSessions(filters: SessionFilters) {
  return useSWR(["sessions", filters], () => api.listSessions(filters), live);
}

export function useSession(id: string) {
  return useSWR(["session", id], () => api.getSession(id).then((r) => r.data!), live);
}

export function useAuditLogs(filters: AuditLogFilters) {
  return useSWR(["audit", filters], () => api.listAuditLogs(filters), live);
}

export function useAgents() {
  return useSWR("agents", () => api.listAgents().then((r) => r.data ?? []), live);
}

export function usePolicies() {
  return useSWR("policies", () => api.listPolicies().then((r) => r.data ?? []));
}
