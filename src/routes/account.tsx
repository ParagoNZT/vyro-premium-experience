import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CreditCard,
  Download,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MonitorSmartphone,
  Package,
  UserRound,
} from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/site/Button";
import { PortalHeading, PortalNotice } from "@/components/site/AuthShell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [{ title: "Espace client – VYRO Premium" }, { name: "robots", content: "noindex" }],
  }),
  component: AccountLayout,
});

const NAV = [
  { to: "/account", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/account/abonnement", label: "Mon abonnement", icon: CreditCard },
  { to: "/account/appareils", label: "Mes appareils", icon: MonitorSmartphone },
  { to: "/account/telechargement", label: "Télécharger VYRO", icon: Download },
  { to: "/account/guides", label: "Guides", icon: BookOpen },
  { to: "/account/profil", label: "Mon profil", icon: UserRound },
  { to: "/account/support", label: "Assistance", icon: LifeBuoy },
  { to: "/account/reseller", label: "Espace revendeur", icon: Package },
] as const;

function AccountLayout() {
  const { user, ready, accountError, isActive, refreshAccount, signOut } = useAuth();
  const pathname = useRouterState({
    select: (state) => state.location.pathname.replace(/\/$/, ""),
  });
  const reseller = pathname === "/account/reseller";
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const redirect = NAV.find(
    (entry) => entry.to === pathname && entry.to !== "/account" && entry.to !== "/account/reseller",
  )?.to;
  const loginSearch = {
    redirect: redirect === "/account" || redirect === "/account/reseller" ? undefined : redirect,
  };

  useEffect(() => {
    if (ready && !user && !accountError && (pathname === "/account" || loginSearch.redirect)) {
      void navigate({ to: "/login", search: { redirect: loginSearch.redirect }, replace: true });
    }
  }, [ready, user, pathname, accountError, navigate, loginSearch.redirect]);

  async function logout() {
    setSigningOut(true);
    setLogoutError("");
    try {
      await signOut();
      await navigate({ to: "/login", replace: true });
    } catch {
      setLogoutError("La déconnexion n’a pas abouti. Réessayez.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="vyro-portal min-h-screen bg-background lg:grid lg:grid-cols-[235px_minmax(0,1fr)]">
      <aside className="border-b border-border bg-sidebar lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-5 py-4 lg:pt-7">
          <Logo />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Menu du portail"
            aria-expanded={open}
            aria-controls="portal-navigation"
            className="grid size-11 place-items-center rounded-lg border border-border text-foreground hover:border-primary lg:hidden"
          >
            <Menu aria-hidden className="size-5" />
          </button>
        </div>
        <div id="portal-navigation" className={open ? "block" : "hidden lg:block"}>
          <div className="mx-4 mb-3 rounded-lg border border-border bg-surface-2 px-3.5 py-3">
            <p className="portal-kicker">{reseller && !user ? "Partenaires" : "Espace client"}</p>
            {user && (
              <>
                <p className="mt-2 truncate text-sm font-semibold">{user.firstName}</p>
                <p className="truncate text-xs text-muted-foreground" title={user.email}>
                  {user.email}
                </p>
                <p className="mt-2 text-xs text-primary">
                  {accountError
                    ? "Compte indisponible"
                    : isActive
                      ? "Premium actif"
                      : "Aucun accès actif"}
                </p>
              </>
            )}
          </div>
          <nav className="space-y-1 px-4 pb-5" aria-label="Espace client">
            {NAV.filter(({ to }) => !!user || to === "/account/reseller").map(
              ({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  activeOptions={{ exact: true }}
                  className="flex min-h-11 items-center gap-3 rounded-lg border border-transparent px-3 text-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  activeProps={{ className: "border-primary/25 bg-primary/10 text-primary" }}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {label}
                </Link>
              ),
            )}
            <div className="mt-3 space-y-1 border-t border-border pt-3">
              <Link
                to="/"
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="size-4" aria-hidden />
                Retour au site
              </Link>
              {user && (
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={() => void logout()}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-muted-foreground hover:text-primary disabled:opacity-50"
                >
                  <LogOut className="size-4" aria-hidden />
                  {signingOut ? "Déconnexion…" : "Se déconnecter"}
                </button>
              )}
              {logoutError && <PortalNotice error>{logoutError}</PortalNotice>}
            </div>
          </nav>
        </div>
      </aside>

      <div className="min-w-0 px-5 py-8 sm:px-8 sm:py-12 xl:px-14">
        <div className="mx-auto max-w-5xl">
          {reseller ? (
            <Outlet />
          ) : accountError ? (
            <div className="space-y-5">
              <PortalHeading label="Espace client" title="Votre compte est indisponible." />
              <PortalNotice error>{accountError}</PortalNotice>
              <div className="flex flex-wrap gap-3">
                <Button
                  size="sm"
                  disabled={refreshing}
                  onClick={() => {
                    setRefreshing(true);
                    void refreshAccount().finally(() => setRefreshing(false));
                  }}
                >
                  {refreshing ? "Vérification…" : "Réessayer"}
                </Button>
                {!user && (
                  <Button to="/login" search={loginSearch} size="sm" variant="secondary">
                    Se connecter
                  </Button>
                )}
                <Button to="/support" size="sm" variant="secondary">
                  Assistance
                </Button>
              </div>
            </div>
          ) : !ready || !user ? (
            <p role="status" className="text-sm text-muted-foreground">
              {ready ? "Ouverture de la connexion…" : "Vérification de votre session…"}
            </p>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  );
}
