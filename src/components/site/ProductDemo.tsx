import { useCopy, useSiteLanguage } from "@/lib/site-language";
import frVideo from "@/assets/product-demo/vyro-demo-fr.mp4";
import enVideo from "@/assets/product-demo/vyro-demo-en.mp4";
import frPoster from "@/assets/product-demo/vyro-demo-fr.jpg";
import enPoster from "@/assets/product-demo/vyro-demo-en.jpg";
import { ArrowDown, ArrowUpRight, Play, X } from "lucide-react";
import { useId, useRef, useState, type MouseEvent, type SyntheticEvent } from "react";

const media = {
  fr: { src: frVideo, poster: frPoster },
  en: { src: enVideo, poster: enPoster },
};

const copy = {
  fr: {
    title: "VYRO en 20 secondes",
    duration: "00:20 · Sans son",
    close: "Fermer la démo",
    gallery: "Voir la galerie de captures",
    transcript: "Lire la transcription de la démo (20 s)",
    error: "La vidéo n’a pas pu être lue. Retrouvez les quatre scènes dans la transcription.",
    captions: [
      "Vos chaînes et le guide TV.",
      "Compétitions, résultats et prochaines rencontres.",
      "Synchronisez vos favoris avec la même playlist sur la TV et le téléphone.",
      "Gérez vos playlists et restaurez une sauvegarde depuis l’espace client.",
    ],
    chapters: [
      ["Le direct", "La grille des chaînes affiche un aperçu du direct et le programme en cours."],
      [
        "Le sport",
        "L’écran Sports de SHOW+ sur Fire TV présente les compétitions, les résultats et les prochaines rencontres selon les données disponibles.",
      ],
      [
        "De la TV au téléphone",
        "Le même titre apparaît sur les deux écrans. Avec la même playlist ouverte sur les deux appareils, la TV principale synchronise ses favoris, ses groupes et son historique vers le téléphone. Ouvrez l’application sur le téléphone pour recevoir les changements.",
      ],
      [
        "L’espace client",
        "Une maquette montre la gestion d’une playlist M3U et la restauration d’une sauvegarde de la TV vers le téléphone. Ouvrez VYRO sur le téléphone pour appliquer la restauration.",
      ],
    ],
    credits:
      "Captures de VYRO retouchées, capture SHOW+ sur Fire TV et maquette de l’espace client avec des données fictives. VYRO ne fournit aucun flux.",
  },
  en: {
    title: "VYRO in 20 seconds",
    duration: "00:20 · Silent",
    close: "Close the demo",
    gallery: "View the screenshot gallery",
    transcript: "Read the demo transcript (20 sec)",
    error: "The video couldn’t play. All four scenes are in the transcript.",
    captions: [
      "Your channels and TV guide.",
      "Competitions, results and upcoming fixtures.",
      "Sync your favourites using the same playlist on your TV and phone.",
      "Manage your playlists and restore a backup from your customer area.",
    ],
    chapters: [
      ["Live TV", "The channel grid shows a live preview and what’s on now."],
      [
        "Sports",
        "The SHOW+ Sports screen on Fire TV shows competitions, results and upcoming fixtures when the data is available.",
      ],
      [
        "From TV to phone",
        "The same title appears on both screens. With the same playlist open on both devices, the primary TV syncs its favourites, groups and watch history to the phone. Open the app on the phone to receive changes.",
      ],
      [
        "Customer area",
        "A mockup shows how to manage an M3U playlist and restore a TV backup to your phone. Open VYRO on the phone to apply the restore.",
      ],
    ],
    credits:
      "Retouched VYRO screenshots, a SHOW+ screenshot on Fire TV and a customer area mockup with fictional data. VYRO doesn’t supply any streams.",
  },
} as const;

function Transcript() {
  const content = copy[useSiteLanguage()];
  return (
    <details className="vyro-demo-transcript">
      <summary>
        {content.transcript}
        <ArrowDown size={16} aria-hidden />
      </summary>
      <ol>
        {content.chapters.map(([title, description], index) => (
          <li key={title}>
            <span className="vyro-demo-time">0:{String(index * 5).padStart(2, "0")}</span>
            <p>
              <strong>{title}</strong>
              {description}
            </p>
          </li>
        ))}
      </ol>
      <p className="vyro-demo-credits">{content.credits}</p>
    </details>
  );
}

export function ProductDemoTranscript() {
  return (
    <div className="vyro-demo-static">
      <Transcript />
    </div>
  );
}

export function ProductDemo() {
  const t = useCopy();
  const language = useSiteLanguage();
  const content = copy[language];
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [chapter, setChapter] = useState(0);

  function openDemo(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;

    const dialog = dialogRef.current;
    const video = videoRef.current;
    if (!dialog || !video || typeof dialog.showModal !== "function") return;

    dialog.showModal();
    event.preventDefault();
    setFailed(false);
    setChapter(0);
    video.poster = media[language].poster;
    video.src = media[language].src;
    // Call play during the user gesture. Native controls remain available if playback is blocked.
    void video.play().catch(() => {});
  }

  function releaseVideo() {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.removeAttribute("src");
    video.removeAttribute("poster");
    video.load();
  }

  function updateChapter(event: SyntheticEvent<HTMLVideoElement>) {
    setChapter(Math.min(3, Math.floor(event.currentTarget.currentTime / 5)));
  }

  return (
    <>
      <a
        className="screening-button screening-button-primary"
        href="#projection"
        onClick={openDemo}
      >
        <Play size={16} fill="currentColor" aria-hidden /> {t("Voir VYRO en action")}
      </a>
      <dialog
        ref={dialogRef}
        className="vyro-demo"
        aria-labelledby={titleId}
        onClose={releaseVideo}
      >
        <header className="vyro-demo-head">
          <div>
            <p className="vyro-demo-time">{content.duration}</p>
            <h2 id={titleId}>{content.title}</h2>
          </div>
          <button
            className="vyro-demo-close"
            type="button"
            aria-label={content.close}
            onClick={() => dialogRef.current?.close()}
          >
            <X size={22} aria-hidden />
          </button>
        </header>
        <video
          ref={videoRef}
          aria-label={content.title}
          width={1280}
          height={720}
          controls
          playsInline
          preload="none"
          hidden={failed}
          onError={() => setFailed(true)}
          onTimeUpdate={updateChapter}
        />
        {!failed && (
          <p className="vyro-demo-mobile-caption">
            <span className="vyro-demo-time">0{chapter + 1} / 04</span>
            <strong>{content.chapters[chapter]?.[0]}</strong>
            {content.captions[chapter]}
          </p>
        )}
        {failed && (
          <p className="vyro-demo-error" role="status">
            {content.error}
          </p>
        )}
        <footer className="vyro-demo-foot">
          <Transcript />
          <a
            href="#projection"
            className="vyro-demo-gallery"
            onClick={() => dialogRef.current?.close()}
          >
            {content.gallery} <ArrowUpRight size={16} aria-hidden />
          </a>
        </footer>
      </dialog>
    </>
  );
}
