import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="halo left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2" />
      <div className="relative mx-auto w-full max-w-md px-5 py-20 md:py-28">
        <h1 className="text-balance font-display text-3xl font-semibold leading-tight">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        <div className="panel mt-8 p-7">{children}</div>
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    </section>
  );
}

export function Field({
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="text-[13px] text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-[10px] border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-primary/60"
      />
    </div>
  );
}
