import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/api/checkout")({server:{handlers:{POST:async({request})=>{
 const {checkoutRequest}=await import("@/lib/stripe.server"); return checkoutRequest(request);
}}}});
