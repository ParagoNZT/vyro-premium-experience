import { Link } from "@tanstack/react-router";
import { Check, Tv, MonitorPlay, Flame } from "lucide-react";
import { Reveal } from "./Reveal";
import { cn } from "@/lib/utils";
import {
  DISCLAIMER,
  FAQ,
  INTEGRATIONS,
  PLANS,
  PLAN_INCLUDED,
  formatPrice,
  monthlyEquivalent,
} from "@/config/site";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
    <section id={id} className={cn("relative mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28", className)}>
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-primary/90">{children}</p>
  );
}

export function Heading({ children, className }: { children: React.ReactNode; className?: string }) {
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
    <p className={cn("text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-lg", className)}>
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
  return (
    <Section id="appareils">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <Reveal className="min-w-0">
          <Eyebrow>Compatibilité</Eyebrow>
          <Heading className="mt-4 text-[28px] md:text-4xl">Pensé pour le grand écran.</Heading>
        </Reveal>
        <Reveal delay={60} className="min-w-0">
          <Lead>
            Une interface conçue pour être utilisée à la télécommande, pas une application mobile
            simplement agrandie sur votre téléviseur.
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
            Installez VYRO Premium, connectez votre source compatible et profitez immédiatement de
            votre bibliothèque.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}

export function IntegrationsSection() {
  return (
    <Section id="integrations">
      <Reveal className="max-w-2xl">
        <Eyebrow>Intégrations</Eyebrow>
        <Heading className="mt-4">Connecté aux services que vous utilisez déjà.</Heading>
        <Lead className="mt-5">
          VYRO Premium enrichit votre bibliothèque avec les services que vous avez déjà. Rien de plus,
          rien d'inventé.
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
                    ? "bg-primary/15 text-primary"
                    : "bg-surface-2 text-muted-foreground",
                )}
              >
                {item.status === "available" ? "Disponible" : "Prochainement"}
              </span>
            </div>
            <p className="mt-2.5 text-sm text-muted-foreground">{item.description}</p>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}

export function PricingSection({ withHeading = true }: { withHeading?: boolean }) {
  return (
    <Section id="tarifs">
      {withHeading ? (
        <Reveal className="mx-auto max-w-2xl text-center">
          <Heading>Choisissez votre accès VYRO Premium.</Heading>
          <Lead className="mt-5">Un seul abonnement. Toute l'expérience VYRO Premium.</Lead>
        </Reveal>
      ) : null}

      <div className="mt-14 grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan, i) => (
          <Reveal
            key={plan.id}
            delay={i * 80}
            className={cn(
              "panel relative flex flex-col p-7",
              plan.highlight && "border-primary/40 shadow-[var(--shadow-glow)]",
            )}
          >
            {plan.highlight ? (
              <div aria-hidden className="halo -inset-16 -z-10 opacity-40" />
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-medium">{plan.name}</h3>
              {plan.badge ? (
                <span
                  className={cn(
                    "rounded-[6px] px-2 py-0.5 text-[11px] font-medium",
                    plan.highlight ? "bg-primary/15 text-primary" : "bg-surface-2 text-muted-foreground",
                  )}
                >
                  {plan.badge}
                </span>
              ) : null}
            </div>
            <p className="mt-7 font-display text-4xl font-semibold tracking-tight">
              {formatPrice(plan.price)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              soit {monthlyEquivalent(plan)} / mois · accès {plan.months} mois
            </p>
            <Link
              to="/checkout"
              search={{ plan: plan.id }}
              className={cn(
                "mt-8 inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-sm font-medium transition-all duration-200",
                plan.highlight
                  ? "bg-primary text-primary-foreground hover:brightness-115 hover:shadow-[0_0_28px_-8px_var(--primary)]"
                  : "bg-surface-2 text-foreground hover:bg-accent",
              )}
            >
              {plan.cta}
            </Link>
          </Reveal>
        ))}
      </div>

      <Reveal className="panel mt-4 p-7">
        <p className="text-sm font-medium">Inclus dans chaque offre</p>
        <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Reveal>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        L'abonnement concerne l'accès à l'application VYRO Premium. Aucune chaîne, aucun film et
        aucune série n'est vendu ni inclus.
      </p>
    </Section>
  );
}

export function DisclaimerSection() {
  return (
    <Section>
      <Reveal className="panel mx-auto max-w-4xl p-8 md:p-12">
        <h2 className="text-balance font-display text-xl font-medium md:text-2xl">
          VYRO Premium est un lecteur, pas un fournisseur de contenu.
        </h2>
        <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">{DISCLAIMER}</p>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          Le paiement concerne uniquement la licence et l'accès aux fonctionnalités de l'application
          VYRO Premium.
        </p>
      </Reveal>
    </Section>
  );
}

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-border">
      <div aria-hidden className="halo left-1/2 top-1/2 h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/2" />
      <div className="relative mx-auto max-w-3xl px-5 py-28 text-center md:px-8 md:py-36">
        <Reveal>
          <Heading>Votre expérience TV commence ici.</Heading>
          <Lead className="mx-auto mt-6 max-w-xl">
            Installez VYRO Premium et profitez d'une interface pensée jusque dans les moindres détails
            pour votre télévision.
          </Lead>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              to="/tarifs"
              className="inline-flex w-full items-center justify-center rounded-[10px] bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all duration-200 hover:brightness-115 hover:shadow-[0_0_36px_-8px_var(--primary)] sm:w-auto"
            >
              Obtenir VYRO Premium
            </Link>
            <Link
              to="/appareils"
              className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              Voir les appareils compatibles
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function FaqSection({ compact = false }: { compact?: boolean }) {
  return (
    <Section id="faq">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Heading>Questions fréquentes.</Heading>
      </Reveal>
      <Reveal delay={60} className="mx-auto mt-12 max-w-3xl">
        <Accordion type="single" collapsible className="w-full">
          {(compact ? FAQ.slice(0, 6) : FAQ).map((item, i) => (
            <AccordionItem key={item.q} value={`item-${i}`} className="border-border">
              <AccordionTrigger className="py-5 text-left text-[15px] font-medium hover:no-underline md:text-base">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="pb-6 text-[14.5px] leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </Section>
  );
}
