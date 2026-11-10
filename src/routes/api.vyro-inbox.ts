import { createFileRoute } from "@tanstack/react-router";
const handle = async ({ request }: { request: Request }) => {
  const { vyroInbox } = await import("@/lib/vyro-inbox.server");
  return vyroInbox(request);
};
export const Route = createFileRoute("/api/vyro-inbox")({
  server: { handlers: { GET: handle, POST: handle } },
});
