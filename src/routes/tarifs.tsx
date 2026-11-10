import { createFileRoute } from "@tanstack/react-router";
import {
  DisclaimerSection,
  FaqSection,
  Lead,
  PricingSection,
  Section,
} from "@/components/site/sections";
import { Reveal } from "@/components/site/Reveal";

export const Route = createFileRoute("/tarifs")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Tarifs – VYRO Premium" },
      {
        name: "description",
        content:
          "Comparez les packs VYRO Premium : 1, 3 ou 5 appareils à partir de 9,99 € par an, ou 5 appareils à vie pour 49,99 €.",
      },
      { property: "og:title", content: "Tarifs – VYRO Premium" },
      {
        property: "og:description",
        content: "Packs annuels pour 1, 3 ou 5 appareils et pack À vie pour 5 appareils.",
      },
      { property: "og:url", content: "/tarifs" },
    ],
    links: [{ rel: "canonical", href: "/tarifs" }],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <>
      <div className="screening-price-page">
        <Section className="pb-0 pt-20 text-center md:pt-28">
          <Reveal className="mx-auto max-w-2xl">
            <p className="vyro-kicker">
              <i /> LES OFFRES
            </p>
            <h1 className="vyro-display-title">Choisissez votre accès VYRO.</h1>
            <Lead className="mt-5">
              Les mêmes fonctionnalités dans tous les packs. Choisissez le nombre d’appareils et un
              accès annuel ou à vie.
            </Lead>
          </Reveal>
        </Section>
        <PricingSection withHeading={false} />
      </div>
      <DisclaimerSection />
      <FaqSection />
    </>
  );
}
