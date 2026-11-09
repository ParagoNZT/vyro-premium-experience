import { Film, Home, LayoutGrid, Play, Radio, Tv } from "lucide-react";

const images = import.meta.glob<string>("/src/assets/vyro-mobile/**/*.jpg", {
  eager: true,
  import: "default",
  query: "?url",
});

const sections = [
  { id: "accueil", label: "Accueil", note: "Les Veilleurs de Brume", icon: Home },
  { id: "films", label: "Films", note: "Le catalogue", icon: Film },
  { id: "series", label: "Séries", note: "Affiches et catégories", icon: LayoutGrid },
  { id: "direct", label: "Direct", note: "Horizon 1 et son programme", icon: Radio },
  { id: "fiche", label: "Fiche détaillée", note: "Station Nacre", icon: Tv },
  { id: "lecteur", label: "Lecteur", note: "Commandes à l’écran", icon: Play },
] as const;

function forDevice(device: "telephone" | "tablette", label: string) {
  return sections.flatMap((section) => {
    const image = images[`/src/assets/vyro-mobile/${device}/${section.id}.jpg`];
    return image
      ? [{ ...section, image, alt: `${section.label} de SHOW+ sur ${label} : ${section.note}.` }]
      : [];
  });
}

export const handheldCaptures = {
  telephone: forDevice("telephone", "téléphone Android"),
  tablette: forDevice("tablette", "tablette Android"),
};

export const handheldCaption =
  "Écrans de l’application Android capturés sur émulateur avec le même catalogue fictif que sur TV. Aucun contenu n’est inclus.";
