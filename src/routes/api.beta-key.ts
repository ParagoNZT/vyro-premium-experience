import {createFileRoute} from "@tanstack/react-router";
export const Route=createFileRoute("/api/beta-key")({server:{handlers:{POST:async({request})=>(await import("@/lib/beta-key.server")).betaKeyRequest(request)}}});
