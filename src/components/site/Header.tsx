import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, Menu, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "./Logo";

const nav = [
  { to: "/fonctionnalites", label: "L’application" },
  { to: "/appareils", label: "Appareils" },
  { to: "/tarifs", label: "Tarifs" },
  { to: "/support", label: "Assistance" },
] as const;

export function Header() {
  const { user } = useAuth();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === path;
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenedAt(null);
      toggle.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header className="vyro-header screening-header">
      <div className="vyro-wrap vyro-header-inner">
        <Logo />
        <nav aria-label="Navigation principale" className="vyro-main-nav">
          {nav.map(({ to, label }) => (
            <Link key={to} to={to} activeOptions={{ exact: true }}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="vyro-header-actions">
          <Link className="vyro-account-link" to={user ? "/account" : "/login"}>
            <UserRound size={17} aria-hidden />
            <span>Espace client</span>
          </Link>
          <Link to="/tarifs" className="vyro-cta vyro-cta-compact">
            Obtenir VYRO <ArrowUpRight size={16} aria-hidden />
          </Link>
          <button
            ref={toggle}
            type="button"
            className="vyro-menu-toggle"
            aria-expanded={open}
            aria-controls="vyro-mobile-nav"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpenedAt(open ? null : path)}
          >
            {open ? <X size={23} aria-hidden /> : <Menu size={23} aria-hidden />}
          </button>
        </div>
      </div>
      <nav
        id="vyro-mobile-nav"
        className="vyro-mobile-nav"
        aria-label="Navigation mobile"
        hidden={!open}
      >
        {nav.map(({ to, label }) => (
          <Link key={to} to={to} onClick={() => setOpenedAt(null)}>
            {label}
            <ArrowUpRight size={16} aria-hidden />
          </Link>
        ))}
        <Link to={user ? "/account" : "/login"} onClick={() => setOpenedAt(null)}>
          Espace client
          <ArrowUpRight size={16} aria-hidden />
        </Link>
      </nav>
    </header>
  );
}
