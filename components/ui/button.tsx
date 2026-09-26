import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-ink text-page hover:bg-ink-2",
        outline: "border border-line-strong text-ink-2 hover:bg-raised hover:text-ink",
        ghost: "text-ink-2 hover:bg-raised hover:text-ink",
        danger: "border border-crit/60 text-ink hover:bg-crit/15",
      },
      size: { sm: "h-7 px-2.5", md: "h-9 px-3.5" },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}
