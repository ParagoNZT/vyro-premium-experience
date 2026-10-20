import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/site/Button";
type Access={id:string;name:string;enabled:number;maxDevices:number;expiresAt:string|null;deviceCount:number;lastSeen:string|null;resellerName:string|null;clientEmail:string|null};
type Data={codes:Access[];hasMore:boolean;stats:{accesses:number;activeAccesses:number;devices:number}};
const field="mt-1 w-full rounded-lg border border-border bg-surface-2 p-3 text-sm";
const date=(v:string|null)=>v?new Date(v).toLocaleString("fr-FR"):"—";
async function request(path:string,body?:unknown){
 const {data}=await supabase.auth.getSession(); if(!data.session)throw Error("Reconnectez-vous.");
 const r=await fetch(path,{method:body?"POST":"GET",cache:"no-store",headers:{Authorization:"Bearer "+data.session.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const result=await r.json(); if(!r.ok)throw Error(result.error||"Demande impossible."); return result;
}
export function BetaPanel({onSaved}:{onSaved:()=>void}){
 const [data,setData]=useState<Data|null>(null),[page,setPage]=useState(0),[q,setQ]=useState(""),[search,setSearch]=useState(""),[version,setVersion]=useState(0);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [edit,setEdit]=useState<Access|null>(null),[expiry,setExpiry]=useState(""),[limit,setLimit]=useState(1),[enabled,setEnabled]=useState(true),[note,setNote]=useState("");
 useEffect(()=>{let live=true;setError("");request("/api/beta?page="+page+"&q="+encodeURIComponent(search)).then(v=>{if(live)setData(v);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[page,search,version]);
 async function save(e:FormEvent){e.preventDefault();if(!edit)return;setBusy(true);setError("");setNotice("");try{
  const initialDate=edit.expiresAt?new Date(edit.expiresAt).toLocaleDateString("sv-SE"):"";
  const expiresAt=expiry===initialDate?edit.expiresAt:expiry?new Date(expiry+"T23:59:59.999").toISOString():null;
  await request("/api/beta",{id:edit.id,enabled,maxDevices:limit,expiresAt,note});
  setEdit(null);setVersion(v=>v+1);onSaved();setNotice("Accès enregistré dans le panel et appliqué à l’application TV.");
 }catch(e){setError(e instanceof Error?e.message:"Enregistrement impossible.");}finally{setBusy(false);}}
 return <section className="space-y-5">
 <div className="grid gap-3 sm:grid-cols-3">{[["Accès enregistrés",data?.stats.accesses],["Accès actifs",data?.stats.activeAccesses],["Appareils liés",data?.stats.devices]].map(([label,value])=><div key={label} className="panel p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl">{value??"—"}</p></div>)}</div>
 <div className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><p>Les testeurs existants et les licences VYRO utilisent la même gestion des accès TV.</p><a className="text-primary" href="https://vyro-beta-access.beta-worker.workers.dev/admin" target="_blank" rel="noopener noreferrer">Ouvrir le panel complet ↗</a></div>
 <form onSubmit={e=>{e.preventDefault();setPage(0);setSearch(q);}} className="flex items-end gap-3"><label className="flex-1 text-sm">Rechercher un accès<input className={field} maxLength={80} value={q} onChange={e=>setQ(e.target.value)} placeholder="Nom du testeur ou e-mail VYRO"/></label><Button type="submit" size="sm" variant="secondary">Rechercher</Button><button type="button" className="p-2 text-sm text-primary" onClick={()=>setVersion(v=>v+1)}>Actualiser les accès TV</button></form>
 {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{notice&&<p role="status" className="text-sm text-primary">{notice}</p>}
 {edit&&<form onSubmit={save} className="panel space-y-4 p-5"><h2 className="font-medium">Modifier l’accès de {edit.name}</h2><p className="text-xs text-muted-foreground">Les appareils et les clés existants sont conservés.</p><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Fin de l’accès<input type="date" className={field} value={expiry} onChange={e=>setExpiry(e.target.value)}/><span className="text-xs text-muted-foreground">Vide : sans expiration.</span></label><label className="text-sm">Appareils autorisés<input className={field} type="number" min={Math.max(1,edit.deviceCount)} max={10} required value={limit} onChange={e=>setLimit(Number(e.target.value))}/></label></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Accès activé</label><label className="block text-sm">Motif<input className={field} required maxLength={300} value={note} onChange={e=>setNote(e.target.value)}/></label><div className="flex gap-3"><Button type="submit" size="sm" disabled={busy}>Enregistrer l’accès</Button><button type="button" onClick={()=>setEdit(null)} className="text-sm">Annuler</button></div></form>}
 {!data?<p role="status">Chargement des accès TV…</p>:<div className="panel overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{["Nom / compte","Origine","Statut","Fin de l’accès","Appareils","Dernière visite","Action"].map(v=><th key={v} className="p-4 text-xs text-muted-foreground">{v}</th>)}</tr></thead><tbody>{data.codes.map(c=><tr key={c.id} className="border-t border-border"><td className="p-4">{c.name}{c.clientEmail&&<p className="text-xs text-muted-foreground">{c.clientEmail}</p>}</td><td className="p-4">{c.clientEmail?"VYRO":c.resellerName?"Revendeur · "+c.resellerName:"Bêta"}</td><td className="p-4">{!c.enabled?"Désactivé":c.expiresAt&&c.expiresAt<new Date().toISOString()?"Expiré":"Actif"}</td><td className="p-4 text-xs">{c.expiresAt?date(c.expiresAt):"Sans expiration"}</td><td className="p-4">{c.deviceCount} / {c.maxDevices}</td><td className="p-4 text-xs">{date(c.lastSeen)}</td><td className="p-4"><button className="text-primary" onClick={()=>{setEdit(c);setExpiry(c.expiresAt?new Date(c.expiresAt).toLocaleDateString("sv-SE"):"");setLimit(c.maxDevices);setEnabled(Boolean(c.enabled));setNote("");}}>Modifier l’accès</button></td></tr>)}</tbody></table>{data.codes.length===0&&<p className="p-5">Aucun accès trouvé.</p>}</div>}
 <div className="flex justify-between text-sm"><button disabled={!page} onClick={()=>setPage(v=>v-1)}>Précédent</button><span>Page {page+1}</span><button disabled={!data?.hasMore} onClick={()=>setPage(v=>v+1)}>Suivant</button></div>
 </section>;
}
