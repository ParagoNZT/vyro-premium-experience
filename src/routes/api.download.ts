import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { downloadRequest } = await import("@/lib/download.server");
        return downloadRequest(request);
      },
    },
  },
});
