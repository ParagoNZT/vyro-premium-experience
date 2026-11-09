import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/show-directory")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        (await import("@/lib/show-directory.server")).showDirectoryRequest(request),
    },
  },
});
