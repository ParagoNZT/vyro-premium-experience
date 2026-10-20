import { createFileRoute } from "@tanstack/react-router";
const handle = async ({ request }: { request: Request }) => {
 const { accountRequest } = await import("@/lib/management.server");
 return accountRequest(request);
};
export const Route = createFileRoute("/api/account")({ server: { handlers: { GET: handle, POST: handle } } });
