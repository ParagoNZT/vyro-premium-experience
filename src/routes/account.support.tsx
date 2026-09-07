import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/site/Button";

export const Route = createFileRoute("/account/support")({
  component: AccountSupportPage,
});

const SUBJECTS = ["Installation", "Lecture", "Compte", "Abonnement", "Autre"] as const;

function AccountSupportPage() {
  const { user } = useAuth();
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSent(true);
    setMessage("");
    setTimeout(() => setSent(false), 4000);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-semibold">Support</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Une question sur l'installation, la lecture ou votre abonnement ?
      </p>

      <form onSubmit={onSubmit} className="panel mt-8 space-y-4 p-7">
        <div>
          <label htmlFor="ticket-subject" className="text-[13px] text-muted-foreground">
            Sujet
          </label>
          <select
            id="ticket-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1.5 w-full rounded-[10px] border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-primary/60"
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ticket-message" className="text-[13px] text-muted-foreground">
            Votre message
          </label>
          <textarea
            id="ticket-message"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Décrivez votre problème, votre appareil et ce que vous avez déjà essayé."
            className="mt-1.5 w-full resize-y rounded-[10px] border border-border bg-surface-2 px-4 py-3 text-sm outline-none transition-colors duration-150 focus:border-primary/60"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Button type="submit" variant="primary" size="sm">
            Envoyer la demande
          </Button>
          {sent ? (
            <span className="text-sm text-primary">
              Demande envoyée. Réponse sous 24 à 48 h ouvrées.
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Votre demande sera rattachée à {user?.email}.
        </p>
      </form>

      <div className="panel mt-4 flex flex-wrap items-center gap-4 p-7">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Vous préférez chercher par vous-même ? Le centre d'aide couvre l'installation, la
          connexion d'une source et le dépannage.
        </p>
        <Button to="/support" variant="secondary" size="sm">
          Ouvrir le centre d'aide
        </Button>
      </div>
    </div>
  );
}
