# VYRO backend: portal and deployment contract

This integration is based on the local previous implementation at `1b44833`, adapted to `74f840f`. **No production migration, deployment, service call or data export was performed.**

## Data ownership

- The existing Lovable/Supabase project handles sign-in, signup, confirmation, email changes and password recovery. No passwords are stored in D1. `AuthContext` remains in its existing component-free module. Old demo sessions are discarded.
- `VYRO_DB` is a Cloudflare D1 binding. Clients, orders, licences, audit records and Stripe events live in D1. A new licence writes its hashed key into the existing TV `codes` table via triggers. Real devices come from `bindings` and `device_profiles` after enrollment in the TV app.
- The reseller Supabase tables, logo policies and Android APK pipeline are outside this integration. No reseller data is authorized by a VYRO portal session alone. The existing Supabase RLS still governs reseller records.

## Portal endpoints

Browser writes send JSON with their same-origin `Origin`; private requests send `Authorization: Bearer <Supabase access token>`. Use `portalApi<T>()` for authenticated calls. Error payloads have `{ error }`; private responses cannot be cached.

| Endpoint                       | Contract                                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/account               | `{ id, firstName, email, licenseKey, subscription, devices, orders }`; key only when the linked licence is active; orders list paid live orders. Suspended accounts receive 403.        |
| POST /api/account              | `{ action: "remove", id }` removes a TV binding of the caller and returns the updated account. Enroll a new device in the app.                                                          |
| GET /api/admin                 | Verify current admin identity. 401 for invalid or absent session; 403 for authenticated non-admin; 503 for missing configuration.                                                       |
| GET /api/manage?page=0         | Paginated `{ clients, licenses, payments, audit, stats, stripe, page, hasMore }`. No plaintext keys or Stripe session IDs in the overview.                                              |
| POST /api/manage               | Actions: `create-client`, `grant-license`, `revoke-license`, `client-status`. A manual grant requires a confirmed, linked and active account. No payment is recorded for manual grants. |
| GET /api/beta?page=0&q=`query` | Admin TV summaries. `managedOnSite` and `hasRecoverableKey` are numeric 0/1. Only site-linked rows can be edited or revealed here.                                                      |
| POST /api/beta                 | For a site-linked access: `{ id, enabled, maxDevices, expiresAt, note }`, where expiry is an ISO UTC string or null. Legacy accesses are managed in VYRO Studio.                        |
| POST /api/beta-key             | `{ id, action: "reveal" }` returns `{ code }` for one linked key and writes an audit record without the key. No alias creation.                                                         |
| GET /api/checkout              | Public `{ enabled, live }` when configured; 503 when Stripe is configured but the D1 binding or required migrations are missing.                                                        |
| POST /api/checkout             | `{ planId, requestKey }`; the request key is a UUID reused for a retry of the same purchase. Returns `{ url }` on Stripe's hosted domain. Prices are selected server-side.              |
| POST /api/stripe-webhook       | Stripe only. Validates the signature on the unmodified body and re-reads the Checkout Session before granting a term. A return-page URL never grants access.                            |

`useAuth()` retains its entry point and adds `accountError` and `refreshAccount()`. Signup returns `null` when confirmation is required. The login recovery screen must only enter reset mode for Supabase's recovery flow. After `/account?payment=processing`, refresh the account while waiting for the webhook. A successful test checkout does not grant access.

The configured administrator is the console owner. Apply D1 migration `0014_admin_delegation_and_license_expiry.sql` before deploying code that reads delegated roles. `GET /api/admin` returns `role: "owner" | "admin"`. Only the owner may use the `client-admin-role` management action on another confirmed, linked client. The grant is checked on each admin request and removed independently of reseller memberships. Administrators can use `grant-license-until` for a date inclusive in Europe/Paris; it updates the linked TV access, preserves the key, and rejects a quota below the number of linked devices. Standard checkout terms and prices are unchanged.

## Build and binding verification

The current and older source declare Supabase project ID `jqudulynpebvnipwjyhu`. The older Nitro config used worker name `vyro-premium-experience` and bound `VYRO_DB` to `vyro-beta-access` (historical ID `62609516-d269-4ced-a3c5-1acc6d9d5d2a`). Treat these values as historical evidence; confirm the deployed resources independently.

The current build keeps Lovable's Cloudflare preset and generated worker name `paragonzt-vyro-premium-experience`. It keeps `ASSETS` and adds `VYRO_DB` only when an explicit database ID and its matching name are supplied at build time. No database ID is embedded in the configuration. The older `VYRO_BETA` service binding is unused and is not added.

Example (PowerShell, isolated staging database):

```powershell
$env:VYRO_D1_DATABASE_ID = '<verified-staging-D1-UUID>'
$env:VYRO_D1_DATABASE_NAME = '<verified-staging-D1-name>'
pnpm run build
$config = Get-Content -Raw .output/server/wrangler.json | ConvertFrom-Json
$config | Select-Object name, compatibility_flags
$config.assets.binding
$config.d1_databases | Where-Object { $_.binding -eq 'VYRO_DB' }
```

Expect `ASSETS` plus exactly one `VYRO_DB` entry with the chosen name and ID. Without `VYRO_D1_DATABASE_ID`, the build should have no `VYRO_DB` binding. Cloudflare Workers Builds only includes the configured D1 and R2 bindings on `main`, keeping preview branches separate. Wrangler preserves dashboard runtime variables. Check this artifact before publishing, and confirm the deployed Worker's bindings before enabling Stripe. Neither building nor inspecting this file runs a migration.

For an **empty disposable local Wrangler database only**, create the fake TV tables from `tests/fixtures/beta-schema.sql` and apply the three migrations below in order. With Wrangler installed, run `wrangler d1 execute VYRO_DB --local --config .output/server/wrangler.json --file <path>` once for each file, fixture first. Never apply the fixture to an existing or real TV database.

## Before enabling live payments

1. Confirm the actual deployed Cloudflare worker, Supabase project, D1 schema and migration history. The matching Supabase project ID in source is not deployment evidence. Add the Worker binding `VYRO_DB` in the deployment configuration, pointing to the verified D1 that already serves the TV app. Ensure the build leaves the `cloudflare:workers` module external, and exposes Worker variables to `process.env` (Node compatibility). Normal Vite development has no D1 binding and management APIs fail closed.
2. Inventory and back up the website management database, if separate, and the TV D1. Rehearse on a disposable copy; reconcile duplicate email/ID rows, preserve TV bindings and compare row counts and representative links before switching the binding. Apply only missing migrations in order: `0001_management.sql` (management tables), `0002_shared_beta_access.sql` (requires existing TV tables; run once), then `0003_stripe_fulfillment.sql` (additive payment records). Never replace or reinitialize the production beta database. Old website licences with no TV hash need manual reconciliation. A still-active unlinked licence blocks checkout and manual renewal until its TV link is reconciled. Unlinked historical records with licences or payments are never claimed automatically by email.
3. In Supabase, require genuine email confirmation; verify sender and allowlist redirects for `/login` and recovery. Set `VYRO_ADMIN_USER_ID` to the administrator's immutable Supabase user ID. Optional `VYRO_ADMIN_EMAIL` is an additional check. Keep admin account recovery and MFA configured. Server Auth uses `SUPABASE_URL` with `SUPABASE_PUBLISHABLE_KEY` (or the matching Vite public pair); no service-role key is used.
4. Configure `VYRO_SITE_ORIGIN` as the exact HTTPS origin with no trailing slash. Stripe stays disabled unless the Worker has `VYRO_STRIPE_ENABLED=true`, even if Stripe credentials already exist. Before enabling it, configure server-only `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` for the same mode. Subscribe `/api/stripe-webhook` to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`, and `charge.dispute.created`. Keep staging and live Stripe configuration separate. Preview sessions can use isolated test resources and their own canonical origin.
5. Verify with synthetic accounts: confirmation, cross-account access denial, admin denial and access, Stripe test checkout without a licence, then create a disposable manual licence and enroll/revoke a disposable TV device against the intended staging worker. Confirm test receipts never appear as live sales. Complete a controlled live readiness check only with separately authorized production access.

A full refund recorded before fulfillment suppresses activation. A full refund of a single untouched new term can revoke that term; older records, stacked renewals, changed grants, partial refunds and disputes are logged for review. No automatic recomputation of overlapping grants or billing subscriptions is implied. Stripe Checkout here is a one-time purchase for a fixed term. Reconcile paid and pending historical sessions, and verify webhook delivery for the same Stripe account and mode before sending live traffic. A configured endpoint and schema do not prove webhook registration or reachability.

Local test commands (Node 24, dependencies installed):

```text
node --test src/lib/access.test.ts src/lib/admin-policy.test.ts src/lib/management.test.ts
pnpm run build
node --test tests/worker-smoke.test.mjs
```

The compiled Worker test invokes the actual API handlers using an in-memory SQLite adapter and mocked Supabase and Stripe. It checks authentication, admin authorization, account isolation, TV enrollment records, checkout readiness, signed webhook replay and test-versus-live fulfillment. It does not confirm the live bindings or provider settings.
