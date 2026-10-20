import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Subscription = { planId: string; planName: string; status: "active" | "expired" | "none"; startedAt: string; expiresAt: string; devicesUsed: number; devicesAllowed: number | null };
export type Device = { id: string; name: string; platform: string; lastSeen: string };
export type Order = { id: string; date: string; planName: string; amount: string; status: "paid" };
export type User = { id: string; firstName: string; email: string; licenseKey: string; subscription: Subscription | null; devices: Device[]; orders: Order[] };

// Entitlements never come from localStorage or user-editable auth metadata.
function account(identity: SupabaseUser): User {
  return {
    id: identity.id,
    firstName: typeof identity.user_metadata['first_name'] === "string" ? identity.user_metadata['first_name'] : identity.email?.split("@")[0] || "Vous",
    email: identity.email ?? "", licenseKey: "", subscription: null, devices: [], orders: [],
  };
}

async function loadAccount(identity: SupabaseUser, token?: string): Promise<User> {
  const accessToken = token ?? (await supabase.auth.getSession()).data.session?.access_token;
  if (!accessToken) return account(identity);
  const response = await fetch("/api/account", { cache: "no-store", headers: { Authorization: "Bearer " + accessToken } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Impossible de charger votre compte.");
  return result as User;
}

type AuthState = {
  user: User | null; ready: boolean; daysLeft: number | null; isActive: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (firstName: string, email: string, password: string) => Promise<User | null>;
  signOut: () => Promise<void>;
  updateProfile: (patch: { firstName?: string; email?: string }) => Promise<void>;
  activateLicense: (planId: string) => Promise<void>;
  addDevice: (device: { name: string; platform: string }) => Promise<void>;
  removeDevice: (id: string) => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    let revision = 0;
    // Discard the former demo session; never migrate it into a real account.
    try { localStorage.removeItem("vyro.session.v2"); } catch { /* Storage can be disabled. */ }
    const validate = async () => {
      const current = ++revision;
      try {
        const { data, error } = await supabase.auth.getUser();
        const next = !error && data.user ? await loadAccount(data.user) : null;
        if (live && current === revision) setUser(next);
      } catch {
        if (live && current === revision) setUser(null);
      } finally {
        if (live && current === revision) setReady(true);
      }
    };
    void validate();
    const onFocus = () => { if (live) void validate(); };
    window.addEventListener("focus", onFocus);
    const processing = new URLSearchParams(window.location.search).get("payment") === "processing";
    let polls = 0;
    const timer = processing ? window.setInterval(() => { if (++polls <= 18 && live) void validate(); else if (timer) window.clearInterval(timer); }, 5000) : undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Defer SDK calls until outside Supabase's auth callback lock.
      if (event === "SIGNED_OUT") { ++revision; setUser(null); setReady(true); }
      else if (event !== "INITIAL_SESSION") setTimeout(() => { if (live) void validate(); }, 0);
    });
    return () => { live = false; ++revision; subscription.unsubscribe(); window.removeEventListener("focus", onFocus); if (timer) window.clearInterval(timer); };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) throw new Error("Connexion refusée. Vérifiez vos identifiants et la confirmation de votre adresse e-mail.");
    const next = await loadAccount(data.user, data.session.access_token); setUser(next); return next;
  }, []);
  const signUp = useCallback(async (firstName: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { first_name: firstName.trim() }, emailRedirectTo: window.location.origin + "/login" },
    });
    if (error) throw new Error("Création impossible. Réessayez ou connectez-vous si votre compte existe déjà.");
    if (!data.session || !data.user) return null;
    const next = await loadAccount(data.user, data.session.access_token); setUser(next); return next;
  }, []);
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw new Error("Déconnexion impossible. Réessayez.");
    setUser(null);
  }, []);
  const updateProfile = useCallback(async (patch: { firstName?: string; email?: string }) => {
    const { data, error } = await supabase.auth.updateUser({
      ...(patch.firstName !== undefined ? { data: { first_name: patch.firstName } } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
    });
    if (error || !data.user) throw new Error("Impossible d’enregistrer le profil. Réessayez.");
    setUser(await loadAccount(data.user));
  }, []);

  const deviceAction = useCallback(async (action: Record<string, unknown>) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Reconnectez-vous pour continuer.");
    const response = await fetch("/api/account", { method: "POST", headers: { Authorization: "Bearer " + data.session.access_token, "Content-Type": "application/json" }, body: JSON.stringify(action) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Modification impossible.");
    setUser(result as User);
  }, []);
  const daysLeft = user?.subscription ? Math.max(0, Math.ceil((new Date(user.subscription.expiresAt).getTime() - Date.now()) / 86400000)) : null;
  const isActive = user?.subscription?.status === "active" && daysLeft !== null && daysLeft > 0;

  const value = useMemo<AuthState>(() => ({
    user, ready, daysLeft, isActive, signIn, signUp, signOut, updateProfile,
    // Provisioning requires a separate trusted licensing/payment backend.
    activateLicense: async () => { throw new Error("Les paiements et l’activation des licences ne sont pas encore disponibles."); },
    addDevice: (device) => deviceAction({ action: "add", ...device }),
    removeDevice: (id) => deviceAction({ action: "remove", id }),
  }), [user, ready, daysLeft, isActive, signIn, signUp, signOut, updateProfile, deviceAction]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return context;
}
