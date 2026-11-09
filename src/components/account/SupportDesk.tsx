import { Check, Clock3, RotateCcw } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { portalApi } from "@/lib/portal-api";
import type { Ticket, TicketDetail } from "@/lib/support.server";

const labels = {
  open: "Ouvert",
  processing: "En cours de traitement",
  waiting: "En attente du client",
  closed: "Clôturé",
} as const;
const badgeColors = {
  open: "bg-secondary text-secondary-foreground",
  processing: "bg-amber-100 text-amber-950",
  waiting: "bg-sky-100 text-sky-950",
  closed: "bg-muted text-muted-foreground",
};

function TicketStatus({ status }: { status: Ticket["status"] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeColors[status]}`}
    >
      {labels[status]}
    </span>
  );
}
const categories = {
  application: "Application",
  account: "Compte",
  payment: "Paiement",
  other: "Autre",
};
const control =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const date = (value: string) => new Date(value).toLocaleString("fr-FR");

export function SupportDesk({ admin = false }: { admin?: boolean }) {
  const prefix = `/api/support-tickets?view=${admin ? "admin" : "mine"}` as const;
  const [list, setList] = useState<{ tickets: Ticket[]; hasMore: boolean }>();
  const [detail, setDetail] = useState<TicketDetail>();
  const [active, setActive] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void portalApi<{ tickets: Ticket[]; hasMore: boolean }>(
      `${prefix}&page=${page}&status=${filter}`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) setList(value);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : "Liste indisponible.");
      });
    return () => controller.abort();
  }, [prefix, filter, page, version]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void portalApi<TicketDetail>(`${prefix}&id=${active}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : "Ticket indisponible.");
      });
    return () => controller.abort();
  }, [prefix, active, version]);
  async function save(data: Record<string, string>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await portalApi<{ id: string }>(prefix, { method: "POST", body: data });
      setActive(result.id);
      setCreating(false);
      if (data["action"] !== "status") setMessage("");
      if (data["action"] === "status") setNotice("Statut du ticket mis à jour.");
      setVersion((x) => x + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer la demande.");
    } finally {
      setBusy(false);
    }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void save({
      action: "create",
      subject: String(data.get("subject")),
      category: String(data.get("category")),
      message: String(data.get("message")),
    });
  }
  const ticket = active === detail?.ticket.id ? detail.ticket : undefined;
  return (
    <section
      className={admin ? "va-card p-5" : "portal-panel mt-8 p-5"}
      aria-label={admin ? "Tickets de support" : "Mes tickets"}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">
          {admin ? "Tickets de support" : "Mes demandes d’assistance"}
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setVersion((x) => x + 1)}>
            Actualiser
          </Button>
          {!admin && (
            <Button
              size="sm"
              onClick={() => {
                setCreating(!creating);
                setActive("");
                setError("");
              }}
            >
              Nouveau ticket
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="my-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-4 rounded-md bg-secondary p-3 text-sm text-secondary-foreground"
        >
          {notice}
        </p>
      )}
      {creating ? (
        <form className="mt-5 grid gap-3" onSubmit={create}>
          <label className="grid gap-1 text-sm">
            Sujet
            <Input name="subject" required minLength={4} maxLength={120} />
          </label>
          <label className="grid gap-1 text-sm">
            Catégorie
            <select name="category" className={control}>
              {Object.entries(categories).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Votre demande
            <textarea
              name="message"
              className={control}
              rows={4}
              required
              minLength={2}
              maxLength={4000}
            />
            <small className="text-muted-foreground">
              N’indiquez ni mot de passe ni clé de licence.
            </small>
          </label>
          <Button className="justify-self-start" disabled={busy}>
            Créer le ticket
          </Button>
        </form>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="space-y-3">
            <label className="grid gap-1 text-sm">
              Statut
              <select
                className={control}
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setPage(0);
                  setActive("");
                }}
              >
                <option value="">Tous les tickets</option>
                {Object.entries(labels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {list?.tickets.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === active}
                className="block w-full break-words rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-primary aria-pressed:border-primary"
                onClick={() => {
                  setActive(item.id);
                  setMessage("");
                  setError("");
                }}
              >
                <strong>{item.subject}</strong>
                <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <TicketStatus status={item.status} /> {date(item.updatedAt)}
                </span>
              </button>
            ))}
            {list?.tickets.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun ticket.</p>
            )}
            {((list?.hasMore ?? false) || page > 0) && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Précédente
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!list?.hasMore}
                  onClick={() => setPage(page + 1)}
                >
                  Suivante
                </Button>
              </div>
            )}
          </div>
          <div className="min-w-0 rounded-lg border border-border p-4">
            {!ticket ? (
              <p className="text-sm text-muted-foreground">
                {active
                  ? "Chargement du ticket…"
                  : "Sélectionnez un ticket pour afficher la conversation."}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-words text-lg font-semibold">{ticket.subject}</h3>
                  <TicketStatus status={ticket.status} />
                </div>
                <p className="mb-4 break-words text-xs text-muted-foreground">
                  {categories[ticket.category]}
                  {ticket.email ? " · " + ticket.email : ""}
                </p>
                <div className="mb-4 flex flex-wrap gap-2 border-b border-border pb-4">
                  {admin && ticket.status !== "closed" && ticket.status !== "processing" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void save({ action: "status", id: ticket.id, status: "processing" })
                      }
                    >
                      <Clock3 aria-hidden /> Mettre en cours
                    </Button>
                  )}
                  {ticket.status !== "closed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void save({ action: "status", id: ticket.id, status: "closed" })
                      }
                    >
                      <Check aria-hidden /> Clôturer le ticket
                    </Button>
                  )}
                  {admin && ticket.status === "closed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void save({ action: "status", id: ticket.id, status: "open" })}
                    >
                      <RotateCcw aria-hidden /> Rouvrir le ticket
                    </Button>
                  )}
                </div>
                <div className="max-h-[25rem] space-y-3 overflow-y-auto">
                  {detail?.replies.map((reply) => (
                    <article key={reply.id} className="rounded-lg border border-border p-3">
                      <p className="text-xs font-semibold">
                        {reply.author === "support" ? "Assistance VYRO" : "Client"} ·{" "}
                        {date(reply.createdAt)}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                        {reply.message}
                      </p>
                    </article>
                  ))}
                </div>
                {ticket.status !== "closed" && (
                  <form
                    className="mt-4 grid gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void save({ action: "reply", id: ticket.id, message });
                    }}
                  >
                    <label className="grid gap-1 text-sm">
                      Votre réponse
                      <textarea
                        className={control}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                        minLength={2}
                        maxLength={4000}
                        rows={3}
                      />
                    </label>
                    <Button size="sm" className="justify-self-start" disabled={busy}>
                      Répondre
                    </Button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
