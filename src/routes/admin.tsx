import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { AdminNotice } from "@/components/admin/AdminControls";
import { AdminBrand, AdminWorkspace } from "@/components/admin/AdminWorkspace";
import { ManagementPanel } from "@/components/admin/ManagementPanel";
import { isAdminSection, type AdminSection } from "@/components/admin/sections";
import { useAuth } from "@/lib/auth";
import { portalApi, PortalApiError } from "@/lib/portal-api";
import "@/components/admin/admin.css";

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>): { section?: AdminSection } =>
    isAdminSection(search["section"]) ? { section: search["section"] } : {},
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
  const { section = "overview" } = Route.useSearch();
  const { user, ready, accountError, signOut } = useAuth();
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
      setGate({ kind: "signed-out" });
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
  }, [ready, userId, attempt, accessDenied]);

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

  if (admin) {
    return (
      <AdminWorkspace
        section={section}
        email={admin.email}
        onSignOut={() => void logout()}
        signingOut={signingOut}
        logoutError={logoutError}
      >
        {!signingOut && (
          <ManagementPanel
            key={admin.id + ":" + section}
            section={section}
            onAccessDenied={accessDenied}
          />
        )}
      </AdminWorkspace>
    );
  }

  return (
    <div className="va-theme va-entry">
      <AdminBrand />
      <section className="va-entry-card" aria-labelledby="admin-entry-heading">
        <span className="va-metric-icon">
          <LockKeyhole size={20} aria-hidden />
        </span>
        <p className="va-eyebrow">Espace réservé</p>
        <h1 id="admin-entry-heading">Console administrateur</h1>
        {logoutError && <AdminNotice error>{logoutError}</AdminNotice>}
        {!ready || gate.kind === "loading" || signingOut ? (
          <p role="status">{signingOut ? "Déconnexion…" : "Vérification de votre accès…"}</p>
        ) : gate.kind === "error" ? (
          <>
            <AdminNotice error>{gate.message}</AdminNotice>
            <button
              className="va-button va-button-primary"
              type="button"
              onClick={() => {
                setAttempt((value) => value + 1);
              }}
            >
              Réessayer
            </button>
          </>
        ) : (
          <>
            <h2>
              {gate.kind === "forbidden"
                ? "Accès administrateur refusé"
                : "Connectez-vous pour continuer"}
            </h2>
            <p>
              {gate.kind === "forbidden"
                ? "Cette session ne dispose pas des droits nécessaires."
                : "Utilisez votre compte administrateur avec une adresse e-mail confirmée."}
            </p>
            {gate.kind === "signed-out" && accountError && (
              <AdminNotice error>{accountError}</AdminNotice>
            )}
            <div className="va-actions">
              <Link
                to="/login"
                search={{ redirect: "/admin" }}
                className="va-button va-button-primary"
              >
                Se connecter
              </Link>
              {gate.kind === "forbidden" && (
                <Link to="/account" className="va-button va-button-secondary">
                  Mon compte
                </Link>
              )}
            </div>
          </>
        )}
        <Link to="/" className="va-text-link">
          <ArrowLeft size={16} aria-hidden /> Retour au site
        </Link>
      </section>
    </div>
  );
}
