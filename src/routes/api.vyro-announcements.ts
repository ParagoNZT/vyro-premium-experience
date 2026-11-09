import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/vyro-announcements")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        (await import("@/lib/vyro-app.server")).vyroAnnouncementsRequest(request),
    },
  },
});
