const authUrl="https://jqudulynpebvnipwjyhu.supabase.co/auth/v1/user";
const reply=(value,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store, private","Vary":"Authorization"}});
export async function vyroKeyBridge(request,env,handlers,fetchImpl=fetch){
 if(request.method!=="POST")return reply({message:"Méthode refusée."},405);
 const authorization=request.headers.get("authorization"),apikey=request.headers.get("apikey");
 if(!authorization?.match(/^Bearer [^\s]+$/)||!apikey)return reply({message:"Connexion requise."},401);
 const auth=await fetchImpl(authUrl,{headers:{Authorization:authorization,apikey}});
 if(!auth.ok)return reply({message:"Session invalide."},401);
 const user=await auth.json();
 if(!user.id||user.is_anonymous||!user.email_confirmed_at||typeof user.email!=="string"||
 user.email.trim().toLowerCase()!==(env.VYRO_ADMIN_EMAIL||"hongkongsubnet@gmail.com").trim().toLowerCase())return reply({message:"Accès administrateur requis."},403);
 const raw=await request.text();if(raw.length>1024)return reply({message:"Requête trop volumineuse."},413);
 let input;try{input=JSON.parse(raw);}catch{return reply({message:"Requête invalide."},400);}
 if(!/^[a-f0-9-]{36}$/i.test(input?.id)||!["reveal","share"].includes(input?.action))return reply({message:"Accès invalide."},400);
 const response=await (input.action==="reveal"?handlers.revealCode(env,input.id):handlers.createShareCode(env,input.id));
 const headers=new Headers(response.headers);headers.set("Cache-Control","no-store, private");headers.set("Vary","Authorization");
 return new Response(response.body,{status:response.status,headers});
}
