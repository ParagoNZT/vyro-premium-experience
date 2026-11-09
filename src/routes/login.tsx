import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { ScreeningAuth, ScreeningField, ScreeningNotice } from "@/components/site/ScreeningAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const searchSchema = z.object({
  redirect: z
    .enum([
      "/admin",
      "/associer",
      "/account/abonnement",
      "/account/appareils",
      "/account/sauvegardes",
      "/account/telechargement",
      "/account/guides",
      "/account/profil",
      "/account/support",
    ])
    .optional()
    .catch(undefined),
  plan: z.enum(["3m", "6m", "12m"]).optional().catch(undefined),
  recovery: z
    .union([z.literal("1"), z.literal(1)])
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Connexion – VYRO Premium" }, { name: "robots", content: "noindex" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { ready, signIn, signOut, requestPasswordReset, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { redirect, plan, recovery } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");
  const [recoveryPending, setRecoveryPending] = useState(!!recovery);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!recovery) return;
    let active = true;
    let received = false;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || event !== "PASSWORD_RECOVERY" || !session) return;
      received = true;
      setError("");
      setMode("reset");
      setRecoveryPending(false);
    });
    // The auth client consumes the recovery token and emits PASSWORD_RECOVERY.
    // An ordinary existing session must never be mistaken for a recovery link.
    const timer = window.setTimeout(() => {
      if (active && !received) {
        setRecoveryPending(false);
        setMode("forgot");
        setError("Ce lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien.");
      }
    }, 4000);
    return () => {
      active = false;
      window.clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [recovery]);

  function switchMode(next: "login" | "forgot") {
    if (recovery) void navigate({ to: "/login", search: { redirect, plan }, replace: true });
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
    setConfirmation("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy || recoveryPending) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "forgot") {
        await requestPasswordReset(email.trim());
        setNotice(
          "Si un compte est associé à cette adresse, vous recevrez un lien de réinitialisation.",
        );
      } else if (mode === "reset") {
        if (password !== confirmation)
          throw new Error("Les deux mots de passe doivent être identiques.");
        await resetPassword(password);
        switchMode("login");
        try {
          await signOut();
        } catch {
          setError(
            "Mot de passe modifié. La session n’a pas pu être fermée ; déconnectez-vous depuis votre compte.",
          );
          return;
        }
        setNotice("Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.");
      } else {
        await signIn(email, password);
        setPassword("");
        if (redirect) await navigate({ to: redirect });
        else if (plan) await navigate({ to: "/checkout", search: { plan } });
        else await navigate({ to: "/account" });
      }
    } catch (issue) {
      setError(
        issue instanceof Error && !(issue instanceof TypeError)
          ? issue.message
          : "La demande n’a pas abouti. Réessayez.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreeningAuth
      admin={redirect === "/admin"}
      label={redirect === "/admin" ? "Administration" : "Espace client"}
      title={
        mode === "forgot"
          ? "Mot de passe oublié"
          : mode === "reset"
            ? "Nouveau mot de passe"
            : "Connexion"
      }
      subtitle={
        mode === "forgot"
          ? "Nous vous enverrons un lien pour choisir un nouveau mot de passe."
          : mode === "reset"
            ? "Choisissez un mot de passe que vous n’utilisez sur aucun autre site."
            : redirect === "/admin"
              ? "Connectez-vous avec le compte autorisé à administrer VYRO."
              : "Connectez-vous pour accéder à votre espace VYRO."
      }
      action={
        mode === "login" && !recoveryPending && redirect !== "/admin" ? (
          <>
            <p>Pas encore de compte ?</p>
            <Link to="/register" search={{ redirect, plan }} className="screening-auth__cta">
              Créer un compte <ArrowRight size={16} aria-hidden />
            </Link>
          </>
        ) : undefined
      }
    >
      {recoveryPending ? (
        <ScreeningNotice>Vérification du lien de réinitialisation…</ScreeningNotice>
      ) : (
        <form method="post" onSubmit={onSubmit} className="screening-auth__form" aria-busy={busy}>
          {mode !== "reset" && (
            <ScreeningField
              label="Adresse e-mail"
              name="email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="username"
              maxLength={254}
              required
            />
          )}
          {mode !== "forgot" && (
            <ScreeningField
              key={mode}
              label={mode === "reset" ? "Nouveau mot de passe" : "Mot de passe"}
              name="password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === "reset" ? "new-password" : "current-password"}
              minLength={mode === "reset" ? 12 : undefined}
              maxLength={256}
              hint={mode === "reset" ? "12 caractères minimum." : undefined}
              required
            />
          )}
          {mode === "reset" && (
            <ScreeningField
              label="Confirmer le mot de passe"
              name="confirmation"
              type="password"
              value={confirmation}
              onChange={setConfirmation}
              autoComplete="new-password"
              minLength={12}
              maxLength={256}
              required
            />
          )}
          {error && <ScreeningNotice error>{error}</ScreeningNotice>}
          {notice && <ScreeningNotice>{notice}</ScreeningNotice>}
          <button type="submit" disabled={!ready || busy} className="screening-auth__submit">
            {busy
              ? "Veuillez patienter…"
              : mode === "login"
                ? "Se connecter"
                : mode === "forgot"
                  ? "Demander un lien"
                  : "Enregistrer le mot de passe"}
          </button>
          {mode !== "reset" && (
            <button
              type="button"
              disabled={!ready || busy}
              className="screening-auth__text-button"
              onClick={() => switchMode(mode === "login" ? "forgot" : "login")}
            >
              {mode === "login" ? "Mot de passe oublié ?" : "Revenir à la connexion"}
            </button>
          )}
        </form>
      )}
    </ScreeningAuth>
  );
}
