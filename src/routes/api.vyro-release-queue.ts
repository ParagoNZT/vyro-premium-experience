import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/vyro-release-queue")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        (await import("@/lib/vyro-app.server")).vyroReleaseQueueRequest(request),
    },
  },
});
