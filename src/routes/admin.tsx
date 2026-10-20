import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, LockKeyhole, LogOut, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/site/Button";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administration – VYRO Premium" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminPage,
});
type AdminAccount = { email: string; id: string; createdAt: string; lastSignInAt: string | null };
type Status = "loading" | "signed-out" | "forbidden" | "error" | "allowed";

function AdminPage() {
  const { user, ready, signOut } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [account, setAccount] = useState<AdminAccount | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    const abort = new AbortController();
    setAccount(null);
    if (!user) { setStatus("signed-out"); return; }
    setStatus("loading");
    const check = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) { if (live) setStatus("signed-out"); return; }
        const response = await fetch("/api/admin", { headers: { Authorization: "Bearer " + token }, cache: "no-store", signal: abort.signal });
        const result = await response.json();
        if (!live) return;
        if (response.status === 401) setStatus("signed-out");
        else if (response.status === 403) setStatus("forbidden");
        else if (!response.ok) { setStatus("error"); setError(result.error || "Vérification impossible."); }
        else { setAccount(result); setStatus("allowed"); }
      } catch {
        if (live) { setStatus("error"); setError("Vérification impossible. Réessayez."); }
      }
    };
    void check();
    return () => { live = false; abort.abort(); };
  }, [user, ready, attempt]);

  return <section className="mx-auto min-h-screen max-w-5xl px-5 py-16 md:px-8">
    <div className="mb-12 flex items-center justify-between gap-4">
      <Link to="/" className="font-display text-lg font-semibold">VYRO <span className="text-primary">Premium</span></Link>
      <Link to="/account" className="text-sm text-muted-foreground hover:text-primary">Mon compte</Link>
    </div>
    <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-primary"><LockKeyhole className="h-4 w-4" />Espace réservé</p>
    <h1 className="font-display text-3xl font-semibold">Administration VYRO</h1>
    {(!ready || status === "loading") && <p role="status" className="mt-8 text-muted-foreground">Vérification de votre accès…</p>}
    {ready && status === "signed-out" && <div className="panel mt-8 space-y-5 p-7">
      <h2 className="text-lg font-medium">Connectez votre compte administrateur</h2>
      <p className="text-sm text-muted-foreground">Utilisez l’adresse réservée à l’administration. Votre adresse doit être confirmée avant de pouvoir accéder à cet espace.</p>
      <div className="flex flex-wrap gap-3">
        <Button to="/login" search={{ redirect: "/admin" }} variant="primary">Se connecter</Button>
        <Button to="/register" search={{ redirect: "/admin" }} variant="secondary">Créer mon compte</Button>
      </div>
    </div>}
    {ready && status === "forbidden" && <div className="panel mt-8 p-7">
      <h2 className="font-medium">Accès refusé</h2>
      <p role="alert" className="mt-3 text-sm text-muted-foreground">Ce compte ne dispose pas des droits administrateur. Vérifiez votre adresse et sa confirmation.</p>
      <Button to="/account" variant="secondary" className="mt-5">Revenir à mon compte</Button>
    </div>}
    {ready && status === "error" && <div className="panel mt-8 p-7">
      <p role="alert" className="text-sm text-destructive">{error}</p>
      <Button onClick={() => setAttempt(value => value + 1)} variant="secondary" className="mt-5">Réessayer</Button>
    </div>}
    {ready && status === "allowed" && account && <div className="mt-8 space-y-5">
      <div className="panel p-7">
        <h2 className="flex items-center gap-2 font-medium"><ShieldCheck className="h-5 w-5 text-primary" />Accès administrateur vérifié</h2>
        <p className="mt-3 break-all text-lg">{account.email}</p>
        <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Compte créé le</dt><dd className="mt-1">{new Date(account.createdAt).toLocaleDateString("fr-FR")}</dd></div>
          <div><dt className="text-muted-foreground">Dernière connexion</dt><dd className="mt-1">{account.lastSignInAt ? new Date(account.lastSignInAt).toLocaleString("fr-FR") : "—"}</dd></div>
        </dl>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/account/profil" className="panel flex items-center justify-between gap-4 p-7 hover:border-primary/40"><span>Gérer mon profil</span><ArrowRight className="h-4 w-4 text-primary" /></Link>
        <Link to="/account/reseller" className="panel flex items-center justify-between gap-4 p-7 hover:border-primary/40"><span>Configuration revendeur</span><ArrowRight className="h-4 w-4 text-primary" /></Link>
      </div>
      <div className="panel p-7 text-sm text-muted-foreground">La connexion et l’accès administrateur sont actifs. La gestion des utilisateurs, licences, paiements et contenus sera disponible après raccordement de ces modules.</div>
      <Button variant="secondary" onClick={async () => {
        setAccount(null); setStatus("loading"); setError("");
        try { await signOut(); setStatus("signed-out"); }
        catch { setError("Déconnexion impossible. Réessayez."); setStatus("error"); }
      }}><LogOut className="h-4 w-4" />Se déconnecter</Button>
    </div>}
  </section>;
}
