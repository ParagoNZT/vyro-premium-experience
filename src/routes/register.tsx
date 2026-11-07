import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/site/Button";
import { AuthShell, Field, PortalNotice } from "@/components/site/AuthShell";

const searchSchema = z.object({
  redirect: z
    .enum([
      "/admin",
      "/account/abonnement",
      "/account/appareils",
      "/account/telechargement",
      "/account/guides",
      "/account/profil",
      "/account/support",
    ])
    .optional()
    .catch(undefined),
  plan: z.enum(["3m", "6m", "12m"]).optional().catch(undefined),
});

export const Route = createFileRoute("/register")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Créer un compte – VYRO Premium" }, { name: "robots", content: "noindex" }],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { ready, signUp } = useAuth();
  const navigate = useNavigate();
  const { redirect, plan } = Route.useSearch();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingEmail, setAwaitingEmail] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    setError("");
    if (!firstName.trim()) {
      setError("Renseignez votre prénom.");
      return;
    }
    setBusy(true);
    try {
      const created = await signUp(firstName.trim(), email.trim(), password);
      setPassword("");
      if (!created) setAwaitingEmail(true);
      else if (redirect) await navigate({ to: redirect });
      else if (plan) await navigate({ to: "/checkout", search: { plan } });
      else await navigate({ to: "/account" });
    } catch (issue) {
      setError(
        issue instanceof Error && !(issue instanceof TypeError)
          ? issue.message
          : "Création impossible. Réessayez.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      label="Nouveau compte"
      title={awaitingEmail ? "Confirmez votre adresse." : "Créez votre compte VYRO."}
      subtitle={
        awaitingEmail
          ? "La confirmation de votre adresse est nécessaire avant de vous connecter."
          : "Votre compte vous permet de retrouver votre accès et les appareils liés à votre licence."
      }
      footer={
        !awaitingEmail && (
          <p className="text-sm text-muted-foreground">
            Déjà un compte ?{" "}
            <Link
              to="/login"
              search={{ redirect, plan }}
              className="text-primary underline-offset-4 hover:underline"
            >
              Se connecter
            </Link>
          </p>
        )
      }
    >
      {awaitingEmail ? (
        <div className="space-y-4">
          <MailCheck aria-hidden className="size-7 text-primary" />
          <p role="status" className="break-words text-sm leading-relaxed text-muted-foreground">
            Si cette adresse peut être utilisée, un lien vous sera envoyé à{" "}
            <strong className="text-foreground">{email.trim()}</strong>. Pensez à vérifier les
            courriers indésirables. Si vous avez déjà un compte, connectez-vous.
          </p>
          <Button to="/login" search={{ redirect, plan }} size="sm">
            Aller à la connexion
          </Button>
          <button
            type="button"
            onClick={() => setAwaitingEmail(false)}
            className="block min-h-10 text-sm text-primary hover:underline"
          >
            Corriger mon adresse
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" aria-busy={busy}>
          <Field
            label="Prénom"
            value={firstName}
            onChange={setFirstName}
            autoComplete="given-name"
            maxLength={80}
            required
          />
          <Field
            label="Adresse e-mail"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            maxLength={254}
            required
          />
          <Field
            label="Mot de passe"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={12}
            maxLength={256}
            hint="12 caractères minimum."
            required
          />
          {error && <PortalNotice error>{error}</PortalNotice>}
          <Button type="submit" disabled={!ready || busy} className="w-full">
            {busy ? "Création…" : "Créer mon compte"}
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Consultez les{" "}
            <Link
              to="/legal/conditions"
              className="text-primary underline-offset-4 hover:underline"
            >
              conditions d’utilisation
            </Link>{" "}
            et la{" "}
            <Link
              to="/legal/confidentialite"
              className="text-primary underline-offset-4 hover:underline"
            >
              politique de confidentialité
            </Link>
            .
          </p>
        </form>
      )}
    </AuthShell>
  );
}
