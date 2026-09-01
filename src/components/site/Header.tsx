import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const NAV = [
  { to: "/", label: "Accueil" },
  { to: "/fonctionnalites", label: "Fonctionnalités" },
  { to: "/appareils", label: "Appareils" },
  { to: "/tarifs", label: "Tarifs" },
  { to: "/faq", label: "FAQ" },
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "transition-all duration-200",
          scrolled
            ? "border-b border-border bg-background/70 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 md:grid-cols-[1fr_auto_1fr] md:px-8">
          <div className="flex min-w-0 items-center">
            <Logo />
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="rounded-[8px] px-3 py-1.5 text-[13.5px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center justify-end gap-2">
            <Link
              to={user ? "/account" : "/login"}
              className="hidden rounded-[8px] px-3 py-1.5 text-[13.5px] text-muted-foreground transition-colors duration-150 hover:text-foreground md:inline-flex"
            >
              {user ? "Mon compte" : "Se connecter"}
            </Link>
            <Link
              to="/tarifs"
              className="hidden rounded-[10px] bg-primary px-4 py-2 text-[13.5px] font-medium text-primary-foreground transition-all duration-200 hover:brightness-115 hover:shadow-[0_0_28px_-8px_var(--primary)] md:inline-flex"
            >
              Obtenir VYRO Premium
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={open}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-foreground transition-colors duration-150 hover:bg-surface-2 md:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div className="h-[calc(100dvh-60px)] overflow-y-auto border-b border-border bg-background/95 px-5 pb-10 pt-4 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="border-b border-border/60 py-4 text-lg text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to={user ? "/account" : "/login"}
              onClick={() => setOpen(false)}
              className="border-b border-border/60 py-4 text-lg text-foreground"
            >
              {user ? "Mon compte" : "Se connecter"}
            </Link>
          </nav>
          <Link
            to="/tarifs"
            onClick={() => setOpen(false)}
            className="mt-6 flex items-center justify-center rounded-[10px] bg-primary px-5 py-3 font-medium text-primary-foreground"
          >
            Obtenir VYRO Premium
          </Link>
        </div>
      ) : null}
    </header>
  );
}
