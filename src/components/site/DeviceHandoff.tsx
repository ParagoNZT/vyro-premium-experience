import { useEffect, useRef, type RefObject } from "react";
import { ArrowUpRight, Monitor, Smartphone, Tablet } from "lucide-react";
import tvCapture from "@/assets/vyro-series.jpg";
import tabletCapture from "@/assets/vyro-mobile/tablette/accueil.jpg";
import phoneCapture from "@/assets/vyro-mobile/telephone/accueil.jpg";
import { useSiteLanguage } from "@/lib/site-language";

const copy = {
  fr: {
    kicker: "VYRO / MULTI-ÉCRANS",
    title: "Changez d’écran.",
    accent: "Gardez vos repères.",
    lead: "Sur une même playlist configurée sur vos appareils, retrouvez vos favoris, vos groupes et votre historique quand vous passez d’un écran à l’autre.",
    label: "TV, tablette et téléphone avec des captures de VYRO",
    demo: "Captures VYRO · Catalogue fictif",
    link: "Découvrir les outils de synchronisation",
    steps: [
      [
        "Téléviseur",
        "Commencez sur grand écran",
        "Retrouvez votre catalogue et enregistrez vos favoris depuis votre TV.",
      ],
      [
        "Tablette",
        "Retrouvez votre organisation",
        "Vos favoris et groupes personnalisés restent à portée de main.",
      ],
      [
        "Téléphone",
        "Reprenez là où vous en étiez",
        "Retrouvez votre historique et votre progression sur votre téléphone.",
      ],
    ],
  },
  en: {
    kicker: "VYRO / MULTI-DEVICE",
    title: "Switch screens.",
    accent: "Pick up where you left off.",
    lead: "With the same playlist set up on your devices, take your favourites, custom groups and watch history with you as you switch screens.",
    label: "TV, tablet and phone showing screenshots of VYRO",
    demo: "VYRO screenshots · Fictional catalogue",
    link: "Explore sync tools",
    steps: [
      ["TV", "Start on the big screen", "Browse your library and save favourites from your TV."],
      [
        "Tablet",
        "Keep things in order",
        "Find your favourites and custom groups right where you expect them.",
      ],
      [
        "Phone",
        "Pick up where you left off",
        "Find your watch history and playback progress on your phone.",
      ],
    ],
  },
} as const;

const devices = [
  { id: "tv", src: tvCapture, width: 1600, height: 900, icon: Monitor },
  { id: "tablet", src: tabletCapture, width: 1440, height: 900, icon: Tablet },
  { id: "phone", src: phoneCapture, width: 1000, height: 2226, icon: Smartphone },
] as const;

const motionQuery =
  "(min-width: 960px) and (min-height: 660px) and (prefers-reduced-motion: no-preference)";

function useHandoffMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const section = root.current;
    if (!section) return;
    const media = window.matchMedia(motionQuery);
    let dispose: (() => void) | undefined;
    let generation = 0;

    const reconcile = () => {
      const request = ++generation;
      dispose?.();
      dispose = undefined;
      if (!media.matches) return;
      void import("./device-handoff-motion")
        .then(({ setupHandoffMotion }) => {
          if (request === generation) dispose = setupHandoffMotion(section);
        })
        .catch(() => {
          // The static scene remains usable if the optional motion chunk fails to load.
        });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        media.addEventListener("change", reconcile);
        reconcile();
      },
      { rootMargin: "400px" },
    );
    observer.observe(section);
    return () => {
      generation++;
      observer.disconnect();
      media.removeEventListener("change", reconcile);
      dispose?.();
    };
  }, [root]);
}

export function DeviceHandoff() {
  const content = copy[useSiteLanguage()];
  const root = useRef<HTMLElement>(null);
  useHandoffMotion(root);
  return (
    <section
      ref={root}
      id="synchronisation"
      className="device-handoff screening-wrap"
      aria-labelledby="device-handoff-title"
    >
      <header className="device-handoff-intro">
        <div>
          <p className="screening-kicker">{content.kicker}</p>
          <h2 id="device-handoff-title">
            {content.title} <em>{content.accent}</em>
          </h2>
        </div>
        <p>{content.lead}</p>
      </header>
      <div className="device-handoff-track">
        <figure className="device-handoff-stage" aria-label={content.label}>
          <div className="device-handoff-art">
            <span className="device-handoff-orbit" aria-hidden />
            <div className="device-handoff-spine" aria-hidden>
              <i /> <i /> <i />
            </div>
            {devices.map(({ id, src, width, height }, index) => (
              <div key={id} className="device-handoff-device" data-device={id}>
                <div className="device-handoff-shell">
                  <img
                    src={src}
                    alt=""
                    width={width}
                    height={height}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <span>{content.steps[index]![0]}</span>
              </div>
            ))}
            <svg
              className="device-handoff-signal"
              viewBox="0 0 720 420"
              fill="none"
              aria-hidden="true"
            >
              <path d="M166 300 C163 379 323 390 382 346" />
              <path d="M511 344 C526 400 602 397 617 357" />
              <path data-signal pathLength="1" d="M166 300 C163 379 323 390 382 346" />
              <path data-signal pathLength="1" d="M511 344 C526 400 602 397 617 357" />
            </svg>
          </div>
          <figcaption>{content.demo}</figcaption>
        </figure>
        <ol className="device-handoff-steps">
          {content.steps.map(([device, title, text], index) => {
            const Icon = devices[index]!.icon;
            return (
              <li key={device} data-handoff-step>
                <div className="device-handoff-step-copy">
                  <span className="device-handoff-step-device">
                    <Icon size={17} aria-hidden /> {device}
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <a className="screening-text-link device-handoff-link" href="#espace-client">
        {content.link} <ArrowUpRight size={16} aria-hidden />
      </a>
    </section>
  );
}
