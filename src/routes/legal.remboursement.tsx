import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/legal/remboursement")({
  head: () => ({
    meta: [
      { title: "Politique de remboursement – VYRO Premium" },
      {
        name: "description",
        content:
          "Conditions de remboursement de la licence VYRO Premium : cas éligibles, délais et procédure de demande.",
      },
      { property: "og:title", content: "Politique de remboursement – VYRO Premium" },
      { property: "og:description", content: "Conditions et procédure de remboursement VYRO Premium." },
      { property: "og:url", content: "/legal/remboursement" },
    ],
    links: [{ rel: "canonical", href: "/legal/remboursement" }],
  }),
  component: () => (
    <LegalPage title="Politique de remboursement">
      <section>
        <h2>Objet de l'achat</h2>
        <p>
          L'achat porte sur une licence d'utilisation de l'application VYRO Premium, activée
          immédiatement après le paiement. Aucun contenu audiovisuel n'est vendu.
        </p>
      </section>
      <section>
        <h2>Cas éligibles</h2>
        <p>
          Une demande de remboursement peut être étudiée lorsque l'application est inutilisable sur
          un appareil officiellement compatible et qu'aucune solution technique n'a pu être apportée
          par le support.
        </p>
      </section>
      <section>
        <h2>Cas non éligibles</h2>
        <p>
          Une source tierce indisponible, un débit internet insuffisant ou un appareil non compatible
          ne peuvent donner lieu à un remboursement, VYRO Premium n'ayant aucun contrôle sur ces
          éléments.
        </p>
      </section>
      <section>
        <h2>Procédure</h2>
        <p>
          Adressez votre demande au support depuis votre espace client, en précisant votre appareil
          et les diagnostics déjà réalisés. Une réponse est apportée sous 24 à 48 heures ouvrées.
        </p>
      </section>
    </LegalPage>
  ),
});
