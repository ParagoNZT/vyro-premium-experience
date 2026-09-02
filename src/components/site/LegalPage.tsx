import type { ReactNode } from "react";

export function LegalPage({
  title,
  updatedAt = "1er septembre 2026",
  children,
}: {
  title: string;
  updatedAt?: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-20 md:px-8 md:py-28">
      <h1 className="font-display text-3xl font-semibold">{title}</h1>
      <p className="mt-2 text-xs text-muted-foreground">Dernière mise à jour : {updatedAt}</p>
      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-muted-foreground [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-foreground [&_p]:mt-3">
        {children}
      </div>
    </article>
  );
}
