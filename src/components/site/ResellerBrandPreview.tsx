import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
} from "react";
import { ArrowUpRight, Sparkles, Upload, X } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { homeCapture } from "./captures";
import phoneCapture from "@/assets/vyro-mobile/telephone/accueil.jpg";
import { resellerCopy } from "@/config/reseller-copy";
import {
  clearBrandDraft,
  keepBrandDraft,
  logoAccept,
  orderBrandColor,
  orderLogoSrc,
  prepareOrderLogo,
  readBrandDraft,
} from "@/lib/reseller-brand-draft";
import { resellerOrderRoute, resellerPath } from "@/lib/reseller-navigation";
import type { SiteLanguage } from "@/lib/site-language";

const previewCopy = {
  fr: {
    custom: "Votre marque",
    name: "Nom de l’application",
    colour: "Couleur principale",
    add: "Ajouter un logo",
    replace: "Remplacer le logo",
    remove: "Retirer le logo",
    tip: "PNG, JPG ou WebP · 2 Mo maximum",
    invalidLogo: "Choisissez une image PNG, JPG ou WebP lisible de 2 Mo maximum.",
    draft:
      "Votre aperçu reste dans cet onglet. Le logo est transmis quand vous envoyez la demande.",
    submit: "Continuer avec cette marque",
    invalidName: "Saisissez au moins deux caractères pour le nom de l’application.",
    loading: "Préparation du logo…",
  },
  en: {
    custom: "Your brand",
    name: "App name",
    colour: "Primary colour",
    add: "Add a logo",
    replace: "Replace logo",
    remove: "Remove logo",
    tip: "PNG, JPG or WebP · Up to 2 MB",
    invalidLogo: "Choose a readable PNG, JPG or WebP image up to 2 MB.",
    draft: "Your preview stays in this tab. The logo is sent when you submit your request.",
    submit: "Continue with this brand",
    invalidName: "Enter an app name with at least two characters.",
    loading: "Preparing logo…",
  },
} as const;

export function OrderLink({ children, signedIn }: { children: string; signedIn: boolean }) {
  const className = "screening-button screening-button-primary";
  const label = (
    <>
      {children} <ArrowUpRight size={17} aria-hidden />
    </>
  );
  const reset = (event: MouseEvent) => {
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey)
      clearBrandDraft();
  };
  return signedIn ? (
    <Link {...resellerOrderRoute} className={className} onClick={reset}>
      {label}
    </Link>
  ) : (
    <Link to="/login" search={{ redirect: resellerPath }} className={className} onClick={reset}>
      {label}
    </Link>
  );
}

export function ResellerBrandPreview({
  language,
  owner,
}: {
  language: SiteLanguage;
  owner: string | undefined;
}) {
  const copy = resellerCopy[language];
  const details = previewCopy[language];
  const picker = useId();
  const navigate = useNavigate();
  const nameInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const logoJob = useRef(0);
  const [name, setName] = useState("");
  const [accent, setAccent] = useState(orderBrandColor);
  const [logo, setLogo] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<"name" | "logo" | null>(null);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);

  function chooseCustom() {
    if (name || logo) return;
    const draft = readBrandDraft(owner);
    if (!draft) return;
    setName(draft.name);
    setAccent(draft.accent);
    setLogo(draft.logo);
  }

  async function selectLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const job = ++logoJob.current;
    setPreparing(true);
    setError(null);
    try {
      const next = await prepareOrderLogo(file);
      if (job === logoJob.current) setLogo(next);
    } catch {
      if (job === logoJob.current) setError("logo");
    } finally {
      if (job === logoJob.current) setPreparing(false);
    }
  }

  function proceed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preparing || error === "logo") return;
    const label = name.trim();
    if (label.length < 2) {
      setError("name");
      nameInput.current?.focus();
      return;
    }
    keepBrandDraft({ name: label, accent, logo }, owner);
    void navigate(
      owner ? resellerOrderRoute : { to: "/login", search: { redirect: resellerPath } },
    );
  }

  function brandStrip() {
    return (
      <div className="reseller-brand" aria-hidden>
        <span className="reseller-brand-vyro">
          <img src="/vyro-mark.svg" alt="" width={16} height={16} /> VYRO
        </span>
        <span className="reseller-brand-nova">
          <Sparkles /> Nova Player
        </span>
        <span className="reseller-brand-custom">
          {logo ? <img src={orderLogoSrc(logo)} alt="" width={16} height={16} /> : <i />}
          <b>{name.trim() || details.custom}</b>
        </span>
      </div>
    );
  }

  return (
    <div className="reseller-showcase" style={{ "--preview-custom": accent } as CSSProperties}>
      <p className="reseller-preview-label">{copy.preview}</p>
      <fieldset className="reseller-brand-picker">
        <legend className="sr-only">{copy.previewPicker}</legend>
        <label>
          <input type="radio" name={picker} value="vyro" defaultChecked />
          <span>
            <img src="/vyro-mark.svg" alt="" width={14} height={14} /> VYRO
          </span>
        </label>
        <label>
          <input type="radio" name={picker} value="nova" />
          <span>
            <Sparkles size={14} aria-hidden /> Nova Player
          </span>
        </label>
        {interactive && (
          <label>
            <input type="radio" name={picker} value="custom" onChange={chooseCustom} />
            <span>
              <span className="reseller-custom-swatch" aria-hidden />
              {details.custom}
            </span>
          </label>
        )}
      </fieldset>
      <figure>
        <div className="reseller-devices">
          <div className="reseller-tv">
            {brandStrip()}
            <img
              src={homeCapture}
              width={1600}
              height={900}
              alt={copy.previewAltTv}
              fetchPriority="high"
            />
          </div>
          <div className="reseller-phone">
            {brandStrip()}
            <img
              src={phoneCapture}
              width={1000}
              height={2226}
              alt={copy.previewAltPhone}
              decoding="async"
            />
          </div>
        </div>
        <figcaption>{copy.previewCaption}</figcaption>
      </figure>
      <form className="reseller-custom-form" onSubmit={proceed}>
        <div className="reseller-custom-fields">
          <label>
            {details.name}
            <input
              ref={nameInput}
              name="brand"
              maxLength={60}
              value={name}
              aria-invalid={error === "name" || undefined}
              aria-describedby={error === "name" ? picker + "-error" : undefined}
              onChange={(event) => {
                setName(event.target.value);
                if (error === "name") setError(null);
              }}
              placeholder={language === "fr" ? "Ex. Studio Horizon" : "e.g. Horizon Studio"}
            />
          </label>
          <label className="reseller-colour-input">
            {details.colour}
            <input
              type="color"
              value={accent}
              onChange={(event) => setAccent(event.target.value)}
            />
          </label>
        </div>
        <div className="reseller-logo-controls">
          <input
            ref={logoInput}
            type="file"
            hidden
            accept={logoAccept}
            onChange={(event) => void selectLogo(event)}
          />
          <button
            className="reseller-small-button"
            type="button"
            onClick={() => logoInput.current?.click()}
          >
            <Upload size={16} aria-hidden /> {logo ? details.replace : details.add}
          </button>
          {(logo || error === "logo") && (
            <button
              className="reseller-small-button"
              type="button"
              onClick={() => {
                logoJob.current++;
                setPreparing(false);
                setLogo(null);
                setError(null);
              }}
            >
              <X size={15} aria-hidden /> {details.remove}
            </button>
          )}
        </div>
        <p className="reseller-preview-label" role="status">
          {preparing ? details.loading : details.tip}
        </p>
        {error && (
          <p className="reseller-custom-error" id={picker + "-error"} role="alert">
            {error === "name" ? details.invalidName : details.invalidLogo}
          </p>
        )}
        <p className="reseller-custom-note">{details.draft}</p>
        <button
          className="screening-button screening-button-primary"
          type="submit"
          disabled={preparing}
        >
          {details.submit} <ArrowUpRight size={17} aria-hidden />
        </button>
      </form>
    </div>
  );
}
