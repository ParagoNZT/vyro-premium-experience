import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, LockKeyhole } from "lucide-react";
import { z } from "zod";
import { PortalHeading, PortalNotice } from "@/components/site/AuthShell";
import { Button } from "@/components/site/Button";
import { PLANS, formatPrice, getPlan } from "@/config/site";
import { useAuth } from "@/lib/auth";
import { portalApi, PortalApiError } from "@/lib/portal-api";

type Billing = { enabled: boolean; live: boolean };
const searchSchema = z.object({ plan: z.enum(["3m", "6m", "12m"]).optional().catch(undefined) });

export const Route = createFileRoute("/checkout")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Commande – VYRO Premium" }, { name: "robots", content: "noindex" }],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user, ready, accountError } = useAuth();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [billingError, setBillingError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const key = useRef<{ userId: string; planId: string; value: string } | null>(null);
  const plan = getPlan(search.plan ?? "12m") ?? PLANS[0]!;

  useEffect(() => {
    const controller = new AbortController();
    setBillingError(false);
    setBilling(null);
    void fetch("/api/checkout", { cache: "no-store", redirect: "error", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Paiement indisponible");
        const parsed = z
          .object({ enabled: z.boolean(), live: z.boolean() })
          .parse(await response.json());
        if (!controller.signal.aborted) setBilling(parsed);
      })
      .catch(() => {
        if (!controller.signal.aborted) setBillingError(true);
      });
    return () => controller.abort();
  }, [attempt]);

  async function pay() {
    if (!ready || !user || accountError || busy || !billing?.enabled || sessionExpired) return;
    setBusy(true);
    setError("");
    try {
      if (key.current?.planId !== plan.id || key.current.userId !== user.id) {
        key.current = { planId: plan.id, userId: user.id, value: crypto.randomUUID() };
      }
      const result = await portalApi<{ url: string }>("/api/checkout", {
        method: "POST",
        body: { planId: plan.id, requestKey: key.current.value },
      });
      const target = new URL(result.url);
      if (target.origin !== "https://checkout.stripe.com" || target.username || target.password) {
        throw new Error("Le lien de paiement reçu est invalide.");
      }
      window.location.assign(target.href);
    } catch (issue) {
      if (issue instanceof PortalApiError && issue.status === 401) setSessionExpired(true);
      setError(
        issue instanceof PortalApiError
          ? issue.message
          : "Impossible d’ouvrir le paiement. Réessayez.",
      );
      setBusy(false);
    }
  }

  return (
    <section className="vyro-portal portal-enter mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
      <Button to="/tarifs" variant="ghost" size="sm" className="mb-5">
        ← Voir les offres
      </Button>
      <PortalHeading label="VYRO / Commande" title="Votre accès VYRO Premium.">
        Choisissez une durée d’accès au lecteur. Vous connectez vos propres sources dans
        l’application TV.
      </PortalHeading>
      <div className="mt-8 grid items-start gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="portal-panel space-y-7 p-5 sm:p-7">
          <fieldset className="space-y-2" disabled={busy}>
            <legend className="mb-3 font-display text-lg font-semibold">01. Durée d’accès</legend>
            {PLANS.map((offer) => (
              <label
                key={offer.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-2 p-3.5 has-checked:border-primary/65 has-checked:bg-primary/10 sm:p-4"
              >
                <input
                  type="radio"
                  name="plan"
                  className="size-4 shrink-0 accent-primary"
                  checked={offer.id === plan.id}
                  onChange={() => {
                    key.current = null;
                    setError("");
                    void navigate({ search: { plan: offer.id }, replace: true });
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{offer.name}</span>
                  {offer.badge && (
                    <span className="block text-xs text-muted-foreground">{offer.badge}</span>
                  )}
                </span>
                <span className="shrink-0 font-display text-lg">{formatPrice(offer.price)}</span>
              </label>
            ))}
          </fieldset>

          <section className="border-t border-border pt-6">
            <h2 className="font-display text-lg font-semibold">02. Votre compte</h2>
            <div className="mt-3">
              {!ready ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Vérification de votre session…
                </p>
              ) : accountError && !sessionExpired ? (
                <PortalNotice error>{accountError}</PortalNotice>
              ) : user && !sessionExpired ? (
                <p className="break-words text-sm text-muted-foreground">
                  Connecté avec <strong className="text-foreground">{user.email}</strong>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button to="/login" search={{ plan: plan.id }} variant="secondary" size="sm">
                    Se connecter
                  </Button>
                  <Button to="/register" search={{ plan: plan.id }} variant="ghost" size="sm">
                    Créer un compte
                  </Button>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="font-display text-lg font-semibold">03. Paiement</h2>
            {billingError ? (
              <div className="space-y-2">
                <PortalNotice error>
                  Impossible de vérifier la disponibilité du paiement.
                </PortalNotice>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Réessayer
                </Button>
              </div>
            ) : !billing ? (
              <p role="status" className="text-sm text-muted-foreground">
                Vérification du paiement…
              </p>
            ) : !billing.enabled ? (
              <PortalNotice>Le paiement en ligne est indisponible pour le moment.</PortalNotice>
            ) : (
              <>
                <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                  <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  Le paiement s’effectue sur Stripe. Pas de renouvellement automatique.
                </p>
                {!billing.live && (
                  <PortalNotice>
                    Mode test : aucun prélèvement réel et aucune licence attribuée.
                  </PortalNotice>
                )}
                <Button
                  className="w-full"
                  disabled={!ready || !user || !!accountError || sessionExpired || busy}
                  onClick={() => void pay()}
                >
                  {busy
                    ? "Ouverture de Stripe…"
                    : billing.live
                      ? `Payer ${formatPrice(plan.price)}`
                      : "Ouvrir le paiement de test"}
                </Button>
              </>
            )}
            {error && <PortalNotice error>{error}</PortalNotice>}
          </section>
        </div>

        <aside className="portal-panel portal-glow p-5 sm:p-7">
          <p className="portal-kicker">Récapitulatif</p>
          <h2 className="mt-5 font-display text-2xl font-semibold">VYRO Premium · {plan.name}</h2>
          <p className="mt-3 font-display text-4xl tracking-[-.05em]">
            {formatPrice(plan.price)} <span className="text-sm text-muted-foreground">TTC</span>
          </p>
          <ul className="mt-6 space-y-3 border-y border-border py-5 text-sm text-muted-foreground">
            {[
              "Accès au lecteur VYRO Premium",
              "Android TV, Google TV et Fire TV",
              "Gestion de votre licence et de vos appareils",
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-5 flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <CircleAlert aria-hidden className="size-4 shrink-0 text-primary" />
            Aucune chaîne, aucun film, aucune série ni abonnement IPTV n’est inclus.
          </p>
        </aside>
      </div>
    </section>
  );
}
