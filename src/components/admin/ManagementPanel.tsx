import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CreditCard,
  KeyRound,
  Monitor,
  RefreshCw,
  ScrollText,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PLANS, formatPrice, getPlan } from "@/config/site";
import type { AdminOverview, ClientRow, LicenseRow } from "@/lib/management-types";
import { portalApi, PortalApiError } from "@/lib/portal-api";
import { AdminDialog, AdminField, AdminNotice } from "./AdminControls";
import { AdminPagination, AdminStats, AdminStatus, AdminTable } from "./AdminTable";
import { BetaPanel, type BetaPage } from "./BetaPanel";
import type { AdminSection } from "./sections";
import { TvPanelLink } from "./TvPanelLink";
import { SupportDesk } from "@/components/account/SupportDesk";
import { PartnerWorkspace } from "@/components/account/PartnerWorkspace";
import { VyroAppPanel } from "./VyroAppPanel";

type OnDenied = (status: 401 | 403) => void;
type Action =
  | { kind: "client" }
  | { kind: "grant"; client: ClientRow }
  | { kind: "status"; client: ClientRow }
  | { kind: "revoke"; license: LicenseRow };

const auditLabels: Record<string, string> = {
  "access-key-viewed": "Clé consultée",
  "access-key-shared": "Clé de partage demandée",
  "beta-access-change-requested": "Modification d’accès TV demandée",
  "beta-access-updated": "Accès TV modifié",
  "client-created": "Fiche client créée",
  "license-granted": "Licence attribuée ou prolongée",
  "license-revoked": "Licence révoquée",
  "client-suspended": "Client suspendu",
  "client-active": "Client réactivé",
  "payment-paid": "Paiement confirmé",
  "test-payment-paid": "Paiement de test confirmé",
  "payment-refunded": "Paiement remboursé",
};
const paymentLabels: Record<string, string> = {
  pending: "En attente",
  paid: "Payé",
  failed: "Échoué",
  refunded: "Remboursé",
};

function date(value: string | null) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("fr-FR")
    : "—";
}

function stripeLabel({ configured, live }: AdminOverview["stripe"]) {
  return !configured ? "Désactivé" : live ? "Activé" : "Mode test";
}

function Overview({
  data,
  version,
  onAccessDenied,
}: {
  data: AdminOverview;
  version: number;
  onAccessDenied: OnDenied;
}) {
  const [tv, setTv] = useState<{ stats?: BetaPage["stats"]; failed?: boolean }>({});

  useEffect(() => {
    const controller = new AbortController();
    void portalApi<BetaPage>("/api/beta?page=0", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setTv({ stats: result.stats });
      })
      .catch((issue: unknown) => {
        if (controller.signal.aborted) return;
        if (issue instanceof PortalApiError && (issue.status === 401 || issue.status === 403))
          onAccessDenied(issue.status);
        else setTv({ failed: true });
      });
    return () => controller.abort();
  }, [onAccessDenied, version]);

  return (
    <>
      <AdminStats
        stats={[
          { label: "Clients enregistrés", value: data.stats?.clients ?? "—", Icon: Users },
          { label: "Licences actives", value: data.stats?.activeLicenses ?? "—", Icon: KeyRound },
          { label: "Accès TV actifs", value: tv.stats?.activeAccesses ?? "—", Icon: Monitor },
          {
            label: "Paiements réels encaissés",
            value: data.stats ? formatPrice(data.stats.paidCents / 100) : "—",
            Icon: CreditCard,
          },
        ]}
      />
      {tv.failed && (
        <AdminNotice error>Impossible de charger le nombre d’accès TV actifs.</AdminNotice>
      )}
      <div className="va-overview-grid">
        <section className="va-card" aria-labelledby="va-recent">
          <div className="va-card-head">
            <div>
              <h2 id="va-recent">Dernières opérations</h2>
              <p>Les dernières entrées du journal d’administration.</p>
            </div>
            <Link className="va-text-link" to="/admin" search={{ section: "audit" }}>
              Tout le journal <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
          {data.audit.length ? (
            <ul className="va-timeline">
              {data.audit.slice(0, 5).map((row) => (
                <li key={row.id}>
                  <span className="va-row-icon">
                    <ScrollText size={16} aria-hidden />
                  </span>
                  <div>
                    <strong>{auditLabels[row.action] ?? row.action}</strong>
                    <p>{row.note || (row.actor_id === "stripe" ? "Stripe" : "Administrateur")}</p>
                  </div>
                  <time dateTime={row.created_at}>{date(row.created_at)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="va-state">Aucune opération enregistrée.</p>
          )}
        </section>
        <section className="va-card" aria-labelledby="va-services">
          <div className="va-card-head">
            <div>
              <h2 id="va-services">Services</h2>
              <p>Accédez aux outils de gestion.</p>
            </div>
          </div>
          <div className="va-services">
            <div className="va-service">
              <span className="va-metric-icon">
                <Monitor size={20} aria-hidden />
              </span>
              <div>
                <Link to="/admin" search={{ section: "beta" }} className="va-text-link">
                  Gérer les accès TV <ArrowRight size={16} aria-hidden />
                </Link>
                <p>
                  {tv.stats
                    ? new Intl.NumberFormat("fr-FR").format(tv.stats.devices) + " appareils liés"
                    : "Licences et clés d’activation"}
                </p>
              </div>
            </div>
            <div className="va-service">
              <span className="va-metric-icon">
                <CreditCard size={20} aria-hidden />
              </span>
              <div>
                <Link to="/admin" search={{ section: "payments" }} className="va-text-link">
                  Paiements Stripe <ArrowRight size={16} aria-hidden />
                </Link>
                <p>
                  <AdminStatus
                    tone={
                      data.stripe.configured
                        ? data.stripe.live
                          ? "positive"
                          : "warning"
                        : "neutral"
                    }
                  >
                    {stripeLabel(data.stripe)}
                  </AdminStatus>
                </p>
              </div>
            </div>
            <TvPanelLink />
          </div>
        </section>
      </div>
    </>
  );
}

export function ManagementPanel({
  section,
  onAccessDenied,
}: {
  section: AdminSection;
  onAccessDenied: OnDenied;
}) {
  return section === "beta" ? (
    <BetaPanel onAccessDenied={onAccessDenied} />
  ) : section === "support" ? (
    <SupportDesk admin />
  ) : section === "partners" ? (
    <PartnerWorkspace admin />
  ) : section === "vyro" ? (
    <VyroAppPanel onAccessDenied={onAccessDenied} />
  ) : (
    <ManagementSection section={section} onAccessDenied={onAccessDenied} />
  );
}

function ManagementSection({
  section,
  onAccessDenied,
}: {
  section: Exclude<AdminSection, "beta" | "support" | "partners" | "vyro">;
  onAccessDenied: OnDenied;
}) {
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [planId, setPlanId] = useState("12m");
  const [limit, setLimit] = useState("3");
  const [note, setNote] = useState("");
  const dialogTrigger = useRef<HTMLButtonElement | null>(null);
  const sectionHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void portalApi<AdminOverview>(`/api/manage?page=${page}`, { signal: controller.signal })
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
            issue instanceof PortalApiError ? issue.message : "Impossible de charger la gestion.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, version, onAccessDenied]);

  function openForm(next: Action, trigger: HTMLButtonElement) {
    dialogTrigger.current = trigger;
    setFirstName("");
    setEmail("");
    setNote("");
    setPlanId("12m");
    setLimit("3");
    setFormError("");
    setNotice("");
    setAction(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || busy) return;
    setBusy(true);
    setFormError("");
    try {
      const body =
        action.kind === "client"
          ? { action: "create-client", firstName, email }
          : action.kind === "grant"
            ? {
                action: "grant-license",
                clientId: action.client.id,
                planId,
                deviceLimit: Number(limit),
                note,
              }
            : action.kind === "status"
              ? {
                  action: "client-status",
                  clientId: action.client.id,
                  status: action.client.status === "active" ? "suspended" : "active",
                  note,
                }
              : { action: "revoke-license", licenseId: action.license.id, note };
      await portalApi<{ ok: true }>("/api/manage", { method: "POST", body });
      setAction(null);
      setNotice(
        action.kind === "client"
          ? "Fiche client créée."
          : action.kind === "grant"
            ? "Licence enregistrée."
            : action.kind === "revoke"
              ? "Licence révoquée."
              : action.client.status === "active"
                ? "Client suspendu."
                : "Client réactivé.",
      );
      if (action.kind === "client") {
        setPage(0);
        setQuery("");
      }
      setVersion((value) => value + 1);
    } catch (issue) {
      if (issue instanceof PortalApiError && (issue.status === 401 || issue.status === 403))
        onAccessDenied(issue.status);
      else
        setFormError(
          issue instanceof PortalApiError
            ? issue.message
            : "Impossible d’enregistrer cette modification.",
        );
    } finally {
      setBusy(false);
    }
  }

  const search = query.trim().toLocaleLowerCase("fr-FR");
  const match = (value: string) => value.toLocaleLowerCase("fr-FR").includes(search);
  const clients = data?.clients.filter((row) => match(row.first_name + " " + row.email)) ?? [];
  const licenses =
    data?.licenses.filter((row) =>
      match((row.email ?? "") + " " + (getPlan(row.plan_id)?.name ?? row.plan_id)),
    ) ?? [];
  const payments =
    data?.payments.filter((row) =>
      match((row.email ?? "") + " " + row.id + " " + (getPlan(row.plan_id)?.name ?? row.plan_id)),
    ) ?? [];
  const audit =
    data?.audit.filter((row) => match((auditLabels[row.action] ?? row.action) + " " + row.note)) ??
    [];
  const empty = search ? "Aucun résultat sur cette page." : "Aucun enregistrement sur cette page.";
  const formTitle =
    action?.kind === "client"
      ? "Créer une fiche client"
      : action?.kind === "grant"
        ? "Attribuer ou prolonger une licence"
        : action?.kind === "revoke"
          ? "Révoquer cette licence"
          : action?.kind === "status" && action.client.status === "active"
            ? "Suspendre l’accès client"
            : "Réactiver l’accès client";

  const tableTitle =
    section === "clients"
      ? "Fiches clients"
      : section === "licenses"
        ? "Licences VYRO"
        : section === "payments"
          ? "Transactions"
          : "Journal des actions";

  return (
    <div className="va-stack">
      {notice && <AdminNotice>{notice}</AdminNotice>}
      {error && <AdminNotice error>{error}</AdminNotice>}
      {section === "overview" ? (
        <>
          <div className="va-overview-tools">
            <h2 ref={sectionHeading} tabIndex={-1}>
              Chiffres clés
            </h2>
            <div className="va-actions">
              <button
                className="va-button va-button-secondary"
                type="button"
                disabled={loading}
                onClick={() => setVersion((value) => value + 1)}
              >
                <RefreshCw size={16} aria-hidden /> Actualiser
              </button>
              <button
                className="va-button va-button-primary"
                type="button"
                onClick={(event) => openForm({ kind: "client" }, event.currentTarget)}
              >
                <UserPlus size={17} aria-hidden /> Créer une fiche client
              </button>
            </div>
          </div>
          {data ? (
            <Overview data={data} version={version} onAccessDenied={onAccessDenied} />
          ) : (
            loading && (
              <p className="va-state" role="status">
                Chargement de la vue d’ensemble…
              </p>
            )
          )}
        </>
      ) : (
        <>
          {section === "payments" && data && (
            <section className="va-card va-stripe" aria-label="État de Stripe">
              <span className="va-metric-icon">
                <CreditCard size={20} aria-hidden />
              </span>
              <div>
                <h2>Stripe</h2>
                <p>
                  {!data.stripe.configured
                    ? "Les paiements en ligne sont désactivés. L’historique reste consultable."
                    : data.stripe.live
                      ? "Les paiements en ligne sont activés."
                      : "Stripe est en mode test."}
                </p>
              </div>
              <AdminStatus
                tone={
                  data.stripe.configured ? (data.stripe.live ? "positive" : "warning") : "neutral"
                }
              >
                {stripeLabel(data.stripe)}
              </AdminStatus>
            </section>
          )}
          <section className="va-card va-records" aria-labelledby="va-records-title">
            <div className="va-card-head">
              <div>
                <h2 id="va-records-title" ref={sectionHeading} tabIndex={-1}>
                  {tableTitle}
                </h2>
                {section === "licenses" && (
                  <p>
                    Pour attribuer une licence,{" "}
                    <Link className="va-text-link" to="/admin" search={{ section: "clients" }}>
                      ouvrez les fiches clients <ArrowRight size={14} aria-hidden />
                    </Link>
                    .
                  </p>
                )}
              </div>
              <div className="va-actions">
                <button
                  className="va-button va-button-secondary"
                  type="button"
                  disabled={loading}
                  onClick={() => setVersion((value) => value + 1)}
                >
                  <RefreshCw size={16} aria-hidden /> Actualiser
                </button>
                {section === "clients" && (
                  <button
                    className="va-button va-button-primary"
                    type="button"
                    onClick={(event) => openForm({ kind: "client" }, event.currentTarget)}
                  >
                    <UserPlus size={17} aria-hidden /> Créer une fiche client
                  </button>
                )}
              </div>
            </div>
            <div className="va-toolbar">
              <AdminField
                label="Filtrer cette page"
                type="search"
                value={query}
                onChange={setQuery}
                placeholder={
                  section === "audit"
                    ? "Action ou motif"
                    : section === "clients"
                      ? "Nom ou e-mail"
                      : section === "licenses"
                        ? "E-mail ou offre"
                        : "E-mail, offre ou référence"
                }
              />
            </div>
            {(!data || data.page !== page) && loading && (
              <p className="va-state" role="status">
                Chargement de la rubrique…
              </p>
            )}
            {data && data.page === page && (
              <div aria-busy={loading}>
                {section === "clients" && (
                  <AdminTable
                    label="Fiches clients"
                    columns={["Client", "Compte", "Statut", "Dernière visite", "Actions"]}
                    empty={clients.length ? undefined : empty}
                  >
                    {clients.map((client) => (
                      <tr key={client.id}>
                        <td className="va-person">
                          <strong>{client.first_name}</strong>
                          <small>{client.email}</small>
                        </td>
                        <td>{client.auth_user_id ? "Inscrit" : "À créer par le client"}</td>
                        <td>
                          <AdminStatus tone={client.status === "active" ? "positive" : "warning"}>
                            {client.status === "active" ? "Actif" : "Suspendu"}
                          </AdminStatus>
                        </td>
                        <td className="va-date">{date(client.last_seen_at)}</td>
                        <td>
                          <div className="va-table-actions">
                            {client.status === "active" && client.auth_user_id && (
                              <button
                                className="va-row-action"
                                type="button"
                                disabled={loading}
                                onClick={(event) =>
                                  openForm({ kind: "grant", client }, event.currentTarget)
                                }
                              >
                                Attribuer une licence
                              </button>
                            )}
                            <button
                              className="va-row-action"
                              type="button"
                              disabled={loading}
                              onClick={(event) =>
                                openForm({ kind: "status", client }, event.currentTarget)
                              }
                            >
                              {client.status === "active" ? "Suspendre" : "Réactiver"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </AdminTable>
                )}
                {section === "licenses" && (
                  <AdminTable
                    label="Licences VYRO"
                    columns={["Client", "Offre", "Échéance", "Quota TV", "Statut", "Action"]}
                    empty={licenses.length ? undefined : empty}
                  >
                    {licenses.map((license) => {
                      const active =
                        license.status !== "revoked" && Date.parse(license.expires_at) > Date.now();
                      return (
                        <tr key={license.id}>
                          <td className="va-person">{license.email ?? "—"}</td>
                          <td>{getPlan(license.plan_id)?.name ?? license.plan_id}</td>
                          <td className="va-date">{date(license.expires_at)}</td>
                          <td>{license.device_limit}</td>
                          <td>
                            <AdminStatus tone={active ? "positive" : "warning"}>
                              {license.status === "revoked"
                                ? "Révoquée"
                                : active
                                  ? "Active"
                                  : "Expirée"}
                            </AdminStatus>
                          </td>
                          <td>
                            {license.status !== "revoked" && (
                              <button
                                className="va-row-action"
                                type="button"
                                disabled={loading}
                                onClick={(event) =>
                                  openForm({ kind: "revoke", license }, event.currentTarget)
                                }
                              >
                                Révoquer
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </AdminTable>
                )}
                {section === "payments" && (
                  <AdminTable
                    label="Transactions"
                    columns={["Date", "Client", "Offre", "Montant", "Statut", "Mode"]}
                    empty={payments.length ? undefined : empty}
                  >
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="va-date">{date(payment.paid_at ?? payment.created_at)}</td>
                        <td className="va-person">{payment.email ?? "—"}</td>
                        <td>{getPlan(payment.plan_id)?.name ?? payment.plan_id}</td>
                        <td>{formatPrice(payment.amount_cents / 100)}</td>
                        <td>
                          <AdminStatus tone={payment.status === "paid" ? "positive" : "neutral"}>
                            {paymentLabels[payment.status] ?? payment.status}
                          </AdminStatus>
                        </td>
                        <td>{payment.livemode ? "Réel" : "Test"}</td>
                      </tr>
                    ))}
                  </AdminTable>
                )}
                {section === "audit" && (
                  <AdminTable
                    label="Journal des actions"
                    columns={["Date", "Action", "Motif", "Auteur"]}
                    empty={audit.length ? undefined : empty}
                  >
                    {audit.map((row) => (
                      <tr key={row.id}>
                        <td className="va-date">{date(row.created_at)}</td>
                        <td>{auditLabels[row.action] ?? row.action}</td>
                        <td className="va-person">{row.note || "—"}</td>
                        <td>{row.actor_id === "stripe" ? "Stripe" : "Administrateur"}</td>
                      </tr>
                    ))}
                  </AdminTable>
                )}
                <AdminPagination
                  page={page}
                  hasMore={data.hasMore && data[section].length === 50}
                  onChange={setPage}
                  busy={loading}
                />
              </div>
            )}
          </section>
        </>
      )}
      <AdminDialog
        open={!!action}
        busy={busy}
        title={formTitle}
        description={
          action?.kind === "client"
            ? "La fiche sera liée au compte lorsque le client confirmera son adresse. Aucun e-mail n’est envoyé ici."
            : action?.kind === "grant"
              ? "Attribution manuelle sans paiement. Une licence active est prolongée à partir de son échéance."
              : action?.kind === "status"
                ? `La modification concerne les services VYRO de ${action.client.email}. Le compte de connexion est conservé.`
                : action?.kind === "revoke"
                  ? `L’accès TV lié à cette licence sera révoqué pour ${action.license.email ?? "ce client"}.`
                  : ""
        }
        onClose={() => setAction(null)}
        returnFocus={() => {
          const trigger = dialogTrigger.current;
          return trigger?.isConnected && !trigger.disabled ? trigger : sectionHeading.current;
        }}
      >
        <form className="va-form" onSubmit={submit} aria-busy={busy}>
          {action?.kind === "client" && (
            <>
              <AdminField
                label="Prénom"
                value={firstName}
                onChange={setFirstName}
                maxLength={80}
                required
              />
              <AdminField
                label="Adresse e-mail du client"
                type="email"
                value={email}
                onChange={setEmail}
                maxLength={254}
                required
              />
            </>
          )}
          {action?.kind === "grant" && (
            <>
              <p>
                Client : <strong>{action.client.email}</strong>
              </p>
              <div className="va-form-grid">
                <label className="va-field">
                  Durée
                  <select value={planId} onChange={(event) => setPlanId(event.target.value)}>
                    {PLANS.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </label>
                <AdminField
                  label="Appareils autorisés"
                  type="number"
                  value={limit}
                  onChange={setLimit}
                  min={1}
                  max={10}
                  required
                />
              </div>
            </>
          )}
          {action?.kind !== "client" && (
            <AdminField label="Motif" value={note} onChange={setNote} maxLength={300} required />
          )}
          {formError && <AdminNotice error>{formError}</AdminNotice>}
          <div className="va-actions">
            <button className="va-button va-button-primary" type="submit" disabled={busy}>
              {busy ? "Enregistrement…" : "Confirmer"}
            </button>
            <button
              className="va-button va-button-secondary"
              type="button"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Annuler
            </button>
          </div>
        </form>
      </AdminDialog>
    </div>
  );
}
