import { useRouterState } from "@tanstack/react-router";
import { useCallback } from "react";
import { englishCopy } from "./english-copy";

export const siteOrigin = "https://vyro-player.app";
export type SiteLanguage = "fr" | "en";

const englishPaths: Readonly<Record<string, string>> = {
  "/": "/en",
  "/fonctionnalites": "/en/features",
  "/appareils": "/en/devices",
  "/tarifs": "/en/pricing",
  "/revendeurs": "/en/resellers",
  "/download": "/en/download",
  "/support": "/en/support",
  "/faq": "/en/faq",
  "/login": "/en/login",
  "/register": "/en/register",
  "/checkout": "/en/checkout",
  "/associer": "/en/pair",
  "/legal/conditions": "/en/legal/terms",
  "/legal/confidentialite": "/en/legal/privacy",
  "/legal/mentions": "/en/legal/imprint",
  "/legal/remboursement": "/en/legal/refunds",
};

const frenchPaths: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(englishPaths).map(([fr, en]) => [en, fr]),
);

const trimTrailingSlash = (pathname: string) => pathname.replace(/\/+$/, "") || "/";

export function languageFromHref(href: string): SiteLanguage {
  const pathname = href.split(/[?#]/, 1)[0] ?? "";
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "fr";
}

export function frenchPath(pathname: string) {
  const path = trimTrailingSlash(pathname);
  return Object.hasOwn(frenchPaths, path) ? frenchPaths[path] : undefined;
}

export function englishPath(pathname: string) {
  const path = trimTrailingSlash(pathname);
  return Object.hasOwn(englishPaths, path) ? englishPaths[path] : undefined;
}

export function useSiteLanguage() {
  return useRouterState({ select: (state) => languageFromHref(state.location.publicHref) });
}

export function translate(language: SiteLanguage, french: string): string {
  return language === "en" && Object.hasOwn(englishCopy, french) ? englishCopy[french]! : french;
}

export function useCopy() {
  const language = useSiteLanguage();
  return useCallback((french: string) => translate(language, french), [language]);
}
