import { createFileRoute } from "@tanstack/react-router";
const handle = async ({ request }: { request: Request }) => {
  const { nativeRemoteWorkspace } = await import("@/lib/remote-workspace.server");
  return nativeRemoteWorkspace(request);
};
export const Route = createFileRoute("/api/remote-device")({
  server: { handlers: { POST: handle } },
});
