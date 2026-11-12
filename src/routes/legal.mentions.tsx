import { useCopy } from "@/lib/site-language";
import { publicPageHead } from "@/lib/site-seo";
import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/legal/mentions")({
  head: ({ match }) => {
    const head = publicPageHead(
      "/legal/mentions",
      match.context.language,
      "Mentions légales – VYRO Premium",
      "Mentions légales du site officiel de l'application VYRO Premium : éditeur, hébergement et contact.",
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
  component: LegalContent,
});

function LegalContent() {
  const t = useCopy();
  return (
    <LegalPage title={t("Mentions légales")}>
      <section>
        <h2>{t("Éditeur")}</h2>
        <p>
          {t(
            "VYRO Premium — application multimédia pour téléviseurs connectés. Les informations d'immatriculation de la société éditrice sont à compléter avant la mise en ligne commerciale du site.",
          )}
        </p>
      </section>
      <section>
        <h2>{t("Contact")}</h2>
        <p>support@vyro-premium.app</p>
      </section>
      <section>
        <h2>{t("Hébergement")}</h2>
        <p>
          {t(
            "Le site est hébergé sur une infrastructure cloud. Les coordonnées de l'hébergeur sont à compléter avant la mise en ligne commerciale.",
          )}
        </p>
      </section>
      <section>
        <h2>{t("Propriété intellectuelle")}</h2>
        <p>
          {t(
            "L'ensemble des éléments du site et de l'application (marque, interface, textes, visuels) est protégé. Toute reproduction non autorisée est interdite.",
          )}
        </p>
      </section>
    </LegalPage>
  );
}
