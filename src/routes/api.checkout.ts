import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/checkout")({
  server: {
    handlers: {
      GET: async ({ request }) => (await import("@/lib/stripe.server")).checkoutStatus(request),
      POST: async ({ request }) => (await import("@/lib/stripe.server")).checkoutRequest(request),
    },
  },
});
