import { createFileRoute } from "@tanstack/react-router";
import {
  DisclaimerSection,
  FaqSection,
  Heading,
  Lead,
  PricingSection,
  Section,
} from "@/components/site/sections";
import { Reveal } from "@/components/site/Reveal";

export const Route = createFileRoute("/tarifs")({
  head: () => ({
    meta: [
      { title: "Tarifs – VYRO Premium" },
      {
        name: "description",
        content:
          "Choisissez votre accès à l'application VYRO Premium : 3, 6 ou 12 mois. Un seul abonnement, toute l'expérience VYRO Premium.",
      },
      { property: "og:title", content: "Tarifs – VYRO Premium" },
      {
        property: "og:description",
        content: "3, 6 ou 12 mois d'accès à l'application VYRO Premium.",
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
      <Section className="pb-0 pt-20 text-center md:pt-28">
        <Reveal className="mx-auto max-w-2xl">
          <Heading>Choisissez votre accès VYRO Premium.</Heading>
          <Lead className="mt-5">Un seul abonnement. Toute l'expérience VYRO Premium.</Lead>
        </Reveal>
      </Section>
      <PricingSection withHeading={false} />
      <DisclaimerSection />
      <FaqSection />
    </>
  );
}
