import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Tv, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/site/Button";

export const Route = createFileRoute("/account/appareils")({
  component: DevicesPage,
});

const PLATFORMS = ["Android TV", "Google TV", "Amazon Fire TV"];

function DevicesPage() {
  const { user, isActive, addDevice, removeDevice } = useAuth();
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const devices = user?.devices ?? [];

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addDevice({ name: name.trim(), platform });
    setName("");
  }

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
                onClick={() => removeDevice(device.id)}
                aria-label={`Retirer ${device.name}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))
        )}
      </div>

      <h2 className="mt-12 font-display text-lg font-medium">Ajouter un appareil</h2>
      <form onSubmit={onSubmit} className="panel mt-4 grid gap-4 p-7 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <label htmlFor="device-name" className="text-[13px] text-muted-foreground">
            Nom de l'appareil
          </label>
          <input
            id="device-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="TV du salon"
            className="mt-1.5 w-full rounded-[10px] border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-primary/60"
          />
        </div>
        <div>
          <label htmlFor="device-platform" className="text-[13px] text-muted-foreground">
            Plateforme
          </label>
          <select
            id="device-platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="mt-1.5 w-full rounded-[10px] border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-primary/60"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="primary" size="sm" disabled={!isActive}>
            Ajouter
          </Button>
        </div>
      </form>

      <p className="mt-6 text-xs text-muted-foreground">
        {isActive
          ? "La limite d'appareils dépend des règles de licence appliquées à votre compte."
          : "Activez un accès VYRO Premium pour enregistrer un appareil."}
      </p>
    </div>
  );
}
