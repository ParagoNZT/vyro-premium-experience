import { useCopy } from "@/lib/site-language";
import { publicPageHead } from "@/lib/site-seo";
import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/legal/remboursement")({
  head: ({ match }) => {
    const head = publicPageHead(
      "/legal/remboursement",
      match.context.language,
      "Politique de remboursement – VYRO Premium",
      "Conditions de remboursement de la licence VYRO Premium : cas éligibles, délais et procédure de demande.",
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
    <LegalPage title={t("Politique de remboursement")}>
      <section>
        <h2>{t("Objet de l'achat")}</h2>
        <p>
          {t(
            "L'achat porte sur une licence d'utilisation de l'application VYRO Premium, activée immédiatement après le paiement. Aucun contenu audiovisuel n'est vendu.",
          )}
        </p>
      </section>
      <section>
        <h2>{t("Cas éligibles")}</h2>
        <p>
          {t(
            "Une demande de remboursement peut être étudiée lorsque l'application est inutilisable sur un appareil officiellement compatible et qu'aucune solution technique n'a pu être apportée par le support.",
          )}
        </p>
      </section>
      <section>
        <h2>{t("Cas non éligibles")}</h2>
        <p>
          {t(
            "Une source tierce indisponible, un débit internet insuffisant ou un appareil non compatible ne peuvent donner lieu à un remboursement, VYRO Premium n'ayant aucun contrôle sur ces éléments.",
          )}
        </p>
      </section>
      <section>
        <h2>{t("Procédure")}</h2>
        <p>
          {t(
            "Adressez votre demande au support depuis votre espace client, en précisant votre appareil et les diagnostics déjà réalisés. Une réponse est apportée sous 24 à 48 heures ouvrées.",
          )}
        </p>
      </section>
    </LegalPage>
  );
}
