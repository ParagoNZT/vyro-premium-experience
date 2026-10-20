import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Tv, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";


export const Route = createFileRoute("/account/appareils")({
  head: () => ({ meta: [
    { title: "Mes appareils – VYRO Premium" },
    { name: "description", content: "Gérez vos appareils VYRO Premium." },
    { property: "og:title", content: "Mes appareils – VYRO Premium" },
    { property: "og:description", content: "Gérez vos appareils VYRO Premium." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex" },
  ] }),
  component: DevicesPage,
});


function DevicesPage() {
  const { user, removeDevice } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const devices = user?.devices ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-semibold">Mes appareils</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Les appareils sur lesquels votre licence VYRO Premium est activée.
      </p>

      <div className="mt-8 space-y-3">
        {devices.length === 0 ? (
          <div className="panel p-7 text-sm text-muted-foreground">
            Aucun appareil enregistré pour le moment.
          </div>
        ) : (
          devices.map((device) => (
            <div key={device.id} className="panel flex items-center gap-4 p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-surface-2 text-primary">
                <Tv className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{device.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {device.platform} · ajouté le{" "}
                  {new Date(device.lastSeen).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={async () => { if(!window.confirm("Retirer cet appareil et son historique de liaison ? Il devra être réactivé sur la TV.")) return; setBusy(true); setError(""); try { await removeDevice(device.id); } catch (issue) { setError(issue instanceof Error ? issue.message : "Retrait impossible."); } finally { setBusy(false); } }}
                aria-label={`Retirer ${device.name}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="panel mt-8 p-6 text-sm"><h2 className="font-medium">Activer votre TV</h2><p className="mt-2 text-muted-foreground">Saisissez la clé de votre licence dans l’application VYRO sur votre TV. L’appareil apparaîtra automatiquement ici après son activation.</p></div>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}


    </div>
  );
}
