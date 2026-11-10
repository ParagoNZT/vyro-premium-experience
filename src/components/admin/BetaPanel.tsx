import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ChevronRight,
  Copy,
  Eye,
  Monitor,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  TvMinimal,
} from "lucide-react";
import { portalApi, PortalApiError } from "@/lib/portal-api";
import { AdminDialog, AdminField, AdminNotice } from "./AdminControls";
import { AdminPagination, AdminStats, AdminStatus } from "./AdminTable";
import { TvPanelLink } from "./TvPanelLink";

type Access = {
  id: string;
  name: string;
  enabled: number;
  maxDevices: number;
  expiresAt: string | null;
  deviceCount: number;
  lastSeen: string | null;
  resellerName: string | null;
  scopeKey: string;
  clientEmail: string | null;
  hasRecoverableKey: number;
  managedOnSite: number;
};
export type BetaPage = {
  page: number;
  codes: Access[];
  hasMore: boolean;
  stats: { accesses: number; activeAccesses: number; devices: number };
  resellers: { id: string; name: string; kind: "reseller" | "partner" }[];
};
type DialogState = { kind: "edit" | "reveal"; access: Access };

function inputDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function origin(access: Access) {
  if (access.scopeKey === "show-plus") return "SHOW+";
  if (access.scopeKey === "review") return "SHOW+ · À vérifier";
  if (access.scopeKey.startsWith("reseller:"))
    return access.resellerName ? "Revendeur · " + access.resellerName : "Revendeur";
  if (access.scopeKey.startsWith("partner:"))
    return access.resellerName ? "Application · " + access.resellerName : "Application partenaire";
  return access.managedOnSite ? "Client direct · VYRO" : "Client direct";
}

function accessStatus(access: Access) {
  if (!access.enabled) return { label: "Désactivé", tone: "neutral" } as const;
  if (access.expiresAt && Date.parse(access.expiresAt) <= Date.now())
    return { label: "Expiré", tone: "warning" } as const;
  return access.resellerName
    ? ({ label: "Activé", tone: "neutral" } as const)
    : ({ label: "Actif", tone: "positive" } as const);
}

function AccessStatus({ access }: { access: Access }) {
  const { label, tone } = accessStatus(access);
  return <AdminStatus tone={tone}>{label}</AdminStatus>;
}

export function BetaPanel({ onAccessDenied }: { onAccessDenied: (status: 401 | 403) => void }) {
  const [data, setData] = useState<{ result: BetaPage; key: string } | null>(null);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("direct");
  const [sort, setSort] = useState("recent");
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inspector = useRef<HTMLHeadingElement>(null);
  const dialogTrigger = useRef<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const keyRevision = useRef(0);
  const [expiry, setExpiry] = useState("");
  const [limit, setLimit] = useState("1");
  const [enabled, setEnabled] = useState(true);
  const [note, setNote] = useState("");

  const params = new URLSearchParams({ page: String(page), q: search, scope, sort }).toString();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void portalApi<BetaPage>(`/api/beta?${params}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setData({ result, key: params });
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
  }, [params, version, onAccessDenied]);

  useEffect(() => {
    if (dialog?.kind !== "reveal") return;
    function hide() {
      ++keyRevision.current;
      setCode(null);
      setDialog(null);
    }
    function onVisibilityChange() {
      if (document.hidden) hide();
    }
    const timer = code ? window.setTimeout(hide, 60_000) : undefined;
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [dialog, code]);

  function open(kind: DialogState["kind"], access: Access, trigger: HTMLElement) {
    dialogTrigger.current = trigger;
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
      } else {
        const result = await portalApi<{ code: string }>("/api/beta-key", {
          method: "POST",
          body: { id: access.id, action: "reveal" },
        });
        if (typeof result.code !== "string" || !result.code)
          throw new Error("Aucune clé n’a été renvoyée.");
        if (revision === keyRevision.current && document.hasFocus() && !document.hidden)
          setCode(result.code);
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
    const revision = keyRevision.current;
    try {
      await navigator.clipboard.writeText(code);
      if (revision !== keyRevision.current) return;
      close();
      setNotice("Clé copiée.");
    } catch {
      if (revision === keyRevision.current)
        setFormError("Le navigateur n’a pas autorisé la copie.");
    }
  }

  const result = data?.key === params ? data.result : null;
  const stats = result?.stats;
  const resellers = data?.result.resellers.filter((item) => item.kind === "reseller") ?? [];
  const partners = data?.result.resellers.filter((item) => item.kind === "partner") ?? [];
  const selected = result?.codes.find((access) => access.id === selectedId) ?? result?.codes[0];

  function select(access: Access) {
    setSelectedId(access.id);
    if (window.matchMedia("(max-width: 64rem)").matches)
      window.requestAnimationFrame(() => inspector.current?.focus());
  }

  return (
    <div className="va-stack">
      <AdminStats
        stats={[
          { label: "Accès enregistrés", value: stats?.accesses ?? "—", Icon: Monitor },
          { label: "Accès actifs", value: stats?.activeAccesses ?? "—", Icon: ShieldCheck },
          { label: "Appareils liés", value: stats?.devices ?? "—", Icon: TvMinimal },
        ]}
      />
      {notice && <AdminNotice>{notice}</AdminNotice>}
      <div className="va-access-grid">
        <section className="va-card va-access-list" aria-labelledby="va-access-list-title">
          <div className="va-card-head">
            <div>
              <h2 id="va-access-list-title">Liste des accès TV</h2>
              <p>Choisissez les clients directs, SHOW+ ou un revendeur précis.</p>
            </div>
            <button
              className="va-button va-button-secondary va-refresh"
              type="button"
              aria-label="Actualiser les accès TV"
              title="Actualiser les accès TV"
              disabled={loading}
              onClick={() => setVersion((value) => value + 1)}
            >
              <RefreshCw size={17} aria-hidden />
            </button>
          </div>
          <div className="va-toolbar">
            <label className="va-field">
              <span>Périmètre</span>
              <select
                value={scope}
                onChange={(event) => {
                  setScope(event.target.value);
                  setPage(0);
                  setSelectedId(null);
                  setNotice("");
                }}
              >
                <optgroup label="Accès directs et SHOW+">
                  <option value="direct">Clients directs VYRO</option>
                  <option value="show-plus">Tous les accès SHOW+</option>
                </optgroup>
                {resellers.length > 0 && (
                  <optgroup label="Revendeurs">
                    <option value="resellers">Tous les revendeurs</option>
                    {resellers.map((reseller) => (
                      <option key={reseller.id} value={`reseller:${reseller.id}`}>
                        {reseller.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {partners.length > 0 && (
                  <optgroup label="Applications partenaires">
                    <option value="partners">Toutes les applications partenaires</option>
                    {partners.map((partner) => (
                      <option key={partner.id} value={`partner:${partner.id}`}>
                        {partner.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Vue d’ensemble">
                  <option value="all">Tous les accès</option>
                  <option value="review">SHOW+ · Accès à vérifier</option>
                </optgroup>
              </select>
            </label>
            <label className="va-field">
              <span>Trier par</span>
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(0);
                  setSelectedId(null);
                }}
              >
                <option value="recent">Ajouts récents</option>
                <option value="name">Nom du client</option>
                <option value="reseller">Revendeur, puis nom</option>
              </select>
            </label>
          </div>
          <form
            className="va-toolbar"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(0);
              setSearch(query.trim());
              setSelectedId(null);
              setNotice("");
              setVersion((value) => value + 1);
            }}
          >
            <AdminField
              label="Rechercher un accès TV"
              type="search"
              value={query}
              onChange={setQuery}
              maxLength={80}
              placeholder="Nom, e-mail ou revendeur"
            />
            <button className="va-button va-button-primary" type="submit" disabled={loading}>
              <Search size={16} aria-hidden /> Rechercher
            </button>
            {search && (
              <button
                className="va-button va-button-secondary"
                type="button"
                disabled={loading}
                onClick={() => {
                  setQuery("");
                  setSearch("");
                  setPage(0);
                  setSelectedId(null);
                  setNotice("");
                }}
              >
                Effacer
              </button>
            )}
          </form>
          {error ? (
            <AdminNotice error>{error}</AdminNotice>
          ) : !result ? (
            <p className="va-state" role="status">
              Chargement des accès TV…
            </p>
          ) : result.codes.length === 0 ? (
            <p className="va-state" role="status">
              {search
                ? "Aucun accès TV ne correspond à cette recherche."
                : "Aucun accès TV dans ce périmètre."}
            </p>
          ) : (
            <>
              <div className="va-access-columns" aria-hidden>
                <span>Nom / origine</span>
                <span>État</span>
                <span>Appareils</span>
                <span />
              </div>
              <ul className="va-access-rows" aria-busy={loading}>
                {result.codes.map((access) => (
                  <li key={access.id}>
                    <button
                      type="button"
                      aria-pressed={selected?.id === access.id}
                      aria-controls="va-access-inspector"
                      className="va-access-row"
                      onClick={() => select(access)}
                    >
                      <span className="va-access-name">
                        <span className="va-row-icon" aria-hidden>
                          <Monitor size={18} />
                        </span>
                        <span>
                          <strong>{access.name}</strong>
                          <small>{origin(access)}</small>
                        </span>
                      </span>
                      <AccessStatus access={access} />
                      <span className="va-row-devices">
                        <span className="sr-only">Appareils liés : </span>
                        {access.deviceCount} / {access.maxDevices}
                      </span>
                      <ChevronRight size={17} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <AdminPagination
            page={page}
            hasMore={!!result?.hasMore}
            busy={loading}
            onChange={(next) => {
              setSelectedId(null);
              setNotice("");
              setPage(next);
            }}
          />
        </section>
        <section
          className="va-card va-inspector"
          id="va-access-inspector"
          aria-labelledby="va-inspector-title"
        >
          <div className="va-inspector-top">
            <span className="va-metric-icon" aria-hidden>
              <Monitor size={21} />
            </span>
            <p className="va-eyebrow">Fiche accès TV</p>
            <h2 id="va-inspector-title" ref={inspector} tabIndex={-1}>
              {selected?.name ?? "Détails de l’accès"}
            </h2>
            {selected?.clientEmail && <p>{selected.clientEmail}</p>}
          </div>
          {selected ? (
            <>
              <dl className="va-details">
                <div>
                  <dt>État du code</dt>
                  <dd>
                    <AccessStatus access={selected} />
                  </dd>
                </div>
                <div>
                  <dt>Origine</dt>
                  <dd>{origin(selected)}</dd>
                </div>
                <div>
                  <dt>Échéance</dt>
                  <dd>
                    {selected.expiresAt
                      ? new Date(selected.expiresAt).toLocaleDateString("fr-FR")
                      : "Sans expiration"}
                  </dd>
                </div>
                <div>
                  <dt>Appareils liés / autorisés</dt>
                  <dd>
                    {selected.deviceCount} / {selected.maxDevices}
                  </dd>
                </div>
                {selected.lastSeen && (
                  <div>
                    <dt>Dernière activité TV</dt>
                    <dd>{new Date(selected.lastSeen).toLocaleString("fr-FR")}</dd>
                  </div>
                )}
              </dl>
              <div className="va-inspector-actions">
                {selected.managedOnSite ? (
                  <>
                    <button
                      type="button"
                      className="va-button va-button-primary"
                      aria-disabled={loading || busy}
                      onClick={(event) => {
                        if (!loading && !busy) open("edit", selected, event.currentTarget);
                      }}
                    >
                      <Pencil size={16} aria-hidden /> Modifier l’accès
                    </button>
                    {selected.hasRecoverableKey ? (
                      <button
                        type="button"
                        className="va-button va-button-secondary"
                        disabled={loading || busy}
                        onClick={(event) => open("reveal", selected, event.currentTarget)}
                      >
                        <Eye size={16} aria-hidden /> Consulter la clé
                      </button>
                    ) : (
                      <p>Aucune clé disponible sur le site pour cet accès.</p>
                    )}
                  </>
                ) : (
                  <p>Cet accès et ses clés se gèrent dans le panneau TV.</p>
                )}
              </div>
            </>
          ) : (
            <p className="va-inspector-empty">
              {error
                ? "Réessayez de charger la liste pour afficher une fiche."
                : "Sélectionnez un accès dans la liste pour afficher sa fiche."}
            </p>
          )}
        </section>
      </div>
      <div className="va-card va-tv-service">
        <TvPanelLink />
      </div>
      <AdminDialog
        open={!!dialog}
        busy={busy}
        title={dialog?.kind === "edit" ? "Modifier l’accès TV" : "Consulter la clé TV"}
        description={
          dialog?.kind === "edit"
            ? "Les appareils et les clés existants sont conservés."
            : "La consultation est journalisée. La clé se masque après une minute ou quand vous quittez la fenêtre."
        }
        onClose={close}
        returnFocus={() =>
          dialogTrigger.current?.isConnected ? dialogTrigger.current : inspector.current
        }
      >
        <form className="va-form" onSubmit={submit} aria-busy={busy}>
          {dialog && (
            <p>
              Accès : <strong>{dialog.access.name}</strong>
            </p>
          )}
          {dialog?.kind === "edit" && (
            <>
              <AdminField
                label="Fin de l’accès"
                type="date"
                value={expiry}
                onChange={setExpiry}
                hint="Laissez vide pour un accès sans expiration."
              />
              <AdminField
                label="Nombre d’appareils autorisés"
                type="number"
                value={limit}
                onChange={setLimit}
                min={Math.max(1, dialog.access.deviceCount)}
                max={10}
                required
              />
              <label className="va-checkbox">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                />{" "}
                Accès activé
              </label>
              <AdminField label="Motif" value={note} onChange={setNote} maxLength={300} required />
            </>
          )}
          {code && <code className="va-key">{code}</code>}
          {formError && <AdminNotice error>{formError}</AdminNotice>}
          <div className="va-actions">
            {code ? (
              <button
                className="va-button va-button-primary"
                type="button"
                onClick={() => void copy()}
              >
                <Copy size={16} aria-hidden /> Copier et masquer
              </button>
            ) : (
              <button className="va-button va-button-primary" type="submit" disabled={busy}>
                {busy
                  ? "Veuillez patienter…"
                  : dialog?.kind === "edit"
                    ? "Enregistrer"
                    : "Afficher la clé"}
              </button>
            )}
            <button
              className="va-button va-button-secondary"
              type="button"
              onClick={close}
              disabled={busy}
            >
              {code ? "Masquer" : "Annuler"}
            </button>
          </div>
        </form>
      </AdminDialog>
    </div>
  );
}
