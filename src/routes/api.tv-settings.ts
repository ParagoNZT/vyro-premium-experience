import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tv-settings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { nativeTvSettings } = await import("@/lib/tv-settings.server");
        return nativeTvSettings(request);
      },
    },
  },
});
