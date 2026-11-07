import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { adminResponse } = await import("@/lib/admin.server");
        return adminResponse(request);
      },
    },
  },
});
