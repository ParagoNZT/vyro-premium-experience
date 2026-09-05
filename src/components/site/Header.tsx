import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "./Button";
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
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3 md:px-6 md:pt-4">
      <div
        className={cn(
          "mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-full border px-3 py-2 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)] transition-all duration-300",
          scrolled
            ? "border-primary/15 bg-primary/10 backdrop-blur-2xl"
            : "border-white/8 bg-gradient-to-r from-primary/8 via-primary/4 to-transparent",
        )}
      >
        <div className="flex min-w-0 items-center pl-1">
          <Logo />
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Button
              key={item.to}
              to={item.to}
              variant="nav"
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Button>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <Button
            to={user ? "/account" : "/login"}
            variant="ghost"
            size="sm"
            className="hidden md:inline-flex"
          >
            {user ? "Mon compte" : "Se connecter"}
          </Button>
          <Button
            to="/tarifs"
            variant="primary"
            size="sm"
            className="hidden md:inline-flex"
          >
            Obtenir VYRO Premium
          </Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-foreground transition-colors duration-150 hover:bg-primary/15 md:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mx-4 mt-2 overflow-hidden rounded-2xl border border-primary/15 bg-primary/10 px-4 py-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl md:hidden">
          <nav className="flex flex-col">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="group relative rounded-xl border-b border-white/6 px-2 py-3.5 text-base text-foreground transition-all duration-200 hover:-translate-x-0.5 hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_24px_-16px_var(--color-primary)]"
              >
                {item.label}
                <span className="absolute bottom-3 left-2 h-[1px] w-0 bg-primary transition-all duration-300 group-hover:w-4" />
              </Link>
            ))}
            <Link
              to={user ? "/account" : "/login"}
              onClick={() => setOpen(false)}
              className="group relative rounded-xl border-b border-white/6 px-2 py-3.5 text-base text-foreground transition-all duration-200 hover:-translate-x-0.5 hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_24px_-16px_var(--color-primary)]"
            >
              {user ? "Mon compte" : "Se connecter"}
              <span className="absolute bottom-3 left-2 h-[1px] w-0 bg-primary transition-all duration-300 group-hover:w-4" />
            </Link>
          </nav>
          <Button
            to="/tarifs"
            variant="primary"
            size="md"
            onClick={() => setOpen(false)}
            className="mt-4 w-full"
          >
            Obtenir VYRO Premium
          </Button>
        </div>
      ) : null}
    </header>
  );
}
