import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarClock, Copy, Download, Monitor, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/site/Button";
import { PortalHeading, PortalNotice } from "@/components/site/AuthShell";
import { useAuth } from "@/lib/auth";

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
  const [feedback, setFeedback] = useState<"copied" | "error" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const subscription = user?.subscription;
  const expiry =
    subscription && Number.isFinite(Date.parse(subscription.expiresAt))
      ? formatDate.format(new Date(subscription.expiresAt))
      : "—";
  const devices = user?.devices.length ?? 0;
  const deviceValue =
    subscription?.devicesAllowed == null
      ? String(devices)
      : `${devices} / ${subscription.devicesAllowed}`;
  const status = isActive
    ? "Actif"
    : subscription?.status === "revoked"
      ? "Révoqué"
      : subscription
        ? "Expiré"
        : "Sans abonnement";

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

  async function copyKey() {
    if (!isActive || !user?.licenseKey) return;
    try {
      await navigator.clipboard.writeText(user.licenseKey);
      setFeedback("copied");
    } catch {
      setFeedback("error");
    }
  }

  return (
    <div className="portal-enter">
      <PortalHeading
        label="VYRO / Tableau de bord"
        title={`Bonjour, ${user?.firstName || "et bienvenue"}.`}
      >
        Retrouvez l’état de votre accès, installez le lecteur et associez votre téléviseur.
      </PortalHeading>

      {payment && (
        <div className="mt-6 space-y-2">
          <PortalNotice>
            {payment === "test"
              ? "Retour du paiement de test. Aucun prélèvement réel et aucune licence attribuée."
              : "Retour de Stripe. La licence et l’historique se mettent à jour après confirmation du paiement."}
          </PortalNotice>
          {payment === "processing" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={refreshing}
              onClick={() => {
                setRefreshing(true);
                void refreshAccount().finally(() => setRefreshing(false));
              }}
            >
              {refreshing ? "Actualisation…" : "Actualiser mon accès"}
            </Button>
          )}
        </div>
      )}

      <section className="portal-panel portal-glow mt-8 p-5 sm:p-8" aria-labelledby="license-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="portal-kicker">Votre licence</p>
            <h2 id="license-title" className="mt-4 font-display text-2xl font-semibold sm:text-3xl">
              {subscription?.planName ? `VYRO Premium · ${subscription.planName}` : "VYRO Premium"}
            </h2>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${isActive ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface-2 text-muted-foreground"}`}
          >
            <ShieldCheck aria-hidden className="size-4" />
            {status}
          </span>
        </div>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          {isActive
            ? "Pour associer un appareil, ouvrez VYRO sur votre TV et saisissez votre clé d’activation."
            : subscription
              ? "Prolongez votre accès pour continuer à utiliser VYRO Premium sur vos appareils."
              : "Choisissez une offre pour obtenir une licence et activer l’application sur votre TV."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {isActive && user?.licenseKey ? (
            <Button size="sm" onClick={() => void copyKey()}>
              <Copy aria-hidden className="size-4" /> Copier ma clé TV
            </Button>
          ) : isActive ? null : (
            <Button to="/tarifs" size="sm">
              {subscription ? "Prolonger mon accès" : "Voir les offres"}
            </Button>
          )}
          {isActive && (
            <Button to="/account/telechargement" variant="secondary" size="sm">
              <Download aria-hidden className="size-4" /> Installer VYRO
            </Button>
          )}
        </div>
        {isActive && feedback && (
          <div className="mt-4">
            <PortalNotice error={feedback === "error"}>
              {feedback === "copied"
                ? "Clé copiée. Utilisez-la uniquement dans l’application VYRO."
                : "Votre navigateur n’a pas autorisé la copie. Réessayez sur un navigateur compatible ou contactez l’assistance."}
            </PortalNotice>
          </div>
        )}
        <dl className="mt-7 grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
          {[
            { label: "Accès", value: status, Icon: ShieldCheck },
            { label: "Échéance", value: expiry, Icon: CalendarClock },
            { label: "Appareils associés", value: deviceValue, Icon: Monitor },
          ].map(({ label, value, Icon }) => (
            <div key={label}>
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon aria-hidden className="size-4 text-primary" />
                {label}
              </dt>
              <dd className="mt-1.5 font-display text-base font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {isActive && daysLeft != null && (
          <p className="mt-4 text-xs text-muted-foreground">
            {daysLeft} jour{daysLeft === 1 ? "" : "s"} restant{daysLeft === 1 ? "" : "s"}
          </p>
        )}
      </section>

      <section className="mt-9">
        <h2 className="font-display text-xl font-semibold">Sur votre téléviseur</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            {
              to: "/account/appareils",
              label: "Mes appareils",
              text: "Consultez les appareils associés à votre licence.",
            },
            {
              to: "/account/guides",
              label: "Guides de configuration",
              text: "Apprenez à connecter votre source dans l’application.",
            },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="portal-panel flex min-h-24 items-start justify-between gap-4 p-5 transition-colors hover:border-primary/50"
            >
              <span>
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-2 block text-sm text-muted-foreground">{item.text}</span>
              </span>
              <ArrowUpRight aria-hidden className="size-4 shrink-0 text-primary" />
            </Link>
          ))}
        </div>
      </section>
      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        VYRO Premium est un lecteur. Vous devez disposer d’une source compatible que vous êtes
        autorisé à utiliser.
      </p>
    </div>
  );
}
