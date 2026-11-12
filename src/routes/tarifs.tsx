import { useCopy } from "@/lib/site-language";
import { publicPageHead } from "@/lib/site-seo";
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
  head: ({ match }) => {
    const head = publicPageHead(
      "/tarifs",
      match.context.language,
      "Tarifs – VYRO Premium",
      "Comparez les packs VYRO Premium : 1, 3 ou 5 appareils à partir de 9,99 € par an, ou 5 appareils à vie pour 49,99 €.",
    );
    return {
      ...head,
      meta: [
        ...head.meta,
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: PricingPage,
});

function PricingPage() {
  const t = useCopy();
  return (
    <>
      <div className="screening-price-page">
        <Section className="pb-0 pt-20 text-center md:pt-28">
          <Reveal className="mx-auto max-w-2xl">
            <p className="vyro-kicker">
              <i /> {t("LES OFFRES")}
            </p>
            <h1 className="vyro-display-title">{t("Choisissez votre accès VYRO.")}</h1>
            <Lead className="mt-5">
              {t(
                "Les mêmes fonctionnalités dans tous les packs. Choisissez le nombre d’appareils et un accès annuel ou à vie.",
              )}
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
