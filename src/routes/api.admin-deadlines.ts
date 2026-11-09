import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/admin-deadlines")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { adminDeadlines } = await import("@/lib/deadlines.server");
        return adminDeadlines(request);
      },
    },
  },
});
