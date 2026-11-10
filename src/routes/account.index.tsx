import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { AccountActivation, AccountDevices, AccountHero } from "@/components/site/AccountDevices";
import { PortalNotice } from "@/components/site/AuthShell";
import { useAuth } from "@/lib/auth";
import { formatLastLicenseDay } from "@/lib/license-dates";

export const Route = createFileRoute("/account/")({
  validateSearch: z.object({ payment: z.enum(["processing", "test"]).optional().catch(undefined) }),
  head: () => ({
    meta: [{ title: "Tableau de bord – VYRO Premium" }, { name: "robots", content: "noindex" }],
  }),
  component: Dashboard,
});

const formatDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

function Dashboard() {
  const { user, isActive, daysLeft, refreshAccount } = useAuth();
  const { payment } = Route.useSearch();
  const [refreshing, setRefreshing] = useState(false);
  const subscription = user?.subscription;
  const expiry =
    subscription?.expiresAt && Number.isFinite(Date.parse(subscription.expiresAt))
      ? subscription.expiresOn
        ? formatLastLicenseDay(subscription.expiresAt)
        : formatDate.format(new Date(subscription.expiresAt))
      : null;
  const status = isActive
    ? "Actif"
    : subscription?.status === "revoked"
      ? "Révoqué"
      : subscription && subscription.status !== "none"
        ? "Expiré"
        : "Sans abonnement";
  const firstName = user?.firstName.trim();

  useEffect(() => {
    if (payment !== "processing") return;
    let attempts = 0;
    const interval = window.setInterval(() => {
      if (++attempts > 12) {
        window.clearInterval(interval);
        return;
      }
      void refreshAccount();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [payment, refreshAccount]);

  return (
    <div className="account-page">
      <AccountHero
        label="Votre espace VYRO"
        title={firstName ? `Bonjour, ${firstName}.` : "Bienvenue chez VYRO."}
        action={
          <>
            <Link to="/account/abonnement" className="account-button account-button-on-dark">
              Mon abonnement <ArrowRight size={16} aria-hidden />
            </Link>
            {isActive && (
              <a href="#activation-tv" className="account-button account-button-hero-secondary">
                <KeyRound size={16} aria-hidden /> Ma clé TV
              </a>
            )}
          </>
        }
        summary={
          <>
            <div className="account-summary-heading">
              <span className="account-eyebrow">Votre accès</span>
              <ShieldCheck size={20} aria-hidden />
            </div>
            <strong className="account-summary-plan">
              {subscription?.planName ? `VYRO Premium · ${subscription.planName}` : "VYRO Premium"}
            </strong>
            <div className="account-summary-meta">
              <span className="account-status" data-active={isActive}>
                {status}
              </span>
              {isActive && subscription?.expiresAt === null && <span>Sans échéance</span>}
              {expiry && (
                <span>
                  {isActive ? "Jusqu’au" : "Échéance :"} {expiry}
                </span>
              )}
            </div>
            {isActive && daysLeft != null && (
              <p className="account-summary-days">
                {daysLeft} jour{daysLeft === 1 ? "" : "s"} restant{daysLeft === 1 ? "" : "s"}
              </p>
            )}
          </>
        }
      >
        Gérez votre accès VYRO Premium et les appareils associés à votre licence.
      </AccountHero>

      {payment && (
        <div className="space-y-2">
          <PortalNotice>
            {payment === "test"
              ? "Retour du paiement de test. Aucun prélèvement réel et aucune licence attribuée."
              : "Retour de Stripe. La licence et l’historique se mettent à jour après confirmation du paiement."}
          </PortalNotice>
          {payment === "processing" && (
            <button
              type="button"
              className="account-button"
              disabled={refreshing}
              onClick={() => {
                setRefreshing(true);
                void refreshAccount().finally(() => setRefreshing(false));
              }}
            >
              {refreshing ? "Actualisation…" : "Actualiser mon accès"}
            </button>
          )}
        </div>
      )}

      <AccountDevices />
      <AccountActivation />

      <p className="account-page-note">
        VYRO Premium est un lecteur. Utilisez une source compatible que vous êtes autorisé à
        consulter.
      </p>
    </div>
  );
}
