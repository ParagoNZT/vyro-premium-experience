import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, CircleAlert } from "lucide-react";
import { z } from "zod";
import { PortalHeading, PortalNotice } from "@/components/site/AuthShell";
import { Button } from "@/components/site/Button";
import {
  PACK_IDS,
  PACKS,
  PACK_ORDER_NOTICE,
  PLAN_INCLUDED,
  formatPrice,
  getPack,
  packBilling,
  packDevices,
} from "@/config/site";

const searchSchema = z.object({ plan: z.enum(PACK_IDS).optional().catch(undefined) });

export const Route = createFileRoute("/checkout")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Détail du pack – VYRO Premium" }, { name: "robots", content: "noindex" }],
  }),
  component: PackDetailsPage,
});

function PackDetailsPage() {
  const { plan } = Route.useSearch();
  const selected = getPack(plan ?? "solo");

  return (
    <section className="vyro-portal portal-enter mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
      <Button to="/tarifs" variant="ghost" size="sm" className="mb-5">
        ← Voir les offres
      </Button>
      <PortalHeading label="VYRO / Packs" title={`VYRO Premium · ${selected.name}`}>
        {packDevices(selected)} sur un seul compte, avec toutes les fonctionnalités du lecteur.
      </PortalHeading>
      <div className="mt-8 grid items-start gap-5 lg:grid-cols-[1fr_1fr]">
        <aside className="portal-panel portal-glow p-5 sm:p-7">
          <p className="portal-kicker">Pack {selected.name}</p>
          <p className="mt-3 font-display text-4xl tracking-[-.05em]">
            {formatPrice(selected.price)}{" "}
            <span className="text-sm text-muted-foreground">{packBilling(selected)}</span>
          </p>
          <p className="mb-5 mt-3 text-sm text-muted-foreground">
            {selected.term === "annual"
              ? "12 mois d’accès. Aucun renouvellement automatique."
              : "Accès à vie. Aucun abonnement annuel."}
          </p>
          <PortalNotice>{PACK_ORDER_NOTICE}</PortalNotice>
          <nav aria-label="Comparer les packs" className="mt-6 grid grid-cols-2 gap-2">
            {PACKS.map((pack) => (
              <Link
                key={pack.id}
                to="/checkout"
                search={{ plan: pack.id }}
                aria-current={selected.id === pack.id ? "page" : undefined}
                className="rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/60 aria-[current=page]:border-primary/60 aria-[current=page]:bg-primary/10"
              >
                <span className="block font-medium">{pack.name}</span>
                <span className="block text-xs text-muted-foreground">{packDevices(pack)}</span>
              </Link>
            ))}
          </nav>
        </aside>
        <div className="portal-panel p-5 sm:p-7">
          <h2 className="font-display text-xl font-semibold">Inclus dans le pack</h2>
          <ul className="mt-4 grid gap-3 text-sm text-muted-foreground">
            {PLAN_INCLUDED.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 flex gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            <CircleAlert aria-hidden className="size-4 shrink-0 text-primary" />
            Aucune chaîne, aucun film, aucune série ni abonnement IPTV n’est inclus. Vous utilisez
            votre propre source.
          </p>
        </div>
      </div>
    </section>
  );
}
