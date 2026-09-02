import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/account/appareils")({
  component: DevicesPage,
});

function DevicesPage() {
  const { user } = useAuth();
  const sub = user?.subscription ?? null;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-semibold">Mes appareils</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Les appareils sur lesquels votre licence VYRO Premium est activée.
      </p>

      <div className="panel mt-8 p-7">
        {sub ? (
          <>
            <p className="text-sm">
              <span className="font-medium">{sub.devicesUsed}</span> appareil actif
              {sub.devicesAllowed ? ` sur ${sub.devicesAllowed} autorisés` : ""}.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              La limite d'appareils dépend des règles de licence appliquées à votre compte.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun appareil enregistré. Activez un accès pour connecter votre premier appareil.
          </p>
        )}
      </div>
    </div>
  );
}
