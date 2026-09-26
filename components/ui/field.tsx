import { cn } from "@/lib/utils";

const control =
  "h-9 w-full rounded-md border border-line-strong bg-page px-3 text-[13px] text-ink placeholder:text-muted focus:border-accent focus:outline-none";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "cursor-pointer pr-8", className)} {...props} />;
}

export function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between text-[12px] text-ink-2">
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </span>
  );
}
