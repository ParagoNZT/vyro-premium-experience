import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpRight, Expand, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { captureCaption, scenes } from "./captures";
import { handheldCaption, handheldCaptures } from "./handheld-captures";

const sceneNotes = [
  "Films et séries",
  "Chaînes et programme",
  "Synopsis et épisodes",
  "Commandes à l’écran",
];

const number = (index: number) => String(index + 1).padStart(2, "0");
const formats = [
  { key: "tv", label: "TV", title: "VYRO sur TV" },
  { key: "telephone", label: "Téléphone", title: "VYRO sur téléphone" },
  { key: "tablette", label: "Tablette", title: "VYRO sur tablette" },
] as const;
const captures = {
  tv: scenes.map((scene, index) => ({ ...scene, note: sceneNotes[index] })),
  ...handheldCaptures,
};
type Format = (typeof formats)[number]["key"];

export function ScreeningRoom() {
  const id = useId();
  const [format, setFormat] = useState<Format>("tv");
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const frames = captures[format];
  const scene = frames[active]!;
  const title = formats.find((entry) => entry.key === format)!.title;
  const caption = format === "tv" ? captureCaption : handheldCaption;

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
    setActive(next);
    tabs.current[next]?.focus({ preventScroll: true });
  }

  return (
    <figure className="screening-room" id="projection" aria-label="Captures de VYRO">
      <div className="screening-room-label">
        <span>
          <i aria-hidden /> {title}
        </span>
        <div className="screening-formats" role="group" aria-label="Appareil présenté">
          {formats
            .filter(({ key }) => captures[key].length)
            .map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={format === key}
                onClick={() => {
                  if (format === key) return;
                  setFormat(key);
                  setActive(0);
                }}
              >
                {label}
              </button>
            ))}
        </div>
      </div>
      <div className="screening-deck">
        <div className="screening-film" data-format={format}>
          {frames.map(({ id: key, image, alt }, index) => (
            <div
              key={format + "-" + key}
              role="tabpanel"
              aria-labelledby={id + "-tab-" + index}
              id={id + "-panel-" + index}
              hidden={index !== active}
            >
              <img
                src={image}
                alt={alt}
                width={format === "tv" ? 1600 : undefined}
                height={format === "tv" ? 900 : undefined}
                decoding="async"
                fetchPriority={format === "tv" && index === 0 ? "high" : "auto"}
                loading={index === active ? "eager" : "lazy"}
                className="screening-film-frame"
              />
            </div>
          ))}
          <Dialog.Root>
            <Dialog.Trigger asChild>
              <button className="screening-expand" type="button" aria-label="Agrandir la capture">
                <Expand size={16} aria-hidden />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="screening-lightbox-backdrop" />
              <Dialog.Content className="screening-lightbox" data-format={format}>
                <div>
                  <Dialog.Title>
                    {title} · {scene.label}
                  </Dialog.Title>
                  <Dialog.Close type="button" aria-label="Fermer la capture">
                    <X size={21} aria-hidden />
                  </Dialog.Close>
                </div>
                <img src={scene.image} alt={scene.alt} decoding="async" />
                <Dialog.Description>{caption}</Dialog.Description>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
        <div className="screening-selector">
          <p className="screening-selector-title">
            Explorer le lecteur <ArrowUpRight size={14} aria-hidden />
          </p>
          <div className="screening-tabs" role="tablist" aria-label="Écrans de l’application">
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
                onClick={() => setActive(index)}
                onKeyDown={onTabKey}
              >
                <Icon size={18} aria-hidden />
                <span>
                  <strong>{label}</strong>
                  <small>{note}</small>
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
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
