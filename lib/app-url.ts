/**
 * Public base URL for links and snippets shown to users (curl, CLAUDE.md).
 * Set NEXT_PUBLIC_APP_URL (e.g. https://agentvault.example.com) so they always use the
 * real domain; otherwise fall back to the address the dashboard is being viewed on.
 */
export function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return typeof window === "undefined" ? "" : window.location.origin;
}
