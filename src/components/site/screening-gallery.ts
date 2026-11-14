import { Home } from "lucide-react";
import { captureCaption, homeCapture, scenes } from "./captures";
import { handheldCaption, handheldCaptures } from "./handheld-captures";

export const formats = [
  { key: "tv", label: "TV", title: "VYRO sur TV" },
  { key: "telephone", label: "Téléphone", title: "VYRO sur téléphone" },
  { key: "tablette", label: "Tablette", title: "VYRO sur tablette" },
] as const;

export type Format = (typeof formats)[number]["key"];

const notes = [
  "Films et séries",
  "Chaînes et programme",
  "Synopsis et épisodes",
  "Commandes à l’écran",
] as const;

const tv = [
  ...scenes.map((scene, index) => ({
    ...scene,
    note: notes[index],
    width: 1600,
    height: 900,
  })),
  {
    id: "accueil",
    label: "Accueil",
    alt: "Écran d’accueil de VYRO sur téléviseur",
    icon: Home,
    image: homeCapture,
    note: "Les Veilleurs de Brume",
    width: 1600,
    height: 900,
  },
];

const captures = {
  tv,
  telephone: handheldCaptures.telephone.map((scene) => ({
    ...scene,
    width: 1000,
    height: 2226,
  })),
  tablette: handheldCaptures.tablette.map((scene) => ({
    ...scene,
    width: 1440,
    height: 900,
  })),
};

const alternates: Readonly<Record<string, readonly string[]>> = {
  bibliotheque: ["series", "films"],
  series: ["bibliotheque", "films"],
  films: ["bibliotheque", "series"],
  lecture: ["lecteur"],
  lecteur: ["lecture"],
};

export type GalleryShot = (typeof captures)[Format][number];

export function getGallery(format: Format): { frames: readonly GalleryShot[]; caption: string } {
  return {
    frames: captures[format],
    caption: format === "tv" ? captureCaption : handheldCaption,
  };
}

export function selectShot(frames: readonly GalleryShot[], topic: string) {
  return (
    [topic, ...(alternates[topic] ?? [])]
      .map((id) => frames.find((frame) => frame.id === id))
      .find((match) => match !== undefined) ?? frames[0]!
  );
}
