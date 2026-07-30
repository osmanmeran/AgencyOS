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

## Phase 7 — File isolation & workspace lifecycle ✅ implemented (2026-07-27)

Two gaps found by auditing the merged Phase 1–6 code against what a second
paying agency actually requires.

### File storage is now per-tenant and access-controlled

Phase 1 isolated the _database_ per tenant but every workspace still shared one
`data/uploads` directory, served by `app.use('/uploads', express.static(...))` —
no session, no tenant check, no permission check. Stored names embed the
original filename, so a URL was guessable as well as unauthenticated.

- `server/db.js` gained `getTenantDataDir()` / `getUploadDir()` / `getPdfDir()`,
  resolved from the request's tenant context. The legacy tenant keeps the
  original top-level `data/uploads` + `data/pdfs` paths, so every pre-existing
  file resolves unchanged (adopt-tenant-zero moves only the .db file); every
  other workspace gets `data/tenants/<id>/{uploads,pdfs,ocr_uploads}/`.
- `/uploads/:filename` is now `server/routes/uploads.js`: authenticated,
  resolved inside the caller's own uploads dir, and permission-checked with
  `userCanAccessDocument` when the file has a `documents` row. Files without one
  (e.g. the workspace logo) stay readable by any member of that workspace.
- The same per-tenant resolution was applied to the paths that bypassed the
  static mount: `/api/documents/:id/download`, `/api/pdf/download/:filename`
  (filenames there are `booking_<reference>_<ts>.pdf` — very guessable), and the
  OCR scratch directory (`/ocr/extract` takes a caller-supplied path).
- Frontend: `assetImgProps()` in `src/lib/assetUrl.js` adds
  `crossorigin="use-credentials"` when a split-host deploy is configured, so
  authenticated `<img>` loads still carry the session cookie. No-op same-origin.

### Workspace status is now enforced

`TENANT_STATUS.SUSPENDED` existed in the registry but nothing read it, and
`trial` had no deadline — a suspended workspace kept working and a trial never
ended.

- Platform migration `002_tenant_trial.js` adds `trial_ends_at` (nullable).
  NULL means "no deadline", so every workspace created before this migration
  keeps working until an operator sets one — the deploy locks nobody out.
- `tenantAccessState()` (`server/services/tenants.js`) is the single rule:
  suspended → blocked; `trial` past `trial_ends_at` → blocked; unparseable
  deadline → allowed (never lock out on bad data); no registry row (the legacy
  tenant) → always allowed.
- `server/middleware/tenantStatus.js` applies it to `/api`, allowlisting
  `/health`, `/auth/*`, `/tenants/*` and `/platform/*` so a blocked workspace
  can still sign in, read its own status, and be reinstated. Error codes:
  `WORKSPACE_SUSPENDED`, `TRIAL_EXPIRED`.
- Self-serve signup sets a deadline of `TRIAL_DAYS` (default 14).
- Operator controls: `PATCH /api/platform/workspaces/:id/status` and
  `POST /api/platform/workspaces/:id/extend-trial`, both audited, wired into
  `PlatformAdmin.jsx` (Suspend / Reactivate / Mark paid / Extend trial, plus a
  trial-countdown column). Activating a workspace clears its deadline.
- Users see `WorkspaceStatusBanner` (suspended, trial expired, or ≤7 days left)
  instead of unexplained failures; `WorkspaceSettings` shows the trial end date.

Covered by `tests/routes/uploads.test.js` and `tests/routes/tenantStatus.test.js`.
Upgrade path verified against a seeded pre-upgrade `platform.db`: the migration
adds the column without touching existing rows, legacy tenant-zero uploads still
resolve, and new tenants get isolated directories.

## Phase 8 — Off-box backups & workspace administration ✅ implemented (2026-07-27)

### Off-box backups (S3/R2)

Local snapshots live on the same Railway volume as the databases they protect,
so a volume loss took the backups with it. `server/services/offsiteBackup.js`
copies them to S3-compatible storage (AWS S3, Cloudflare R2, MinIO).

- Entirely opt-in: with `BACKUP_S3_BUCKET` unset every entry point is a no-op,
  so an existing deployment is unchanged.
- The nightly scheduler now pushes each snapshot — the legacy tenant, the
  platform registry, and every workspace — to `db/<scope>/<filename>`, then
  prunes to `BACKUP_S3_KEEP` (default 30) remotely.
- Uploaded files and generated PDFs are mirrored to `files/<scope>/…`.
  Stored uploads are immutable, so the sync skips anything already present
  (one HEAD per file) rather than re-uploading nightly. Synced files are never
  pruned — they're the off-box copy of live data, not a rotation.
- Uploads send `ContentMD5` so a truncated transfer is rejected rather than
  silently stored as a corrupt "backup".
- Off-box failure never fails the local backup; it's logged and the local
  snapshot still succeeds.
- `npm run backup:offsite verify|list|push` — `verify` round-trips a probe
  object so misconfiguration surfaces on demand instead of the night you need
  a restore.

Config: `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`,
`BACKUP_S3_SECRET_ACCESS_KEY`, plus `BACKUP_S3_REGION` (default `auto`),
`BACKUP_S3_ENDPOINT` (required for R2/MinIO), `BACKUP_S3_PREFIX`,
`BACKUP_S3_KEEP`.

### Workspace rename & deletion

Completes the platform console — previously read-only plus the Phase 7
lifecycle actions, so renaming or removing an agency meant hand-editing
`platform.db`.

- `PATCH /api/platform/workspaces/:id` renames a workspace.
- `DELETE /api/platform/workspaces/:id` removes the registry row and the whole
  tenant directory. Guardrails, all enforced server-side and mirrored in the UI:
  the primary/legacy workspace can never be deleted; the workspace must already
  be **suspended** (deletion takes two deliberate steps); `confirmSlug` must
  match exactly; and a final snapshot is written to the **top-level** backups
  directory — outside the directory being removed — and pushed off-box when
  configured. Audited as `platform_delete_workspace`.
- Found while testing: a token for a deleted workspace used to **recreate** its
  directory, because `getDb()` creates and migrates on demand. `authMiddleware`
  now verifies the token's tenant still exists in the registry before opening
  it (the legacy tenant, which has no row by design, is exempt).

Covered by `tests/services/offsiteBackup.test.js` (S3 client mocked) and the
deletion suite in `tests/routes/tenantStatus.test.js`. The delete guardrails and
snapshot restorability were also verified end-to-end against a scratch DATA_DIR.

## Phase 9 — Restore & backup monitoring ✅ implemented (2026-07-29)

Phase 8 pushed snapshots off-box but could not bring them back, and a failed
backup only wrote a log line nobody reads. Both halves are now closed.

### Restore

- `scripts/backup-cli.mjs` is workspace-aware: `--tenant <slug|id>` targets any
  workspace (default: the primary/legacy one, so the original usage is
  unchanged), and `--from-offsite` downloads the snapshot from S3/R2 first —
  the case off-box backups exist for.
- `list --offsite` shows what is stored remotely for a workspace.
- Before overwriting anything, the snapshot is opened read-only and checked
  (`PRAGMA integrity_check` plus a sanity check that it is a Marvelops
  database). Restoring a corrupt file over a live database turns a recoverable
  incident into an unrecoverable one.
- `server/services/offsiteBackup.js` gained `downloadFile`, `listSnapshots` and
  `fetchSnapshot` to support this.
- See the restore runbook below — the procedure has been rehearsed, including
  full loss of the local disk.

### Monitoring

- Platform migration `003_backup_runs.js` records every backup pass: when it
  ran, how many targets, which failed and why.
- `runBackupPass()` (`backupScheduler.js`) now isolates each target, so one
  workspace failing no longer aborts the pass — the rest are still backed up and
  the failure is reported rather than swallowed.
- Failures email the operator (`BACKUP_ALERT_EMAIL`, falling back to
  `PLATFORM_ADMIN_EMAILS`). Alerting is best-effort and never throws: an
  alerting problem must not take down the job it reports on.
- `backupHealth()` is surfaced on the platform dashboard, including the failure
  a per-run alert can never catch — **no successful run at all**, i.e. a
  scheduler that died silently.

Covered by `tests/services/backupRuns.test.js` and
`tests/services/backupScheduler.test.js` (which simulates one workspace's disk
failing and asserts the others still complete).

## Phase 6 — Ops enablement & launch checklist

### Restore runbook (rehearsed 2026-07-29)

Backups only count once a restore has actually been performed. This procedure
was rehearsed end-to-end against a scratch `DATA_DIR`, including the total-loss
case (workspace directory deleted, recovered from object storage alone).

```
# 1. What can I restore? (add --offsite for what's in S3/R2)
node scripts/backup-cli.mjs list --tenant acme
node scripts/backup-cli.mjs list --tenant acme --offsite

# 2. STOP THE SERVER. Restoring under a running server leaves the process and
#    the file on disk out of sync.

# 3. Restore — from the local disk, or pull from off-box when the disk is gone
node scripts/backup-cli.mjs restore <snapshot>.db --tenant acme
node scripts/backup-cli.mjs restore <snapshot>.db --tenant acme --from-offsite

# 4. Start the server, and confirm the workspace loads.
```

- `--tenant` takes a slug or an id; omit it entirely for the primary/legacy
  workspace, which keeps the original single-tenant behaviour.
- The snapshot is opened and `PRAGMA integrity_check`ed **before** anything is
  overwritten — a truncated or corrupt file is refused rather than copied over a
  live database (verified in the rehearsal).
- The current database is copied to `marvelops-pre-restore-<ts>.db` first, so
  the restore itself can be undone.
- Stale `-wal`/`-shm` files are removed, so nothing is replayed over the
  restored file.

Rehearsal results: a workspace with users, trips and uploaded files was backed
up, its live database corrupted, and restored from the local snapshot; then its
entire directory was deleted and it was recovered from object storage alone.
Both restores returned the full dataset.

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

The app is **already production-ready** for subdomains (verified: known
subdomain resolves to its tenant, unknown subdomain → 404, `Host` is
authoritative, cookies carry across apex↔subdomain). The only missing piece is
infrastructure: a wildcard DNS record + a wildcard TLS cert. Until both exist,
signup _succeeds_ (tenant row + DB created, `201`) but the post-signup redirect
to `https://<slug>.marvelops.app` can't resolve — which looks like a failure but
isn't.

#### Recommended: Cloudflare (free wildcard DNS + auto TLS)

1. Add `marvelops.app` to Cloudflare; point the registrar NS records at it.
2. **DNS:** add an `A` (or `CNAME`) record `*.marvelops.app` → your host IP /
   app URL, and `marvelops.app` (apex) → the same. Set proxy status **Proxied**
   (orange cloud) so Cloudflare terminates TLS and issues a free wildcard cert
   for `*.marvelops.app` automatically — no cert management needed.
3. **Origin:** ensure your host forwards the original `Host` header to Node
   (Railway/Heroku/Fly do this by default; behind nginx/CF Tunnel confirm
   `proxy_set_header Host $host;`). The app already runs `app.set('trust proxy', 1)`.
4. Set `APP_ROOT_DOMAIN=marvelops.app` in the server env.

#### Alternatives

- **Let's Encrypt wildcard via DNS-01**: `certbot certonly --dns <provider>
-d marvelops.app -d '*.marvelops.app'`, then terminate TLS at your proxy/edge
  with the issued cert + private key.
- **Platform-native**: some hosts (e.g. Fly, Render) can attach a wildcard cert
  if you own the domain there; otherwise bring your own cert at the edge.

#### Verify before flipping traffic

```
# From a machine with DNS propagated:
curl -sI https://<slug>.marvelops.app/api/health      # expect 200, valid cert
curl -s  https://<slug>.marvelops.app/api/tenants/check-slug?slug=test
# Unknown subdomain must 404:
curl -s  https://does-not-exist.marvelops.app/api/tenants/check-slug?slug=test
#   -> {"error":{"code":"TENANT_NOT_FOUND",...}}
```

Set `APP_ROOT_DOMAIN=marvelops.app` in the server env. This is what activates
subdomain→tenant resolution (`server/middleware/tenant.js`); leave it unset in
dev so localhost keeps working unchanged.

### Runtime env (production)

- `ALLOW_PUBLIC_SIGNUP=true` to open self-serve signup (default `false` —
  existing single-tenant deployments stay closed by default).
- `PLATFORM_ADMIN_EMAILS=ops@marvelops.app` — who can see the platform dashboard
  and suspend/reactivate workspaces.
- `TRIAL_DAYS` — trial length for new self-serve workspaces (default 14).
- `MICROSOFT_CLIENT_ID` — still required for Microsoft SSO (per-workspace
  `azure_tenant_id` is now configured in-app via the Workspace settings page,
  and falls back to `MICROSOFT_TENANT_ID` when empty).
- `CORS_ORIGIN` — set to your production origin in prod (dev defaults to `*`).
- `JWT_SECRET` — stable secret across restarts (tokens survive reloads).
- **Off-box backups**: ✅ done (Phase 8) — set `BACKUP_S3_*` and verify with
  `npm run backup:offsite verify`. Without it, snapshots stay on the same disk
  as the databases they protect.
- **Backup monitoring**: ✅ done (Phase 9) — set `BACKUP_ALERT_EMAIL` (or rely
  on `PLATFORM_ADMIN_EMAILS`) plus SMTP, or failures are recorded but nobody is
  told. The platform dashboard also flags a stale/silent scheduler.

## Still missing (audited 2026-07-27)

- **Billing** — no Stripe/plan scaffolding; `status` is set by an operator by
  hand. `trial`/`active`/`suspended` is the hook a billing webhook would drive.
- **Email verification on signup** — anyone can claim a workspace with an
  address they don't own.
- **Self-serve offboarding** — an operator can now delete a workspace
  (Phase 8), but a workspace admin can't export their own data or close their
  own account.
- **Invite links are tenant-fragile**: `server/routes/auth.js` prefers
  `APP_URL` over the request `Host`, so with `APP_URL` set an invite from
  workspace X points at the apex and the token won't resolve. Leave `APP_URL`
  unset (the `Host` fallback is correct) until this is fixed properly.

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
