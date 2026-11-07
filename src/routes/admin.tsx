import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/site/Button";
import { PortalHeading, PortalNotice } from "@/components/site/AuthShell";
import { ManagementPanel } from "@/components/admin/ManagementPanel";
import { useAuth } from "@/lib/auth";
import { portalApi, PortalApiError } from "@/lib/portal-api";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration – VYRO Premium" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

type Admin = { id: string; email: string };
type Gate =
  | { kind: "loading" | "signed-out" | "forbidden" }
  | { kind: "error"; message: string }
  | { kind: "allowed"; admin: Admin };

function AdminPage() {
  const { user, ready, accountError, refreshAccount, signOut } = useAuth();
  const userId = user?.id;
  const [gate, setGate] = useState<Gate>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const accessDenied = useCallback((status: 401 | 403) => {
    setGate({ kind: status === 401 ? "signed-out" : "forbidden" });
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      setGate(accountError ? { kind: "error", message: accountError } : { kind: "signed-out" });
      return;
    }
    const controller = new AbortController();
    setGate({ kind: "loading" });
    void portalApi<Admin>("/api/admin", { signal: controller.signal })
      .then((admin) => {
        if (controller.signal.aborted) return;
        if (admin.id !== userId) {
          setGate({ kind: "signed-out" });
          return;
        }
        setGate({ kind: "allowed", admin });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof PortalApiError && (error.status === 401 || error.status === 403))
          accessDenied(error.status);
        else
          setGate({ kind: "error", message: "Impossible de vérifier les droits administrateur." });
      });
    return () => controller.abort();
  }, [ready, userId, accountError, attempt, accessDenied]);

  async function logout() {
    setSigningOut(true);
    setLogoutError("");
    try {
      await signOut();
      setGate({ kind: "signed-out" });
    } catch {
      setLogoutError("La déconnexion n’a pas abouti. Réessayez.");
    } finally {
      setSigningOut(false);
    }
  }

  const admin = gate.kind === "allowed" && gate.admin.id === userId && ready ? gate.admin : null;

  return (
    <section className="vyro-portal min-h-screen bg-background">
      <div className="border-b border-border bg-sidebar">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Logo />
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/account"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:text-primary"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Mon compte
            </Link>
            {userId && (
              <Button
                variant="secondary"
                size="sm"
                disabled={signingOut}
                onClick={() => void logout()}
              >
                <LogOut aria-hidden className="size-4" />
                {signingOut ? "Déconnexion…" : "Déconnexion"}
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="portal-enter mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PortalHeading label="VYRO / Console" title="Administration">
            Suivez les comptes, les licences, les accès TV et les paiements.
          </PortalHeading>
          {admin && (
            <p className="inline-flex max-w-full items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
              <ShieldCheck aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 break-words">{admin.email}</span>
            </p>
          )}
        </div>
        {logoutError && (
          <div className="mt-5">
            <PortalNotice error>{logoutError}</PortalNotice>
          </div>
        )}
        {!ready || gate.kind === "loading" ? (
          <p role="status" className="portal-panel mt-7 p-6 text-sm text-muted-foreground">
            Vérification de votre accès…
          </p>
        ) : admin && !signingOut ? (
          <ManagementPanel key={admin.id} onAccessDenied={accessDenied} />
        ) : gate.kind === "error" ? (
          <div className="portal-panel mt-7 max-w-xl space-y-4 p-6">
            <PortalNotice error>{gate.message}</PortalNotice>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!userId) void refreshAccount();
                setAttempt((value) => value + 1);
              }}
            >
              Réessayer
            </Button>
          </div>
        ) : (
          !signingOut && (
            <div className="portal-panel portal-glow mt-7 max-w-xl space-y-4 p-6">
              <LockKeyhole aria-hidden className="size-6 text-primary" />
              <h2 className="font-display text-xl font-semibold">
                {gate.kind === "forbidden"
                  ? "Accès administrateur refusé"
                  : "Connectez-vous pour continuer"}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {gate.kind === "forbidden"
                  ? "Cette session ne dispose pas des droits nécessaires. Revenez à votre compte ou connectez-vous avec le compte autorisé."
                  : "Utilisez votre compte administrateur avec une adresse e-mail confirmée."}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button to="/login" search={{ redirect: "/admin" }} size="sm">
                  Se connecter
                </Button>
                {gate.kind === "forbidden" && (
                  <Button to="/account" variant="secondary" size="sm">
                    Mon compte
                  </Button>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}
