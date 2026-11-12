import { useCopy } from "@/lib/site-language";
import { publicPageHead } from "@/lib/site-seo";
import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";
import { DISCLAIMER } from "@/config/site";

export const Route = createFileRoute("/legal/conditions")({
  head: ({ match }) => {
    const head = publicPageHead(
      "/legal/conditions",
      match.context.language,
      "Conditions d'utilisation – VYRO Premium",
      "Conditions d'utilisation de l'application VYRO Premium : objet de la licence, obligations de l'utilisateur et limitations.",
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
    <LegalPage title={t("Conditions d'utilisation")}>
      <section>
        <h2>{t("1. Objet")}</h2>
        <p>
          {t(
            "Les présentes conditions régissent l'accès et l'utilisation de l'application VYRO Premium, un lecteur et gestionnaire multimédia destiné aux téléviseurs connectés.",
          )}
        </p>
      </section>
      <section>
        <h2>{t("2. Nature du service")}</h2>
        <p>{t(DISCLAIMER)}</p>
        <p>
          {t(
            "L'abonnement souscrit porte exclusivement sur la licence d'utilisation des fonctionnalités de l'application.",
          )}
        </p>
      </section>
      <section>
        <h2>{t("3. Compte et licence")}</h2>
        <p>
          {t(
            "Chaque compte est personnel. La licence est activée pour la durée choisie et peut être limitée à un nombre d'appareils défini au moment de l'activation.",
          )}
        </p>
      </section>
      <section>
        <h2>{t("4. Obligations de l'utilisateur")}</h2>
        <p>
          {t(
            "L'utilisateur s'engage à ne connecter que des sources et services auxquels il est légalement autorisé à accéder, et à respecter la législation applicable dans son pays.",
          )}
        </p>
      </section>
      <section>
        <h2>{t("5. Disponibilité et mises à jour")}</h2>
        <p>
          {t(
            "L'application évolue régulièrement. Certaines fonctionnalités peuvent être ajoutées, modifiées ou retirées afin d'assurer la compatibilité et la sécurité du service.",
          )}
        </p>
      </section>
      <section>
        <h2>{t("6. Résiliation")}</h2>
        <p>
          {t(
            "Tout usage contraire aux présentes conditions peut entraîner la suspension immédiate de la licence, sans remboursement.",
          )}
        </p>
      </section>
    </LegalPage>
  );
}
