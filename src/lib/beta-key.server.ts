import {z} from "zod";
import {api,identity,body,json,ApiError} from "./access.server";
import {database,logStatement} from "./management.server";
export const betaKeyRequest=api(async request=>{
 const user=await identity(request,true);
 const parsed=z.object({id:z.string().uuid(),action:z.enum(["reveal","share"])}).safeParse(await body(request));
 if(!parsed.success)throw new ApiError(400,"Accès invalide.");
 const db=await database();
 const code=await db.prepare(`SELECT c.id,l.license_key FROM codes c LEFT JOIN licenses l ON l.beta_code_hash=c.code_hash WHERE c.id=?`).bind(parsed.data.id).first<{id:string;license_key:string|null}>();
 if(!code)throw new ApiError(404,"Accès introuvable.");
 let key=code.license_key;
 if(!key){
  const {env}=await import("cloudflare:workers");
  const service=env['VYRO_BETA'] as {fetch(input:string,init:RequestInit):Promise<Response>}|undefined;
  if(!service)throw new ApiError(503,"Le service de consultation des clés n’est pas relié.");
  const response=await service.fetch("https://vyro-beta-access.beta-worker.workers.dev/v1/vyro/admin/key",{method:"POST",headers:{
   "Content-Type":"application/json",Authorization:request.headers.get("authorization")!,apikey:import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'],
  },body:JSON.stringify(parsed.data)});
  if(!response.headers.get("content-type")?.includes("application/json"))throw new ApiError(502,"Le service de clés a renvoyé une réponse invalide.");
  const result=await response.json() as {code?:string;message?:string};
  if(!response.ok)throw new ApiError(response.status===409?409:response.status===404?404:502,response.status===409?"La clé initiale n’est plus récupérable. Créez une clé de partage, sans changer les appareils.":"Impossible de récupérer la clé. Réessayez.");
  key=result.code??null;
 }
 if(!key||!/^VYRO-[A-F0-9]{24}$/.test(key))throw new ApiError(502,"Clé indisponible.");
 await db.batch([logStatement(db,user.id,parsed.data.action==="share"?"access-key-shared":"access-key-viewed",code.id,"Clé consultée par l’administrateur ; valeur non journalisée")]);
 return json({code:key});
});
