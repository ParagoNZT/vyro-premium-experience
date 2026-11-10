import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/account/guides")({
  head: () => ({ meta: [
    { title: "Guides client – VYRO Premium" },
    { name: "description", content: "Guides de configuration VYRO Premium." },
    { property: "og:title", content: "Guides client – VYRO Premium" },
    { property: "og:description", content: "Guides de configuration VYRO Premium." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex" },
  ] }),
  component: GuidesPage,
});

const GUIDES = [
  {
    title: "Connecter une source Xtream Codes",
    body: "Réglages › Sources › Xtream Codes. Saisissez l'URL du serveur, votre identifiant et votre mot de passe fournis par le service que vous utilisez.",
  },
  {
    title: "Connecter une liste M3U",
    body: "Réglages › Sources › M3U. Collez l'URL de votre liste, puis ajoutez une URL EPG (XMLTV) pour afficher le guide des programmes.",
  },
  {
    title: "Créer et protéger un profil",
    body: "Réglages › Profils. Créez un profil par utilisateur, puis activez un code PIN si vous souhaitez le protéger.",
  },
  {
    title: "Associer un appareil pour le gérer à distance",
    body: "Dans VYRO, ouvrez Réglages → À propos → Gestion à distance. Affichez le QR code, scannez-le et confirmez l’association dans votre compte. Ouvrez ensuite Gestion à distance dans l’espace client.",
  },
  {
    title: "Transférer ou exporter une configuration",
    body: "Dans Gestion à distance → Sauvegardes, choisissez un appareil et créez une sauvegarde. Vous pouvez la restaurer sur un second appareil ou l’exporter en JSON. Pour retrouver vos favoris, vos groupes et votre historique, ouvrez la même playlist sur la destination.",
  },
  {
    title: "Activer la synchronisation Trakt",
    body: "Réglages › Intégrations › Trakt. Autorisez l'appareil pour synchroniser votre progression de lecture.",
  },
];

function GuidesPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-semibold">Guides</h1>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {GUIDES.map((guide) => (
          <div key={guide.title} className="panel p-6">
            <h2 className="text-sm font-medium">{guide.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{guide.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Besoin d'aide supplémentaire ?{" "}
        <Link to="/support" className="text-primary hover:brightness-115">
          Consultez le centre d'aide
        </Link>
        .
      </p>
    </div>
  );
}
