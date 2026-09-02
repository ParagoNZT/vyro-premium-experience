import { createFileRoute, Link } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/account/")({
  component: Dashboard,
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-6">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-lg font-medium">{value}</p>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const sub = user?.subscription ?? null;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-semibold">Bonjour, {user?.firstName}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Voici l'état de votre accès VYRO Premium.
      </p>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Abonnement" value={sub ? sub.planName : "Aucun accès"} />
        <Stat label="Statut" value={sub?.status === "active" ? "Actif" : "Inactif"} />
        <Stat
          label="Expiration"
          value={sub ? new Date(sub.expiresAt).toLocaleDateString("fr-FR") : "—"}
        />
        <Stat
          label="Appareils"
          value={sub ? `${sub.devicesUsed} / ${sub.devicesAllowed ?? "—"}` : "—"}
        />
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          to="/account/telechargement"
          className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200 hover:brightness-115 hover:shadow-[0_0_28px_-8px_var(--primary)]"
        >
          <Download className="h-4 w-4" aria-hidden />
          Télécharger VYRO Premium
        </Link>
        {!sub ? (
          <Link
            to="/tarifs"
            className="rounded-[10px] bg-surface-2 px-5 py-2.5 text-sm transition-colors hover:bg-accent"
          >
            Obtenir un accès
          </Link>
        ) : null}
      </div>
    </div>
  );
}
