import { createFileRoute, Link } from "@tanstack/react-router";
import { useId } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  ChevronDown,
  Fingerprint,
  Image,
  MessageSquare,
  MonitorSmartphone,
  Paintbrush,
  RefreshCw,
  Server,
  Sparkles,
  Tag,
} from "lucide-react";
import { homeCapture } from "@/components/site/captures";
import phoneCapture from "@/assets/vyro-mobile/telephone/accueil.jpg";
import { Reveal } from "@/components/site/Reveal";
import { resellerCopy } from "@/config/reseller-copy";
import { resellerCreationCents, resellerUpdatesCents } from "@/config/reseller-offer";
import { useAuth } from "@/lib/auth";
import { resellerOrderRoute, resellerPath } from "@/lib/reseller-navigation";
import { useSiteLanguage } from "@/lib/site-language";
import { publicPageHead } from "@/lib/site-seo";
import resellerStyles from "@/components/site/resellers.css?url";

export const Route = createFileRoute("/revendeurs")({
  head: ({ match }) => {
    const head = publicPageHead(
      "/revendeurs",
      match.context.language,
      "Application Android en marque blanche – VYRO Revendeurs",
      "Créez votre application Android avec VYRO : nom, logo, couleurs, serveur XC et gestion des appareils. Premier APK signé à 100 €, mises à jour en option.",
    );
    return { ...head, links: [...head.links, { rel: "stylesheet", href: resellerStyles }] };
  },
  component: ResellersPage,
});

const identityIcons = [Tag, Image, Paintbrush, Fingerprint, Server, MonitorSmartphone] as const;
const actionIcons = [MessageSquare, RefreshCw, RefreshCw] as const;

function OrderLink({ children, signedIn }: { children: string; signedIn: boolean }) {
  const className = "screening-button screening-button-primary";
  const label = (
    <>
      {children} <ArrowUpRight size={17} aria-hidden />
    </>
  );
  return signedIn ? (
    <Link {...resellerOrderRoute} className={className}>
      {label}
    </Link>
  ) : (
    <Link to="/login" search={{ redirect: resellerPath }} className={className}>
      {label}
    </Link>
  );
}

function ResellersPage() {
  const language = useSiteLanguage();
  const { user } = useAuth();
  const copy = resellerCopy[language];
  const brandPicker = useId();
  const currency = new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  return (
    <div className="screening-home reseller-page">
      <section className="reseller-hero" aria-labelledby="reseller-title">
        <div className="screening-wrap reseller-hero-grid">
          <div className="reseller-hero-copy">
            <p className="screening-kicker">{copy.eyebrow}</p>
            <h1 id="reseller-title">
              {copy.heroTitle} <em>{copy.heroAccent}</em>
            </h1>
            <p className="reseller-lead">{copy.lead}</p>
            <div className="screening-actions">
              <OrderLink signedIn={Boolean(user)}>{copy.request}</OrderLink>
              <a href="#offre" className="screening-button screening-button-ghost">
                {copy.pricingLink} <ArrowDown size={16} aria-hidden />
              </a>
            </div>
            <Link to={resellerPath} className="screening-text-link">
              {copy.account} <ArrowUpRight size={15} aria-hidden />
            </Link>
          </div>
          <figure className="reseller-showcase">
            <p className="reseller-preview-label">{copy.preview}</p>
            <fieldset className="reseller-brand-picker">
              <legend className="sr-only">{copy.previewPicker}</legend>
              <label>
                <input type="radio" name={brandPicker} value="vyro" defaultChecked />
                <span>
                  <img src="/vyro-mark.svg" alt="" width={14} height={14} /> VYRO
                </span>
              </label>
              <label>
                <input type="radio" name={brandPicker} value="nova" />
                <span>
                  <Sparkles size={14} aria-hidden /> Nova Player
                </span>
              </label>
            </fieldset>
            <div className="reseller-devices">
              <div className="reseller-tv">
                <BrandStrip />
                <img
                  src={homeCapture}
                  width={1600}
                  height={900}
                  alt={copy.previewAltTv}
                  fetchPriority="high"
                />
              </div>
              <div className="reseller-phone">
                <BrandStrip />
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
        </div>
      </section>

      <section className="screening-wrap reseller-section" aria-labelledby="reseller-identity">
        <Reveal>
          <h2 id="reseller-identity">{copy.identityTitle}</h2>
          <ul className="reseller-identity">
            {copy.identity.map(([title, description], index) => {
              const Icon = identityIcons[index]!;
              return (
                <li key={title}>
                  <Icon size={23} aria-hidden />
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="reseller-note">{copy.contentNotice}</p>
        </Reveal>
      </section>

      <section className="reseller-panel-section" aria-labelledby="reseller-management">
        <div className="screening-wrap reseller-section reseller-management">
          <Reveal>
            <h2 id="reseller-management">{copy.panelTitle}</h2>
            <p className="reseller-lead">{copy.panelLead}</p>
            <dl>
              {copy.panel.map(([title, description]) => (
                <div key={title}>
                  <dt>{title}</dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal as="div" className="reseller-panel-example">
            <figure>
              <figcaption>
                <span>{copy.panelLabel}</span> {copy.panelPreview}
              </figcaption>
              <div className="reseller-panel-device">
                <MonitorSmartphone size={27} aria-hidden />
                <div>
                  <strong>{copy.device}</strong>
                  <small>{copy.deviceRef} · NOVA-42</small>
                </div>
                <span>{copy.deviceStatus}</span>
              </div>
              <ul>
                {[copy.messageStatus, copy.updateStatus, copy.guideStatus].map((action, index) => {
                  const Icon = actionIcons[index]!;
                  return (
                    <li key={action}>
                      <Icon size={16} aria-hidden /> {action}
                    </li>
                  );
                })}
              </ul>
            </figure>
          </Reveal>
        </div>
      </section>

      <section
        id="offre"
        className="screening-wrap reseller-section"
        aria-labelledby="reseller-pricing"
      >
        <Reveal>
          <h2 id="reseller-pricing">{copy.pricingTitle}</h2>
          <div className="reseller-prices">
            <div>
              <h3>{copy.creation}</h3>
              <p className="reseller-price">
                <strong>{currency.format(resellerCreationCents / 100)}</strong> {copy.once}
              </p>
              <p>{copy.creationDetails}</p>
            </div>
            <div>
              <h3>{copy.updates}</h3>
              <p className="reseller-price">
                <strong>{currency.format(resellerUpdatesCents / 100)}</strong> {copy.annual}
              </p>
              <p>{copy.updatesDetails}</p>
            </div>
          </div>
          <p className="reseller-note">{copy.payment}</p>
        </Reveal>

        <Reveal className="reseller-delivery">
          <h2>{copy.deliveryTitle}</h2>
          <ol>
            {copy.steps.map(([title, description]) => (
              <li key={title}>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      <section
        className="screening-wrap reseller-section reseller-faq"
        aria-labelledby="reseller-faq"
      >
        <Reveal>
          <h2 id="reseller-faq">{copy.faqTitle}</h2>
          {copy.faq.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <ChevronDown size={19} aria-hidden />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </Reveal>
      </section>

      <section className="screening-wrap reseller-closing">
        <Reveal>
          <h2>{copy.closing}</h2>
          <div className="screening-actions">
            <OrderLink signedIn={Boolean(user)}>{copy.request}</OrderLink>
            <Link to="/support" className="screening-button screening-button-ghost">
              {copy.support} <ArrowUpRight size={16} aria-hidden />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

function BrandStrip() {
  return (
    <div className="reseller-brand" aria-hidden>
      <span className="reseller-brand-vyro">
        <img src="/vyro-mark.svg" alt="" width={16} height={16} /> VYRO
      </span>
      <span className="reseller-brand-nova">
        <Sparkles /> Nova Player
      </span>
    </div>
  );
}
