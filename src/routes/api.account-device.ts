import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/account-device")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { accountDeviceRequest } = await import("@/lib/account-device.server");
        return accountDeviceRequest(request);
      },
    },
  },
});
