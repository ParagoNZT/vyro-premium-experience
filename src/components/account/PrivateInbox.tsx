import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { portalApi } from "@/lib/portal-api";
import type { InboxMessage } from "@/lib/vyro-inbox.server";

const endpoint = "/api/vyro-inbox";
export function PrivateInbox() {
  const [messages, setMessages] = useState<InboxMessage[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>();
  const [version, refresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void portalApi<{ messages: InboxMessage[] }>(endpoint, { signal: controller.signal })
      .then(({ messages }) => {
        if (!controller.signal.aborted) {
          setMessages(messages);
          setError("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Impossible de charger les messages.");
      });
    return () => controller.abort();
  }, [version]);
  async function act(id: string, action: "read" | "dismiss") {
    setBusy(id);
    try {
      await portalApi(endpoint, { method: "POST", body: { id, action } });
      setMessages((items) =>
        items?.flatMap((item) =>
          item.id !== id ? [item] : action === "read" ? [{ ...item, read: true }] : [],
        ),
      );
      setError("");
    } catch {
      setError("L’action n’a pas pu être enregistrée.");
    } finally {
      setBusy(undefined);
    }
  }
  return (
    <section id="messages" className="portal-panel max-w-2xl space-y-3 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">Messages privés</h2>
        <Button variant="outline" size="sm" onClick={() => refresh((v) => v + 1)}>
          Actualiser
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!messages && !error && (
        <p role="status" className="text-sm text-muted-foreground">
          Chargement des messages…
        </p>
      )}
      {messages?.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucun message privé.</p>
      )}
      <ul className="divide-y divide-border">
        {messages?.map((message) => (
          <li key={message.id} className="space-y-2 py-3">
            <p className="break-words font-semibold">{message.title}</p>
            <p className="break-words text-xs text-muted-foreground">
              {message.sender} · {new Date(message.createdAt).toLocaleDateString("fr-FR")} ·{" "}
              {message.read ? "Lu" : "Non lu"}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
            <div className="flex flex-wrap gap-2">
              {!message.read && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => void act(message.id, "read")}
                >
                  Marquer comme lu
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={!!busy}
                onClick={() => void act(message.id, "dismiss")}
              >
                Retirer de ma boîte
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
