import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, MailCheck } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { ScreeningAuth, ScreeningField, ScreeningNotice } from "@/components/site/ScreeningAuth";
import { PACK_IDS } from "@/config/site";

const searchSchema = z.object({
  redirect: z
    .enum([
      "/admin",
      "/associer",
      "/account/abonnement",
      "/account/appareils",
      "/account/gestion",
      "/account/sauvegardes",
      "/account/telechargement",
      "/account/guides",
      "/account/profil",
      "/account/support",
    ])
    .optional()
    .catch(undefined),
  plan: z.enum(PACK_IDS).optional().catch(undefined),
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
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingEmail, setAwaitingEmail] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    setError("");
    if (!username.trim()) {
      setError("Renseignez votre nom d’utilisateur.");
      return;
    }
    setBusy(true);
    try {
      const created = await signUp(username.trim(), email.trim(), password);
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
    <ScreeningAuth
      label="Nouveau compte"
      title={awaitingEmail ? "Confirmez votre adresse" : "Créer un compte"}
      subtitle={
        awaitingEmail
          ? "La confirmation de votre adresse est nécessaire avant de vous connecter."
          : "Retrouvez votre licence et les appareils qui y sont associés."
      }
      action={
        !awaitingEmail && (
          <>
            <p>Déjà un compte ?</p>
            <Link to="/login" search={{ redirect, plan }} className="screening-auth__cta">
              Se connecter <ArrowRight size={16} aria-hidden />
            </Link>
          </>
        )
      }
    >
      {awaitingEmail ? (
        <div className="screening-auth__confirmation">
          <MailCheck size={28} aria-hidden />
          <ScreeningNotice>
            Si cette adresse peut être utilisée, un lien vous sera envoyé à{" "}
            <strong>{email.trim()}</strong>. Pensez à vérifier les courriers indésirables. Si vous
            avez déjà un compte, connectez-vous.
          </ScreeningNotice>
          <Link to="/login" search={{ redirect, plan }} className="screening-auth__submit">
            Aller à la connexion
          </Link>
          <button
            type="button"
            onClick={() => setAwaitingEmail(false)}
            className="screening-auth__text-button"
          >
            Corriger mon adresse
          </button>
        </div>
      ) : (
        <form method="post" onSubmit={onSubmit} className="screening-auth__form" aria-busy={busy}>
          <ScreeningField
            label="Nom d’utilisateur"
            name="username"
            value={username}
            onChange={setUsername}
            autoComplete="nickname"
            hint="Ce nom s’affiche dans votre espace client."
            maxLength={80}
            required
          />
          <ScreeningField
            label="Adresse e-mail"
            name="email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            maxLength={254}
            required
          />
          <ScreeningField
            label="Mot de passe"
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={12}
            maxLength={256}
            hint="12 caractères minimum."
            required
          />
          {error && <ScreeningNotice error>{error}</ScreeningNotice>}
          <button type="submit" disabled={!ready || busy} className="screening-auth__submit">
            {busy ? "Création…" : "Créer mon compte"}
          </button>
          <p className="screening-auth__fine-print">
            Consultez les <Link to="/legal/conditions">conditions d’utilisation</Link> et la{" "}
            <Link to="/legal/confidentialite">politique de confidentialité</Link>.
          </p>
        </form>
      )}
    </ScreeningAuth>
  );
}
