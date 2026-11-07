import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Monitor, Trash2 } from "lucide-react";
import { PortalHeading, PortalNotice } from "@/components/site/AuthShell";
import { Button } from "@/components/site/Button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/account/appareils")({
  head: () => ({
    meta: [{ title: "Mes appareils – VYRO Premium" }, { name: "robots", content: "noindex" }],
  }),
  component: DevicesPage,
});

function DevicesPage() {
  const { user, isActive, refreshAccount, removeDevice } = useAuth();
  const [removing, setRemoving] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const devices = user?.devices ?? [];
  const limit = user?.subscription?.devicesAllowed;

  async function remove(id: string) {
    if (removing) return;
    setRemoving(id);
    setError("");
    setNotice("");
    try {
      await removeDevice(id);
      setSelected(null);
      setNotice("Appareil retiré de votre licence.");
    } catch (issue) {
      setError(
        issue instanceof Error && !(issue instanceof TypeError)
          ? issue.message
          : "Impossible de retirer cet appareil.",
      );
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="portal-enter">
      <PortalHeading label="VYRO / Appareils" title="Mes appareils">
        Les appareils apparaissent ici après l’activation de VYRO Premium sur votre téléviseur.
      </PortalHeading>
      <section
        className="portal-panel portal-glow mt-7 space-y-4 p-5 sm:p-7"
        aria-labelledby="pair-title"
      >
        <h2 id="pair-title" className="font-display text-lg font-semibold">
          Associer un téléviseur
        </h2>
        {isActive ? (
          <>
            <ol className="list-inside list-decimal space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li>Ouvrez VYRO Premium sur votre téléviseur.</li>
              <li>
                Copiez votre clé depuis le tableau de bord, puis saisissez-la dans l’application.
              </li>
              <li>Revenez ici et actualisez la liste.</li>
            </ol>
            <Button to="/account" variant="secondary" size="sm">
              Accéder à ma clé
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Une licence active est nécessaire pour associer un appareil.
            </p>
            <Button to="/tarifs" size="sm">
              Voir les offres
            </Button>
          </>
        )}
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">
          Appareils associés{" "}
          <span className="text-sm text-muted-foreground">
            {devices.length}
            {limit != null ? ` / ${limit}` : ""}
          </span>
        </h2>
        <Button
          size="sm"
          variant="secondary"
          disabled={refreshing || !!removing}
          onClick={() => {
            setRefreshing(true);
            setNotice("");
            void refreshAccount()
              .then(() => setNotice("Liste actualisée."))
              .finally(() => setRefreshing(false));
          }}
        >
          {refreshing ? "Actualisation…" : "Actualiser"}
        </Button>
      </div>
      {notice && (
        <div className="mt-3">
          <PortalNotice>{notice}</PortalNotice>
        </div>
      )}
      {devices.length === 0 ? (
        <div className="portal-panel mt-4 flex items-start gap-3 p-5 text-sm text-muted-foreground">
          <Monitor aria-hidden className="size-5 shrink-0 text-primary" />
          Aucun appareil associé pour le moment.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {devices.map((device) => (
            <li
              key={device.id}
              className="portal-panel flex flex-wrap items-center gap-3 p-4 sm:p-5"
            >
              <Monitor aria-hidden className="size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold">{device.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {device.platform}
                  {Number.isFinite(Date.parse(device.lastSeen))
                    ? ` · Dernière activité : ${new Date(device.lastSeen).toLocaleString("fr-FR")}`
                    : ""}
                </p>
              </div>
              <AlertDialog
                open={selected === device.id}
                onOpenChange={(open) => {
                  if (!removing) {
                    setSelected(open ? device.id : null);
                    setError("");
                  }
                }}
              >
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={!!removing}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:border-destructive hover:text-destructive"
                  >
                    <Trash2 aria-hidden className="size-4" /> Retirer
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Retirer {device.name} ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      L’appareil devra être réactivé avec votre clé pour utiliser VYRO Premium.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {error && <PortalNotice error>{error}</PortalNotice>}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={!!removing}>Annuler</AlertDialogCancel>
                    <Button size="sm" disabled={!!removing} onClick={() => void remove(device.id)}>
                      {removing ? "Retrait…" : "Confirmer le retrait"}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
