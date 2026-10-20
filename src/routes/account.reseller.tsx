import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Download, Upload, Plus, Trash2, Tv, LockKeyhole, Save, LogOut, Package, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/site/Button";
import { Button as IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resellerSchema, exportResellerConfig, type ResellerConfig } from "@/lib/reseller";

export const Route = createFileRoute("/account/reseller")({
  head: () => ({ meta: [
    { title: "Revendeur – VYRO Premium" },
    { name: "description", content: "Personnalisez votre application et préconfigurez vos serveurs XC dans votre espace revendeur VYRO Premium." },
    { property: "og:title", content: "Revendeur – VYRO Premium" },
    { property: "og:description", content: "Votre marque, votre logo et vos serveurs XC préconfigurés." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ResellerPage,
});

function ResellerPage() {
  const [config, setConfig] = useState<ResellerConfig>({ name: "", package_name: "", servers: [{ name: "Principal", url: "" }] });
  const [identity, setIdentity] = useState<{ id: string; email: string } | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    const update = (user: { id: string; email?: string } | null) => { if (live) setIdentity(user ? { id: user.id, email: user.email ?? "" } : null); };
    supabase.auth.getUser().then(({ data }) => { update(data.user); if (live) setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => update(session?.user ?? null));
    return () => { live = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!identity) return;
    let live = true;
    setLoading(true);
    supabase.from("reseller_apps").select("*").eq("user_id", identity.id).maybeSingle().then(async ({ data, error: issue }) => {
      if (!live) return;
      if (issue) setError("Impossible de charger vos réglages. Réessayez en rechargeant la page.");
      if (data) {
        const parsed = resellerSchema.safeParse(data);
        if (parsed.success) setConfig(parsed.data);
        setLogoPath(data.logo_path); setLogoFile(null);
        if (data.logo_path) {
          const { data: signed } = await supabase.storage.from("reseller-logos").createSignedUrl(data.logo_path, 3600);
          if (live) setLogo(signed?.signedUrl ?? null);
        }
      }
      if (live) setLoading(false);
    });
    return () => { live = false; };
  }, [identity?.id]);

  useEffect(() => {
    if (!logoFile) return;
    const url = URL.createObjectURL(logoFile);
    setLogo(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  async function authenticate(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = register
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/account/reseller` } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setPassword("");
      if (register && !result.data.session) setNotice("Consultez votre e-mail pour confirmer votre compte revendeur, puis connectez-vous ici.");
    } catch { setError("Connexion impossible. Vérifiez vos identifiants et la confirmation de votre e-mail."); }
    finally { setBusy(false); }
  }

  async function social(provider: "google" | "lovable") {
    setError("");
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) setError("La connexion n’a pas abouti. Réessayez.");
  }

  async function save(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    const parsed = resellerSchema.safeParse(config);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Vérifiez vos réglages."); return; }
    if (!identity) { setError("Connectez votre compte revendeur pour enregistrer vos réglages privés."); return; }
    setBusy(true);
    let uploaded: string | null = null;
    try {
      let path = logoPath;
      if (logoFile) {
        const ext = logoFile.type === "image/png" ? "png" : logoFile.type === "image/webp" ? "webp" : "jpg";
        path = `${identity.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("reseller-logos").upload(path, logoFile, { contentType: logoFile.type });
        if (uploadError) throw uploadError;
        uploaded = path;
      }
      const { error: saveError } = await supabase.from("reseller_apps").upsert({ ...parsed.data, logo_path: path, user_id: identity.id }, { onConflict: "user_id" });
      if (saveError) throw saveError;
      if (logoPath && logoPath !== path) await supabase.storage.from("reseller-logos").remove([logoPath]);
      setConfig(parsed.data); setLogoPath(path);
      setNotice("Vos réglages revendeur sont enregistrés.");
    } catch {
      if (uploaded) await supabase.storage.from("reseller-logos").remove([uploaded]);
      setError("Enregistrement impossible. Vos modifications restent à l’écran ; réessayez.");
    } finally { setBusy(false); }
  }

  function downloadConfig() {
    const parsed = resellerSchema.safeParse(config);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Vérifiez vos réglages."); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportResellerConfig(parsed.data, logoPath), null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `${config.package_name}-configuration.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="mb-2 text-xs uppercase text-primary">VYRO / Partenaires</p><h1 className="font-display text-3xl font-semibold">Espace Revendeur</h1><p className="mt-2 text-sm text-muted-foreground">Votre application. Votre marque. Vos serveurs XC.</p></div>
      <span className="flex items-center gap-2 border border-border px-3 py-2 text-xs text-muted-foreground"><Package className="size-4" />Configuration APK</span>
    </div>

    <section className="mt-8 border-y border-border py-5">
      {identity ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex min-w-0 items-center gap-2 text-sm"><LockKeyhole className="size-4 shrink-0 text-primary" /><span className="break-all">Compte revendeur · {identity.email}</span></p><IconButton variant="ghost" onClick={async () => { await supabase.auth.signOut(); setLogo(null); setLogoPath(null); setLogoFile(null); setNotice(""); }}><LogOut />Déconnexion revendeur</IconButton></div> : <>
        <h2 className="text-base font-medium">Connexion revendeur sécurisée</h2>
        <p className="mt-1 text-xs text-muted-foreground">L’espace client actuel est une démonstration. Un compte revendeur réel protège vos réglages et votre logo.</p>
        <form onSubmit={authenticate} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-xs">E-mail<Input className="mt-2" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
          <label className="min-w-0 flex-1 text-xs">Mot de passe<Input className="mt-2" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete={register ? "new-password" : "current-password"} /></label>
          <Button type="submit" size="sm" disabled={busy}>{register ? "Créer mon compte" : "Se connecter"}</Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2"><IconButton variant="ghost" size="sm" onClick={() => setRegister(!register)}>{register ? "J’ai déjà un compte" : "Créer un compte revendeur"}</IconButton><IconButton variant="outline" size="sm" onClick={() => void social("google")}>Google</IconButton><IconButton variant="outline" size="sm" onClick={() => void social("lovable")}>Lovable</IconButton></div>
      </>}
    </section>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-4 text-sm text-primary">{notice}</p>}
    {loading ? <p className="mt-6 text-sm text-muted-foreground">Chargement…</p> : <div className="mt-8 grid min-w-0 gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={save} className="min-w-0 space-y-9">
        <section><h2 className="font-display text-lg">01 — Identité de l’application</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="text-sm">Nom de l’application<Input className="mt-2" placeholder="Votre marque TV" maxLength={60} value={config.name} onChange={e => setConfig({ ...config, name: e.target.value })} required /></label><label className="text-sm">Identifiant Android<Input className="mt-2" placeholder="com.votremarque.tv" maxLength={150} value={config.package_name} onChange={e => setConfig({ ...config, package_name: e.target.value })} required /></label></div>
          <div className="mt-5 flex flex-wrap items-center gap-4"><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Importer le logo" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError("Choisissez un logo PNG, JPG ou WebP de 2 Mo maximum."); return; } setError(""); setLogoFile(file); }} />
            <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}><Upload className="size-4" />Importer le logo</Button><p className="text-xs text-muted-foreground">PNG, JPG ou WebP · 2 Mo maximum</p>
            {logo && <IconButton type="button" variant="ghost" size="icon" aria-label="Retirer le logo" title="Retirer le logo" onClick={() => { setLogo(null); setLogoFile(null); setLogoPath(null); if (fileInput.current) fileInput.current.value = ""; }}><Trash2 /></IconButton>}
          </div>
        </section>
        <section className="border-t border-border pt-7"><div className="flex items-center justify-between gap-3"><h2 className="font-display text-lg">02 — Serveurs Xtream Codes</h2><IconButton type="button" variant="outline" size="icon" title="Ajouter un serveur" aria-label="Ajouter un serveur" disabled={config.servers.length >= 10} onClick={() => setConfig({ ...config, servers: [...config.servers, { name: "", url: "" }] })}><Plus /></IconButton></div>
          <div className="mt-5 space-y-5">{config.servers.map((server, index) => <div key={index} className="grid min-w-0 gap-3 sm:grid-cols-[140px_minmax(0,1fr)_36px]">
            <label className="text-xs">Nom du serveur<Input className="mt-2" required maxLength={60} value={server.name} onChange={e => setConfig({ ...config, servers: config.servers.map((s, i) => i === index ? { ...s, name: e.target.value } : s) })} /></label>
            <label className="min-w-0 text-xs">Adresse de base XC<Input className="mt-2" required type="url" placeholder="https://votre-serveur.com:8080" value={server.url} onChange={e => setConfig({ ...config, servers: config.servers.map((s, i) => i === index ? { ...s, url: e.target.value } : s) })} /></label>
            <IconButton className="sm:mt-6" type="button" variant="ghost" size="icon" disabled={config.servers.length === 1} title="Supprimer ce serveur" aria-label={`Supprimer le serveur ${index + 1}`} onClick={() => setConfig({ ...config, servers: config.servers.filter((_, i) => i !== index) })}><Trash2 /></IconButton>
          </div>)}</div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Adresse du serveur uniquement, sans identifiant ni mot de passe. Avec plusieurs serveurs, le client choisira leur nom.</p>
        </section>
        <div className="flex flex-wrap gap-3 border-t border-border pt-6"><Button type="submit" size="sm" disabled={busy || !identity}><Save className="size-4" />{busy ? "Enregistrement…" : "Enregistrer"}</Button><Button variant="secondary" size="sm" onClick={downloadConfig}><Download className="size-4" />Exporter les réglages</Button></div>
      </form>
      <aside className="min-w-0"><p className="mb-3 text-xs uppercase text-muted-foreground">Aperçu de connexion TV</p><div className="rounded-lg border border-border bg-surface p-7 text-center">
        <div className="mx-auto grid size-20 place-items-center rounded-lg bg-surface-2">{logo ? <img src={logo} alt="Votre logo" className="max-h-16 max-w-16 object-contain" /> : <Tv className="size-9 text-primary" />}</div>
        <h2 className="mt-5 break-words font-display text-xl">{config.name || "Votre marque TV"}</h2><p className="mt-2 text-xs text-muted-foreground">Bienvenue sur votre télévision</p>
        <div className="mt-7 space-y-3 text-left">{config.servers.length > 1 && <div className="rounded-md border border-input px-3 py-3 text-xs">{config.servers[0]?.name || "Choisir un serveur"}</div>}<div className="rounded-md border border-input px-3 py-3 text-xs text-muted-foreground">Identifiant</div><div className="rounded-md border border-input px-3 py-3 text-xs text-muted-foreground">Mot de passe</div><div className="flex items-center justify-center gap-2 rounded-md bg-primary py-3 text-xs text-primary-foreground">Se connecter<ArrowRight className="size-3" /></div></div>
      </div><div className="mt-7 border-t border-border pt-5"><p className="flex items-center gap-2 text-sm"><Package className="size-4 text-primary" />APK personnalisée — non disponible</p><p className="mt-3 text-xs leading-relaxed text-muted-foreground">Les réglages sont prêts à être intégrés. La génération d’une APK signée nécessite les sources Android de VYRO et un service de compilation. L’export JSON n’est pas une application installable.</p></div></aside>
    </div>}
    <p className="mt-10 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">VYRO ne fournit aucun contenu. Configurez uniquement les sources auxquelles vous et vos clients êtes légalement autorisés à accéder.</p>
  </div>;
}