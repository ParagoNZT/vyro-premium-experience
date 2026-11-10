import { useEffect, useRef, useState, type FormEvent } from "react";
import { Mail, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { portalApi, PortalApiError } from "@/lib/portal-api";
import type { MessageRecipient } from "@/lib/vyro-inbox.server";

const endpoint = "/api/vyro-inbox?view=admin" as const;
export function PrivateMessageComposer({
  onAccessDenied,
}: {
  onAccessDenied: (status: 401 | 403) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MessageRecipient[] | null>(null);
  const [selected, setSelected] = useState<MessageRecipient | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController>(null);
  useEffect(() => () => abort.current?.abort(), []);
  function fail(err: unknown) {
    if (err instanceof PortalApiError && (err.status === 401 || err.status === 403))
      onAccessDenied(err.status);
    else setError(err instanceof Error ? err.message : "La messagerie est indisponible.");
  }
  async function search(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setError("");
    setStatus("");
    setSelected(null);
    setResults(null);
    setBusy(true);
    try {
      const response = await portalApi<{ recipients: MessageRecipient[] }>(
        `${endpoint}&q=${encodeURIComponent(value)}`,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) setResults(response.recipients);
    } catch (err) {
      if (!controller.signal.aborted) fail(err);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await portalApi(endpoint, {
        method: "POST",
        body: {
          action: "send",
          client: selected.id,
          title: data.get("title"),
          body: data.get("body"),
        },
      });
      setStatus(`Message envoyé à ${selected.username || selected.email}.`);
      form.reset();
      setSelected(null);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="max-w-3xl space-y-4 rounded-xl border border-border bg-card p-5">
      <h2>Message privé</h2>
      <p className="text-sm text-muted-foreground">
        Choisissez un compte VYRO. Le message sera visible dans son espace client et sur ses
        appareils VYRO associés.
      </p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void search(e)}>
        <label className="grid flex-1 gap-1 text-sm font-medium">
          Nom d’utilisateur du destinataire
          <Input
            type="search"
            required
            minLength={2}
            maxLength={80}
            value={query}
            onChange={(e) => {
              abort.current?.abort();
              setQuery(e.target.value);
              setBusy(false);
              setResults(null);
              setSelected(null);
            }}
            placeholder="Nom d’utilisateur ou e-mail"
            disabled={busy && selected !== null}
          />
        </label>
        <Button type="submit" variant="outline" disabled={busy || query.trim().length < 2}>
          <Search aria-hidden /> Rechercher
        </Button>
      </form>
      {results?.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          Aucun compte actif trouvé.
        </p>
      )}
      {results && results.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border px-3">
          {results.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0 text-sm">
                <p className="font-medium break-words">{item.username || "Compte VYRO"}</p>
                <p className="text-muted-foreground break-all">
                  {item.email} · {item.devices} appareil(s) VYRO
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                aria-pressed={selected?.id === item.id}
                onClick={() => {
                  setSelected(item);
                  setStatus("");
                }}
              >
                Choisir
              </Button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <form key={selected.id} onSubmit={(e) => void submit(e)} className="grid gap-3">
          <p className="break-all rounded-md bg-muted px-3 py-2 text-sm">
            À : <strong>{selected.username || "Compte VYRO"}</strong> · {selected.email}
          </p>
          {selected.devices === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun appareil associé. Le message sera visible dans l’espace client.
            </p>
          )}
          <label className="grid gap-1 text-sm font-medium">
            Titre du message privé
            <Input name="title" required minLength={3} maxLength={100} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Message
            <textarea
              className="min-h-24 rounded-md border border-input bg-background p-2 text-sm"
              name="body"
              required
              minLength={3}
              maxLength={1000}
            />
          </label>
          <Button className="justify-self-start" disabled={busy}>
            <Mail aria-hidden /> Envoyer le message privé
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="text-sm">
          {status}
        </p>
      )}
    </section>
  );
}
