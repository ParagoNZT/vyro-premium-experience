import { useCopy, useSiteLanguage } from "@/lib/site-language";
import { ArrowUpRight, Check, Tv, MonitorPlay, Flame, Plus } from "lucide-react";
import { Reveal } from "./Reveal";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import {
  DISCLAIMER,
  FAQ,
  INTEGRATIONS,
  PACKS,
  PACK_ORDER_NOTICE,
  PLAN_INCLUDED,
  formatPrice,
  packBilling,
  packDevices,
} from "@/config/site";

export function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn("relative mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28", className)}
    >
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-primary/80">
      {children}
    </p>
  );
}

export function Heading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-balance text-3xl font-semibold leading-[1.12] md:text-[42px] lg:text-5xl",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function Lead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-lg",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Shot({
  src,
  alt,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("shot relative bg-surface", className)}>
      <img
        src={src}
        alt={alt}
        width={1600}
        height={900}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        className="block h-auto w-full"
      />
    </div>
  );
}

export function FeatureRow({
  eyebrow,
  title,
  description,
  points,
  image,
  alt,
  reversed = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  points?: string[];
  image: string;
  alt: string;
  reversed?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <Reveal className={cn("min-w-0", reversed && "lg:order-2")}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Heading className="mt-4 text-[26px] md:text-4xl">{title}</Heading>
        <Lead className="mt-5">{description}</Lead>
        {points ? (
          <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Reveal>
      <Reveal delay={80} className={cn("relative min-w-0", reversed && "lg:order-1")}>
        <div aria-hidden className="halo -inset-10 -z-10" />
        <Shot src={image} alt={alt} />
      </Reveal>
    </div>
  );
}

const PLATFORMS = [
  { name: "Android TV", icon: Tv },
  { name: "Google TV", icon: MonitorPlay },
  { name: "Amazon Fire TV", icon: Flame },
];

export function DevicesSection() {
  const t = useCopy();
  return (
    <Section id="appareils">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <Reveal className="min-w-0">
          <Eyebrow>{t("Compatibilité")}</Eyebrow>
          <Heading className="mt-4 text-[28px] md:text-4xl">
            {t("Pensé pour le grand écran.")}
          </Heading>
        </Reveal>
        <Reveal delay={60} className="min-w-0">
          <Lead>
            {t(
              "Une interface conçue pour être utilisée à la télécommande, pas une application mobile simplement agrandie sur votre téléviseur.",
            )}
          </Lead>
          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            {PLATFORMS.map(({ name, icon: Icon }) => (
              <div key={name} className="panel flex items-center gap-3 px-4 py-4">
                <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <span className="truncate text-sm font-medium">{name}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            {t(
              "Installez VYRO Premium, connectez votre source compatible et profitez immédiatement de votre bibliothèque.",
            )}
          </p>
        </Reveal>
      </div>
    </Section>
  );
}

export function IntegrationsSection() {
  const t = useCopy();
  return (
    <Section id="integrations">
      <Reveal className="max-w-2xl">
        <Eyebrow>{t("Intégrations")}</Eyebrow>
        <Heading className="mt-4">{t("Les intégrations de VYRO.")}</Heading>
        <Lead className="mt-5">
          {t(
            "Consultez les services disponibles pour enrichir votre bibliothèque et suivre votre lecture.",
          )}
        </Lead>
      </Reveal>
      <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((item, i) => (
          <Reveal as="li" key={item.name} delay={i * 60} className="panel px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-base font-medium">{item.name}</span>
              <span
                className={cn(
                  "rounded-[6px] px-2 py-0.5 text-[11px] font-medium",
                  item.status === "available"
                    ? "bg-primary/12 text-primary"
                    : "bg-surface-2 text-muted-foreground",
                )}
              >
                {item.status === "available"
                  ? t("Disponible")
                  : item.status === "soon"
                    ? t("Prochainement")
                    : t("Non intégré")}
              </span>
            </div>
            <p className="mt-2.5 text-sm text-muted-foreground">{t(item.description)}</p>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}

export function PricingSection({ withHeading = true }: { withHeading?: boolean }) {
  const t = useCopy();
  const locale = useSiteLanguage() === "en" ? "en-GB" : "fr-FR";
  return (
    <Section id="tarifs">
      {withHeading ? (
        <Reveal className="mx-auto max-w-2xl text-center">
          <Heading>{t("Choisissez votre accès VYRO Premium.")}</Heading>
          <Lead className="mt-5">
            {t("Un accès annuel pour 1, 3 ou 5 appareils, ou à vie pour 5 appareils.")}
          </Lead>
        </Reveal>
      ) : null}

      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PACKS.map((pack, i) => (
          <Reveal
            key={pack.id}
            delay={i * 60}
            className={cn(
              "vyro-price-card panel relative flex flex-col p-5 sm:p-6",
              pack.term === "lifetime" && "border-primary/28 shadow-[var(--shadow-glow)]",
            )}
          >
            {pack.term === "lifetime" ? (
              <div aria-hidden className="halo -inset-16 -z-10 opacity-25" />
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-medium">{t(pack.name)}</h3>
              <span className="rounded-md bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">
                {t(packDevices(pack))}
              </span>
            </div>
            <p className="mt-6 font-display text-4xl font-semibold tracking-tight">
              {formatPrice(pack.price, undefined, locale)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t(packBilling(pack))}</p>
            <Button
              to="/checkout"
              search={{ plan: pack.id }}
              variant={pack.term === "lifetime" ? "primary" : "secondary"}
              size="md"
              className="mt-8 w-full"
            >
              {t("Voir le pack")} {t(pack.name)} <ArrowUpRight size={16} aria-hidden />
            </Button>
          </Reveal>
        ))}
      </div>

      <p className="my-4 text-center text-sm text-muted-foreground">{t(PACK_ORDER_NOTICE)}</p>

      <Reveal className="panel mt-4 p-7">
        <p className="text-sm font-medium">{t("Inclus dans chaque offre")}</p>
        <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{t(item)}</span>
            </li>
          ))}
        </ul>
      </Reveal>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {t(
          "Chaque pack donne accès au lecteur VYRO Premium. Aucune chaîne, aucun film ni aucune série n’est inclus.",
        )}
      </p>
    </Section>
  );
}

export function DisclaimerSection() {
  const t = useCopy();
  return (
    <Section>
      <Reveal className="panel mx-auto max-w-4xl p-8 md:p-12">
        <h2 className="text-balance font-display text-xl font-medium md:text-2xl">
          {t("VYRO Premium est un lecteur, pas un fournisseur de contenu.")}
        </h2>
        <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">{t(DISCLAIMER)}</p>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          {t(
            "Le paiement concerne uniquement la licence et l'accès aux fonctionnalités de l'application VYRO Premium.",
          )}
        </p>
      </Reveal>
    </Section>
  );
}

export function FinalCta() {
  const t = useCopy();
  return (
    <section className="relative overflow-hidden border-t border-border">
      <div
        aria-hidden
        className="halo left-1/2 top-1/2 h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/2"
      />
      <div className="relative mx-auto max-w-3xl px-5 py-28 text-center md:px-8 md:py-36">
        <Reveal>
          <Heading>{t("Votre expérience TV commence ici.")}</Heading>
          <Lead className="mx-auto mt-6 max-w-xl">
            {t(
              "Installez VYRO Premium et profitez d'une interface pensée jusque dans les moindres détails pour votre télévision.",
            )}
          </Lead>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button to="/tarifs" variant="primary" size="md" className="w-full sm:w-auto">
              {t("Obtenir VYRO Premium")}
            </Button>
            <Button to="/appareils" variant="ghost" size="md" className="w-full sm:w-auto">
              {t("Voir les appareils compatibles")}
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function FaqSection({ compact = false }: { compact?: boolean }) {
  const t = useCopy();
  return (
    <Section id="faq">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Heading>{t("Questions fréquentes.")}</Heading>
      </Reveal>
      <Reveal delay={60} className="mx-auto mt-12 max-w-3xl">
        <div className="vyro-faq">
          {(compact ? FAQ.slice(0, 6) : FAQ).map((item) => (
            <details key={t(item.q)}>
              <summary>
                {t(item.q)}
                <Plus size={19} aria-hidden />
              </summary>
              <p>{t(item.a)}</p>
            </details>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}
