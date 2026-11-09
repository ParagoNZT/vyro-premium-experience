import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpRight, Expand, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { captureCaption, scenes } from "./captures";

const sceneNotes = [
  "Films et séries",
  "Chaînes et programme",
  "Synopsis et épisodes",
  "Commandes à l’écran",
];

const number = (index: number) => String(index + 1).padStart(2, "0");

export function ScreeningRoom() {
  const id = useId();
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const scene = scenes[active]!;

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const offset =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    const next = offset
      ? (active + offset + scenes.length) % scenes.length
      : event.key === "Home"
        ? 0
        : event.key === "End"
          ? scenes.length - 1
          : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus({ preventScroll: true });
  }

  return (
    <figure className="screening-room" id="projection" aria-label="Captures de VYRO sur TV">
      <div className="screening-room-label">
        <span>
          <i aria-hidden /> VYRO SUR TV
        </span>
        <span>4 ÉCRANS À EXPLORER</span>
      </div>
      <div className="screening-deck">
        <div className="screening-film">
          {scenes.map(({ id: key, image, alt }, index) => (
            <div
              key={key}
              role="tabpanel"
              aria-labelledby={id + "-tab-" + index}
              id={id + "-panel-" + index}
              hidden={index !== active}
            >
              <img
                src={image}
                alt={alt}
                width={1600}
                height={900}
                decoding="async"
                fetchPriority={index === 0 ? "high" : "auto"}
                loading={index === 0 ? "eager" : "lazy"}
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
              <Dialog.Content className="screening-lightbox">
                <div>
                  <Dialog.Title>VYRO sur TV · {scene.label}</Dialog.Title>
                  <Dialog.Close type="button" aria-label="Fermer la capture">
                    <X size={21} aria-hidden />
                  </Dialog.Close>
                </div>
                <img src={scene.image} alt={scene.alt} width={1600} height={900} decoding="async" />
                <Dialog.Description>{captureCaption}</Dialog.Description>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
        <div className="screening-selector">
          <p className="screening-selector-title">
            Explorer le lecteur <ArrowUpRight size={14} aria-hidden />
          </p>
          <div className="screening-tabs" role="tablist" aria-label="Écrans de l’application">
            {scenes.map(({ id: key, label, icon: Icon }, index) => (
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
                  <small>{sceneNotes[index]}</small>
                </span>
                <span aria-hidden className="screening-tab-number">
                  {number(index)}
                </span>
              </button>
            ))}
          </div>
          <p className="screening-selector-index" aria-hidden>
            <span /> {number(active)} / {number(scenes.length - 1)}
          </p>
        </div>
      </div>
      <figcaption>{captureCaption}</figcaption>
    </figure>
  );
}
