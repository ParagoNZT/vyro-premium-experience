import { useCopy } from "@/lib/site-language";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpRight, Expand, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  formats,
  getGallery,
  selectShot,
  type Format,
  type GalleryShot,
} from "./screening-gallery";

const number = (index: number) => String(index + 1).padStart(2, "0");

function ShotTransition({ shot, previous }: { shot: GalleryShot; previous: GalleryShot }) {
  const overlay = useRef<HTMLImageElement>(null);
  const visible = useRef<HTMLImageElement>(null);
  const t = useCopy();

  useEffect(() => {
    const frame = visible.current;
    const cover = overlay.current;
    if (!frame || !cover) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;
    let live = true;
    let cancelMotion: (() => void) | undefined;
    const hide = () => {
      window.clearTimeout(timer);
      cover.removeAttribute("data-visible");
    };
    const interrupt = () => {
      live = false;
      cancelMotion?.();
      hide();
    };
    preference.addEventListener("change", interrupt);
    cover.setAttribute("data-visible", "true");
    const timer = window.setTimeout(interrupt, 750);
    void Promise.all([frame.decode(), import("motion/mini")])
      .then(([, { animate }]) => {
        if (!live) return;
        const animation = animate(cover, { opacity: [1, 0] }, { duration: 0.18, ease: "easeOut" });
        cancelMotion = () => animation.cancel();
        void animation.then(hide);
      })
      .catch(hide);
    return () => {
      preference.removeEventListener("change", interrupt);
      interrupt();
    };
  }, [shot.image]);

  return (
    <>
      <img
        ref={visible}
        src={shot.image}
        alt={t(shot.alt)}
        width={shot.width}
        height={shot.height}
        decoding="async"
        className="screening-film-frame"
      />
      <img
        ref={overlay}
        src={previous.image}
        alt=""
        aria-hidden
        width={previous.width}
        height={previous.height}
        className="screening-film-transition"
      />
    </>
  );
}

export function ScreeningRoom() {
  const t = useCopy();
  const id = useId();
  const [format, setFormat] = useState<Format>("tv");
  const [topic, setTopic] = useState("bibliotheque");
  const [previous, setPrevious] = useState<GalleryShot>();
  const [announcement, setAnnouncement] = useState(false);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const { frames, caption } = getGallery(format);
  const scene = selectShot(frames, topic);
  const active = frames.indexOf(scene);
  const title = formats.find((entry) => entry.key === format)!.title;

  function goToShot(index: number) {
    const next = frames[index];
    if (!next || next === scene) return;
    setPrevious(scene);
    setTopic(next.id);
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const offset =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    const next = offset
      ? (active + offset + frames.length) % frames.length
      : event.key === "Home"
        ? 0
        : event.key === "End"
          ? frames.length - 1
          : null;
    if (next === null) return;
    event.preventDefault();
    goToShot(next);
    tabs.current[next]?.focus({ preventScroll: true });
  }

  return (
    <figure className="screening-room" id="projection" aria-label={t("Captures de VYRO")}>
      <div className="screening-room-label">
        <span>
          <i aria-hidden /> {t(title)}
        </span>
        <div className="screening-formats" role="group" aria-label={t("Appareil présenté")}>
          {formats
            .filter(({ key }) => getGallery(key).frames.length)
            .map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={format === key}
                onClick={() => {
                  if (format === key) return;
                  setPrevious(scene);
                  setAnnouncement(true);
                  setFormat(key);
                }}
              >
                {t(label)}
              </button>
            ))}
        </div>
      </div>
      <div className="screening-deck">
        <div className="screening-film" data-format={format}>
          {frames.map((shot, index) => (
            <div
              key={format + "-" + shot.id}
              role="tabpanel"
              aria-labelledby={id + "-tab-" + index}
              id={id + "-panel-" + index}
              hidden={index !== active}
            >
              {index === active && previous ? (
                <ShotTransition key={shot.image} shot={shot} previous={previous} />
              ) : (
                <img
                  src={shot.image}
                  alt={t(shot.alt)}
                  width={shot.width}
                  height={shot.height}
                  decoding="async"
                  fetchPriority={format === "tv" && index === 0 ? "high" : "auto"}
                  loading={index === active ? "eager" : "lazy"}
                  className="screening-film-frame"
                />
              )}
            </div>
          ))}
          <Dialog.Root>
            <Dialog.Trigger asChild>
              <button
                className="screening-expand"
                type="button"
                aria-label={t("Agrandir la capture")}
              >
                <Expand size={16} aria-hidden />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="screening-lightbox-backdrop" />
              <Dialog.Content className="screening-lightbox" data-format={format}>
                <div>
                  <Dialog.Title>
                    {t(title)} · {t(scene.label)}
                  </Dialog.Title>
                  <Dialog.Close type="button" aria-label={t("Fermer la capture")}>
                    <X size={21} aria-hidden />
                  </Dialog.Close>
                </div>
                <img src={scene.image} alt={t(scene.alt)} decoding="async" />
                <Dialog.Description>{t(caption)}</Dialog.Description>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
        <div className="screening-selector">
          <p className="screening-selector-title">
            {t("Explorer le lecteur")} <ArrowUpRight size={14} aria-hidden />
          </p>
          <div className="screening-tabs" role="tablist" aria-label={t("Écrans de l’application")}>
            {frames.map(({ id: key, label, icon: Icon, note }, index) => (
              <button
                key={key}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                id={id + "-tab-" + index}
                aria-controls={id + "-panel-" + index}
                aria-selected={index === active}
                tabIndex={index === active ? 0 : -1}
                role="tab"
                type="button"
                onClick={() => goToShot(index)}
                onKeyDown={onTabKey}
              >
                <Icon size={18} aria-hidden />
                <span>
                  <strong>{t(label)}</strong>
                  <small>{note && t(note)}</small>
                </span>
                <span aria-hidden className="screening-tab-number">
                  {number(index)}
                </span>
              </button>
            ))}
          </div>
          <p className="screening-selector-index" aria-hidden>
            <span /> {number(active)} / {number(frames.length - 1)}
          </p>
        </div>
      </div>
      <span className="sr-only" role="status">
        {announcement && `${t(title)} · ${t(scene.label)}`}
      </span>
      <figcaption>{t(caption)}</figcaption>
    </figure>
  );
}
