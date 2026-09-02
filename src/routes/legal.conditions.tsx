import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";
import { DISCLAIMER } from "@/config/site";

export const Route = createFileRoute("/legal/conditions")({
  head: () => ({
    meta: [
      { title: "Conditions d'utilisation – VYRO Premium" },
      {
        name: "description",
        content:
          "Conditions d'utilisation de l'application VYRO Premium : objet de la licence, obligations de l'utilisateur et limitations.",
      },
      { property: "og:title", content: "Conditions d'utilisation – VYRO Premium" },
      { property: "og:description", content: "Les conditions d'utilisation de VYRO Premium." },
      { property: "og:url", content: "/legal/conditions" },
    ],
    links: [{ rel: "canonical", href: "/legal/conditions" }],
  }),
  component: () => (
    <LegalPage title="Conditions d'utilisation">
      <section>
        <h2>1. Objet</h2>
        <p>
          Les présentes conditions régissent l'accès et l'utilisation de l'application VYRO Premium,
          un lecteur et gestionnaire multimédia destiné aux téléviseurs connectés.
        </p>
      </section>
      <section>
        <h2>2. Nature du service</h2>
        <p>{DISCLAIMER}</p>
        <p>
          L'abonnement souscrit porte exclusivement sur la licence d'utilisation des fonctionnalités
          de l'application.
        </p>
      </section>
      <section>
        <h2>3. Compte et licence</h2>
        <p>
          Chaque compte est personnel. La licence est activée pour la durée choisie et peut être
          limitée à un nombre d'appareils défini au moment de l'activation.
        </p>
      </section>
      <section>
        <h2>4. Obligations de l'utilisateur</h2>
        <p>
          L'utilisateur s'engage à ne connecter que des sources et services auxquels il est
          légalement autorisé à accéder, et à respecter la législation applicable dans son pays.
        </p>
      </section>
      <section>
        <h2>5. Disponibilité et mises à jour</h2>
        <p>
          L'application évolue régulièrement. Certaines fonctionnalités peuvent être ajoutées,
          modifiées ou retirées afin d'assurer la compatibilité et la sécurité du service.
        </p>
      </section>
      <section>
        <h2>6. Résiliation</h2>
        <p>
          Tout usage contraire aux présentes conditions peut entraîner la suspension immédiate de la
          licence, sans remboursement.
        </p>
      </section>
    </LegalPage>
  ),
});
