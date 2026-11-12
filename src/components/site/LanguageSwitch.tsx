import { useRouterState } from "@tanstack/react-router";
import { englishPath, useSiteLanguage } from "@/lib/site-language";

export function LanguageSwitch() {
  const { pathname, searchStr } = useRouterState({ select: (state) => state.location });
  const language = useSiteLanguage();
  const translatedPath = englishPath(pathname);
  const alternate =
    language === "en" ? (translatedPath ? pathname : "/") : (translatedPath ?? "/en");
  const target = language === "en" ? "fr" : "en";

  return (
    <a
      className="vyro-language-switch"
      href={alternate + searchStr}
      hrefLang={target}
      lang={target}
      aria-label={target === "en" ? "English" : "Français"}
    >
      {target.toUpperCase()}
    </a>
  );
}
