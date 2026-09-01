import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getPlan } from "@/config/site";

/**
 * Couche d'authentification / licence côté client.
 *
 * Elle est volontairement isolée derrière ce contexte : le jour où le backend
 * (comptes, licences, paiements, appareils) est branché, seules les fonctions
 * ci-dessous changent — aucun écran n'a besoin d'être réécrit.
 * Aucune clé ni secret ne doit être placé ici.
 */

export type Subscription = {
  planId: string;
  planName: string;
  status: "active" | "expired" | "none";
  expiresAt: string; // ISO
  devicesUsed: number;
  devicesAllowed: number | null;
};

export type User = {
  id: string;
  firstName: string;
  email: string;
  subscription: Subscription | null;
};

type AuthState = {
  user: User | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (firstName: string, email: string, password: string) => Promise<User>;
  signOut: () => void;
  activateLicense: (planId: string) => Promise<void>;
};

const STORAGE_KEY = "vyro.session.v1";
const AuthContext = createContext<AuthState | null>(null);

function read(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function persist(user: User | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(read());
    setReady(true);
  }, []);

  const save = useCallback((next: User | null) => {
    setUser(next);
    persist(next);
  }, []);

  const signIn = useCallback(
    async (email: string) => {
      const existing = read();
      const next: User =
        existing && existing.email === email
          ? existing
          : {
              id: crypto.randomUUID(),
              firstName: email.split("@")[0] || "Vous",
              email,
              subscription: null,
            };
      save(next);
      return next;
    },
    [save],
  );

  const signUp = useCallback(
    async (firstName: string, email: string) => {
      const next: User = { id: crypto.randomUUID(), firstName, email, subscription: null };
      save(next);
      return next;
    },
    [save],
  );

  const signOut = useCallback(() => save(null), [save]);

  const activateLicense = useCallback(
    async (planId: string) => {
      const plan = getPlan(planId);
      const current = read();
      if (!plan || !current) return;
      const expires = new Date();
      expires.setMonth(expires.getMonth() + plan.months);
      save({
        ...current,
        subscription: {
          planId: plan.id,
          planName: `VYRO Premium · ${plan.name}`,
          status: "active",
          expiresAt: expires.toISOString(),
          devicesUsed: 1,
          devicesAllowed: null,
        },
      });
    },
    [save],
  );

  const value = useMemo(
    () => ({ user, ready, signIn, signUp, signOut, activateLicense }),
    [user, ready, signIn, signUp, signOut, activateLicense],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
