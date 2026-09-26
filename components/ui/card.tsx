import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({
  eyebrow,
  title,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h3 className="text-[15px] font-medium tracking-tight text-ink">{title}</h3>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
