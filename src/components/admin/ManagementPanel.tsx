import { useEffect, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Users, KeyRound, CreditCard, ScrollText, X, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AdminOverview } from "@/lib/management-types";
import { Button } from "@/components/site/Button";
import { BetaPanel } from "./BetaPanel";
import { PLANS, formatPrice, getPlan } from "@/config/site";

type Tab = "beta" | "clients" | "licenses" | "payments" | "audit";
type Action = Record<string, unknown> & {action:string};
const inputClass="mt-1.5 w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary";
const date=(value:string|null)=>value?new Date(value).toLocaleString("fr-FR"):"—";
const actionLabels:Record<string,string>={"access-key-viewed":"Clé consultée","access-key-shared":"Clé de partage demandée","beta-access-change-requested":"Modification d’accès TV demandée","client-created":"Fiche client créée","license-granted":"Licence attribuée / prolongée","license-revoked":"Licence révoquée","client-suspended":"Client suspendu","client-active":"Client réactivé","payment-paid":"Paiement confirmé","test-payment-paid":"Paiement de test confirmé","payment-refunded":"Paiement remboursé"};

async function request(path:string, action?:Action) {
 const {data}=await supabase.auth.getSession();
 if(!data.session) throw new Error("Reconnectez-vous pour continuer.");
 const response=await fetch(path,{method:action?"POST":"GET",cache:"no-store",headers:{Authorization:"Bearer "+data.session.access_token,...(action?{"Content-Type":"application/json"}:{})},...(action?{body:JSON.stringify(action)}:{})});
 const result=await response.json();
 if(!response.ok) throw new Error(result.error||"La demande n’a pas abouti.");
 return result;
}
export function ManagementPanel() {
 const [data,setData]=useState<AdminOverview|null>(null);
 const [tab,setTab]=useState<Tab>("clients");
 const [page,setPage]=useState(0);
 const [version,setVersion]=useState(0);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [search,setSearch]=useState("");
 const [form,setForm]=useState<"client"|"license"|null>(null);
 const [firstName,setFirstName]=useState("");
 const [email,setEmail]=useState("");
 const [clientId,setClientId]=useState("");
 const [planId,setPlanId]=useState("12m");
 const [limit,setLimit]=useState(3);
 const [note,setNote]=useState("");
 const [pending,setPending]=useState<Action|null>(null);
 useEffect(()=>{
 let live=true; setLoading(true); setError("");
 request("/api/manage?page="+page).then(result=>{if(live)setData(result);}).catch(issue=>{if(live)setError(issue.message);}).finally(()=>{if(live)setLoading(false);});
 return()=>{live=false;};
 },[page,version]);
 async function run(action:Action) {
 setBusy(true);setError("");setNotice("");
 try{await request("/api/manage",action);setNotice("Modification enregistrée.");setForm(null);setPending(null);setNote("");setVersion(v=>v+1);}
 catch(issue){setError(issue instanceof Error?issue.message:"Enregistrement impossible.");}
 finally{setBusy(false);}
 }
 function submit(e:FormEvent) {
 e.preventDefault();
 if(form==="client")void run({action:"create-client",email,firstName});
 else if(form==="license")void run({action:"grant-license",clientId,planId,deviceLimit:limit,note});
 else if(pending)void run({...pending,note});
 }
 const tabs=[["beta","Accès TV / Bêtas",ShieldCheck],["clients","Clients",Users],["licenses","Licences",KeyRound],["payments","Paiements",CreditCard],["audit","Journal",ScrollText]] as const;
 const filter=(value:string)=>value.toLowerCase().includes(search.toLowerCase());
 return <div className="mt-8 space-y-5">
 <div className="grid gap-3 sm:grid-cols-3">
 {[["Clients enregistrés",data?.stats.clients??"—"],["Licences actives",data?.stats.activeLicenses??"—"],["Paiements encaissés",data?formatPrice(data.stats.paidCents/100):"—"]].map(([label,value])=><div key={label} className="panel p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl">{value}</p></div>)}
 </div>
 <div className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
 <span className={data?.stripe.configured?"text-primary":"text-muted-foreground"}>{data?.stripe.configured?(data.stripe.live?"Stripe connecté · paiements réels":"Stripe connecté · mode test"):"Stripe à connecter · aucun encaissement activé"}</span>
 <span className="text-xs text-muted-foreground">Les fiches se complètent à la première connexion du client.</span>
 </div>
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div role="tablist" aria-label="Gestion" className="flex flex-wrap gap-1">{tabs.map(([id,label,Icon])=><button key={id} role="tab" aria-selected={tab===id} onClick={()=>{setTab(id);setSearch("");}} className={"flex items-center gap-2 rounded-lg px-3 py-2 text-sm "+(tab===id?"bg-primary/15 text-primary":"text-muted-foreground hover:bg-surface-2")}><Icon className="h-4 w-4"/>{label}</button>)}</div>
 <div className="flex flex-wrap gap-2">
 <Button variant="secondary" size="sm" onClick={()=>{setForm("client");setPending(null);setFirstName("");setEmail("");setNote("");}}><Plus className="h-4 w-4"/>Ajouter un client</Button>
 <Button variant="primary" size="sm" onClick={()=>{setForm("license");setPending(null);setClientId("");setNote("");}}><KeyRound className="h-4 w-4"/>Attribuer une licence</Button>
 <button aria-label="Actualiser la gestion" onClick={()=>setVersion(v=>v+1)} className="rounded-lg border border-border p-2"><RefreshCw className={"h-4 w-4 "+(loading?"animate-spin":"")}/></button>
 </div></div>
 {error&&<p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
 {notice&&<p role="status" className="text-sm text-primary">{notice}</p>}
 {(form||pending)&&<form onSubmit={submit} className="panel space-y-4 p-6">
 <div className="flex items-center justify-between"><h2 className="font-medium">{form==="client"?"Ajouter une fiche client":form==="license"?"Attribuer ou prolonger une licence":pending?.action==="revoke-license"?"Révoquer la licence":pending?.['status']==="suspended"?"Suspendre l’accès client":"Réactiver l’accès client"}</h2><button type="button" aria-label="Fermer le formulaire" onClick={()=>{setForm(null);setPending(null);}}><X className="h-5 w-5"/></button></div>
 {form==="client"?<><p className="text-xs text-muted-foreground">La fiche sera liée au compte de cette adresse après sa confirmation. Aucun e-mail n’est envoyé.</p><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Prénom<input className={inputClass} required maxLength={80} value={firstName} onChange={e=>setFirstName(e.target.value)}/></label><label className="text-sm">E-mail client<input className={inputClass} type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label></div></>:null}
 {form==="license"&&<><p className="text-xs text-muted-foreground">Attribution manuelle sans encaissement. Une licence active est prolongée à partir de sa date d’expiration.</p><label className="block text-sm">Client<select className={inputClass} required value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Choisir un client de cette page</option>{data?.clients.filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.email}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Durée<select className={inputClass} value={planId} onChange={e=>setPlanId(e.target.value)}>{PLANS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="text-sm">Appareils autorisés<input className={inputClass} type="number" min={1} max={10} required value={limit} onChange={e=>setLimit(Number(e.target.value))}/></label></div></>}
 {form!=="client"&&<label className="block text-sm">Motif<input className={inputClass} required minLength={1} maxLength={300} value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex. geste commercial, correction, demande client"/></label>}
 {pending?.action==="client-status"&&<p className="text-xs text-muted-foreground">Cette action concerne les services VYRO. Le compte de connexion est conservé.</p>}
 <Button type="submit" disabled={busy} variant="primary" size="sm">{busy?"Enregistrement…":"Confirmer"}</Button>
 </form>}
 {tab!=="beta"&&<label className="block text-xs text-muted-foreground">Filtrer cette page<input className={inputClass} placeholder="E-mail, nom, référence…" value={search} onChange={e=>setSearch(e.target.value)}/></label>}
 {tab==="beta"?<BetaPanel onSaved={()=>setVersion(v=>v+1)}/>:loading&&!data?<p role="status" className="py-8 text-muted-foreground">Chargement de la gestion…</p>:<div className="panel overflow-x-auto">
 {tab==="clients"&&<table className="w-full text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr>{["Client","Compte","Statut","Dernière visite","Action"].map(v=><th key={v} className="p-4">{v}</th>)}</tr></thead><tbody>{data?.clients.filter(c=>filter(c.email+" "+c.first_name)).map(c=><tr key={c.id} className="border-b border-border/60"><td className="p-4"><p>{c.first_name}</p><p className="mt-1 text-xs text-muted-foreground">{c.email}</p></td><td className="p-4">{c.auth_user_id?"Inscrit":"À créer par le client"}</td><td className="p-4">{c.status==="active"?"Actif":"Suspendu"}</td><td className="whitespace-nowrap p-4 text-xs">{date(c.last_seen_at)}</td><td className="p-4"><button className="text-xs text-primary" onClick={()=>{setForm(null);setNote("");setPending({action:"client-status",clientId:c.id,status:c.status==="active"?"suspended":"active"});}}>{c.status==="active"?"Suspendre":"Réactiver"}</button></td></tr>)}</tbody></table>}
 {tab==="licenses"&&<table className="w-full text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr>{["Client / clé","Offre","Expiration","Appareils max.","Statut","Action"].map(v=><th key={v} className="p-4">{v}</th>)}</tr></thead><tbody>{data?.licenses.filter(l=>filter((l.email??"")+" "+l.license_key)).map(l=><tr key={l.id} className="border-b border-border/60"><td className="p-4"><p>{l.email}</p><code className="mt-1 block max-w-60 break-all text-xs text-muted-foreground">{l.license_key}</code></td><td className="p-4">{getPlan(l.plan_id)?.name}</td><td className="whitespace-nowrap p-4 text-xs">{date(l.expires_at)}</td><td className="p-4">{l.device_limit}</td><td className="p-4">{l.status==="revoked"?"Révoquée":l.expires_at>new Date().toISOString()?"Active":"Expirée"}</td><td className="p-4">{l.status!=="revoked"&&<button className="text-xs text-destructive" onClick={()=>{setForm(null);setNote("");setPending({action:"revoke-license",licenseId:l.id});}}>Révoquer</button>}</td></tr>)}</tbody></table>}
 {tab==="payments"&&<table className="w-full text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr>{["Date","Client","Offre","Montant","Statut","Mode"].map(v=><th key={v} className="p-4">{v}</th>)}</tr></thead><tbody>{data?.payments.filter(p=>filter((p.email??"")+" "+p.id)).map(p=><tr key={p.id} className="border-b border-border/60"><td className="whitespace-nowrap p-4 text-xs">{date(p.paid_at||p.created_at)}</td><td className="p-4">{p.email}<p className="mt-1 text-xs text-muted-foreground">{p.stripe_session_id||p.id}</p></td><td className="p-4">{getPlan(p.plan_id)?.name}</td><td className="p-4">{formatPrice(p.amount_cents/100)}</td><td className="p-4">{{pending:"En attente",paid:"Payé",failed:"Échoué",refunded:"Remboursé"}[p.status]||p.status}</td><td className="p-4">{p.livemode?"Réel":"Test"}</td></tr>)}</tbody></table>}
 {tab==="audit"&&<table className="w-full text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr>{["Date","Action","Motif","Auteur"].map(v=><th key={v} className="p-4">{v}</th>)}</tr></thead><tbody>{data?.audit.filter(a=>filter(a.action+" "+a.note)).map(a=><tr key={a.id} className="border-b border-border/60"><td className="whitespace-nowrap p-4 text-xs">{date(a.created_at)}</td><td className="p-4">{actionLabels[a.action]||a.action}</td><td className="max-w-md break-words p-4">{a.note}</td><td className="max-w-48 break-all p-4 text-xs text-muted-foreground">{a.actor_id==="stripe"?"Stripe":"Administrateur"}</td></tr>)}</tbody></table>}
 {data&&data[tab].length===0&&<p className="p-7 text-sm text-muted-foreground">Aucun enregistrement pour le moment.</p>}
 </div>}
 {tab!=="beta"&&<div className="flex items-center justify-between text-xs text-muted-foreground"><button disabled={page===0||loading} onClick={()=>setPage(p=>p-1)} className="rounded-lg border border-border px-3 py-2 disabled:opacity-40">Précédent</button><span>Page {page+1} · 50 éléments maximum par rubrique</span><button disabled={!data?.hasMore||loading} onClick={()=>setPage(p=>p+1)} className="rounded-lg border border-border px-3 py-2 disabled:opacity-40">Suivant</button></div>}
 <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-primary"/>Les licences VYRO sont reliées au panel et à l’application TV. Les modifications sont vérifiées côté serveur et conservées dans le journal.</p>
 </div>;
}

