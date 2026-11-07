import { useEffect, useState, type FormEvent } from "react";
import {
  CreditCard,
  KeyRound,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/site/Button";
import { Field, PortalNotice } from "@/components/site/AuthShell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PLANS, formatPrice, getPlan } from "@/config/site";
import type { AdminOverview, ClientRow, LicenseRow } from "@/lib/management-types";
import { portalApi, PortalApiError } from "@/lib/portal-api";
import { AdminPagination, AdminStats, AdminTable } from "./AdminTable";
import { BetaPanel } from "./BetaPanel";

const tabs = [
  { id: "clients", label: "Clients", Icon: Users },
  { id: "licenses", label: "Licences", Icon: KeyRound },
  { id: "beta", label: "Accès TV", Icon: ShieldCheck },
  { id: "payments", label: "Paiements", Icon: CreditCard },
  { id: "audit", label: "Journal", Icon: ScrollText },
] as const;
type Tab = (typeof tabs)[number]["id"];
type Action =
  | { kind: "client" }
  | { kind: "grant"; client?: ClientRow }
  | { kind: "status"; client: ClientRow }
  | { kind: "revoke"; license: LicenseRow };
const fieldClass =
  "mt-2 min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 focus-visible:border-primary focus-visible:outline-1 focus-visible:outline-primary";
const actionClass =
  "inline-flex min-h-10 items-center rounded-md px-2 text-sm font-medium text-primary hover:bg-primary/10";
const auditLabels: Record<string, string> = {
  "access-key-viewed": "Clé consultée",
  "access-key-shared": "Clé de partage demandée",
  "beta-access-change-requested": "Modification d’accès TV",
  "client-created": "Fiche créée",
  "license-granted": "Licence attribuée ou prolongée",
  "license-revoked": "Licence révoquée",
  "client-suspended": "Client suspendu",
  "client-active": "Client réactivé",
  "payment-paid": "Paiement confirmé",
  "test-payment-paid": "Paiement de test confirmé",
  "payment-refunded": "Paiement remboursé",
};

function date(value: string | null) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("fr-FR")
    : "—";
}

export function ManagementPanel({
  onAccessDenied,
}: {
  onAccessDenied: (status: 401 | 403) => void;
}) {
  const [tab, setTab] = useState<Tab>("clients");
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
  const [clientId, setClientId] = useState("");
  const [planId, setPlanId] = useState("12m");
  const [limit, setLimit] = useState("3");
  const [note, setNote] = useState("");

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

  function openForm(next: Action) {
    setFirstName("");
    setEmail("");
    setNote("");
    setPlanId("12m");
    setLimit("3");
    setClientId(next.kind === "grant" ? (next.client?.id ?? "") : "");
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
            ? { action: "grant-license", clientId, planId, deviceLimit: Number(limit), note }
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
            : "Modification enregistrée.",
      );
      if (action.kind === "client" || action.kind === "grant" || action.kind === "revoke")
        setPage(0);
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
  const payments = data?.payments.filter((row) => match((row.email ?? "") + " " + row.id)) ?? [];
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

  return (
    <div className="mt-8 space-y-5">
      <AdminStats
        stats={[
          { label: "Clients enregistrés", value: data?.stats?.clients ?? "—" },
          { label: "Licences actives", value: data?.stats?.activeLicenses ?? "—" },
          {
            label: "Paiements réels encaissés",
            value: data?.stats ? formatPrice(data.stats.paidCents / 100) : "—",
          },
        ]}
      />
      {data && (
        <p className="text-xs text-muted-foreground">
          {data.stripe.configured
            ? data.stripe.live
              ? "Stripe · Paiements réels activés"
              : "Stripe · Mode test"
            : "Stripe · Paiement indisponible"}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav className="flex flex-wrap gap-1" aria-label="Rubriques d’administration">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => {
                if (id === tab) return;
                setTab(id);
                setPage(0);
                setQuery("");
                setNotice("");
              }}
              className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm transition-colors ${tab === id ? "border-primary/30 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground"}`}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </button>
          ))}
        </nav>
        {tab === "clients" && (
          <Button size="sm" onClick={() => openForm({ kind: "client" })}>
            <UserPlus aria-hidden className="size-4" />
            Créer une fiche
          </Button>
        )}
      </div>
      {notice && <PortalNotice>{notice}</PortalNotice>}
      {error && (
        <div className="space-y-3">
          <PortalNotice error>{error}</PortalNotice>
          <Button size="sm" variant="secondary" onClick={() => setVersion((value) => value + 1)}>
            Réessayer
          </Button>
        </div>
      )}

      {tab === "beta" ? (
        <BetaPanel
          onAccessDenied={onAccessDenied}
          onSaved={() => setVersion((value) => value + 1)}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-full max-w-sm">
              <Field
                label="Filtrer cette page"
                type="search"
                value={query}
                onChange={setQuery}
                placeholder="Saisissez un terme de recherche"
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={loading}
              onClick={() => setVersion((value) => value + 1)}
            >
              <RefreshCw aria-hidden className="size-4" />
              Actualiser
            </Button>
          </div>
          {loading || (data && data.page !== page) ? (
            <p role="status" className="portal-panel p-6 text-sm text-muted-foreground">
              Chargement de la rubrique…
            </p>
          ) : (
            data && (
              <>
                {tab === "clients" && (
                  <AdminTable
                    label="Fiches clients"
                    columns={["Client", "Compte", "Statut", "Dernière visite", "Actions"]}
                    empty={clients.length ? undefined : empty}
                  >
                    {clients.map((client) => (
                      <tr key={client.id}>
                        <td className="max-w-64 break-words">
                          <p className="font-medium">{client.first_name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{client.email}</p>
                        </td>
                        <td>{client.auth_user_id ? "Inscrit" : "À créer par le client"}</td>
                        <td>{client.status === "active" ? "Actif" : "Suspendu"}</td>
                        <td className="whitespace-nowrap text-xs text-muted-foreground">
                          {date(client.last_seen_at)}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {client.status === "active" && client.auth_user_id && (
                              <button
                                type="button"
                                className={actionClass}
                                onClick={() => openForm({ kind: "grant", client })}
                              >
                                Attribuer une licence
                              </button>
                            )}
                            <button
                              type="button"
                              className={actionClass}
                              onClick={() => openForm({ kind: "status", client })}
                            >
                              {client.status === "active" ? "Suspendre" : "Réactiver"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </AdminTable>
                )}
                {tab === "licenses" && (
                  <AdminTable
                    label="Licences VYRO"
                    columns={["Client", "Offre", "Échéance", "Quota TV", "Statut", "Action"]}
                    empty={licenses.length ? undefined : empty}
                  >
                    {licenses.map((license) => (
                      <tr key={license.id}>
                        <td className="max-w-56 break-words">{license.email ?? "—"}</td>
                        <td>{getPlan(license.plan_id)?.name ?? license.plan_id}</td>
                        <td className="whitespace-nowrap text-xs">{date(license.expires_at)}</td>
                        <td>{license.device_limit}</td>
                        <td>
                          {license.status === "revoked"
                            ? "Révoquée"
                            : Date.parse(license.expires_at) > Date.now()
                              ? "Active"
                              : "Expirée"}
                        </td>
                        <td>
                          {license.status !== "revoked" && (
                            <button
                              type="button"
                              className={actionClass}
                              onClick={() => openForm({ kind: "revoke", license })}
                            >
                              Révoquer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </AdminTable>
                )}
                {tab === "payments" && (
                  <AdminTable
                    label="Paiements"
                    columns={["Date", "Client", "Offre", "Montant", "Statut", "Mode"]}
                    empty={payments.length ? undefined : empty}
                  >
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="whitespace-nowrap text-xs">
                          {date(payment.paid_at ?? payment.created_at)}
                        </td>
                        <td className="max-w-56 break-words">{payment.email ?? "—"}</td>
                        <td>{getPlan(payment.plan_id)?.name ?? payment.plan_id}</td>
                        <td className="whitespace-nowrap">
                          {formatPrice(payment.amount_cents / 100)}
                        </td>
                        <td>
                          {{
                            pending: "En attente",
                            paid: "Payé",
                            failed: "Échoué",
                            refunded: "Remboursé",
                          }[payment.status] ?? payment.status}
                        </td>
                        <td>{payment.livemode ? "Réel" : "Test"}</td>
                      </tr>
                    ))}
                  </AdminTable>
                )}
                {tab === "audit" && (
                  <AdminTable
                    label="Journal des actions"
                    columns={["Date", "Action", "Motif", "Auteur"]}
                    empty={audit.length ? undefined : empty}
                  >
                    {audit.map((row) => (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap text-xs">{date(row.created_at)}</td>
                        <td>{auditLabels[row.action] ?? row.action}</td>
                        <td className="max-w-80 break-words">{row.note}</td>
                        <td>{row.actor_id === "stripe" ? "Stripe" : "Administrateur"}</td>
                      </tr>
                    ))}
                  </AdminTable>
                )}
                <AdminPagination
                  page={page}
                  hasMore={data.hasMore && data[tab].length === 50}
                  onChange={setPage}
                />
              </>
            )
          )}
        </>
      )}

      <Dialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !busy) setAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formTitle}</DialogTitle>
            <DialogDescription>
              {action?.kind === "client"
                ? "La fiche sera liée au compte lorsque le client confirmera son adresse. Aucun e-mail n’est envoyé ici."
                : action?.kind === "grant"
                  ? "Attribution manuelle sans paiement. Une licence active est prolongée à partir de son échéance."
                  : action?.kind === "status"
                    ? `La modification concerne les services VYRO de ${action.client.email}. Le compte de connexion est conservé.`
                    : action?.kind === "revoke"
                      ? `L’accès TV lié à cette licence sera révoqué pour ${action.license.email ?? "ce client"}.`
                      : ""}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit} aria-busy={busy}>
            {action?.kind === "client" && (
              <>
                <Field
                  label="Prénom"
                  value={firstName}
                  onChange={setFirstName}
                  maxLength={80}
                  required
                />
                <Field
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
                <p className="break-words text-sm">
                  Client : <strong>{action.client?.email}</strong>
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium">
                    Durée
                    <select
                      className={fieldClass}
                      value={planId}
                      onChange={(event) => setPlanId(event.target.value)}
                    >
                      {PLANS.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
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
              <Field label="Motif" value={note} onChange={setNote} maxLength={300} required />
            )}
            {formError && <PortalNotice error>{formError}</PortalNotice>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Enregistrement…" : "Confirmer"}
              </Button>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => setAction(null)}>
                Annuler
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
