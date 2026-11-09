import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { HardDrive, ListVideo, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PortalHeading } from "@/components/site/AuthShell";
import { portalApi } from "@/lib/portal-api";
import { useAuth } from "@/lib/auth";
import { tvBackupFile } from "@/lib/tv-settings-contract";
import { sealPlaylistUrl } from "@/lib/remote-seal";
import type {
  RemoteCatalog,
  RemoteDevice,
  RemoteOverview,
  RemoteWebAction,
} from "@/lib/remote-contract";

export const Route = createFileRoute("/account/gestion")({ component: RemotePage });
const endpoint = "/api/remote-workspace" as const;
const card = "min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6";
const select = "min-h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const date = (value: string) =>
  new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const status = {
  waiting: "En attente de l’appareil",
  sent: "Transmise, confirmation en attente",
  done: "Appliquée",
  failed: "Échec sur l’appareil",
  cancelled: "Annulée",
  expired: "Expirée",
};

function RemotePage() {
  const { user } = useAuth();
  return <RemotePanel key={user?.id} />;
}
function RemotePanel() {
  const [data, setData] = useState<RemoteOverview>();
  const [id, setId] = useState("");
  const [tab, setTab] = useState<"sources" | "backup" | "jobs">("sources");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      setData(await portalApi<RemoteOverview>(endpoint, signal ? { signal } : {}));
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : "Chargement impossible.");
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh(controller.signal);
    }, 9000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [refresh]);
  const device = data?.devices.find((d) => d.id === id) ?? data?.devices[0];
  async function send(action: RemoteWebAction, message: string) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await portalApi(endpoint, { method: "POST", body: action });
      setNotice(message);
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function exportBackup(id: string) {
    try {
      const file = tvBackupFile.parse(await portalApi(`${endpoint}?backup=${id}`));
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `vyro-sauvegarde-${id.slice(0, 8)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export impossible.");
    }
  }
  const queued = "Commande enregistrée. L’application doit être ouverte pour la recevoir.";
  return (
    <div className="space-y-5">
      <PortalHeading label="Appareils" title="Gestion à distance">
        Gérez les sources, la TV en direct et les sauvegardes depuis votre compte.
      </PortalHeading>
      {error && (
        <p
          className="rounded-lg border border-destructive/40 bg-card p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg border border-primary/40 bg-card p-3 text-sm" role="status">
          {notice}
        </p>
      )}
      <section className={card}>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <QrCode size={20} /> Appareils associés
        </h2>
        <p className="text-sm text-muted-foreground">
          Avec une version de l’application qui prend en charge la gestion à distance, ouvrez
          Réglages → Sauvegardes et scannez le QR code avec votre téléphone.
        </p>
        {!data && !error && <p>Chargement…</p>}
        {device && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid min-w-56 gap-1 text-sm">
              Appareil
              <select className={select} value={device.id} onChange={(e) => setId(e.target.value)}>
                {data?.devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.edition === "vyro" ? "VYRO" : "SHOW+"} ·{" "}
                    {d.kind === "tv" ? "TV" : "Mobile"}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Dissocier cet appareil et supprimer ses commandes en attente ? Les sauvegardes restent dans votre compte.",
                  )
                )
                  void send({ action: "unlink", device: device.id }, "Appareil dissocié.");
              }}
            >
              Dissocier
            </Button>
            {device.lastSeen && (
              <p className="text-sm text-muted-foreground">
                Dernier contact : {date(device.lastSeen)}
              </p>
            )}
          </div>
        )}
        <Link className="text-sm text-primary underline" to="/account/sauvegardes">
          Ouvrir les sauvegardes et la synchronisation existantes
        </Link>
      </section>
      <nav className="flex flex-wrap gap-2" aria-label="Gestion à distance">
        {(
          [
            ["sources", "Playlists"],
            ["backup", "Sauvegardes"],
            ["jobs", "Suivi des commandes"],
          ] as const
        ).map(([k, label]) => (
          <Button
            key={k}
            aria-pressed={tab === k}
            variant={tab === k ? "default" : "outline"}
            onClick={() => setTab(k)}
          >
            {label}
          </Button>
        ))}
      </nav>
      {tab === "sources" &&
        (device?.catalog ? (
          <>
            <Sources
              key={device.id + device.catalog.context}
              device={device}
              catalog={device.catalog}
              busy={busy}
              fail={setError}
              save={(action) => send(action, queued)}
            />
            {device.catalog.layout &&
              device.catalog.active &&
              (device.catalog.layoutComplete ? (
                <Layout
                  key={device.id + device.catalog.context}
                  device={device}
                  catalog={device.catalog}
                  busy={busy}
                  save={(action) => send(action, queued)}
                />
              ) : (
                <p className={card}>
                  Le catalogue est trop volumineux pour modifier la visibilité des catégories depuis
                  le panneau. Utilisez les réglages de l’application.
                </p>
              ))}
          </>
        ) : (
          <p className={card}>
            Ouvrez l’application sur le profil associé pour afficher ses playlists.
          </p>
        ))}
      {tab === "backup" && (
        <>
          <section className={card}>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <HardDrive size={20} /> Créer une sauvegarde
            </h2>
            <p className="text-sm text-muted-foreground">
              La sauvegarde complète inclut les catégories, groupes, favoris, liste à voir et
              historique de la playlist ouverte. Elle ne contient aucun lien de playlist ni mot de
              passe.
            </p>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!device) return;
                const values = new FormData(event.currentTarget);
                void send(
                  {
                    action: "backup",
                    device: device.id,
                    name: String(values.get("name")),
                    full: values.has("full"),
                  },
                  queued,
                );
              }}
            >
              <label className="grid gap-1 text-sm">
                Nom
                <Input name="name" required maxLength={64} />
              </label>
              <label className="flex items-center gap-2 py-2 text-sm">
                <input type="checkbox" name="full" disabled={!device?.catalog?.active} /> Inclure la
                playlist et l’historique
              </label>
              <Button disabled={busy || !device?.catalog}>Sauvegarder</Button>
            </form>
          </section>
          <section className={card}>
            <h2 className="text-lg font-semibold">Sauvegardes enregistrées</h2>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const values = new FormData(form);
                const file = values.get("file");
                if (!(file instanceof File) || file.size > 400_000) {
                  setError("Sélectionnez un fichier de sauvegarde VYRO valide.");
                  return;
                }
                void file
                  .text()
                  .then((text) => tvBackupFile.parse(JSON.parse(text)))
                  .then(async (file) => {
                    if (
                      await send(
                        { action: "import", name: String(values.get("name")), file },
                        "Sauvegarde importée.",
                      )
                    )
                      form.reset();
                  })
                  .catch(() => setError("Ce fichier n’est pas une sauvegarde VYRO compatible."));
              }}
            >
              <label className="grid gap-1 text-sm">
                Nom de l’import
                <Input name="name" required maxLength={64} />
              </label>
              <label className="grid min-w-0 gap-1 text-sm">
                Fichier JSON
                <Input name="file" type="file" accept=".json,application/json" required />
              </label>
              <Button variant="outline" disabled={busy}>
                Importer
              </Button>
            </form>
            <ul className="divide-y divide-border">
              {data?.backups.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.source} · {date(b.date)} ·{" "}
                      {b.full ? "Configuration et historique" : "Réglages"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => void exportBackup(b.id)}>
                      Exporter
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || !device?.catalog}
                      onClick={() => {
                        if (
                          device &&
                          window.confirm(
                            `Restaurer « ${b.name} » sur ${device.name} ? Les réglages sauvegardés remplaceront ceux de la destination.`,
                          )
                        )
                          void send({ action: "restore", device: device.id, backup: b.id }, queued);
                      }}
                    >
                      Restaurer sur l’appareil choisi
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("Supprimer cette sauvegarde ?"))
                          void send({ action: "delete", backup: b.id }, "Sauvegarde supprimée.");
                      }}
                    >
                      Supprimer
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {tab === "jobs" && (
        <section className={card}>
          <h2 className="text-lg font-semibold">Activité récente</h2>
          {data?.jobs.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune commande pour le moment.</p>
          )}
          <ul className="divide-y divide-border">
            {data?.jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">
                    {j.name} · {j.device}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {date(j.date)} · {status[j.status]}
                  </p>
                </div>
                {j.status === "waiting" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void send({ action: "cancel", job: j.id }, "Commande annulée.")}
                  >
                    Annuler avant envoi
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type EditorProps = {
  device: RemoteDevice;
  catalog: RemoteCatalog;
  busy: boolean;
  save: (action: RemoteWebAction) => Promise<boolean>;
};
function Sources({
  device,
  catalog,
  busy,
  save,
  fail,
}: EditorProps & { fail: (message: string) => void }) {
  const [target, setTarget] = useState("");
  const [encrypting, setEncrypting] = useState(false);
  const playlist = catalog.playlists.find((p) => p.id === target);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const raw = String(values.get("url") ?? "").trim();
    setEncrypting(true);
    try {
      const sealed = raw ? await sealPlaylistUrl(device.publicKey, raw, device.id) : undefined;
      if (
        await save({
          action: "playlist",
          device: device.id,
          context: catalog.context,
          playlist: playlist?.id ?? null,
          name: String(values.get("name")),
          sealed,
        })
      ) {
        form.reset();
        setTarget("");
      }
    } catch {
      fail(
        "Impossible de préparer cette URL. Utilisez une adresse HTTPS publique de playlist M3U.",
      );
    } finally {
      setEncrypting(false);
    }
  }
  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <ListVideo size={20} /> Sources du profil associé
      </h2>
      <label className="grid max-w-md gap-1 text-sm">
        Playlist
        <select className={select} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Ajouter une playlist M3U</option>
          {catalog.playlists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.kind === "xc" ? "Xtream" : "M3U"}
              {catalog.active === p.id ? " · ouverte" : ""}
              {!p.editable ? " · fournie par le revendeur" : ""}
            </option>
          ))}
        </select>
      </label>
      {device.edition === "show-plus" || playlist?.editable === false ? (
        <p className="text-sm text-muted-foreground">
          Cette source est gérée par un revendeur ou partagée entre plusieurs profils.
        </p>
      ) : (
        <form key={target} className="grid gap-3 md:grid-cols-2" onSubmit={(e) => void submit(e)}>
          <label className="grid gap-1 text-sm">
            Nom
            <Input name="name" defaultValue={playlist?.name} required maxLength={80} />
          </label>
          {playlist?.kind !== "xc" && (
            <label className="grid gap-1 text-sm">
              Adresse HTTPS M3U
              <Input
                name="url"
                type="url"
                autoComplete="off"
                maxLength={2048}
                required={!playlist}
                placeholder={playlist ? "Laisser vide pour garder l’adresse actuelle" : "https://…"}
              />
            </label>
          )}
          <p className="text-sm text-muted-foreground md:col-span-2">
            {playlist?.kind === "xc"
              ? "Le nom peut être modifié ici. Les identifiants et le serveur Xtream se gèrent dans l’application."
              : "L’adresse est chiffrée pour cet appareil et n’apparaît pas dans les sauvegardes. Une nouvelle URL représente une nouvelle source pour les favoris et l’historique."}
          </p>
          <Button className="justify-self-start" disabled={busy || encrypting}>
            {playlist ? "Envoyer la modification" : "Ajouter à l’appareil"}
          </Button>
        </form>
      )}
    </section>
  );
}
function Layout({ device, catalog, busy, save }: EditorProps) {
  const [layout, setLayout] = useState(() => structuredClone(catalog.layout!));
  const [search, setSearch] = useState("");
  const categories = layout.visible ?? catalog.categories.map((c) => c.id);
  const channelLabel = new Map(catalog.channels.map((c) => [c.id, c.name]));
  const update = (idx: number, next: (typeof layout.groups)[number]) =>
    setLayout((current) => ({
      ...current,
      groups: current.groups.map((g, i) => (i === idx ? next : g)),
    }));
  function move(idx: number, direction: number) {
    const groups = [...layout.groups];
    const [item] = groups.splice(idx, 1);
    if (item) groups.splice(idx + direction, 0, item);
    setLayout({ ...layout, groups });
  }
  return (
    <section className={card}>
      <h2 className="text-lg font-semibold">Catégories et groupes de la playlist ouverte</h2>
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer font-medium">
          Catégories visibles ({categories.length}/{catalog.categories.length})
        </summary>
        <div className="mt-3 max-h-60 space-y-1 overflow-auto">
          {catalog.categories.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={categories.includes(c.id)}
                onChange={(e) => {
                  const visible = e.target.checked
                    ? [...categories, c.id]
                    : categories.filter((id) => id !== c.id);
                  setLayout({
                    ...layout,
                    visible: visible.length === catalog.categories.length ? null : visible,
                  });
                }}
              />
              {c.name}
            </label>
          ))}
        </div>
      </details>
      <label className="grid max-w-md gap-1 text-sm">
        Rechercher une chaîne à ajouter
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nom de la chaîne"
        />
      </label>
      {layout.groups.map((g, i) => (
        <div key={g.id} className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid flex-1 gap-1 text-sm">
              Nom du groupe
              <Input
                value={g.name}
                maxLength={80}
                onChange={(e) => update(i, { ...g, name: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-1 py-2 text-sm">
              <input
                type="checkbox"
                checked={g.pinned}
                onChange={(e) => update(i, { ...g, pinned: e.target.checked })}
              />{" "}
              Épingler
            </label>
            <Button variant="outline" size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
              Monter
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={i === layout.groups.length - 1}
              onClick={() => move(i, 1)}
            >
              Descendre
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setLayout({ ...layout, groups: layout.groups.filter((_, idx) => idx !== i) })
              }
            >
              Supprimer
            </Button>
          </div>
          <label className="grid gap-1 text-sm">
            Ajouter une chaîne
            <select
              className={select}
              value=""
              onChange={(e) => {
                if (e.target.value) update(i, { ...g, channels: [...g.channels, e.target.value] });
              }}
            >
              <option value="">Sélectionner…</option>
              {catalog.channels
                .filter(
                  (c) =>
                    c.name.toLowerCase().includes(search.toLowerCase()) &&
                    !g.channels.includes(c.id),
                )
                .slice(0, 100)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <details>
            <summary className="cursor-pointer text-sm">
              Chaînes du groupe ({g.channels.length})
            </summary>
            <ul className="max-h-44 overflow-auto">
              {g.channels.map((id) => (
                <li className="flex items-center justify-between gap-2 text-sm" key={id}>
                  {channelLabel.get(id) ?? id}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      update(i, { ...g, channels: g.channels.filter((c) => c !== id) })
                    }
                  >
                    Retirer
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={layout.groups.length >= 80}
          onClick={() =>
            setLayout({
              ...layout,
              groups: [
                ...layout.groups,
                {
                  id: "group-" + crypto.randomUUID(),
                  name: "Nouveau groupe",
                  pinned: false,
                  channels: [],
                },
              ],
            })
          }
        >
          Ajouter un groupe
        </Button>
        <Button
          disabled={busy || layout.groups.some((g) => !g.name.trim())}
          onClick={() => {
            if (catalog.active)
              void save({
                action: "layout",
                device: device.id,
                context: catalog.context,
                playlist: catalog.active,
                layout,
              });
          }}
        >
          Appliquer à l’appareil
        </Button>
      </div>
    </section>
  );
}
