import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("group flex items-center gap-2.5", className)} aria-label="VYRO Premium — accueil">
      <span className="relative grid h-7 w-7 shrink-0 place-items-center">
        <span
          aria-hidden
          className="absolute inset-0 rounded-[8px] bg-primary/20 transition-colors duration-200 group-hover:bg-primary/30"
        />
        <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-primary" />
      </span>
      <span className="font-display text-[15px] font-semibold tracking-tight">
        VYRO<span className="text-muted-foreground"> Premium</span>
      </span>
    </Link>
  );
}
