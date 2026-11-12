import { englishPath, siteOrigin, translate, type SiteLanguage } from "./site-language";

export const homeTitle = "VYRO Premium – Lecteur IPTV pour TV et Android";
export const homeDescription =
  "VYRO Premium est votre lecteur IPTV pour Android TV, Google TV, Fire TV et mobile. Lisez vos playlists, sauvegardez vos réglages et synchronisez vos appareils.";

export function publicPageHead(
  path: string,
  language: SiteLanguage,
  title: string,
  description?: string,
) {
  const alternate = englishPath(path);
  const canonical = siteOrigin + (language === "en" && alternate ? alternate : path);
  const localizedTitle = translate(language, title);
  const localizedDescription = description && translate(language, description);

  return {
    meta: [
      { title: localizedTitle },
      { property: "og:title", content: localizedTitle },
      { property: "og:url", content: canonical },
      ...(localizedDescription
        ? [
            { name: "description", content: localizedDescription },
            { property: "og:description", content: localizedDescription },
          ]
        : []),
    ],
    links: [
      { rel: "canonical", href: canonical },
      ...(alternate
        ? [
            { rel: "alternate", hrefLang: "fr", href: siteOrigin + path },
            { rel: "alternate", hrefLang: "en", href: siteOrigin + alternate },
            { rel: "alternate", hrefLang: "x-default", href: siteOrigin + path },
          ]
        : []),
    ],
  };
}
