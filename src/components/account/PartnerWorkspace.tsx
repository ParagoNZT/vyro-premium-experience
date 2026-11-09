import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { portalApi } from "@/lib/portal-api";
import type {
  PartnerActivity,
  PartnerApp,
  PartnerOrder,
  PartnerOverview,
} from "@/lib/partner-control.server";
import type { ShowDirectoryPage } from "@/lib/show-directory.server";
import { ShowDirectory } from "./ShowDirectory";

type Device = ShowDirectoryPage["devices"][number];
const textArea =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const orderStatus = {
  pending: "En attente de règlement",
  paid: "Règlement confirmé",
  cancelled: "Annulée",
};
const commandStatus = {
  queued: "En attente",
  expired: "Expirée",
  applied: "Terminée",
  failed: "Échec signalé",
  message: "Message enregistré",
};
const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const shortDate = (value: string) => new Date(value).toLocaleDateString("fr-FR");
const formValues = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
};

export function PartnerWorkspace({ admin = false }: { admin?: boolean }) {
  const url = `/api/partner-control?view=${admin ? "admin" : "mine"}` as const;
  const [data, setData] = useState<PartnerOverview>();
  const [active, setActive] = useState("");
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<PartnerOrder>();
  const [device, setDevice] = useState<Device>();
  const [activity, setActivity] = useState<PartnerActivity>();
  const devicePanel = useRef<HTMLElement>(null);
  const app = data?.apps.find((item) => item.id === active) ?? data?.apps[0];
  useEffect(() => {
    const controller = new AbortController();
    void portalApi<PartnerOverview>(`${url}&page=${page}`, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : "Espace indisponible.");
      });
    return () => controller.abort();
  }, [url, page, version]);
  const appId = app?.id;
  const deviceId = device?.id;
  useEffect(() => {
    if (!appId || !deviceId) return;
    const controller = new AbortController();
    void portalApi<PartnerActivity>(`${url}&app=${appId}&target=${deviceId}`, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setActivity(value);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : "Historique indisponible.");
      });
    return () => controller.abort();
  }, [url, appId, deviceId, version]);
  async function save(body: Record<string, unknown>, success: string, reset?: HTMLFormElement) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await portalApi(url, { method: "POST", body });
      setNotice(success);
      if (body["action"] === "decision") setOrder(undefined);
      setVersion((x) => x + 1);
      reset?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "L’action n’a pas pu être enregistrée.");
    } finally {
      setBusy(false);
    }
  }
  function manage(next: Device) {
    setDevice(next);
    setActivity(undefined);
    setNotice("");
    setError("");
    requestAnimationFrame(() => devicePanel.current?.focus());
  }
  return (
    <div className="mt-6 space-y-5">
      <div aria-live="polite" className="space-y-2">
        {notice && (
          <p className="rounded-lg border border-primary/40 bg-card px-4 py-3 text-sm">{notice}</p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>
      {data && data.apps.length > 0 && (
        <label className="grid max-w-md gap-1 text-sm font-medium">
          Application à gérer
          <select
            className={textArea}
            value={app?.id ?? ""}
            onChange={(e) => {
              setActive(e.target.value);
              setDevice(undefined);
              setActivity(undefined);
            }}
          >
            {data.apps.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {app && (
        <>
          <AppSettings key={app.id} app={app} admin={admin} busy={busy} save={save} />
          {device && (
            <section
              ref={devicePanel}
              tabIndex={-1}
              aria-label="Actions sur l’appareil"
              className="rounded-xl border border-primary/40 bg-card p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold">{device.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {device.supportRef ?? "Référence d’assistance non renseignée"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setDevice(undefined)}>
                  Fermer la fiche
                </Button>
              </div>
              <div className="mt-4 grid gap-5 lg:grid-cols-2">
                <form
                  key={device.id}
                  className="grid gap-2"
                  onSubmit={(event) => {
                    const targetForm = event.currentTarget;
                    const values = formValues(event);
                    void save(
                      {
                        action: "message",
                        app: app.id,
                        target: device.id,
                        title: values["title"],
                        message: values["message"],
                      },
                      "Message enregistré. Il apparaîtra lors de la prochaine connexion de l’appareil.",
                      targetForm,
                    );
                  }}
                >
                  <label className="grid gap-1 text-sm">
                    Titre du message
                    <Input name="title" required minLength={2} maxLength={100} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Message dans l’application
                    <textarea
                      className={textArea}
                      name="message"
                      rows={3}
                      required
                      minLength={2}
                      maxLength={1000}
                    />
                  </label>
                  <Button
                    size="sm"
                    disabled={busy || !device.enabled}
                    className="justify-self-start"
                  >
                    Envoyer à cet appareil
                  </Button>
                </form>
                <div className="space-y-3">
                  <h3 className="font-medium">Actualisation à distance</h3>
                  <p className="text-sm text-muted-foreground">
                    {device.commandReady
                      ? "L’appareil traitera la demande dès sa prochaine connexion."
                      : "Une version compatible doit se connecter avant de recevoir ces commandes."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(["playlist", "epg"] as const).map((kind) => (
                      <Button
                        key={kind}
                        variant="outline"
                        size="sm"
                        disabled={busy || !device.enabled || !device.commandReady}
                        onClick={() =>
                          void save(
                            { action: "refresh", app: app.id, target: device.id, kind },
                            "Demande d’actualisation enregistrée.",
                          )
                        }
                      >
                        {kind === "playlist"
                          ? "Actualiser la playlist"
                          : "Actualiser le guide TV (EPG)"}
                      </Button>
                    ))}
                  </div>
                  {activity?.recent.length ? (
                    <ul className="space-y-1 text-sm">
                      {activity.recent.map((item) => (
                        <li key={item.id}>
                          {item.kind === "epg" ? "Guide TV" : "Playlist"} ·{" "}
                          {commandStatus[item.state]} · {shortDate(item.createdAt)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => setVersion((x) => x + 1)}>
                    Actualiser le suivi
                  </Button>
                </div>
              </div>
            </section>
          )}
          <ShowDirectory
            key={app.id}
            app={app.id}
            name={app.name}
            admin={admin}
            onManage={manage}
          />
        </>
      )}
      {!admin && (
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Applications personnalisées
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold">Commander votre application</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong>100 €</strong> pour la création de votre application. En option,{" "}
            <strong>20 €/an</strong> pour les mises à jour publiées pendant la période couverte.
          </p>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              const targetForm = event.currentTarget;
              const values = formValues(event);
              void save(
                { action: "order", name: values["name"], packageName: values["packageName"] },
                "Demande enregistrée. Aucun paiement n’a été prélevé.",
                targetForm,
              );
            }}
          >
            <label className="grid gap-1 text-sm">
              Nom de l’application
              <Input name="name" required minLength={2} maxLength={60} />
            </label>
            <label className="grid gap-1 text-sm">
              Identifiant Android
              <Input name="packageName" placeholder="com.votremarque.tv" required maxLength={140} />
            </label>
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Le paiement en ligne est désactivé. L’équipe VYRO confirme le règlement avant de
              préparer l’application.
            </p>
            <Button size="sm" className="justify-self-start" disabled={busy}>
              Demander l’application · 100 €
            </Button>
          </form>
        </section>
      )}
      {data && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">
            {admin ? "Commandes et règlements" : "Mes demandes"}
          </h2>
          {data.orders.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">Aucune demande enregistrée.</p>
          )}
          <ul className="mt-3 divide-y divide-border">
            {data.orders.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {item.name} · {item.kind === "app" ? "Application" : "Mises à jour, 1 an"} ·{" "}
                    {euro.format(item.cents / 100)}
                  </p>
                  <p className="break-words text-muted-foreground">
                    {orderStatus[item.status]} · {shortDate(item.createdAt)}
                    {item.email ? " · " + item.email : ""}
                  </p>
                </div>
                {admin && item.status === "pending" && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setOrder(item)}>
                    Traiter
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {admin && order && (
            <form
              key={order.id}
              className="mt-3 space-y-3 rounded-lg border border-primary/40 p-4"
              onSubmit={(event) => {
                const paid =
                  (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "paid";
                const values = formValues(event);
                void save(
                  { action: "decision", id: order.id, paid, receipt: values["receipt"] },
                  paid ? "Règlement enregistré." : "Demande annulée.",
                );
              }}
            >
              <p className="text-sm font-medium">
                {order.name} · {euro.format(order.cents / 100)} · {order.email}
              </p>
              <label className="grid gap-1 text-sm">
                Référence du règlement ou motif
                <Input name="receipt" required minLength={4} maxLength={160} />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" name="decision" value="paid" disabled={busy}>
                  Confirmer le règlement reçu
                </Button>
                <Button size="sm" variant="outline" name="decision" value="cancel" disabled={busy}>
                  Annuler la demande
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setOrder(undefined)}>
                  Fermer
                </Button>
              </div>
            </form>
          )}
          {(page > 0 || data.hasMore) && (
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Précédente
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.hasMore}
                onClick={() => setPage(page + 1)}
              >
                Suivante
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function AppSettings({
  app,
  admin,
  busy,
  save,
}: {
  app: PartnerApp;
  admin: boolean;
  busy: boolean;
  save: (body: Record<string, unknown>, success: string, reset?: HTMLFormElement) => Promise<void>;
}) {
  const initial = admin && app.id !== "show-plus" && !app.version;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <form
        className="space-y-3 rounded-xl border border-border bg-card p-5"
        onSubmit={(event) => {
          const values = formValues(event);
          void save(
            {
              action: "server",
              app: app.id,
              url: values["url"],
              confirmed: values["confirmed"] === "on",
            },
            "Adresse du serveur enregistrée.",
          );
        }}
      >
        <h2 className="font-display text-lg font-semibold">Adresse du serveur XC</h2>
        <p className="text-sm text-muted-foreground">
          Cette adresse s’applique à {app.name}. Les appareils qui utilisent une playlist attribuée
          gardent leur source.
        </p>
        <label className="grid gap-1 text-sm">
          URL HTTPS
          <Input
            name="url"
            type="url"
            placeholder="https://serveur.exemple.fr"
            defaultValue={app.serverUrl ?? ""}
            required
            maxLength={2048}
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirmed" className="mt-1" required /> Je contrôle ce
          domaine et confirme que l’application peut y connecter les comptes de mes utilisateurs.
        </label>
        <Button size="sm" disabled={busy}>
          Enregistrer l’adresse
        </Button>
      </form>
      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Mises à jour de {app.name}</h2>
        <p className="break-words text-sm text-muted-foreground">
          {app.packageName} ·{" "}
          {app.version ? `Version ${app.version}` : "Aucun APK livré via le site"}
        </p>
        {admin && app.id !== "show-plus" && (
          <p className="break-all text-xs text-muted-foreground">
            Identifiant de l’application : {app.id}
          </p>
        )}
        {app.apkUrl && (
          <a
            className="text-sm text-primary underline"
            href={app.apkUrl}
            target="_blank"
            rel="noreferrer"
          >
            Télécharger la dernière version accessible
          </a>
        )}
        {app.id !== "show-plus" && (
          <p className="text-sm text-muted-foreground">
            {app.coveredUntil
              ? `Couverture jusqu’au ${shortDate(app.coveredUntil)}`
              : "Aucune période de mises à jour active."}
          </p>
        )}
        {!admin && app.id !== "show-plus" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              void save(
                { action: "renew", app: app.id },
                "Demande de mises à jour enregistrée. Aucun paiement n’a été prélevé.",
              )
            }
          >
            Demander 1 an de mises à jour · 20 €
          </Button>
        )}
        {app.canPublish || initial ? (
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              const targetForm = event.currentTarget;
              const values = formValues(event);
              void save(
                {
                  action: "release",
                  app: app.id,
                  versionName: values["versionName"],
                  versionCode: Number(values["versionCode"]),
                  url: values["url"],
                  sha256: values["sha256"],
                  changelog: values["changelog"],
                  initial,
                },
                "Version publiée pour cette application.",
                targetForm,
              );
            }}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Version affichée
                <Input name="versionName" required placeholder="1.0.46" maxLength={40} />
              </label>
              <label className="grid gap-1 text-sm">
                Numéro de build
                <Input name="versionCode" type="number" required min={1} max={10000000} />
              </label>
            </div>
            <label className="grid gap-1 text-sm">
              URL HTTPS de l’APK signé
              <Input name="url" type="url" required maxLength={2048} />
            </label>
            <label className="grid gap-1 text-sm">
              Empreinte SHA‑256
              <Input
                name="sha256"
                required
                minLength={64}
                maxLength={64}
                pattern="[A-Fa-f0-9]{64}"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Notes de version
              <textarea className={textArea} name="changelog" maxLength={1200} rows={2} />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" required /> Je confirme que cet APK correspond
              à {app.name} et utilise sa clé de signature.
            </label>
            <Button size="sm" disabled={busy} className="justify-self-start">
              {initial ? "Livrer le premier APK" : "Publier la mise à jour"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            La publication d’une mise à jour nécessite une période de couverture active.
          </p>
        )}
      </section>
    </div>
  );
}
