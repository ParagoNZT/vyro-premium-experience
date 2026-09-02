import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/legal/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité – VYRO Premium" },
      {
        name: "description",
        content:
          "Comment VYRO Premium collecte, utilise et protège vos données personnelles : compte, licence, appareils et statistiques anonymisées.",
      },
      { property: "og:title", content: "Politique de confidentialité – VYRO Premium" },
      { property: "og:description", content: "Traitement des données personnelles chez VYRO Premium." },
      { property: "og:url", content: "/legal/confidentialite" },
    ],
    links: [{ rel: "canonical", href: "/legal/confidentialite" }],
  }),
  component: () => (
    <LegalPage title="Politique de confidentialité">
      <section>
        <h2>Données collectées</h2>
        <p>
          Adresse e-mail, prénom, informations de licence et identifiants techniques des appareils
          sur lesquels l'application est activée.
        </p>
      </section>
      <section>
        <h2>Finalités</h2>
        <p>
          Gestion du compte, activation et renouvellement de la licence, assistance et sécurité du
          service.
        </p>
      </section>
      <section>
        <h2>Contenus consultés</h2>
        <p>
          VYRO Premium ne fournit aucun contenu et n'exploite pas vos flux à des fins commerciales.
          Les données de progression de lecture restent associées à votre profil.
        </p>
      </section>
      <section>
        <h2>Statistiques</h2>
        <p>
          Des statistiques d'usage anonymisées peuvent être collectées afin d'améliorer la stabilité
          et les performances de l'application.
        </p>
      </section>
      <section>
        <h2>Vos droits</h2>
        <p>
          Vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Une
          demande peut être adressée au support depuis votre espace client.
        </p>
      </section>
    </LegalPage>
  ),
});
