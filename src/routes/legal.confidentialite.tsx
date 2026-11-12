import { useCopy } from "@/lib/site-language";
import { publicPageHead } from "@/lib/site-seo";
import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/legal/confidentialite")({
  head: ({ match }) => {
    const head = publicPageHead(
      "/legal/confidentialite",
      match.context.language,
      "Politique de confidentialité – VYRO Premium",
      "Comment VYRO Premium collecte, utilise et protège vos données personnelles : compte, licence, appareils et statistiques anonymisées.",
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
    <LegalPage title={t("Politique de confidentialité")}>
      <section>
        <h2>{t("Données collectées")}</h2>
        <p>
          {t(
            "Adresse e-mail, prénom, informations de licence et identifiants techniques des appareils sur lesquels l'application est activée.",
          )}
        </p>
      </section>
      <section>
        <h2>{t("Finalités")}</h2>
        <p>
          {t(
            "Gestion du compte, activation et renouvellement de la licence, assistance et sécurité du service.",
          )}
        </p>
      </section>
      <section>
        <h2>{t("Contenus consultés")}</h2>
        <p>
          {t(
            "VYRO Premium ne fournit aucun contenu et n'exploite pas vos flux à des fins commerciales. Les données de progression de lecture restent associées à votre profil.",
          )}
        </p>
      </section>
      <section>
        <h2>{t("Statistiques")}</h2>
        <p>
          {t(
            "Des statistiques d'usage anonymisées peuvent être collectées afin d'améliorer la stabilité et les performances de l'application.",
          )}
        </p>
      </section>
      <section>
        <h2>{t("Vos droits")}</h2>
        <p>
          {t(
            "Vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Une demande peut être adressée au support depuis votre espace client.",
          )}
        </p>
      </section>
    </LegalPage>
  );
}
