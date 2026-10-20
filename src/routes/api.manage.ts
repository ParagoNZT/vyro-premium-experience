import { createFileRoute } from "@tanstack/react-router";
const handle = async ({ request }: { request: Request }) => {
 const { manageRequest } = await import("@/lib/management.server");
 return manageRequest(request);
};
export const Route = createFileRoute("/api/manage")({ server: { handlers: { GET: handle, POST: handle } } });
