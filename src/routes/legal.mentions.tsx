import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/legal/mentions")({
  head: () => ({
    meta: [
      { title: "Mentions légales – VYRO Premium" },
      {
        name: "description",
        content: "Mentions légales du site officiel de l'application VYRO Premium : éditeur, hébergement et contact.",
      },
      { property: "og:title", content: "Mentions légales – VYRO Premium" },
      { property: "og:description", content: "Éditeur, hébergement et contact de VYRO Premium." },
      { property: "og:url", content: "/legal/mentions" },
    ],
    links: [{ rel: "canonical", href: "/legal/mentions" }],
  }),
  component: () => (
    <LegalPage title="Mentions légales">
      <section>
        <h2>Éditeur</h2>
        <p>
          VYRO Premium — application multimédia pour téléviseurs connectés. Les informations
          d'immatriculation de la société éditrice sont à compléter avant la mise en ligne
          commerciale du site.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>support@vyro-premium.app</p>
      </section>
      <section>
        <h2>Hébergement</h2>
        <p>
          Le site est hébergé sur une infrastructure cloud. Les coordonnées de l'hébergeur sont à
          compléter avant la mise en ligne commerciale.
        </p>
      </section>
      <section>
        <h2>Propriété intellectuelle</h2>
        <p>
          L'ensemble des éléments du site et de l'application (marque, interface, textes, visuels)
          est protégé. Toute reproduction non autorisée est interdite.
        </p>
      </section>
    </LegalPage>
  ),
});
