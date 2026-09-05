import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/site/Button";

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
        <Button to="/account/telechargement" variant="primary" size="sm">
          <Download className="h-4 w-4" aria-hidden />
          Télécharger VYRO Premium
        </Button>
        {!sub ? (
          <Button to="/tarifs" variant="secondary" size="sm">
            Obtenir un accès
          </Button>
        ) : null}
      </div>
    </div>
  );
}
