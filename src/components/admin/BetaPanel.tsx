import { useEffect, useRef, useState, type FormEvent } from "react";
import { Copy, Eye, RefreshCw } from "lucide-react";
import { Field, PortalNotice } from "@/components/site/AuthShell";
import { Button } from "@/components/site/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { portalApi, PortalApiError } from "@/lib/portal-api";
import { AdminPagination, AdminStats, AdminTable } from "./AdminTable";

type Access = {
  id: string;
  name: string;
  enabled: number;
  maxDevices: number;
  expiresAt: string | null;
  deviceCount: number;
  lastSeen: string | null;
  resellerName: string | null;
  clientEmail: string | null;
  hasRecoverableKey: number;
};
type Page = {
  page: number;
  codes: Access[];
  hasMore: boolean;
  stats: { accesses: number; activeAccesses: number; devices: number };
};
type DialogState = { kind: "edit" | "reveal" | "share"; access: Access };

function inputDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function BetaPanel({
  onSaved,
  onAccessDenied,
}: {
  onSaved: () => void;
  onAccessDenied: (status: 401 | 403) => void;
}) {
  const [data, setData] = useState<Page | null>(null);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const keyRevision = useRef(0);
  const [expiry, setExpiry] = useState("");
  const [limit, setLimit] = useState("1");
  const [enabled, setEnabled] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void portalApi<Page>(`/api/beta?page=${page}&q=${encodeURIComponent(search)}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((issue: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        if (issue instanceof PortalApiError && (issue.status === 401 || issue.status === 403))
          onAccessDenied(issue.status);
        else
          setError(
            issue instanceof PortalApiError ? issue.message : "Impossible de charger les accès TV.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, search, version, onAccessDenied]);

  useEffect(() => {
    if (!dialog || dialog.kind === "edit") return;
    function hide() {
      ++keyRevision.current;
      setCode(null);
      setDialog(null);
    }
    const timer = window.setTimeout(hide, 60_000);
    window.addEventListener("blur", hide);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("blur", hide);
    };
  }, [dialog]);

  function open(kind: DialogState["kind"], access: Access) {
    ++keyRevision.current;
    setCode(null);
    setNotice("");
    setFormError("");
    setNote("");
    setExpiry(inputDate(access.expiresAt));
    setLimit(String(access.maxDevices));
    setEnabled(Boolean(access.enabled));
    setDialog({ kind, access });
  }

  function close() {
    ++keyRevision.current;
    setCode(null);
    setDialog(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog || busy) return;
    const { kind, access } = dialog;
    const revision = keyRevision.current;
    setBusy(true);
    setFormError("");
    try {
      if (kind === "edit") {
        const expiresAt =
          expiry === inputDate(access.expiresAt)
            ? access.expiresAt
            : expiry
              ? new Date(expiry + "T23:59:59.999").toISOString()
              : null;
        await portalApi<{ ok: true }>("/api/beta", {
          method: "POST",
          body: { id: access.id, enabled, maxDevices: Number(limit), expiresAt, note },
        });
        close();
        setNotice("Accès TV mis à jour.");
        setVersion((value) => value + 1);
        onSaved();
      } else {
        const result = await portalApi<{ code: string }>("/api/beta-key", {
          method: "POST",
          body: { id: access.id, action: kind },
        });
        if (typeof result.code !== "string" || !result.code)
          throw new Error("Aucune clé n’a été renvoyée.");
        if (revision === keyRevision.current && document.hasFocus()) setCode(result.code);
        if (kind === "share") {
          setVersion((value) => value + 1);
          onSaved();
        }
      }
    } catch (issue) {
      if (issue instanceof PortalApiError && (issue.status === 401 || issue.status === 403))
        onAccessDenied(issue.status);
      else if (revision === keyRevision.current)
        setFormError(
          issue instanceof PortalApiError ? issue.message : "Impossible de terminer cette action.",
        );
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      close();
      setNotice("Clé copiée.");
    } catch {
      setFormError("Le navigateur n’a pas autorisé la copie.");
    }
  }

  return (
    <section aria-labelledby="tv-admin-title" className="space-y-5">
      <div>
        <h2 id="tv-admin-title" className="font-display text-xl font-semibold">
          Accès TV
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Gérez les accès VYRO et les accès des testeurs depuis la même liste.
        </p>
      </div>
      <AdminStats
        stats={[
          { label: "Accès enregistrés", value: data?.stats?.accesses ?? "—" },
          { label: "Accès actifs", value: data?.stats?.activeAccesses ?? "—" },
          { label: "Appareils liés", value: data?.stats?.devices ?? "—" },
        ]}
      />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(0);
          setSearch(query.trim());
          setVersion((value) => value + 1);
        }}
      >
        <div className="w-full max-w-sm">
          <Field
            label="Rechercher un accès TV"
            type="search"
            value={query}
            onChange={setQuery}
            maxLength={80}
            placeholder="Nom ou e-mail"
          />
        </div>
        <Button type="submit" size="sm" disabled={loading}>
          Rechercher
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={() => setVersion((value) => value + 1)}
        >
          <RefreshCw aria-hidden className="size-4" />
          Actualiser
        </Button>
      </form>
      {notice && <PortalNotice>{notice}</PortalNotice>}
      {error && <PortalNotice error>{error}</PortalNotice>}
      {loading || (data && data.page !== page) ? (
        <p role="status" className="portal-panel p-5 text-sm text-muted-foreground">
          Chargement des accès TV…
        </p>
      ) : (
        data && (
          <>
            <AdminTable
              label="Liste des accès TV"
              columns={["Nom / compte", "Origine", "Statut", "Échéance", "Appareils", "Actions"]}
              empty={data.codes.length ? undefined : "Aucun accès TV trouvé."}
            >
              {data.codes.map((access) => (
                <tr key={access.id}>
                  <td className="max-w-60 break-words">
                    <p className="font-medium">{access.name}</p>
                    {access.clientEmail && (
                      <p className="mt-1 text-xs text-muted-foreground">{access.clientEmail}</p>
                    )}
                  </td>
                  <td className="max-w-44 break-words">
                    {access.clientEmail
                      ? "VYRO"
                      : access.resellerName
                        ? `Revendeur · ${access.resellerName}`
                        : "Bêta"}
                  </td>
                  <td>
                    {!access.enabled
                      ? "Désactivé"
                      : access.expiresAt && Date.parse(access.expiresAt) <= Date.now()
                        ? "Expiré"
                        : "Actif"}
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    {access.expiresAt
                      ? new Date(access.expiresAt).toLocaleDateString("fr-FR")
                      : "Sans expiration"}
                  </td>
                  <td className="whitespace-nowrap">
                    {access.deviceCount} / {access.maxDevices}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="min-h-10 rounded-lg px-2 text-sm text-primary hover:bg-primary/10"
                        onClick={() => open("edit", access)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm text-primary hover:bg-primary/10"
                        onClick={() => open(access.hasRecoverableKey ? "reveal" : "share", access)}
                      >
                        <Eye aria-hidden className="size-4" />
                        {access.hasRecoverableKey ? "Consulter la clé" : "Créer une clé de partage"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </AdminTable>
            <AdminPagination page={page} hasMore={data.hasMore} onChange={setPage} />
          </>
        )
      )}

      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open && !busy) close();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === "edit"
                ? "Modifier l’accès TV"
                : dialog?.kind === "share"
                  ? "Créer une clé de partage"
                  : "Consulter la clé TV"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.kind === "edit"
                ? "Les appareils et les clés existants sont conservés."
                : dialog?.kind === "share"
                  ? "La clé et les appareils existants restent valides. La clé de partage donne accès à la même licence TV."
                  : "La clé sera masquée après une minute ou lorsque vous quittez la fenêtre."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
            {dialog && (
              <p className="break-words text-sm">
                Accès : <strong>{dialog.access.name}</strong>
              </p>
            )}
            {dialog?.kind === "edit" && (
              <>
                <Field
                  label="Fin de l’accès"
                  type="date"
                  value={expiry}
                  onChange={setExpiry}
                  hint="Laissez vide pour un accès sans expiration."
                />
                <Field
                  label="Nombre d’appareils autorisés"
                  type="number"
                  value={limit}
                  onChange={setLimit}
                  min={Math.max(1, dialog.access.deviceCount)}
                  max={10}
                  required
                />
                <label className="flex min-h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => setEnabled(event.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Accès activé
                </label>
                <Field label="Motif" value={note} onChange={setNote} maxLength={300} required />
              </>
            )}
            {code && (
              <code className="block break-all rounded-lg border border-border bg-surface-2 p-3 text-sm">
                {code}
              </code>
            )}
            {formError && <PortalNotice error>{formError}</PortalNotice>}
            <div className="flex flex-wrap gap-2">
              {code ? (
                <Button size="sm" onClick={() => void copy()}>
                  <Copy aria-hidden className="size-4" />
                  Copier et masquer
                </Button>
              ) : (
                <Button type="submit" size="sm" disabled={busy}>
                  {busy
                    ? "Veuillez patienter…"
                    : dialog?.kind === "edit"
                      ? "Enregistrer"
                      : dialog?.kind === "share"
                        ? "Créer la clé"
                        : "Afficher la clé"}
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={close} disabled={busy}>
                {code ? "Masquer" : "Annuler"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
