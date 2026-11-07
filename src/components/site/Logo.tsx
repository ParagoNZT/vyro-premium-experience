import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("vyro-wordmark", className)} aria-label="VYRO Premium — accueil">
      <img src="/vyro-mark.svg" alt="" width="34" height="34" />
      <span>VYRO</span>
      <small>PREMIUM</small>
    </Link>
  );
}
