import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import screeningCss from "../components/site/screening.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Toaster } from "@/components/ui/sonner";
import {
  languageFromHref,
  siteOrigin,
  translate,
  useCopy,
  useSiteLanguage,
} from "@/lib/site-language";
import { homeDescription, homeTitle } from "@/lib/site-seo";

function NotFoundComponent() {
  const t = useCopy();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-semibold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-medium text-foreground">{t("Page introuvable")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("Cette page n'existe pas ou a été déplacée.")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-[10px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-200 hover:brightness-115"
          >
            {t("Retour à l'accueil")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const t = useCopy();
  const language = useSiteLanguage();
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error instanceof Error ? error : new Error(String(error)), {
      boundary: "tanstack_root_error_component",
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("Cette page n'a pas pu être chargée")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("Une erreur est survenue. Vous pouvez réessayer ou revenir à l'accueil.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-[10px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-200 hover:brightness-115"
          >
            {t("Réessayer")}
          </button>
          <a
            href={language === "en" ? "/en" : "/"}
            className="inline-flex items-center justify-center rounded-[10px] border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("Accueil")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: ({ location }) => ({ language: languageFromHref(location.publicHref) }),
  head: ({ match }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: translate(match.context.language, homeTitle) },
      {
        name: "description",
        content: translate(match.context.language, homeDescription),
      },
      { property: "og:site_name", content: "VYRO Premium" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: match.context.language === "en" ? "en_US" : "fr_FR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#100e17" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: screeningCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: "/vyro-icon.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/vyro-icon.png", sizes: "192x192" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "VYRO Premium",
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Android TV, Google TV, Amazon Fire TV",
          image: siteOrigin + "/vyro-icon.png",
          description: translate(match.context.language, homeDescription),
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const language = useSiteLanguage();
  return (
    <html lang={language} className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const t = useCopy();
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const bare = pathname.startsWith("/account") || pathname.startsWith("/admin");
  const authPage = pathname === "/login" || pathname === "/register";

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <a className="vyro-skip" href="#main">
          {t("Aller au contenu")}
        </a>
        {bare || authPage ? null : <Header />}
        <main
          id="main"
          tabIndex={-1}
          className={bare || authPage ? "" : "vyro-public screening-public"}
        >
          {/* Required: nested routes render here. */}
          <Outlet />
        </main>
        {bare || authPage ? null : <Footer />}
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
