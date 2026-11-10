import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { PACKS, PACK_ORDER_NOTICE, formatPrice, packBilling, packDevices } from "@/config/site";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/site/Button";
import { PortalHeading } from "@/components/site/AuthShell";
import { formatLastLicenseDay } from "@/lib/license-dates";

export const Route = createFileRoute("/account/abonnement")({
  head: () => ({
    meta: [{ title: "Mon abonnement – VYRO Premium" }, { name: "robots", content: "noindex" }],
  }),
  component: SubscriptionPage,
});

function formatDate(value: string) {
  return Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString("fr-FR") : "—";
}

function SubscriptionPage() {
  const { user, isActive, daysLeft } = useAuth();
  const subscription = user?.subscription;
  const orders = user?.orders ?? [];
  return (
    <div className="portal-enter">
      <PortalHeading label="VYRO / Abonnement" title="Mon abonnement">
        Retrouvez votre offre, l’échéance de votre licence et l’historique de vos paiements.
      </PortalHeading>
      <div className="portal-panel portal-glow mt-7 p-5 sm:p-7">
        {subscription ? (
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {[
              ["Offre", subscription.planName],
              [
                "Statut",
                isActive ? "Actif" : subscription.status === "revoked" ? "Révoqué" : "Expiré",
              ],
              subscription.expiresAt === null
                ? ["Échéance", "Sans échéance"]
                : subscription.expiresOn
                  ? ["Dernier jour d’accès", formatLastLicenseDay(subscription.expiresAt)]
                  : ["Échéance", formatDate(subscription.expiresAt)],
              ["Temps restant", isActive && daysLeft != null ? `${daysLeft} j` : "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-2 font-display text-lg font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune licence n’est associée à ce compte.
          </p>
        )}
      </div>
      <section className="mt-9">
        <h2 className="font-display text-xl font-semibold">Les packs VYRO</h2>
        <p className="mt-2 text-sm text-muted-foreground">{PACK_ORDER_NOTICE}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PACKS.map((pack) => (
            <div key={pack.id} className="portal-panel flex flex-col items-start p-5">
              <h3 className="text-sm font-medium">
                {pack.name} · {packDevices(pack)}
              </h3>
              <p className="mt-2 font-display text-2xl">{formatPrice(pack.price)}</p>
              <p className="mb-4 text-xs text-muted-foreground">{packBilling(pack)}</p>
              <Button to="/checkout" search={{ plan: pack.id }} size="sm" variant="secondary">
                Voir le pack {pack.name}
              </Button>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-9">
        <h2 className="font-display text-xl font-semibold">Historique des paiements</h2>
        <div className="portal-panel mt-4 divide-y divide-border">
          {!orders.length ? (
            <p className="p-5 text-sm text-muted-foreground">
              Aucun paiement confirmé pour le moment.
            </p>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center gap-3 p-5">
                <Receipt aria-hidden className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{order.planName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(order.date)}</p>
                </div>
                <span className="text-sm">{order.amount}</span>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                  Payé
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
