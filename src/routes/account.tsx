import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  CreditCard,
  MonitorSmartphone,
  Download,
  BookOpen,
  User as UserIcon,
  LifeBuoy,
  LogOut,
  Menu,
} from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Espace client – VYRO Premium" },
      {
        name: "description",
        content: "Gérez votre abonnement, vos appareils et vos téléchargements VYRO Premium.",
      },
      { property: "og:title", content: "Espace client – VYRO Premium" },
      { property: "og:description", content: "Votre abonnement et vos téléchargements VYRO Premium." },
      { property: "og:url", content: "/account" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/account" }],
  }),
  component: AccountLayout,
});

const NAV = [
  { to: "/account", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/account/abonnement", label: "Mon abonnement", icon: CreditCard },
  { to: "/account/appareils", label: "Mes appareils", icon: MonitorSmartphone },
  { to: "/account/telechargement", label: "Télécharger VYRO", icon: Download },
  { to: "/account/guides", label: "Guides", icon: BookOpen },
  { to: "/account/profil", label: "Compte", icon: UserIcon },
  { to: "/account/support", label: "Support", icon: LifeBuoy },
] as const;

function AccountLayout() {
  const { user, ready, isActive, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/login" });
  }, [ready, user, navigate]);

  if (!ready || !user) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }

  const initials = user.firstName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside
        className={cn(
          "border-b border-border bg-sidebar lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r",
        )}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <Logo />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu de l'espace client"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] hover:bg-surface-2 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <div className={cn("px-5 pb-5 lg:block", open ? "block" : "hidden")}>
          <div className="flex items-center gap-3 rounded-[10px] border border-border bg-surface-2 px-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.firstName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <p
            className={cn(
              "mt-2 inline-block rounded-[6px] px-2 py-0.5 text-xs",
              isActive
                ? "border border-primary/30 bg-primary/10 text-primary"
                : "border border-border text-muted-foreground",
            )}
          >
            {isActive ? "Accès actif" : "Aucun accès actif"}
          </p>
        </div>
        <nav className={cn("px-3 pb-5 lg:block", open ? "block" : "hidden")}>
          {NAV.map(({ to, label, icon: Icon, ...rest }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: "exact" in rest }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
              activeProps={{ className: "bg-surface-2 text-foreground" }}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              signOut();
              navigate({ to: "/" });
            }}
            className="mt-2 flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            Déconnexion
          </button>
        </nav>
      </aside>

      <div className="min-w-0 px-5 py-10 md:px-10 md:py-14">
        <Outlet />
      </div>
    </div>
  );
}
