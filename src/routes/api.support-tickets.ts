import { createFileRoute } from "@tanstack/react-router";
const handle = async ({ request }: { request: Request }) =>
  (await import("@/lib/support.server")).supportRequest(request);
export const Route = createFileRoute("/api/support-tickets")({
  server: { handlers: { GET: handle, POST: handle } },
});
