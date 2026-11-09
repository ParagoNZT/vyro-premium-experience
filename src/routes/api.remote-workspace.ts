import { createFileRoute } from "@tanstack/react-router";
const handle = async ({ request }: { request: Request }) => {
  const { webRemoteWorkspace } = await import("@/lib/remote-workspace.server");
  return webRemoteWorkspace(request);
};
export const Route = createFileRoute("/api/remote-workspace")({
  server: { handlers: { GET: handle, POST: handle } },
});
