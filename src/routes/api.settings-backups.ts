import { createFileRoute } from "@tanstack/react-router";

const handle = async ({ request }: { request: Request }) => {
  const { webTvSettings } = await import("@/lib/tv-settings.server");
  return webTvSettings(request);
};

export const Route = createFileRoute("/api/settings-backups")({
  server: { handlers: { GET: handle, POST: handle } },
});
