import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/account/guides")({
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
