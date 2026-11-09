import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext } from "./auth-context";
import { portalApi, PortalApiError } from "./portal-api";

export type Subscription = {
  planId: string;
  planName: string;
  status: "active" | "expired" | "revoked" | "none";
  startedAt: string;
  expiresAt: string;
  devicesUsed: number;
  devicesAllowed: number | null;
};
export type Device = {
  id: string;
  name: string;
  platform: string;
  lastSeen: string;
  androidVersion?: string | null;
  appVersion?: string | null;
};
export type Order = { id: string; date: string; planName: string; amount: string; status: "paid" };
export type User = {
  id: string;
  firstName: string;
  email: string;
  licenseKey: string;
  subscription: Subscription | null;
  devices: Device[];
  orders: Order[];
};

export type AuthState = {
  user: User | null;
  ready: boolean;
  accountError: string | null;
  daysLeft: number | null;
  isActive: boolean;
  refreshAccount: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (firstName: string, email: string, password: string) => Promise<User | null>;
  signOut: () => Promise<void>;
  updateProfile: (patch: { firstName?: string; email?: string }) => Promise<void>;
  removeDevice: (id: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (password: string) => Promise<void>;
  /** Retained for older callers. Activations now come from the Stripe webhook or administration. */
  activateLicense: (planId: string) => Promise<never>;
  /** Devices are enrolled on the TV. */
  addDevice: (device: { name: string; platform: string }) => Promise<never>;
};

function identityOnly({ user }: Session): User {
  return {
    id: user.id,
    email: user.email ?? "",
    firstName:
      typeof user.user_metadata["first_name"] === "string"
        ? user.user_metadata["first_name"].slice(0, 80)
        : user.email?.split("@")[0] || "Vous",
    licenseKey: "",
    subscription: null,
    devices: [],
    orders: [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const generation = useRef(0);
  const abortRequest = useRef<AbortController | null>(null);
  const invalidate = useCallback(() => {
    abortRequest.current?.abort();
    return ++generation.current;
  }, []);

  const synchronize = useCallback(
    async (session: Session | null): Promise<User | null> => {
      const revision = invalidate();
      if (!session || session.user.is_anonymous || !session.user.email_confirmed_at) {
        setUser(null);
        setAccountError(null);
        setReady(true);
        return null;
      }
      const controller = new AbortController();
      abortRequest.current = controller;
      setUser((previous) => (previous?.id === session.user.id ? previous : null));
      const stub = identityOnly(session);
      let next: User | null = stub;
      let issue: string | null = null;
      try {
        next = await portalApi<User>("/api/account", {
          token: session.access_token,
          signal: controller.signal,
        });
        if (next.id !== session.user.id) throw new Error("Identité de compte inattendue.");
      } catch (error) {
        next = error instanceof PortalApiError && error.status === 401 ? null : stub;
        issue = controller.signal.aborted
          ? null
          : error instanceof Error
            ? error.message
            : "Impossible de charger votre espace client.";
      }
      if (revision === generation.current) {
        setUser(next);
        setAccountError(issue);
        setReady(true);
      }
      return next;
    },
    [invalidate],
  );

  const refreshAccount = useCallback(async () => {
    const revision = generation.current;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (generation.current !== revision) return;
      if (error) throw error;
      await synchronize(data.session);
    } catch {
      if (generation.current !== revision) return;
      await synchronize(null);
      setAccountError("Le service de connexion est indisponible. Réessayez.");
    }
  }, [synchronize]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let pending: number | undefined;
    // Ignore and remove the demo state. Only Supabase sessions can reach account data.
    try {
      localStorage.removeItem("vyro.session.v2");
    } catch {
      /* Storage can be disabled. */
    }
    try {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        window.clearTimeout(pending);
        if (event === "SIGNED_OUT") {
          void synchronize(null);
          return;
        }
        // Supabase holds its session lock while invoking this callback.
        pending = window.setTimeout(() => {
          if (active) void synchronize(session);
        }, 0);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      void refreshAccount();
    }
    const onFocus = () => {
      void refreshAccount();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      invalidate();
      unsubscribe?.();
      window.clearTimeout(pending);
      window.removeEventListener("focus", onFocus);
    };
  }, [invalidate, refreshAccount, synchronize]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error || !data.session)
        throw new Error(
          "Connexion refusée. Vérifiez vos identifiants et la confirmation de votre e-mail.",
        );
      const next = await synchronize(data.session);
      if (!next) throw new Error("Confirmez votre adresse e-mail avant de vous connecter.");
      return next;
    },
    [synchronize],
  );

  const signUp = useCallback(
    async (firstName: string, email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { first_name: firstName.trim().slice(0, 80) },
          emailRedirectTo: window.location.origin + "/login",
        },
      });
      if (error)
        throw new Error(
          "Création impossible. Vérifiez les informations ou connectez-vous si votre compte existe déjà.",
        );
      return data.session ? synchronize(data.session) : null;
    },
    [synchronize],
  );

  const signOut = useCallback(async () => {
    invalidate();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw new Error("Déconnexion impossible. Réessayez.");
    await synchronize(null);
  }, [invalidate, synchronize]);

  const updateProfile = useCallback(
    async (patch: { firstName?: string; email?: string }) => {
      const { error } = await supabase.auth.updateUser({
        ...(patch.firstName !== undefined
          ? { data: { first_name: patch.firstName.trim().slice(0, 80) } }
          : {}),
        ...(patch.email !== undefined ? { email: patch.email.trim() } : {}),
      });
      if (error) throw new Error("Impossible d’enregistrer le profil. Réessayez.");
      await refreshAccount();
    },
    [refreshAccount],
  );

  const removeDevice = useCallback(async (id: string) => {
    const next = await portalApi<User>("/api/account", {
      method: "POST",
      body: { action: "remove", id },
    });
    setUser((previous) => (previous?.id === next.id ? next : previous));
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + "/login?recovery=1",
    });
    if (error) throw new Error("Impossible de demander un nouveau mot de passe. Réessayez.");
  }, []);
  const resetPassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error)
      throw new Error(
        "Impossible de modifier le mot de passe. Vérifiez que le lien est toujours valide.",
      );
  }, []);

  const daysLeft = user?.subscription
    ? Math.max(0, Math.ceil((Date.parse(user.subscription.expiresAt) - Date.now()) / 86_400_000))
    : null;
  const isActive = user?.subscription?.status === "active" && daysLeft !== null && daysLeft > 0;
  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      accountError,
      daysLeft,
      isActive,
      refreshAccount,
      signIn,
      signUp,
      signOut,
      updateProfile,
      removeDevice,
      requestPasswordReset,
      resetPassword,
      activateLicense: async () => {
        throw new Error("L’activation intervient après confirmation du paiement.");
      },
      addDevice: async () => {
        throw new Error("Saisissez la clé dans l’application TV pour l’associer à votre compte.");
      },
    }),
    [
      user,
      ready,
      accountError,
      daysLeft,
      isActive,
      refreshAccount,
      signIn,
      signUp,
      signOut,
      updateProfile,
      removeDevice,
      requestPasswordReset,
      resetPassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- Keep the established hook import; context identity is isolated in auth-context.ts.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return context;
}
