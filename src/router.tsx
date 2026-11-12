import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { englishPath, frenchPath, languageFromHref } from "./lib/site-language";
import { routeTree } from "./routeTree.gen";

const currentPath = createIsomorphicFn()
  .server(() => new URL(getRequest().url).pathname)
  .client(() => window.location.pathname);

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    rewrite: {
      input: ({ url }) => {
        const path = frenchPath(url.pathname);
        if (path) url.pathname = path;
        return url;
      },
      output: ({ url }) => {
        if (languageFromHref(currentPath()) === "en") {
          const path = englishPath(url.pathname);
          if (path) url.pathname = path;
        }
        return url;
      },
    },
  });

  return router;
};
