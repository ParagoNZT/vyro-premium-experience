import type { AdminRole } from "./admin-policy";
import type { LicensePack } from "./license-packs";

export type ClientRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
  first_name: string;
  status: "active" | "suspended";
  created_at: string;
  last_seen_at: string | null;
};
export type AdminClientRow = Omit<ClientRow, "auth_user_id"> & {
  registered: number;
  admin_role: AdminRole | null;
  reseller: number;
};
export type LicenseRow = {
  id: string;
  client_id: string;
  email?: string;
  plan_id: string;
  started_at: string;
  expires_at: string;
  manual_expiry: number;
  pack_id: string | null;
  pack_name: string | null;
  device_limit: number;
  status: "active" | "revoked";
  source_payment_id: string | null;
  updated_at: string;
};
export type PaymentRow = {
  id: string;
  client_id: string;
  email?: string;
  plan_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  created_at: string;
  paid_at: string | null;
  livemode: number;
  request_key: string;
};
export type AdminPaymentRow = Omit<
  PaymentRow,
  "stripe_session_id" | "stripe_payment_intent" | "request_key"
>;
export type AuditRow = {
  id: string;
  actor_id: string;
  action: string;
  target_id: string;
  note: string;
  created_at: string;
  actor_label?: string;
};
export type AdminOverview = {
  clients: AdminClientRow[];
  licenses: LicenseRow[];
  payments: AdminPaymentRow[];
  audit: AuditRow[];
  stripe: { configured: boolean; live: boolean };
  stats: { clients: number; activeLicenses: number; paidCents: number; testPaidCents: number };
  page: number;
  hasMore: boolean;
  hasMoreClients: boolean;
  packs: LicensePack[];
};
