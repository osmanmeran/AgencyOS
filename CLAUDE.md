# CLAUDE.md

Marvelops TravelPro — a full-stack travel agency operations platform.
React 18 + Vite frontend, Express + better-sqlite3 backend, JWT/Microsoft SSO
auth, WebSocket real-time sync. See `README.md` for features/setup and
`ARCHITECTURE.md` for the entity system, permission model, and data flow.

## Commands

- `npm run dev` — Vite dev server; `npm run server` — Express backend
- `npm test` — Vitest (52 files, ~409 tests, backend-only)
- `npm run lint` / `npm run typecheck` — both run in CI alongside test + build
- `npm run db:migrate` / `db:migrate:status` — migrations (`server/migrations/*.js`, filename order)

## Things to know before editing

- Almost all business objects live in a **single `entities` table** (`type` + JSON
  `data` blob). Adding an entity type requires registering `ENTITIES` in
  `server/db.js` (the single source of truth — `public/api-client.js` resolves
  entity types dynamically via a `Proxy`, no client-side list) and adding to
  `CLIENT_SCOPED_TYPES` in `server/services/entities.js` if client-portal-scoped.
  `entities/<TypeName>` JSON Schema files are documentation only — not enforced.
- Permissions have **two parity-kept implementations**: `server/permissions.js`
  and `src/lib/permissions.js`. Change both together.
- i18n: each locale is a JSON file in `src/lib/i18n/locales/` (`en` is eagerly
  bundled as the fallback; the others are code-split and lazy-loaded on demand
  via `import.meta.glob` in `src/lib/i18n/I18nContext.jsx`). Pages use `useT()`;
  translation of pages is in progress (~44 of 58 done).
- **Multi-tenant SaaS**: each workspace gets its own SQLite file
  (`data/tenants/<id>/marvelops.db`), opened on demand and LRU-capped at 50
  concurrently-open connections (`server/db.js`). `server/middleware/tenant.js`
  resolves the tenant from the Host subdomain (or an `active_tenant` cookie in
  single-domain mode) before auth runs, and the rest of the request executes
  inside `runWithTenant()` (`AsyncLocalStorage`), so the ~100 existing
  `getDb()` call sites are tenant-scoped automatically. `authMiddleware`
  double-checks the JWT's `tenant_id` claim against the resolved subdomain so
  a token can't be replayed against another workspace. A separate
  `platform.db` (the tenant registry) backs `/api/platform/*`, gated by the
  `PLATFORM_ADMIN_EMAILS` allow-list — distinct from the per-workspace
  `admin` tier, which has no cross-tenant access.

---

# App Evaluation — Suggestions (2026-07-10)

Overall: a feature-rich, well-documented codebase in good health — the test
suite passes, security fundamentals are solid (parameterized SQL, Helmet, rate
limiting, httpOnly JWT cookies, prototype-pollution guards, audit logging,
automatic pre-migration DB backups). The suggestions below are ordered by
priority; each was verified against the current code, not carried over blindly
from the README's earlier review. Items marked ✅ were fixed on 2026-07-10.

## 🔴 Fix now

1. ✅ **FIXED — `npm run typecheck` failed on `main`** — `src/pages/Suppliers.jsx`
   `formData.rating` is legitimately `number | string` (star count or
   'boutique'/'cave'); the state initializer now declares that union type.

2. ✅ **FIXED — Read permissions are now enforced server-side** —
   `userCanAccessEntity` gates agent/accounting reads through
   `staffCanReadType` (`server/services/entities.js`): a type is readable
   wholesale only via its mapped `read` key, a modify permission on the type,
   or a workflow grant in `STAFF_READ_EXTRA` (e.g. `create_trips` implies
   reading Clients/TourContracts); otherwise users see only their own records.
   Global search (`searchAll`) now filters every hit through the same check.
   Fixed alongside, discovered during implementation:
   - **AppSettings was writable by ANY authenticated user** (unmapped type +
     open access) — now requires `manage_app_settings`.
   - **`OutlookToken` rows (Microsoft Graph OAuth tokens) were readable by any
     staff user** via the generic API — the type is no longer registered in
     the generic-API allowlist; only `services/integrations.js` touches it.
   - Client-portal users no longer see the staff directory in global search.

## 🟡 Security hardening (next)

3. ✅ **FIXED — SSO-provisioned users no longer get a guessable password** —
   auto-provisioned accounts get an empty unusable password, and
   `authenticateLocal` rejects password login for any account with a
   `microsoft_id` (which also covers legacy rows whose password was
   `bcrypt(oid)`).

4. ✅ **FIXED — Inline admin endpoints now audited** — `/api/admin/*` moved to
   `server/routes/admin.js`, mounted under `auditMiddleware`.

5. ✅ **FIXED — Permissions no longer baked into the JWT for authorization** —
   `authMiddleware` re-reads tier/custom_permissions/is_active from the DB on
   every request (single PK lookup), so permission changes and deactivations
   apply immediately. The JWT now only proves identity. (Refresh-token
   rotation is still a worthwhile future upgrade.)

6. ✅ **FIXED — CSP tightened** (`server/app.js`) — `scriptSrc` is `'self'`
   only now (no `unsafe-inline`/`unsafe-eval`); verified zero inline
   `<script>` tags in the built output. `styleSrc` keeps `unsafe-inline`,
   which MUI/emotion's runtime style injection genuinely needs.

7. ✅ **FIXED — CSRF protection added** — double-submit cookie pattern
   (`server/middleware/csrf.js` + `setTokenCookie` in `services/auth.js`);
   every frontend fetch wrapper attaches `X-CSRF-Token`. Covered by
   `tests/middleware/csrf.test.js`.

## 🟠 Architecture & scalability

8. ✅ **FIXED — In-memory entity querying pushed into SQL where safe** —
   `findEntities` (`server/services/entities.js`) runs filter/sort/pagination
   as SQL via `json_extract` (migration 013's indexes) whenever the caller has
   unconditional read access to the type (`hasUnconditionalReadAccess`) and
   isn't doing a text `search`. Row-scoped reads stay on the JS path (already
   bounded to one client/supplier/user). Covered by
   `tests/services/entitiesFindSql.test.js`.

9. **Triple entity registration is error-prone** — `server/db.js`,
   `public/api-client.js`, and `CLIENT_SCOPED_TYPES` must be kept in sync by
   hand. ✅ Short term done: `tests/lib/parity.test.js` diffs the two
   `ENTITIES` lists (and found real drift: a dead client-side `Suggestion`
   entry — the type was never registered server-side; the suggestion UI now
   calls `/api/suggestions` directly). Longer term, generate the client list
   at build time or serve it from the API.

10. ✅ **FIXED — Permission logic deduplicated** — `PERMISSION_GROUPS`/
    `ALL_PERMISSION_KEYS`/`DEFAULT_TIER_PERMISSIONS` now live in
    `shared/permissions.js`, imported by both `server/permissions.js` and
    `src/lib/permissions.js`. `server/permissions.js` also gained
    `getEffectiveTierPermissions`, which reads the admin-configurable
    `AppSettings.tier_permissions` override the same way the frontend already
    did — closing the gap where an admin revoking a permission via that
    override hid the UI but the backend still allowed it. Covered by
    `tests/services/permissions.test.js` and `tests/lib/parity.test.js`.

11. ✅ **FIXED — `I18nContext.jsx` split into per-locale JSON** (2026-07-14) —
    the six inlined locales are now `src/lib/i18n/locales/*.json`. `en` is
    eagerly imported (the fallback dictionary); the other five are code-split
    and lazy-loaded via `import.meta.glob(['./locales/*.json',
'!./locales/en.json'])`, fetched only when a user selects that language.
    `t` falls back to English per-key until the active locale's chunk resolves,
    so no consumer needs a loading state. This moved ~440 KB of translations
    out of the initial bundle (main `index` chunk 650 KB → 222 KB). Translation
    diffs are now reviewable per-locale. Still TODO: finish the remaining ~14
    untranslated pages.

## 🟢 Code quality & testing

12. **Frontend test coverage (baseline established 2026-07-16)** — until
    now all test files targeted the backend. A `frontend` Vitest project now
    runs React Testing Library specs under `tests/frontend/**` (jsdom env,
    `@testing-library/jest-dom` matchers, `@` alias mirrored from
    `vite.config.js`, `@vitejs/plugin-react`). Seed specs cover the permission
    catalog (`tests/frontend/lib/permissions.test.js`), the permission-gated
    `PermissionGate`/`PermissionProvider` UI
    (`tests/frontend/components/PermissionGate.test.jsx`), and the two CRUD
    hooks `usePaginatedEntities` / `useEntitySync`
    (`tests/frontend/hooks/*.test.jsx`) by mocking `@/lib/DbContext` and
    `@/lib/realtime`. A Playwright E2E (`tests/e2e/flow.spec.js`, run via
    `npm run test:e2e`) exercises the live login → create trip → create
    proposal flow against an isolated `data/e2e` SQLite DB seeded by
    `tests/e2e/globalSetup.js` and started by `scripts/e2eServer.mjs`. Still
    TODO: broaden component coverage (more RTL specs) and add further E2E flows.

13. ✅ **FIXED — largest pages decomposed** (2026-07-14) — the four biggest
    pages had their self-contained presentational sub-components and shared
    constants/helpers extracted into co-located folders under
    `src/components/<page-name>/`, leaving each page as orchestration (state,
    data fetching, handlers) only:
    - `ClientQuoteBuilder.jsx` 1,884 → 671 (`components/quote-builder/`:
      PaxRow, ServicePickerDialog, TourPickerDialog, ServiceLineCard, helpers)
    - `ReservationDetails.jsx` 1,804 → 849 (`components/reservation-details/`:
      ServicesSection, ItineraryRecap, HistoryModal, OccupancyValidation,
      NotesAndTerms, helpers)
    - `CreateReservation.jsx` 1,495 → 776 (`components/create-reservation/`:
      13 section/card/dialog components + helpers)
    - `UserManagement.jsx` 1,447 → 583 (`components/user-management/`:
      InviteModal, AddUserForm, EditUserModal, UsersTable, PermissionManager,
      etc. + helpers)
      Pure structural move — no behavior change; lint/typecheck/test/build all
      green. Deeply state-entangled sections were intentionally left in the pages.

14. ✅ **FIXED — ESLint is warning-free** (was 9 warnings of unused
    vars/imports). Keep it at zero so warnings stay a meaningful signal.

15. ✅ **FIXED — Migrations converted from `.cjs` to ESM `.js`** (2026-07-13) —
    all 17 files renamed and rewritten as `export function up/down`. The
    tricky part: the runner tracked applied migrations by exact filename in
    the `_migrations` table, so a naive rename would make every existing
    database (including production) look like it had 17 pending migrations
    again on the next deploy. `server/migrations/runner.js` now compares
    names with the extension stripped (`normalizeName`), so a `.cjs` name
    already recorded in `_migrations` still matches its renamed `.js` file —
    verified by seeding a temp DB's `_migrations` table with the old `.cjs`
    names and confirming `migrationStatus`/`migrate` treat all 17 as already
    applied. Migration loading is now `import()` (async), so `migrate()` and
    `reopenDb()` are async now too; `server/db.js`'s module-level call uses
    top-level await. `npm run db:migrate:down` also had to change: it used to
    reload the exact filename recorded in `_migrations` (which no longer
    exists post-rename) — it now resolves the current on-disk file via the
    same normalized-name match.

16. ✅ **FIXED — `schemas.entityData` is wired** into the entity POST/PUT
    routes, rejecting prohibited keys with a 400 before they reach
    `sanitizeEntityData` (which remains as defense in depth).

17. ✅ **FIXED — `ENTITY_PERMISSION_MAP` write coverage completed** (2026-07-13)
    — the 11 remaining unmapped types (`SupplierCategory`, `SupplierSubcategory`,
    `SupplierPricing`, `SupplierService`, `SupplierReview`, `ItineraryEvent`,
    `PackingItem`, `ProposalTemplate`, `BookingRequest`, `ReferenceCounter`,
    `ReportSchedule`) were previously writable by any authenticated staff tier,
    including `accounting` (nominally read-only). Each is now gated by an
    existing permission already held by the tier that actually uses it
    (`manage_categories`, `manage_pricing`, `modify_suppliers_basic`,
    `create_trips`, `create_proposals`/`modify_proposals`, `view_reports`), with
    matching `STAFF_READ_EXTRA` entries so agent/accounting read access isn't
    regressed. Verified via `createEntity`/`findEntities` against the isolated
    test DB (agent can write, accounting is rejected) before removing the
    scratch test. Note: while investigating this, found the Supplier Portal
    (`linked_supplier_id` accounts) has no production provisioning path
    anywhere in the codebase — only `/api/testing/create-test-user*` sets that
    field, and that route is disabled in production. The portal UI
    (`SupplierPortal.jsx` and friends) is effectively unreachable by a real
    supplier today; worth a follow-up if the feature is meant to be live.

## Deployment/ops notes

- SQLite on Railway: confirm the DB file lives on a persistent volume.
  ✅ Off-box backups (S3/R2) shipped — `server/services/offsiteBackup.js` +
  `backupScheduler.js` fan out `createBackupSync` snapshots per tenant,
  monitored via `backupRuns.js`/`backupHealth()` (surfaced on the platform
  admin dashboard).
- ✅ `server/ocr_parse.py` is now vendored in the repo; the route stays
  feature-flagged behind `OCR_ENABLED` since the Python/tesseract/poppler
  deps still aren't part of the default Node/Railway image.

---

# App Evaluation — Suggestions (2026-07-30)

Scope: the codebase has grown substantially since the 2026-07-10 review — a
full multi-tenant SaaS layer (per-tenant SQLite files, subdomain/cookie
routing, platform admin, off-box backups, self-serve signup) landed on top of
the original single-tenant app. This pass re-verified every item from
2026-07-10 against current code and reviewed the new SaaS surface for the
same. Good news first: **every item from the previous review that wasn't
already ✅ is now resolved**, without a dedicated follow-up pass —
found as a side effect of reviewing the new code:

- Refresh-token rotation (previously "a worthwhile future upgrade", item 5) —
  now implemented: short-lived (15m) access tokens + a rotating, SHA-256-hashed
  refresh token (`server/migrations/021_refresh_tokens.js`,
  `services/auth.js`'s `rotateRefreshToken`). Each refresh revokes the
  previous token, so a leaked one can't be replayed.
- The Supplier Portal provisioning gap (item 17's note) — now has a real
  provisioning path: `POST /api/auth/supplier-portal/grant`
  (`server/routes/auth.js`), gated by `grant_supplier_portal`, mirroring the
  Client Portal flow.
- `server/ocr_parse.py` is vendored (deployment note above).

New findings from this pass, in priority order:

## 🔴 Fix now

1. ✅ **FIXED — Unescaped HTML injection in auto-generated email bodies** —
   `sendEmail({ body })` (`server/services/email.js`) sends `body` verbatim
   as the email's `html`. The `template`/`templateData` path already escapes
   every string field (`escapeTemplateData`), but two call sites built HTML
   by hand from **unescaped, staff-entered fields** and passed it through
   `body` instead: `services/reminders.js` (`Trip "${data.name}" to
${data.destination}...`, invoice reminders) and
   `services/reportScheduler.js`'s `renderCommissionsHtml` (trip name, client
   name in an HTML table). A trip or client name containing `<img
src=x onerror=...>` or a fake "session expired, click here" link would
   render live in the recipient's email client — a stored HTML-injection /
   phishing vector reaching whoever the report schedule or reminder targets
   (often an admin/manager), sent from the app's own trusted address.
   Fixed by exporting `escapeHtml` from `services/email.js` and applying it
   at both sites: `reminders.js` now escapes the composed message only for
   the `email.body` field (the in-app notification `title`/`message` stays
   unescaped — React renders it as text, not HTML, so escaping there would
   just show literal `&amp;` to users); `reportScheduler.js` escapes
   `t.name`/`t.client_name` before interpolating into the commission table.
   Regression tests added: `tests/services/reminders.test.js` and
   `tests/services/reportScheduler.test.js` both assert a `<img onerror=...>`
   trip name is neutralized in the emailed body. The third `sendEmail({body})`
   caller, `POST /api/integrations/email/send` (`routes/integrations.js`), is
   intentionally unescaped — it's a staff member composing free-text/rich-text
   email through the app's own compose UI, not data reflected without intent.

## 🟡 Security hardening (next)

2. **`refresh_tokens` has no pruning job** — every access-token refresh (every
   ~15 min for an active session) inserts a new row; revoked/expired rows are
   never deleted. Not a vulnerability (rows are useless once
   `revoked`/`expires_at` has passed, and lookups stay index-backed), but the
   table grows unbounded per tenant DB with no cap. Add a periodic sweep
   (e.g. alongside `backupScheduler`'s per-tenant loop) deleting rows where
   `revoked = 1 OR expires_at < now`.

3. **CSP `connectSrc` allows `cdn.jsdelivr.net` for no reason** — grep
   confirms `cdn.jsdelivr.net` is only ever fetched server-side
   (`services/exchangeRates.js`, a Node `fetch()` for currency rates, which
   CSP doesn't govern). No frontend code references it. Drop it from
   `server/app.js`'s `connectSrc` — one less allowed origin for no loss of
   functionality.

## 🟠 Architecture & scalability

4. **`MAX_OPEN_DBS = 50` tenant-connection cap is a hardcoded, unmonitored
   ceiling** (`server/db.js`) — fine at current scale, but two things are
   worth tracking before this becomes a real SaaS with many active
   workspaces: (a) there's no metric/alert on eviction frequency, so the
   first sign of hitting the ceiling under load would be user-visible
   latency (every request from an evicted tenant re-opens + re-migrates its
   DB); (b) `evictLruTenant()` can in principle close a connection that a
   concurrent async request for that same tenant is still mid-flight on (an
   `await` between two `getDb()` calls in the same handler), surfacing as a
   rare "database is closed" error that a retry clears. Neither is urgent at
   today's tenant count, but worth a connection-pool-aware redesign (or at
   minimum an eviction counter in `/api/platform/stats`) before onboarding
   enough workspaces to churn the LRU regularly.

5. **No self-service password reset** — `routes/auth.js` has no
   forgot-password flow; a locked-out user needs an admin to reset their
   password (or use Microsoft SSO). Low urgency (not a vulnerability — the
   absence of a reset flow removes a whole class of reset-token bugs), but
   worth deciding deliberately rather than by omission now that self-serve
   signup (`/api/tenants/signup`) exists and new workspaces won't always have
   a second admin on hand to help.

## 🟢 Verified healthy (no action needed)

- Tenant isolation is physical (one SQLite file per tenant, not a shared
  table with a `tenant_id` column), which rules out an entire class of
  cross-tenant leak bugs (a forgotten `WHERE tenant_id = ?`) by construction.
  `authMiddleware` cross-checks the JWT's tenant claim against the resolved
  subdomain on every request.
- File/path handling is consistently hardened: `routes/ocr.js`,
  `routes/uploads.js` (`fs.realpathSync` comparison — the strictest of the
  three), and `routes/pdf.js` all resolve the caller-supplied path and verify
  it stays under the tenant-scoped directory before touching disk.
  `routes/ocr.js`'s subprocess call uses `spawn()` with an argument array
  (no shell), so it isn't vulnerable to command injection despite taking
  user-supplied text.
- Background jobs (`reportScheduler`, `reminders`, `backupScheduler`) all
  iterate every tenant via `forEachTenant`/`allTenantIds` — none of them
  silently regressed to legacy-tenant-only behavior after the multi-tenant
  migration.
- `/api/testing/*` (fixed-password test-user provisioning) is gated behind
  `authMiddleware` + `requireAdmin` and explicitly 403s in production for
  both user-creation endpoints.
- Platform admin routes (`routes/platform.js`) are allow-list gated
  (`PLATFORM_ADMIN_EMAILS`, distinct from workspace `admin` tier) and every
  mutation is audit-logged.
