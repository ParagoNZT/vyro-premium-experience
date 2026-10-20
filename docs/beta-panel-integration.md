# Shared VYRO / beta access

The application already validates TV access against `vyro-beta-access`, D1 database `62609516-d269-4ced-a3c5-1acc6d9d5d2a`. The website's management tables can be added to that database without renaming or replacing its existing tables. Keep the original management database as a rollback copy.

Before deployment, export both databases and simulate their import in SQLite. Import the website management export into the beta database, then apply `migrations/d1/0002_shared_beta_access.sql` exactly once. Check the original code and device counts, and compare preserved records. Do not deploy the new website binding before these tables exist.

New licence keys follow the existing TV contract, `VYRO-` plus 24 uppercase hexadecimal characters. The site stores the key for the authenticated customer; the existing TV service receives its SHA-256 hash through the shared database. No administration or encryption secret is copied into the website. The beta panel can generate a recoverable sharing alias for a website access using its existing key controls.

Database triggers apply licence grants, expiry changes, revocation, and account suspension to the TV `codes` table. Existing beta codes are untouched unless an administrator explicitly edits them. Beta-panel changes to a linked code update its web licence. Account suspension wins over attempts to re-enable the TV code. Renewals preserve the key and bindings. Deleting a linked code revokes its web licence and clears the link.

Customer devices are actual TV `bindings` with `device_profiles`; adding a name on the website no longer pretends to enrol a TV. Removal is scoped to the authenticated customer's linked licence. A paid live Stripe order provisions its TV code in the same D1 transaction. Test payments do not grant access.

`/api/beta` requires a freshly verified Supabase administrator identity. It returns paginated access summaries without playlist credentials or encryption secrets. Sensitive playlist, reseller, and message features remain available in the original beta panel, with its existing authentication.

The original panel's UI can be renamed to VYRO Studio and linked to the website administration without changing its TV APIs. Preserve the active worker source before editing. Deployment must preserve its D1 binding, runtime settings and existing environment variables.

Validation: run `node --test src/lib/admin-policy.test.ts src/lib/management.test.ts`, build, and type-check. After deployment, create a disposable manual licence, enrol a test device through the existing TV API, check quota and ownership, revoke that licence, and verify denial. Never enrol against a real tester's key for this check.

Rollback: restore the website's previous deployment and database binding. The beta worker's API source is unchanged. The additive tables and triggers can remain while reviewing the issue; do not restore a stale beta export over new tester activity. Reconcile new VYRO writes before switching databases back.
