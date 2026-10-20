import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/api/checkout")({server:{handlers:{
GET:async()=>Response.json({enabled:Boolean(process.env['STRIPE_SECRET_KEY']&&process.env['STRIPE_WEBHOOK_SECRET']),live:process.env['STRIPE_SECRET_KEY']?.includes("_live_")??false},{headers:{"Cache-Control":"no-store"}}),
POST:async({request})=>{
 const {checkoutRequest}=await import("@/lib/stripe.server"); return checkoutRequest(request);
}}}});
