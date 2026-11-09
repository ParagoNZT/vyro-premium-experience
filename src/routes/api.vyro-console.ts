import { createFileRoute } from "@tanstack/react-router";
const handle = async ({ request }: { request: Request }) =>
  (await import("@/lib/vyro-app.server")).vyroConsoleRequest(request);
export const Route = createFileRoute("/api/vyro-console")({
  server: { handlers: { GET: handle, POST: handle } },
});
