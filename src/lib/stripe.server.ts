import { ApiError, api, body, identity, json } from "./access.server";
import { database, trackClient, grantStatement, logStatement } from "./management.server";
import { checkoutSchema } from "./management-validation";
import { verifyStripeSignature } from "./stripe-signature";
import { getPlan } from "@/config/site";
import type { PaymentRow } from "./management-types";
import { isAdminIdentity } from "./admin-policy";
class StripeFailure extends ApiError { constructor(public details: string) { super(502,"Stripe n’a pas pu traiter la demande. Aucun accès n’a été activé."); } }
type StripeSession = { id:string; url:string|null; payment_status:string; status:string; amount_total:number; currency:string; livemode:boolean; client_reference_id:string|null; payment_intent:string|null; metadata:Record<string,string> };
export async function stripeCall<T>(path: string, form?: URLSearchParams, idempotency?: string): Promise<T> {
 const secret=process.env['STRIPE_SECRET_KEY'];
 if (!secret || !process.env['STRIPE_WEBHOOK_SECRET']) throw new ApiError(503,"Le paiement Stripe n’est pas encore connecté.");
 const response=await fetch("https://api.stripe.com/v1/"+path,{method:form?"POST":"GET",headers:{
 Authorization:"Bearer "+secret,...(form?{"Content-Type":"application/x-www-form-urlencoded"}:{}),...(idempotency?{"Idempotency-Key":idempotency}:{})
 },...(form?{body:form}:{})});
 if (!response.ok) {
 const issue=await response.json() as {error?:{message?:string}};
 const details=(issue.error?.message||"Erreur Stripe HTTP "+response.status).replace(/(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+/g,"[clé masquée]");
 throw new StripeFailure(details);
 }
 return await response.json() as T;
}
export const checkoutRequest=api(async request=>{
 const user=await identity(request);
 const input=checkoutSchema.safeParse(await body(request));
 if (!input.success) throw new ApiError(400,"Offre invalide.");
 const plan=getPlan(input.data.planId)!;
 if (!process.env['STRIPE_SECRET_KEY'] || !process.env['STRIPE_WEBHOOK_SECRET']) throw new ApiError(503,"Le paiement Stripe n’est pas encore connecté.");
 const db=await database();
 const client=await trackClient(db,user);
 if (client.status!=="active") throw new ApiError(403,"Votre compte est suspendu.");
 const requestKey=client.id+":"+input.data.requestKey;
 const live=process.env['STRIPE_SECRET_KEY']!.includes("_live_")?1:0;
 await db.prepare("INSERT INTO payments(id,client_id,plan_id,amount_cents,currency,created_at,livemode,request_key) VALUES(?,?,?,?,'eur',?,?,?) ON CONFLICT(request_key) DO NOTHING")
 .bind(crypto.randomUUID(),client.id,plan.id,Math.round(plan.price*100),new Date().toISOString(),live,requestKey).run();
 const order=await db.prepare("SELECT * FROM payments WHERE request_key=?").bind(requestKey).first<PaymentRow>();
 if (!order || order.plan_id!==plan.id || order.livemode!==live) throw new ApiError(409,"Rechargez la page avant de changer d’offre.");
 if(order.status!=="pending") throw new ApiError(409,"Cette commande a déjà été traitée.");
 if(order.stripe_session_id){
 const session=await stripeCall<StripeSession>("checkout/sessions/"+encodeURIComponent(order.stripe_session_id));
 if(session.status==="open" && session.url) return json({url:session.url});
 throw new ApiError(409,"Cette session a expiré ou a été traitée. Rechargez la page.");
 }
 const origin=new URL(request.url).origin;
 const form=new URLSearchParams({
 mode:"payment",client_reference_id:order.id,customer_email:user.email!,
 success_url:origin+"/account?payment="+(live?"processing":"test"),cancel_url:origin+"/checkout?plan="+plan.id,
 "line_items[0][price_data][currency]":"eur","line_items[0][price_data][unit_amount]":String(order.amount_cents),
 "line_items[0][price_data][product_data][name]":"VYRO Premium – accès "+plan.name,
 "line_items[0][quantity]":"1","metadata[order_id]":order.id,"metadata[plan_id]":plan.id,
 "metadata[client_id]":client.id,"payment_intent_data[metadata][order_id]":order.id,
 });
 let session:StripeSession;
 try { session=await stripeCall<StripeSession>("checkout/sessions",form,"checkout-"+order.id); }
 catch(issue){ if(issue instanceof StripeFailure && isAdminIdentity(user,process.env['VYRO_ADMIN_EMAIL'])) return json({error:"Configuration Stripe : "+issue.details},502); throw issue; }
 if(!session.url || !session.url.startsWith("https://checkout.stripe.com/")) throw new ApiError(502,"Page de paiement indisponible.");
 await db.prepare("UPDATE payments SET stripe_session_id=? WHERE id=? AND stripe_session_id IS NULL").bind(session.id,order.id).run();
 return json({url:session.url});
});

export const webhookRequest=api(async request=>{
 const secret=process.env['STRIPE_WEBHOOK_SECRET'];
 if(!secret) throw new ApiError(503,"Stripe non configuré.");
 const raw=await request.text();
 if(raw.length>1048576) throw new ApiError(413,"Événement trop volumineux.");
 if(!await verifyStripeSignature(raw,request.headers.get("stripe-signature"),secret)) throw new ApiError(400,"Signature invalide.");
 let event: {id:string;type:string;data:{object:Record<string,unknown>}};
 try {event=JSON.parse(raw);}catch{throw new ApiError(400,"Événement invalide.");}
 if(!event.id || !event.type || !event.data?.object) throw new ApiError(400,"Événement invalide.");
 if(!["checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed","charge.refunded"].includes(event.type)) return json({received:true});
 const db=await database();
 if(await db.prepare("SELECT id FROM stripe_events WHERE id=?").bind(event.id).first()) return json({received:true});
 if(event.type==="charge.refunded"){
 const charge=event.data.object;
 const order=typeof charge['payment_intent']==="string" ? await db.prepare("SELECT * FROM payments WHERE stripe_payment_intent=?").bind(charge['payment_intent']).first<PaymentRow>():null;
 if(order && charge['refunded']===true){
 await db.batch([
 db.prepare("UPDATE payments SET status='refunded' WHERE id=? AND status='paid'").bind(order.id),
 db.prepare("UPDATE licenses SET status='revoked',updated_at=? WHERE source_payment_id=?").bind(new Date().toISOString(),order.id),
 logStatement(db,"stripe","payment-refunded",order.id,"Remboursement intégral reçu de Stripe ; vérifier les renouvellements éventuels."),
 db.prepare("INSERT OR IGNORE INTO stripe_events(id,type,processed_at) VALUES(?,?,?)").bind(event.id,event.type,new Date().toISOString()),
 ]);
 }
 return json({received:true});
 }
 const sessionId=event.data.object['id'];
 if(typeof sessionId!=="string" || !sessionId.startsWith("cs_")) throw new ApiError(400,"Session invalide.");
 const session=await stripeCall<StripeSession>("checkout/sessions/"+encodeURIComponent(sessionId));
 const order=session.client_reference_id ? await db.prepare("SELECT * FROM payments WHERE id=?").bind(session.client_reference_id).first<PaymentRow>():null;
 if(!order) return json({received:true});
 if(session.metadata?.['order_id']!==order.id || session.metadata?.['client_id']!==order.client_id || session.metadata?.['plan_id']!==order.plan_id ||
 session.amount_total!==order.amount_cents || session.currency!=="eur" || Number(session.livemode)!==order.livemode ||
 (order.stripe_session_id && order.stripe_session_id!==session.id)) throw new ApiError(400,"La session ne correspond pas à la commande.");
 const eventStatement=db.prepare("INSERT OR IGNORE INTO stripe_events(id,type,processed_at) VALUES(?,?,?)").bind(event.id,event.type,new Date().toISOString());
 if(event.type==="checkout.session.async_payment_failed"){
 await db.batch([db.prepare("UPDATE payments SET status='failed' WHERE id=? AND status='pending'").bind(order.id),eventStatement]);
 } else if(session.payment_status==="paid"){
 await db.batch([
 // A duplicate session/event cannot extend the licence again: only pending orders qualify, atomically.
 ...(order.livemode===1?[grantStatement(db,order.client_id,order.plan_id,3,order.id)]:[]),
 db.prepare("UPDATE payments SET status='paid',paid_at=?,stripe_session_id=?,stripe_payment_intent=? WHERE id=? AND status='pending'").bind(new Date().toISOString(),session.id,session.payment_intent,order.id),
 logStatement(db,"stripe",order.livemode?"payment-paid":"test-payment-paid",order.id,"Paiement confirmé par Stripe"),
 eventStatement,
 ]);
 }
 // Unpaid completion is acknowledged but never fulfilled. A later success event can activate it.
 return json({received:true});
});
