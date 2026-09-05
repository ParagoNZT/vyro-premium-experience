import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Check, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/site/Button";
import { PLANS, PLAN_INCLUDED, formatPrice, getPlan } from "@/config/site";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ plan: z.string().optional() });

export const Route = createFileRoute("/checkout")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Commande – VYRO Premium" },
      {
        name: "description",
        content: "Finalisez votre accès à l'application VYRO Premium en quelques secondes.",
      },
      { property: "og:title", content: "Commande – VYRO Premium" },
      { property: "og:description", content: "Choisissez votre durée d'accès et activez VYRO Premium." },
      { property: "og:url", content: "/checkout" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/checkout" }],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, activateLicense } = useAuth();
  const [planId, setPlanId] = useState(search.plan && getPlan(search.plan) ? search.plan : "12m");
  const [busy, setBusy] = useState(false);
  const plan = getPlan(planId ?? "12m") ?? PLANS[PLANS.length - 1]!;

  async function pay() {
    setBusy(true);
    // Le paiement réel sera traité côté serveur par le prestataire de paiement.
    // Aucune clé ni secret ne transite par le frontend.
    await activateLicense(plan.id);
    setBusy(false);
    navigate({ to: "/account" });
  }

  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="halo left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 -translate-y-1/2" />
      <div className="relative mx-auto max-w-5xl px-5 py-20 md:px-8 md:py-28">
        <h1 className="font-display text-3xl font-semibold">Votre commande.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Accès à l'application VYRO Premium. Aucun contenu, chaîne ou abonnement TV n'est vendu.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="panel p-7">
            <h2 className="text-sm font-medium">1. Choisissez votre durée</h2>
            <div className="mt-4 space-y-2">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlanId(p.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-4 rounded-[10px] border px-4 py-3.5 text-left transition-colors duration-150",
                    p.id === plan.id
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-surface-2 hover:bg-accent",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">VYRO Premium · {p.name}</span>
                    {p.badge ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{p.badge}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-display text-lg">{formatPrice(p.price)}</span>
                </button>
              ))}
            </div>

            <h2 className="mt-9 text-sm font-medium">2. Votre compte</h2>
            {user ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Connecté en tant que <span className="text-foreground">{user.email}</span>.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  search={{ plan: plan.id }}
                  className="rounded-[10px] bg-surface-2 px-4 py-2.5 text-sm transition-colors hover:bg-accent"
                >
                  Créer un compte
                </Link>
                <Link
                  to="/login"
                  search={{ plan: plan.id }}
                  className="rounded-[10px] bg-surface-2 px-4 py-2.5 text-sm transition-colors hover:bg-accent"
                >
                  Se connecter
                </Link>
              </div>
            )}

            <h2 className="mt-9 text-sm font-medium">3. Paiement</h2>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              Paiement sécurisé. Activation immédiate de la licence.
            </p>
            <button
              type="button"
              onClick={pay}
              disabled={!user || busy}
              className="mt-5 w-full rounded-[10px] bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-all duration-200 hover:brightness-115 hover:shadow-[0_0_28px_-8px_var(--primary)] disabled:opacity-50"
            >
              {busy ? "Activation…" : `Payer ${formatPrice(plan.price)}`}
            </button>
            {!user ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Connectez-vous ou créez un compte pour finaliser la commande.
              </p>
            ) : null}
          </div>

          <aside className="panel h-fit p-7">
            <p className="text-sm font-medium">Récapitulatif</p>
            <div className="mt-5 flex items-baseline justify-between gap-4">
              <span className="text-sm text-muted-foreground">VYRO Premium · {plan.name}</span>
              <span className="font-display text-2xl">{formatPrice(plan.price)}</span>
            </div>
            <ul className="mt-6 space-y-2 border-t border-border pt-5">
              {PLAN_INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}
