import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  CreditCard,
  Download,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MonitorSmartphone,
  Package,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/site/Button";
import { PortalHeading, PortalNotice } from "@/components/site/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type User } from "@/lib/auth";
import { portalApi } from "@/lib/portal-api";
import "@/components/site/account-workspace.css";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [{ title: "Espace client – VYRO Premium" }, { name: "robots", content: "noindex" }],
  }),
  component: AccountLayout,
});

const NAV = [
  { to: "/account", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/account/appareils", label: "Mes appareils", icon: MonitorSmartphone },
  { to: "/account/abonnement", label: "Mon abonnement", icon: CreditCard },
  { to: "/account/profil", label: "Mon profil", icon: UserRound },
] as const;

const RESOURCES = [
  { to: "/account/telechargement", label: "Télécharger VYRO", icon: Download },
  { to: "/account/guides", label: "Guides", icon: BookOpen },
  { to: "/account/support", label: "Assistance", icon: LifeBuoy },
  { to: "/account/reseller", label: "Espace revendeur", icon: Package },
] as const;

const NAV_GROUPS = [
  { label: "Mon compte", links: NAV },
  { label: "Ressources", links: RESOURCES },
];

function AdminConsoleLink({ account, onNavigate }: { account: User; onNavigate: () => void }) {
  const [verifiedAccount, setVerifiedAccount] = useState<User | null>(null);

  useEffect(() => {
    let active = true;
    let sessionChanged = false;
    let request: AbortController | undefined;
    let unsubscribe: (() => void) | undefined;

    try {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        if (event !== "INITIAL_SESSION") {
          // AuthProvider reloads the account on session changes. Wait for that snapshot.
          sessionChanged = true;
          request?.abort();
          setVerifiedAccount(null);
          return;
        }
        if (
          sessionChanged ||
          request ||
          !session?.access_token ||
          session.user.id !== account.id ||
          session.user.is_anonymous ||
          !session.user.email_confirmed_at
        )
          return;

        const controller = new AbortController();
        request = controller;
        void portalApi<{ id: string; email: string }>("/api/admin", {
          token: session.access_token,
          signal: controller.signal,
        })
          .then((admin) => {
            if (controller.signal.aborted || admin.id !== account.id) return;
            const email = typeof admin.email === "string" ? admin.email.trim().toLowerCase() : "";
            if (email && email === account.email.trim().toLowerCase()) setVerifiedAccount(account);
          })
          .catch(() => {
            // A denied or unavailable verification leaves the link hidden.
          });
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // Without a session subscription there is no verified access.
    }

    return () => {
      active = false;
      request?.abort();
      unsubscribe?.();
    };
  }, [account]);

  if (verifiedAccount !== account) return null;

  return (
    <Link to="/admin" onClick={onNavigate} className="account-nav-link account-nav-console">
      <ShieldCheck className="size-4 shrink-0" aria-hidden />
      Console administrateur
    </Link>
  );
}

function AccountLayout() {
  const { user, ready, accountError, refreshAccount, signOut } = useAuth();
  const pathname = useRouterState({
    select: (state) => state.location.pathname.replace(/\/$/, ""),
  });
  const reseller = pathname === "/account/reseller";
  const navigate = useNavigate();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const current = [...NAV, ...RESOURCES].find(({ to }) => to === pathname);
  const open = openPath === pathname;
  const closeMenu = () => setOpenPath(null);
  const redirect =
    current && current.to !== "/account" && current.to !== "/account/reseller"
      ? current.to
      : undefined;
  const loginSearch = { redirect };

  useEffect(() => {
    if (ready && !user && !accountError && (pathname === "/account" || redirect)) {
      void navigate({ to: "/login", search: { redirect }, replace: true });
    }
  }, [ready, user, pathname, accountError, navigate, redirect]);

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
    <div className="vyro-portal account-workspace">
      <aside className="account-sidebar">
        <div className="account-brand">
          <Logo />
          <button
            type="button"
            onClick={() => setOpenPath(open ? null : pathname)}
            aria-label="Menu du portail"
            aria-expanded={open}
            aria-controls="account-navigation"
            className="account-menu-toggle"
          >
            {open ? <X aria-hidden size={20} /> : <Menu aria-hidden size={20} />}
          </button>
        </div>

        <div id="account-navigation" className="account-sidebar-inner" data-open={open}>
          <nav aria-label="Espace client" className="account-sidebar-nav">
            {NAV_GROUPS.map(({ label, links }) => {
              const visible = links.filter(({ to }) => user || to === "/account/reseller");
              if (!visible.length) return null;
              return (
                <div key={label} className="account-nav-group">
                  <p className="account-nav-label">{label}</p>
                  <ul>
                    {visible.map(({ to, label, icon: Icon }) => (
                      <li key={to}>
                        <Link
                          to={to}
                          onClick={closeMenu}
                          activeOptions={{ exact: true }}
                          className="account-nav-link"
                        >
                          <Icon size={17} aria-hidden />
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {ready && user && !accountError && !signingOut && !refreshing && (
              <AdminConsoleLink key={user.id} account={user} onNavigate={closeMenu} />
            )}
          </nav>

          <div className="account-sidebar-footer">
            {user && (
              <div className="account-identity">
                <span className="account-avatar" aria-hidden>
                  {(user.firstName.trim() || user.email).slice(0, 1).toUpperCase() || "V"}
                </span>
                <div className="min-w-0">
                  <p>{user.firstName || "Votre compte"}</p>
                  <small title={user.email}>{user.email}</small>
                </div>
              </div>
            )}
            <Link to="/" className="account-nav-link">
              <ArrowLeft size={17} aria-hidden /> Retour au site
            </Link>
            {user && (
              <button
                type="button"
                disabled={signingOut}
                onClick={() => void logout()}
                className="account-nav-link"
              >
                <LogOut size={17} aria-hidden />
                {signingOut ? "Déconnexion…" : "Se déconnecter"}
              </button>
            )}
            {logoutError && <PortalNotice error>{logoutError}</PortalNotice>}
          </div>
        </div>
      </aside>

      <div className="account-main">
        <div className="account-content">
          <div className="account-breadcrumb">
            <span>{reseller && !user ? "Partenaires" : "Espace client"}</span>
            {current && (
              <>
                <ChevronRight size={14} aria-hidden />
                <span>{current.label}</span>
              </>
            )}
          </div>
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
