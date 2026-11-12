import { useCopy } from "@/lib/site-language";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { captureCaption, scenes } from "./captures";

export function Showcase() {
  const t = useCopy();
  const id = useId();
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const handleKeys = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next =
      event.key === "ArrowRight"
        ? (active + 1) % scenes.length
        : event.key === "ArrowLeft"
          ? (active + scenes.length - 1) % scenes.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? scenes.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <figure className="vyro-showcase">
      <div className="vyro-viewfinder">
        <div className="vyro-viewfinder-top">
          <span>
            <i /> {t("VYRO SUR TV")}
          </span>
          <span>{t("APERÇU · 16:9")}</span>
        </div>
        <div className="vyro-display">
          {scenes.map((scene, index) => (
            <div
              key={scene.id}
              role="tabpanel"
              id={id + "-panel-" + index}
              aria-labelledby={id + "-tab-" + index}
              hidden={active !== index}
            >
              {active === index && (
                <img
                  src={scene.image}
                  alt={t(scene.alt)}
                  width={1600}
                  height={900}
                  decoding="async"
                  fetchPriority={index === 0 ? "high" : "auto"}
                  className={index === 0 ? "" : "vyro-scene-in"}
                />
              )}
            </div>
          ))}
        </div>
        <div className="vyro-viewfinder-bottom">
          <div role="tablist" aria-label={t("Écrans de l’application")} className="vyro-scene-tabs">
            {scenes.map(({ id: sceneId, label, icon: Icon }, index) => (
              <button
                key={sceneId}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                id={id + "-tab-" + index}
                type="button"
                role="tab"
                aria-selected={active === index}
                aria-controls={id + "-panel-" + index}
                tabIndex={active === index ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={handleKeys}
              >
                <Icon size={14} aria-hidden />
                {t(label)}
              </button>
            ))}
          </div>
          <span className="vyro-counter" aria-hidden>
            {String(active + 1).padStart(2, "0")} / 04
          </span>
        </div>
      </div>
      <figcaption>{t(captureCaption)}</figcaption>
    </figure>
  );
}
