import { createFileRoute } from "@tanstack/react-router";
const handle = async ({ request }: { request: Request }) =>
  (await import("@/lib/partner-control.server")).partnerControlRequest(request);
export const Route = createFileRoute("/api/partner-control")({
  server: { handlers: { GET: handle, POST: handle } },
});
