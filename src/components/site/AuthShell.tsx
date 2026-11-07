import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { ArrowLeft, Monitor, ScanLine } from "lucide-react";
import { Link } from "@tanstack/react-router";
import "./portal.css";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  label = "Espace client",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  label?: string;
}) {
  return (
    <section className="vyro-portal mx-auto grid max-w-6xl gap-8 px-5 py-9 sm:px-8 sm:py-14 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
      <div className="portal-art portal-panel flex-col justify-between p-9" aria-hidden>
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[.24em] text-[#c7b9ff]">
          <ScanLine className="size-4" /> VYRO / Premium
        </span>
        <div className="portal-viewfinder" />
        <div>
          <Monitor className="mb-5 size-7 text-[#c7b9ff]" />
          <p className="max-w-[12ch] font-display text-5xl font-semibold leading-[.98] tracking-[-.05em]">
            Votre lecteur.
            <br />
            Votre salon.
          </p>
          <p className="mt-5 max-w-[30ch] text-sm leading-relaxed text-[#cbc2df]">
            Un seul espace pour votre accès VYRO et les appareils qui y sont associés.
          </p>
        </div>
      </div>
      <div className="portal-enter mx-auto flex w-full max-w-[29rem] min-w-0 flex-col justify-center lg:py-9">
        <Link
          to="/"
          className="mb-7 inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ArrowLeft aria-hidden className="size-4" /> Retour au site
        </Link>
        <p className="portal-kicker">{label}</p>
        <h1 className="mt-3 text-balance font-display text-4xl font-semibold leading-[1.03] tracking-[-.04em]">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        <div className="portal-panel mt-7 p-5 sm:p-6">{children}</div>
        {footer && <div className="mt-5">{footer}</div>}
      </div>
    </section>
  );
}

type FieldProps = Omit<ComponentPropsWithoutRef<"input">, "value" | "onChange"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string | undefined;
};

export function Field({ label, value, onChange, hint, id: providedId, ...props }: FieldProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {hint && (
        <p id={id + "-hint"} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <input
        {...props}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={hint ? id + "-hint" : props["aria-describedby"]}
        className="mt-2 min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-base outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary sm:text-sm"
      />
    </div>
  );
}

export function PortalHeading({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header>
      <p className="portal-kicker">{label}</p>
      <h1 className="mt-3 text-balance font-display text-3xl font-semibold tracking-[-.04em] sm:text-4xl">
        {title}
      </h1>
      {children && (
        <p className="mt-3 max-w-[66ch] text-sm leading-relaxed text-muted-foreground">
          {children}
        </p>
      )}
    </header>
  );
}

export function PortalNotice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <p
      role={error ? "alert" : "status"}
      className={
        error
          ? "rounded-lg border border-destructive/35 bg-destructive/5 p-3.5 text-sm text-destructive"
          : "rounded-lg border border-primary/25 bg-primary/5 p-3.5 text-sm text-foreground"
      }
    >
      {children}
    </p>
  );
}
