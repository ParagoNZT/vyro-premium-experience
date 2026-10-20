import { createFileRoute } from "@tanstack/react-router";
const handle=async({request}:{request:Request})=>(await import("@/lib/beta.server")).betaRequest(request);
export const Route=createFileRoute("/api/beta")({server:{handlers:{GET:handle,POST:handle}}});
