import { createFileRoute } from "@tanstack/react-router";
import { Download, Lock } from "lucide-react";
import { DOWNLOADS } from "@/config/site";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/site/Button";

export const Route = createFileRoute("/account/telechargement")({
  component: AccountDownloadPage,
});

function AccountDownloadPage() {
  const { isActive } = useAuth();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-semibold">Télécharger VYRO Premium</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isActive
          ? "Choisissez le fichier correspondant à votre appareil."
          : "Un accès actif est nécessaire pour télécharger l'application."}
      </p>

      {!isActive ? (
        <div className="panel mt-8 flex flex-wrap items-center gap-4 p-6">
          <Lock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            Activez un accès VYRO Premium pour débloquer les téléchargements.
          </p>
          <Button to="/tarifs" variant="primary" size="sm">
            Voir les offres
          </Button>
        </div>
      ) : null}

      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        {DOWNLOADS.map((target) => (
          <div key={target.id} className="panel p-6">
            <h2 className="font-display text-lg font-medium">{target.platform}</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Version {target.version} · {target.size} · {target.updatedAt}
            </p>
            <div className="mt-5">
              <Button type="button" variant="primary" size="sm" disabled={!isActive}>
                <Download className="h-4 w-4" aria-hidden />
                Télécharger
              </Button>
            </div>
            <ol className="mt-6 space-y-2 border-t border-border pt-5 text-sm text-muted-foreground">
              {target.steps.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="text-primary">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
