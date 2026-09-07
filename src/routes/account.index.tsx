import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Copy, Check, ShieldCheck, MonitorSmartphone, CalendarClock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/site/Button";

export const Route = createFileRoute("/account/")({
  component: Dashboard,
});

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <div className="panel p-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="text-xs">{label}</p>
      </div>
      <p className="mt-3 font-display text-lg font-medium">{value}</p>
    </div>
  );
}

function Dashboard() {
  const { user, isActive, daysLeft } = useAuth();
  const [copied, setCopied] = useState(false);
  const sub = user?.subscription ?? null;

  const total = sub
    ? Math.max(
        1,
        Math.round(
          (new Date(sub.expiresAt).getTime() - new Date(sub.startedAt).getTime()) / 86_400_000,
        ),
      )
    : 0;
  const progress = sub && daysLeft !== null ? Math.min(100, (daysLeft / total) * 100) : 0;

  function copyKey() {
    if (!user) return;
    void navigator.clipboard.writeText(user.licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-semibold">Bonjour, {user?.firstName}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Voici l'état de votre accès VYRO Premium.
      </p>

      <div className="panel relative mt-9 overflow-hidden p-7">
        <div aria-hidden className="halo -right-24 -top-24 h-72 w-72" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Licence VYRO Premium</p>
            <p className="mt-2 font-display text-2xl font-medium">
              {sub ? sub.planName : "Aucun accès actif"}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <code className="rounded-[8px] border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm tracking-wider">
                {user?.licenseKey}
              </code>
              <button
                type="button"
                onClick={copyKey}
                aria-label="Copier la clé de licence"
                className="grid h-8 w-8 place-items-center rounded-[8px] border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <span
            className={
              isActive
                ? "rounded-[6px] border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary"
                : "rounded-[6px] border border-border bg-surface-2 px-3 py-1 text-xs text-muted-foreground"
            }
          >
            {isActive ? "Actif" : "Inactif"}
          </span>
        </div>

        {sub ? (
          <div className="relative mt-7">
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {daysLeft} jour{daysLeft && daysLeft > 1 ? "s" : ""} restant
              {daysLeft && daysLeft > 1 ? "s" : ""} · expire le{" "}
              {new Date(sub.expiresAt).toLocaleDateString("fr-FR")}
            </p>
          </div>
        ) : (
          <p className="relative mt-6 text-sm text-muted-foreground">
            Choisissez une offre pour activer votre licence et télécharger l'application.
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat
          label="Statut"
          value={isActive ? "Actif" : "Inactif"}
          icon={ShieldCheck}
        />
        <Stat
          label="Expiration"
          value={sub ? new Date(sub.expiresAt).toLocaleDateString("fr-FR") : "—"}
          icon={CalendarClock}
        />
        <Stat
          label="Appareils"
          value={`${user?.devices.length ?? 0}${sub?.devicesAllowed ? ` / ${sub.devicesAllowed}` : ""}`}
          icon={MonitorSmartphone}
        />
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        {isActive ? (
          <Button to="/account/telechargement" variant="primary" size="sm">
            <Download className="h-4 w-4" aria-hidden />
            Télécharger VYRO Premium
          </Button>
        ) : (
          <Button to="/tarifs" variant="primary" size="sm">
            Obtenir un accès
          </Button>
        )}
        <Button to="/account/appareils" variant="secondary" size="sm">
          Gérer mes appareils
        </Button>
        <Button to="/account/guides" variant="ghost" size="sm">
          Voir les guides
        </Button>
      </div>

      <h2 className="mt-14 font-display text-lg font-medium">Prochaines étapes</h2>
      <ol className="mt-4 space-y-3">
        {[
          { done: true, text: "Créer votre compte VYRO" },
          { done: isActive, text: "Activer un accès VYRO Premium" },
          { done: (user?.devices.length ?? 0) > 0, text: "Installer l'application sur votre TV" },
          { done: false, text: "Connecter votre propre source compatible" },
        ].map((step) => (
          <li key={step.text} className="flex items-center gap-3 text-sm">
            <span
              className={
                step.done
                  ? "grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"
                  : "grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
              }
            >
              {step.done ? <Check className="h-3 w-3" aria-hidden /> : null}
            </span>
            <span className={step.done ? "text-muted-foreground line-through" : ""}>
              {step.text}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-xs text-muted-foreground">
        VYRO Premium est un lecteur. Aucune chaîne, aucun film et aucune série n'est fourni avec
        votre licence.
      </p>
    </div>
  );
}
