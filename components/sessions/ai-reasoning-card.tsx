import { CheckCircle2, Sparkles, TriangleAlert } from "lucide-react";
import type { AiValidation } from "@/types/dashboard";
import { Card, CardHeader } from "@/components/ui/card";
import { PermissionLabel } from "@/components/shared/permission";

const SEVERITY_COLOR = { low: "text-muted", medium: "text-warn", high: "text-crit" } as const;

export function AiReasoningCard({ review }: { review?: AiValidation }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        eyebrow={review ? `Reviewed by ${review.model ?? "Claude"} · confidence ${Math.round(review.confidenceScore * 100)}%` : "AI review"}
        title={
          <span className="flex items-center gap-2">
            <Sparkles size={15} className="text-accent" /> Claude&apos;s reasoning
          </span>
        }
      />
      {!review ? (
        <p className="px-5 pb-5 text-[13px] text-muted">No AI review for this session — only policy rules were applied.</p>
      ) : (
        <>
          <div className="mx-5 mb-4 flex items-start gap-2.5">
            {review.approved ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-good" /> : <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />}
            <p className="text-[13.5px] leading-relaxed text-ink-2">
              <span className="text-ink">{review.approved ? "Looks reasonable. " : "Concerns raised. "}</span>
              {review.reasoning}
            </p>
          </div>
          {review.flaggedPermissions.length > 0 && (
            <ul className="divide-y divide-line border-t border-line">
              {review.flaggedPermissions.map((f, i) => (
                <li key={i} className="flex items-start gap-4 px-5 py-3">
                  <div className="w-56 shrink-0">
                    <PermissionLabel permission={f.permission} />
                  </div>
                  <TriangleAlert size={14} className={`mt-1 shrink-0 ${SEVERITY_COLOR[f.severity] ?? "text-warn"}`} />
                  <div className="min-w-0 text-[12.5px] leading-snug">
                    <div className="text-ink capitalize">{f.severity} concern</div>
                    <div className="text-muted">{f.concern}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {review.suggestedPermissions && review.suggestedPermissions.length > 0 && (
            <div className="border-t border-line px-5 py-3">
              <div className="eyebrow mb-2">Suggested narrower set</div>
              <div className="flex flex-wrap gap-1.5">
                {review.suggestedPermissions.map((p, i) => (
                  <span key={i} className="rounded bg-raised px-1.5 py-0.5 font-mono text-[11px] text-ink-2" title={p.resource}>
                    {p.service}:{p.action}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
