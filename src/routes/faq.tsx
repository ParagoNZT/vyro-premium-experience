import { publicPageHead } from "@/lib/site-seo";
import { translate } from "@/lib/site-language";
import { createFileRoute } from "@tanstack/react-router";
import { FaqSection, FinalCta } from "@/components/site/sections";
import { FAQ } from "@/config/site";

export const Route = createFileRoute("/faq")({
  head: ({ match }) => {
    const head = publicPageHead(
      "/faq",
      match.context.language,
      "FAQ – VYRO Premium",
      "Questions fréquentes sur VYRO Premium : compatibilité, installation, licence, connexion de votre source et renouvellement de l'abonnement.",
    );
    return {
      ...head,
      meta: [
        ...head.meta,
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((item) => ({
              "@type": "Question",
              name: translate(match.context.language, item.q),
              acceptedAnswer: {
                "@type": "Answer",
                text: translate(match.context.language, item.a),
              },
            })),
          }),
        },
      ],
    };
  },
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
