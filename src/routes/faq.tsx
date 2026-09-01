import { createFileRoute } from "@tanstack/react-router";
import { FaqSection, FinalCta } from "@/components/site/sections";
import { FAQ } from "@/config/site";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ – VYRO Premium" },
      {
        name: "description",
        content:
          "Questions fréquentes sur VYRO Premium : compatibilité, installation, licence, connexion de votre source et renouvellement de l'abonnement.",
      },
      { property: "og:title", content: "FAQ – VYRO Premium" },
      {
        property: "og:description",
        content: "Tout ce qu'il faut savoir avant d'installer VYRO Premium.",
      },
      { property: "og:url", content: "/faq" },
    ],
    links: [{ rel: "canonical", href: "/faq" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <>
      <div className="pt-10" />
      <FaqSection />
      <FinalCta />
    </>
  );
}
