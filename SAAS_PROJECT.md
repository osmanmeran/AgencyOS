# Marvelops SaaS Project

Plan for converting Marvelops TravelPro from a single-tenant internal tool
(Marvel Tour's own ops system) into a multi-tenant SaaS product other travel
agencies can sign up for. Written 2026-07-10, no code changes yet.

## Decision: isolation model

**Separate SQLite file per tenant**, not shared-table + `tenant_id`.

Why: the `entities` table has no tenant-scoping today. Every query routes
through `findEntities`/`findEntitiesSql` (a SQL fast-path _and_ a JS fallback
path in `server/services/entities.js`), plus five other tenant-blind SQL
tables (`users`, `audit_logs`, `notifications`, `documents`, `email_logs`), an
FTS5 index, and a singleton `AppSettings` row. Retrofitting a `tenant_id`
column means adding the filter correctly in every one of those paths — one
missed `WHERE` clause is a cross-customer data leak, not a bug ticket.

SQLite makes file-per-tenant cheap in a way Postgres/MySQL don't —
`better-sqlite3` opens a file in milliseconds, and Railway already provides a
persistent volume for the single DB file today. It also resolves several
existing special cases for free: the `AppSettings` singleton, the
global-unique email constraint (`server/services/auth.js:80`), and per-tenant
backups (`createBackupSync` already exists — it becomes "snapshot this
tenant's file").

Cost: cross-tenant platform-admin queries (e.g. "revenue across all
agencies") can't be one SQL statement anymore — needs app-side aggregation or
a denormalized metrics table in a new central DB. Acceptable tradeoff: a
contained reporting problem beats auditing every business query for a missing
filter.

## Current-state notes (grounded in code, 2026-07-10 survey)

- Single SQLite file: `DATA_DIR/marvelops.db`, hardcoded path in
  `server/db.js:16-20`, one module-level `Database` singleton via `getDb()`.
- `entities` table (migration 001): `id, type, data (JSON), created_date,
updated_date` — no tenant column, indexed on `type` only (plus migration
  013's functional JSON indexes).
- `server/services/entities.js` already has a _row-level_ scoping pattern
  worth reusing as a template: `USER_SCOPED_TYPES`, `CLIENT_SCOPED_TYPES`,
  `userCanAccessEntity()`, `hasUnconditionalReadAccess()`. This is the closest
  existing analog to tenant scoping, just one dimension short.
- `users` table is a real SQL table (not JSON blob), columns include
  `microsoft_id`, `invite_token`/`invite_expires` (migrations 007/008 — the
  invite-teammate mechanism already exists and should carry over largely
  unchanged).
- Microsoft SSO (`server/services/auth.js:104-175`) hardcodes a single
  `MICROSOFT_TENANT_ID` env var and hard-rejects any other Azure AD tenant
  (line 125-129) — currently assumes one agency only.
- JWT claims today: `{id, email, user_tier, role, custom_permissions,
client_id, linked_supplier_id}` (`server/middleware/auth.js:20-34`) — no
  tenant claim. `authMiddleware` re-reads tier/permissions from `users` by PK
  on every request already, which is the right place to also resolve tenant.
- Migrations: 17 sequential `NNN_description.cjs` files run via
  `server/migrations/runner.js`. No tenant-related migration exists yet.
- No existing "tenant"/"organization"/"workspace" business concept anywhere
  in the codebase — all "tenant" hits today are Azure AD tenant references.

## Plan

### Phase 1 — Tenant provisioning & data layer

- New central _platform_ DB (`data/platform.db`): `tenants` table
  (`id, slug, name, status, azure_tenant_id, created_date`). This is also
  where a per-tenant `azure_tenant_id` replaces the hardcoded
  `MICROSOFT_TENANT_ID` env var.
- Layout: `data/tenants/<tenant_id>/marvelops.db`. `server/db.js`'s
  `getDb()` becomes `getDb(tenantId)`, backed by an LRU cache of open
  handles (capped — each tenant is a live file descriptor).
- `server/migrations/runner.js` gains a loop mode: run once against
  `platform.db`, and once per tenant directory. New-tenant signup runs the
  full migration chain against a fresh file.
- **Critical one-off, do by hand-verified script, not casually**: the
  existing `data/marvelops.db` (Marvel Tour's real production data) becomes
  _tenant zero_ — adopted into the new layout, never wiped.

### Phase 2 — Auth & request routing

- Subdomain-based tenant resolution (`<agency>.marvelops.app`), resolved
  from the `Host` header before auth runs — avoids needing a global
  email→tenant lookup table. Requires wildcard DNS + wildcard TLS on
  Railway (ops step, not code).
- JWT gains a `tenant_id` claim; `authMiddleware` resolves
  `getDb(req.tenant_id)` and re-reads the user from that tenant's `users`
  table.
- Existing invite flow (`invite_token`/`invite_expires`) carries over
  almost unchanged for inviting teammates into an existing tenant.
- **Open question, needs investigation before Phase 2 starts**: whether the
  WebSocket real-time sync layer is tenant-scoped. A naive broadcast today
  would leak live updates across agencies once there's more than one.

### Phase 3 — Self-serve signup ✅ implemented (2026-07-20)

- Public unauthenticated route `POST /api/tenants/signup`: agency name + slug +
  admin email/password. Slug uniqueness checked against `platform.db`; reserved
  words (`www`, `api`, `app`, `admin`, …) rejected. `GET /api/tenants/check-slug`
  gives the signup form live availability feedback.
- Signup → create tenant row (`status: trial`) → open + migrate the tenant's
  isolated DB → create first user as `admin` tier → issue JWT + auth cookies →
  return `workspaceUrl` (`https://<slug>.<APP_ROOT_DOMAIN>` when configured).
- Gated by `ALLOW_PUBLIC_SIGNUP=true` so an existing single-tenant deployment
  isn't silently turned into an open registration system.
- Cookie `domain` is set to the root (`.<APP_ROOT_DOMAIN>`) when configured, so
  the post-signup redirect to the new subdomain carries the session. Tenant
  scoping (authMiddleware's `TENANT_MISMATCH` check) still blocks cross-workspace
  token reuse, so sharing the cookie domain does not weaken isolation.
- Microsoft-SSO-based signup is implemented: `POST /api/tenants/signup` also
  accepts an `idToken` (obtained via the `common` Microsoft authority). The new
  workspace's Azure tenant is derived from the token (`azure_tenant_id`) and the
  admin is created as an SSO-linked account (no local password). The signup page
  offers a "Sign up with Microsoft" button; the callback exchanges the id token
  for a new workspace. `server/services/microsoft.js` holds the shared
  `verifyMicrosoftIdToken` used by both login and SSO signup.
- Cross-tenant platform-admin dashboard remains deferred (below).

### Phase 4 — Workspace control plane ✅ implemented (2026-07-20)

- `GET /api/tenants/me` returns the current workspace (resolved from the Host
  header / request scope): `id, slug, name, status, azureTenantId, createdDate`.
  Any authenticated member may read.
- `PATCH /api/tenants/me` (admin only) updates `name` and `azureTenantId`.
  `slug` and `status` are intentionally immutable (`slug` is the workspace
  address). `azureTenantId` is validated as a UUID and, when set, scopes
  Microsoft SSO login to that Azure tenant (see Phase 2 `authenticateMicrosoft`).
  Empty/`null` clears it (falls back to the server `MICROSOFT_TENANT_ID`).
- `server/services/tenants.js` `updateTenant` performs the mutation; changes are
  audited (`TENANT_UPDATE`). `shared/schemas.js` `updateTenant` validates input.
- Frontend `src/pages/WorkspaceSettings.jsx` (registered in `pages.config.js`):
  workspace name + Azure tenant id editor, admin-gated, read-only for members.
- Closes the loop so a workspace admin can configure their own SSO without
  touching server env vars. Billing/plan gating (trial → active) remains
  deferred — `status` is currently display-only.

### Explicitly deferred (out of scope for now)

- Stripe billing, plan/usage gating — **owner is researching payment
  providers; not started.**
- Multi-tenant membership / org switcher (a user belonging to more than one
  agency) — uncommon for this vertical, skip unless requested.

## Phase 5 — Platform admin dashboard ✅ implemented (2026-07-20)

Cross-tenant visibility for the SaaS operator (deferred in earlier drafts).
Per-tenant DB isolation means there is no single SQL view, so stats are
aggregated app-side by opening each tenant DB (acceptable; see the isolation
tradeoff in the decision above). If cross-tenant reporting gets heavy, revisit
the denormalized metrics table.

- `server/services/platform.js`:
  - `isPlatformAdmin(email)` — email allow-list from `PLATFORM_ADMIN_EMAILS`
    (comma-separated env var). No new DB table / tier needed.
  - `listWorkspaces()` — every tenant with `userCount` + `entityCount`
    aggregated from its own DB.
  - `platformStats()` — totals (workspace count, users, entities) + `byStatus`.
- `server/routes/platform.js`: `authMiddleware` + `requirePlatformAdmin`
  gate `GET /api/platform/workspaces` and `GET /api/platform/stats`.
- `src/pages/PlatformAdmin.jsx` (registered in `pages.config.js`): workspace
  table + summary cards; shows a not-authorized message for non-admins.
- Set `PLATFORM_ADMIN_EMAILS` in production to grant access.

## Phase 6 — Ops enablement & launch checklist

### Adopt the existing production DB as tenant zero

`scripts/adopt-tenant-zero.mjs` is the one-off, idempotent step. **Take an
off-box backup of `data/` first** (the move is permanent, though non-destructive
— the file is renamed, never deleted).

```
# 1. Dry run — prints exactly what it would do, changes nothing
node scripts/adopt-tenant-zero.mjs --slug marveltour --name "Marvel Tour"

# 2. Apply — moves data/marvelops.db -> data/tenants/0/marvelops.db
#    and inserts the tenant-zero registry row (id '0', status active)
node scripts/adopt-tenant-zero.mjs --slug marveltour --name "Marvel Tour" --apply
```

Verified end-to-end (2026-07-20) in a throwaway DATA_DIR: the source file is
moved to `data/tenants/0/marvelops.db` and the `tenants` row is created. The
app then serves it via `getDb('0')` with no further code changes.

### DNS + TLS (prerequisite for subdomain routing)

- **Wildcard DNS A/AAAA** record for `*.marvelops.app` → the app host (Railway
  / load balancer). Single-tenant `marvelops.app` (apex) keeps working too.
- **Wildcard TLS** certificate covering `*.marvelops.app` (e.g. Let's Encrypt
  wildcard via DNS-01 challenge, or your platform's wildcard cert). Without
  this, `https://<slug>.marvelops.app` fails TLS.
- Set `APP_ROOT_DOMAIN=marvelops.app` in the server env. This is what activates
  subdomain→tenant resolution (`server/middleware/tenant.js`); leave it unset in
  dev so localhost keeps working unchanged.

### Runtime env (production)

- `ALLOW_PUBLIC_SIGNUP=true` to open self-serve signup (default `false` —
  existing single-tenant deployments stay closed by default).
- `PLATFORM_ADMIN_EMAILS=ops@marvelops.app` — who can see the platform dashboard.
- `MICROSOFT_CLIENT_ID` — still required for Microsoft SSO (per-workspace
  `azure_tenant_id` is now configured in-app via the Workspace settings page,
  and falls back to `MICROSOFT_TENANT_ID` when empty).
- `CORS_ORIGIN` — set to your production origin in prod (dev defaults to `*`).
- `JWT_SECRET` — stable secret across restarts (tokens survive reloads).
- **Off-box backups**: `createBackupSync` snapshots are on the same disk as the
  DB; add S3/R2 (or similar) copies of `data/` (platform.db + every
  `tenants/*/marvelops.db`).

## Open questions before implementation starts

1. WebSocket broadcast scoping (Phase 2 blocker — needs its own investigation).
   _Resolved in Phase 2: `server/ws.js` scopes broadcasts to the request's
   tenant via AsyncLocalStorage._
2. Exact migration path for adopting the current production DB as tenant
   zero — should be scripted and dry-run before touching real data.
   _Resolved: `scripts/adopt-tenant-zero.mjs`, verified above._
3. Domain/DNS ownership for `*.marvelops.app` (or whatever the SaaS domain
   ends up being) — ops prerequisite for Phase 2. _Covered by the Phase 6
   checklist above._
