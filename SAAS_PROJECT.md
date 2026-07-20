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
- Deferred: Microsoft-SSO-based signup (the email/password path is the primary
  flow for now). Cross-tenant platform-admin dashboard remains deferred (below).

### Explicitly deferred (out of scope for now)

- Stripe billing, plan/usage gating.
- Cross-tenant platform-admin dashboard — revisit the isolation tradeoff
  specifically for this; likely needs the denormalized metrics table
  mentioned above.
- Multi-tenant membership / org switcher (a user belonging to more than one
  agency) — uncommon for this vertical, skip unless requested.

## Open questions before implementation starts

1. WebSocket broadcast scoping (Phase 2 blocker — needs its own investigation).
2. Exact migration path for adopting the current production DB as tenant
   zero — should be scripted and dry-run before touching real data.
3. Domain/DNS ownership for `*.marvelops.app` (or whatever the SaaS domain
   ends up being) — ops prerequisite for Phase 2.
