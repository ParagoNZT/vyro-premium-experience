import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getPlan, formatPrice } from "@/config/site";

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
  startedAt: string; // ISO
  expiresAt: string; // ISO
  devicesUsed: number;
  devicesAllowed: number | null;
};

export type Device = {
  id: string;
  name: string;
  platform: string;
  lastSeen: string; // ISO
};

export type Order = {
  id: string;
  date: string; // ISO
  planName: string;
  amount: string;
  status: "paid";
};

export type User = {
  id: string;
  firstName: string;
  email: string;
  licenseKey: string;
  subscription: Subscription | null;
  devices: Device[];
  orders: Order[];
};

type AuthState = {
  user: User | null;
  ready: boolean;
  daysLeft: number | null;
  isActive: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (firstName: string, email: string, password: string) => Promise<User>;
  signOut: () => void;
  activateLicense: (planId: string) => Promise<void>;
  updateProfile: (patch: { firstName?: string; email?: string }) => void;
  addDevice: (device: { name: string; platform: string }) => void;
  removeDevice: (id: string) => void;
};

const STORAGE_KEY = "vyro.session.v2";
const AuthContext = createContext<AuthState | null>(null);

function makeLicenseKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `VYRO-${block()}-${block()}-${block()}`;
}

function normalize(raw: unknown): User | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Partial<User>;
  if (!u.email) return null;
  return {
    id: u.id ?? crypto.randomUUID(),
    firstName: u.firstName ?? "Vous",
    email: u.email,
    licenseKey: u.licenseKey ?? makeLicenseKey(),
    subscription: u.subscription ?? null,
    devices: Array.isArray(u.devices) ? u.devices : [],
    orders: Array.isArray(u.orders) ? u.orders : [],
  };
}

function read(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
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
              licenseKey: makeLicenseKey(),
              subscription: null,
              devices: [],
              orders: [],
            };
      save(next);
      return next;
    },
    [save],
  );

  const signUp = useCallback(
    async (firstName: string, email: string) => {
      const next: User = {
        id: crypto.randomUUID(),
        firstName,
        email,
        licenseKey: makeLicenseKey(),
        subscription: null,
        devices: [],
        orders: [],
      };
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

      // Le temps restant est conservé et prolongé.
      const base =
        current.subscription && new Date(current.subscription.expiresAt) > new Date()
          ? new Date(current.subscription.expiresAt)
          : new Date();
      const expires = new Date(base);
      expires.setMonth(expires.getMonth() + plan.months);

      save({
        ...current,
        subscription: {
          planId: plan.id,
          planName: `VYRO Premium · ${plan.name}`,
          status: "active",
          startedAt: current.subscription?.startedAt ?? new Date().toISOString(),
          expiresAt: expires.toISOString(),
          devicesUsed: current.devices.length,
          devicesAllowed: null,
        },
        orders: [
          {
            id: `VY-${Date.now().toString(36).toUpperCase()}`,
            date: new Date().toISOString(),
            planName: `VYRO Premium · ${plan.name}`,
            amount: formatPrice(plan.price),
            status: "paid",
          },
          ...current.orders,
        ],
      });
    },
    [save],
  );

  const updateProfile = useCallback(
    (patch: { firstName?: string; email?: string }) => {
      const current = read();
      if (!current) return;
      save({ ...current, ...patch });
    },
    [save],
  );

  const addDevice = useCallback(
    (device: { name: string; platform: string }) => {
      const current = read();
      if (!current) return;
      const devices = [
        ...current.devices,
        {
          id: crypto.randomUUID(),
          name: device.name,
          platform: device.platform,
          lastSeen: new Date().toISOString(),
        },
      ];
      save({
        ...current,
        devices,
        subscription: current.subscription
          ? { ...current.subscription, devicesUsed: devices.length }
          : null,
      });
    },
    [save],
  );

  const removeDevice = useCallback(
    (id: string) => {
      const current = read();
      if (!current) return;
      const devices = current.devices.filter((d) => d.id !== id);
      save({
        ...current,
        devices,
        subscription: current.subscription
          ? { ...current.subscription, devicesUsed: devices.length }
          : null,
      });
    },
    [save],
  );

  const daysLeft = useMemo(() => {
    if (!user?.subscription) return null;
    const ms = new Date(user.subscription.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86_400_000));
  }, [user]);

  const isActive = Boolean(user?.subscription && daysLeft !== null && daysLeft > 0);

  const value = useMemo(
    () => ({
      user,
      ready,
      daysLeft,
      isActive,
      signIn,
      signUp,
      signOut,
      activateLicense,
      updateProfile,
      addDevice,
      removeDevice,
    }),
    [
      user,
      ready,
      daysLeft,
      isActive,
      signIn,
      signUp,
      signOut,
      activateLicense,
      updateProfile,
      addDevice,
      removeDevice,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
