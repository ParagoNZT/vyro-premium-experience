import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { PLANS, formatPrice } from "@/config/site";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/site/Button";

export const Route = createFileRoute("/account/abonnement")({
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const { user, isActive, daysLeft } = useAuth();
  const sub = user?.subscription ?? null;
  const orders = user?.orders ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-semibold">Mon abonnement</h1>

      <div className="panel mt-8 p-7">
        {sub ? (
          <dl className="grid gap-6 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Offre</dt>
              <dd className="mt-1.5 text-sm font-medium">{sub.planName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Statut</dt>
              <dd className="mt-1.5 text-sm font-medium text-primary">
                {isActive ? "Actif" : "Expiré"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Expiration</dt>
              <dd className="mt-1.5 text-sm font-medium">
                {new Date(sub.expiresAt).toLocaleDateString("fr-FR")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Temps restant</dt>
              <dd className="mt-1.5 text-sm font-medium">
                {daysLeft} jour{daysLeft && daysLeft > 1 ? "s" : ""}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun accès actif sur ce compte pour le moment.
          </p>
        )}
      </div>

      <h2 className="mt-12 font-display text-lg font-medium">
        {sub ? "Prolonger votre accès" : "Choisir une offre"}
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <div key={plan.id} className="panel flex flex-col p-6">
            <p className="text-sm font-medium">{plan.name}</p>
            <p className="mt-3 font-display text-2xl">{formatPrice(plan.price)}</p>
            <div className="mt-6">
              <Button to="/checkout" search={{ plan: plan.id }} variant="secondary" size="sm">
                Choisir
              </Button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-12 font-display text-lg font-medium">Historique</h2>
      <div className="panel mt-4 divide-y divide-border">
        {orders.length === 0 ? (
          <p className="p-7 text-sm text-muted-foreground">Aucune commande pour le moment.</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="flex flex-wrap items-center gap-4 p-5">
              <Receipt className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{order.planName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(order.date).toLocaleDateString("fr-FR")} · Réf. {order.id}
                </p>
              </div>
              <span className="text-sm font-medium">{order.amount}</span>
              <span className="rounded-[6px] border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                Payé
              </span>
            </div>
          ))
        )}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Le renouvellement prolonge la validité de votre licence VYRO Premium. Aucun contenu
        audiovisuel n'est inclus.
      </p>
    </div>
  );
}
