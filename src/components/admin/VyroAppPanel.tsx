import { Download, Megaphone, RefreshCw } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { portalApi, PortalApiError } from "@/lib/portal-api";
import { PrivateMessageComposer } from "./PrivateMessageComposer";
import type { VyroConsole } from "@/lib/vyro-app-contract";
import { AdminNotice } from "./AdminControls";

const control =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
const label = "grid gap-1.5 text-sm font-medium";
const time = (value: string) => new Date(value).toLocaleString("fr-FR");
const endpoint = "/api/vyro-console";

export function VyroAppPanel({ onAccessDenied }: { onAccessDenied: (status: 401 | 403) => void }) {
  const [view, setView] = useState<"releases" | "messages">("releases");
  const [state, setState] = useState<VyroConsole>();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const request = new AbortController();
    void portalApi<VyroConsole>(endpoint, { signal: request.signal })
      .then((data) => {
        if (!request.signal.aborted) setState(data);
      })
      .catch((issue: unknown) => {
        if (request.signal.aborted) return;
        if (issue instanceof PortalApiError && (issue.status === 401 || issue.status === 403))
          onAccessDenied(issue.status);
        else setError(issue instanceof Error ? issue.message : "L’état du canal est indisponible.");
      });
    return () => request.abort();
  }, [revision, onAccessDenied]);
  async function save(payload: Record<string, unknown>, message: string, form?: HTMLFormElement) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await portalApi(endpoint, { method: "POST", body: payload });
      setNotice(message);
      setRevision((x) => x + 1);
      form?.reset();
    } catch (issue) {
      if (issue instanceof PortalApiError && (issue.status === 401 || issue.status === 403))
        onAccessDenied(issue.status);
      else setError(issue instanceof Error ? issue.message : "L’action n’a pas été enregistrée.");
    } finally {
      setBusy(false);
    }
  }
  const current = state?.published;
  const queued = state?.queued;
  const pending = queued && (!current || current.versionCode < queued.versionCode);
  function release(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void save(
      {
        action: "release",
        versionName: data.get("versionName"),
        versionCode: Number(data.get("versionCode")),
        apkUrl: data.get("apkUrl"),
        sha256: data.get("sha256"),
        changelog: data.get("changelog"),
        confirmed: data.get("confirmed") === "on",
      },
      "Demande enregistrée. Le canal vérifiera l’APK avant de le diffuser.",
      form,
    );
  }
  function announce(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void save(
      {
        action: "announce",
        title: data.get("title"),
        body: data.get("body"),
        days: Number(data.get("days")),
        confirmed: data.get("confirmed") === "on",
      },
      "Annonce publiée dans le fil de VYRO.",
      form,
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <nav aria-label="Canal VYRO officiel" className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={view === "releases" ? "secondary" : "ghost"}
            aria-pressed={view === "releases"}
            onClick={() => setView("releases")}
          >
            <Download aria-hidden /> Mises à jour
          </Button>
          <Button
            size="sm"
            variant={view === "messages" ? "secondary" : "ghost"}
            aria-pressed={view === "messages"}
            onClick={() => setView("messages")}
          >
            <Megaphone aria-hidden /> Messages
          </Button>
        </nav>
        <Button size="sm" variant="outline" onClick={() => setRevision((x) => x + 1)}>
          <RefreshCw aria-hidden /> Actualiser
        </Button>
      </div>
      {error && <AdminNotice error>{error}</AdminNotice>}
      {notice && <AdminNotice>{notice}</AdminNotice>}
      {view === "releases" ? (
        <>
          <section className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Application originale · com.vyro.tv
            </p>
            <h2 className="mt-1">Version diffusée</h2>
            <p className="mt-2 text-muted-foreground">
              {!state
                ? "Vérification du canal…"
                : current
                  ? `${current.versionName} · Build ${current.versionCode}`
                  : "Canal de mise à jour indisponible."}
            </p>
            {state && !state.publicationReady && (
              <p className="mt-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-950">
                Publication désactivée : le certificat officiel de VYRO doit être renseigné.
              </p>
            )}
            {pending && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
                <p>
                  En attente de vérification : {queued.versionName} · Build {queued.versionCode} ·{" "}
                  {time(queued.createdAt)}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !current}
                  onClick={() =>
                    void save(
                      { action: "withdraw", versionCode: queued.versionCode },
                      "Demande retirée.",
                    )
                  }
                >
                  Retirer la demande
                </Button>
              </div>
            )}
            <a
              className="mt-3 inline-block text-sm font-semibold text-primary underline"
              href="https://github.com/ParagoNZT/VYRO-Updates/actions/workflows/sync-vyro.yml"
              target="_blank"
              rel="noreferrer"
            >
              Voir le journal de publication
            </a>
          </section>
          <form
            onSubmit={release}
            className="max-w-3xl space-y-4 rounded-xl border border-border bg-card p-5"
          >
            <h2>Publier une mise à jour VYRO</h2>
            <p className="text-muted-foreground">
              Ajoutez le lien de l’APK signé dans les Releases VYRO. Le paquet, le certificat et
              l’empreinte seront vérifiés avant la diffusion.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>
                Nom de version
                <Input name="versionName" required maxLength={40} placeholder="0.24.50" />
              </label>
              <label className={label}>
                Numéro de build
                <Input
                  name="versionCode"
                  type="number"
                  min={(current?.versionCode ?? 0) + 1}
                  max={10000000}
                  required
                />
              </label>
            </div>
            <label className={label}>
              Lien de l’APK
              <Input
                name="apkUrl"
                type="url"
                required
                maxLength={512}
                placeholder="https://github.com/ParagoNZT/VYRO-Updates/releases/download/…"
              />
            </label>
            <label className={label}>
              Empreinte SHA-256
              <Input
                name="sha256"
                minLength={64}
                maxLength={64}
                pattern="[A-Fa-f0-9]{64}"
                required
              />
            </label>
            <label className={label}>
              Notes de version
              <textarea name="changelog" className={control} rows={3} maxLength={1200} />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="confirmed" className="mt-1 accent-primary" required />
              Je confirme la diffusion de cette mise à jour aux appareils VYRO.
            </label>
            <Button disabled={busy || !current || !state?.publicationReady}>
              <Download aria-hidden />{" "}
              {pending ? "Remplacer la demande" : "Mettre en file de publication"}
            </Button>
          </form>
        </>
      ) : (
        <>
          <PrivateMessageComposer onAccessDenied={onAccessDenied} />
          <form
            onSubmit={announce}
            className="max-w-3xl space-y-4 rounded-xl border border-border bg-card p-5"
          >
            <h2>Annonce à tous les appareils</h2>
            <p className="text-muted-foreground">
              Ce message est destiné à tous les appareils VYRO compatibles. Il apparaît dans
              l’application à sa prochaine connexion.
            </p>
            <label className={label}>
              Titre
              <Input name="title" required minLength={3} maxLength={100} />
            </label>
            <label className={label}>
              Message public
              <textarea
                name="body"
                className={control}
                rows={4}
                required
                minLength={3}
                maxLength={1000}
              />
            </label>
            <label className={label}>
              Durée d’affichage
              <select className={control} name="days" defaultValue="7">
                <option value="7">7 jours</option>
                <option value="30">30 jours</option>
                <option value="90">90 jours</option>
              </select>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="confirmed" className="mt-1 accent-primary" required />
              Je confirme l’envoi à tous les appareils VYRO compatibles.
            </label>
            <Button disabled={busy}>
              <Megaphone aria-hidden /> Publier le message
            </Button>
          </form>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2>Historique des annonces</h2>
            {state?.announcements.length === 0 && (
              <p className="mt-3 text-muted-foreground">Aucune annonce publiée.</p>
            )}
            <ul className="mt-3 divide-y divide-border">
              {state?.announcements.map((item) => {
                const expired = Date.parse(item.expiresAt) <= Date.now();
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-4"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{item.title}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words">{item.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {time(item.createdAt)} ·{" "}
                        {item.revokedAt
                          ? "Retirée"
                          : expired
                            ? "Expirée"
                            : `Visible jusqu’au ${time(item.expiresAt)}`}
                      </p>
                    </div>
                    {!item.revokedAt && !expired && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void save({ action: "revoke", id: item.id }, "Annonce retirée.")
                        }
                      >
                        Retirer
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
