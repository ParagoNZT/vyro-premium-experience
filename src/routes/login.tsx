import { useCopy } from "@/lib/site-language";
import { publicPageHead } from "@/lib/site-seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { ScreeningAuth, ScreeningField, ScreeningNotice } from "@/components/site/ScreeningAuth";
import { PACK_IDS } from "@/config/site";
import { supabase } from "@/integrations/supabase/client";
import { resellerOrderRoute, resellerPath } from "@/lib/reseller-navigation";
import { readBrandDraft } from "@/lib/reseller-brand-draft";
import { useAuth } from "@/lib/auth";

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
      resellerPath,
    ])
    .optional()
    .catch(undefined),
  plan: z.enum(PACK_IDS).optional().catch(undefined),
  recovery: z
    .union([z.literal("1"), z.literal(1)])
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: ({ match }) => {
    const head = publicPageHead("/login", match.context.language, "Connexion – VYRO Premium");
    return {
      ...head,
      meta: [...head.meta, { name: "robots", content: "noindex" }],
    };
  },
  component: LoginPage,
});

function LoginPage() {
  const t = useCopy();
  const { ready, user, signIn, signOut, requestPasswordReset, resetPassword } = useAuth();
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
    if (
      ready &&
      user &&
      !busy &&
      !recovery &&
      mode === "login" &&
      (redirect === resellerPath || (!redirect && !plan && readBrandDraft(user.id)))
    ) {
      void navigate({ ...resellerOrderRoute, replace: true });
    }
  }, [ready, user, busy, recovery, mode, redirect, plan, navigate]);

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
        setError(
          t("Ce lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien."),
        );
      }
    }, 4000);
    return () => {
      active = false;
      window.clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [recovery, t]);

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
          t("Si un compte est associé à cette adresse, vous recevrez un lien de réinitialisation."),
        );
      } else if (mode === "reset") {
        if (password !== confirmation)
          throw new Error(t("Les deux mots de passe doivent être identiques."));
        await resetPassword(password);
        switchMode("login");
        try {
          await signOut();
        } catch {
          setError(
            t(
              "Mot de passe modifié. La session n’a pas pu être fermée ; déconnectez-vous depuis votre compte.",
            ),
          );
          return;
        }
        setNotice(t("Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe."));
      } else {
        const signedIn = await signIn(email, password);
        setPassword("");
        if (redirect === resellerPath || (!redirect && !plan && readBrandDraft(signedIn.id)))
          await navigate(resellerOrderRoute);
        else if (redirect) await navigate({ to: redirect });
        else if (plan) await navigate({ to: "/checkout", search: { plan } });
        else await navigate({ to: "/account" });
      }
    } catch (issue) {
      setError(
        issue instanceof Error && !(issue instanceof TypeError)
          ? t(issue.message)
          : t("La demande n’a pas abouti. Réessayez."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreeningAuth
      admin={redirect === "/admin"}
      label={redirect === "/admin" ? "Administration" : t("Espace client")}
      title={
        mode === "forgot"
          ? t("Mot de passe oublié")
          : mode === "reset"
            ? t("Nouveau mot de passe")
            : t("Connexion")
      }
      subtitle={
        mode === "forgot"
          ? t("Nous vous enverrons un lien pour choisir un nouveau mot de passe.")
          : mode === "reset"
            ? t("Choisissez un mot de passe que vous n’utilisez sur aucun autre site.")
            : redirect === "/admin"
              ? t("Connectez-vous avec le compte autorisé à administrer VYRO.")
              : t("Connectez-vous pour accéder à votre espace VYRO.")
      }
      action={
        mode === "login" && !recoveryPending && redirect !== "/admin" ? (
          <>
            <p>{t("Pas encore de compte ?")}</p>
            <Link to="/register" search={{ redirect, plan }} className="screening-auth__cta">
              {t("Créer un compte")} <ArrowRight size={16} aria-hidden />
            </Link>
          </>
        ) : undefined
      }
    >
      {recoveryPending ? (
        <ScreeningNotice>{t("Vérification du lien de réinitialisation…")}</ScreeningNotice>
      ) : (
        <form method="post" onSubmit={onSubmit} className="screening-auth__form" aria-busy={busy}>
          {mode !== "reset" && (
            <ScreeningField
              label={t("Adresse e-mail")}
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
              label={mode === "reset" ? t("Nouveau mot de passe") : t("Mot de passe")}
              name="password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === "reset" ? "new-password" : "current-password"}
              minLength={mode === "reset" ? 12 : undefined}
              maxLength={256}
              hint={mode === "reset" ? t("12 caractères minimum.") : undefined}
              required
            />
          )}
          {mode === "reset" && (
            <ScreeningField
              label={t("Confirmer le mot de passe")}
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
              ? t("Veuillez patienter…")
              : mode === "login"
                ? t("Se connecter")
                : mode === "forgot"
                  ? t("Demander un lien")
                  : t("Enregistrer le mot de passe")}
          </button>
          {mode !== "reset" && (
            <button
              type="button"
              disabled={!ready || busy}
              className="screening-auth__text-button"
              onClick={() => switchMode(mode === "login" ? "forgot" : "login")}
            >
              {mode === "login" ? t("Mot de passe oublié ?") : t("Revenir à la connexion")}
            </button>
          )}
        </form>
      )}
    </ScreeningAuth>
  );
}
