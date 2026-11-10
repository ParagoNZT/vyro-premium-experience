import { AudioLines, Cable, Monitor, Repeat2 } from "lucide-react";
import { Reveal } from "./Reveal";

const settings = [
  {
    icon: Repeat2,
    title: "Fréquence automatique (AFR)",
    description:
      "En plein écran sur TV, VYRO demande à l’écran une fréquence adaptée à la vidéo. Selon l’appareil, vous pouvez limiter les changements à ceux qui se font sans coupure ou autoriser un bref écran noir lors d’un changement HDMI.",
  },
  {
    icon: AudioLines,
    title: "Passthrough audio",
    description:
      "En mode Auto, une piste encodée peut être envoyée à une sortie audio compatible. Choisissez PCM si vous préférez que le lecteur décode le son.",
  },
  {
    icon: Monitor,
    title: "Résolution de sortie",
    description:
      "Vous pouvez demander une résolution qui correspond à la vidéo, si le téléviseur et le boîtier proposent un mode compatible.",
  },
  {
    icon: Cable,
    title: "Mode tunnel et choix du lecteur",
    description:
      "Le mode tunnel est une option Media3 pour le matériel et les pistes compatibles. Vous pouvez aussi choisir Media3 ou LibVLC séparément pour le direct et les films et séries.",
  },
] as const;

export function PlaybackSpotlight() {
  return (
    <section
      id="reglages-lecture"
      className="screening-wrap screening-section workspace-playback"
      aria-labelledby="playback-options-title"
    >
      <Reveal className="workspace-spotlight__intro">
        <p className="workspace-spotlight__kicker">Réglages de lecture sur TV</p>
        <h2 id="playback-options-title">
          L’image et le son <em>à votre façon.</em>
        </h2>
        <p>
          Ouvrez Réglages → Lecture sur un appareil TV compatible pour adapter VYRO à votre écran et
          à votre installation audio.
        </p>
      </Reveal>
      <ul className="workspace-spotlight__features workspace-playback__features">
        {settings.map(({ icon: Icon, title, description }, index) => (
          <Reveal as="li" className="workspace-spotlight__feature" key={title} delay={index * 55}>
            <span className="workspace-spotlight__icon">
              <Icon size={23} aria-hidden />
            </span>
            <h3>{title}</h3>
            <p>{description}</p>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
