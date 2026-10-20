export async function verifyStripeSignature(raw: string, header: string | null, secret: string, now = Date.now()) {
 if (!header || !secret) return false;
 const fields = header.split(",").map(p=>p.split("="));
 const timestamp = fields.find(([key])=>key==="t")?.[1];
 if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now/1000-Number(timestamp))>300) return false;
 const signatures=fields.filter(([key,value])=>key==="v1" && value && /^[a-f0-9]{64}$/i.test(value)).map(([,value])=>value!);
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 for (const signature of signatures) {
 const bytes=Uint8Array.from(signature.match(/../g)!,v=>parseInt(v,16));
 if (await crypto.subtle.verify("HMAC",key,bytes,new TextEncoder().encode(timestamp+"."+raw))) return true;
 }
 return false;
}
