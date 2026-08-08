# CLAUDE.md

Marvelops TravelPro — a full-stack travel agency operations platform.
React 18 + Vite frontend, Express + better-sqlite3 backend, JWT/Microsoft SSO
auth, WebSocket real-time sync. See `README.md` for features/setup and
`ARCHITECTURE.md` for the entity system, permission model, and data flow.

## Commands

- `npm run dev` — Vite dev server; `npm run server` — Express backend
- `npm test` — Vitest (66 files, 517 tests; `backend` + `frontend` projects)
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
- **Tenant zero is registered, not adopted** (and production is deliberately
  in that state). Its database can live at either `data/tenants/0/marvelops.db`
  or the pre-SaaS `data/marvelops.db`; `tenantDbPath()` in `server/db.js`
  prefers the former and falls back to the latter, so both work. Either way it
  needs a row in `platform.db` — without one, SSO login finds the user, then
  dies on `getTenantById()` with "Workspace not found." while every other part
  of the app looks fine. `checkTenantZeroRegistered()`
  (`server/lib/startupChecks.js`, called from `server.js`) logs that at boot.
  To fix it, prefer `scripts/register-tenant-zero.mjs`, which writes only the
  registry row; `adopt-tenant-zero.mjs` additionally _moves_ the live database,
  which is not what resolves the error.
- **The two Azure tenant env vars hold different formats on purpose** — don't
  "fix" one to match the other. `VITE_MICROSOFT_TENANT_ID` goes in the browser
  authorize URL, where Azure accepts a verified domain or a GUID.
  `MICROSOFT_TENANT_ID` (and the `tenants.azure_tenant_id` column) is compared
  server-side against the id token's `tid` claim, which is _always_ a GUID — a
  domain there rejects every login with a misleading "not your organization".

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

2. ✅ **FIXED — `npm audit` flagged 9 dependency vulnerabilities** — `npm
audit fix` (no `--force`, no major bumps) resolved 7 of them in place:
   `body-parser` (DoS via a silently-disabled size limit), `postcss` (path
   traversal disclosing arbitrary `.map` files via source-map auto-loading),
   `dompurify`, `js-yaml`, and the `shell-quote`/`concurrently` dev-tool
   chain. `react-router-dom` was bumped 6.26 → 7.18.2 (package.json + lock)
   to pick up a fix for an open-redirect bypass in `<Link>`/`useNavigate`
   (the app's classic declarative-mode usage — `BrowserRouter`, `Routes`,
   `Route`, `Navigate`, `Outlet`, `Link`, `useLocation`, `useNavigate`,
   `useSearchParams` — is unaffected by v7's API changes, which only bite
   apps opting into the new data-router/framework mode); verified via the
   full test suite, lint, typecheck, a production build, and a headless
   browser smoke test of the built app (Dashboard rendered, sidebar
   navigation worked, zero console/page errors beyond the expected API 500s
   from the backend not running). Two remaining `npm audit` items were
   evaluated and left as-is rather than force-fixed:
   - `brace-expansion` (via `eslint-plugin-react` → `minimatch`) — ESLint is
     a dev-only tool that processes local source globs, never
     attacker-supplied input, so the DoS advisory has no reachable path here;
     the only available fix downgrades `eslint-plugin-react` to a
     much older 7.22.0.
   - The newest `react-router` advisory (RSC-mode CSRF bypass,
     `GHSA-qwww-vcr4-c8h2`) only applies to React Server Components mode,
     which this Vite SPA doesn't use at all (no SSR, no RSC). The only fix
     path (`react-router-dom@7.11.0`) would reintroduce the open-redirect bug
     this update just fixed, so it's a strictly worse trade.
   - Re-verified as-is on 2026-07-30 after GitHub's Dependabot flagged "2 high"
     on `main`: `npm audit` still surfaces exactly these same two — the
     `brace-expansion`/`eslint-plugin-react` DoS advisory (dev-only tool, no
     attacker-reachable input) and the `react-router` RSC-mode CSRF bypass
     (unreachable — no SSR/RSC in this app). `react-router-dom` is still
     pinned at `^7.18.2`, `eslint-plugin-react` at `^7.37.4`. Left untouched
     again for the same reasons above; Dependabot's repo-level scanner has no
     way to encode "not reachable in this app's usage," so it will keep
     flagging these two until upstream ships a real fix.
   - Re-verified again on 2026-07-31: same two findings, still the only two.
     This pass also checked whether bumping `eslint` itself (rather than
     downgrading `eslint-plugin-react`) could clear the `brace-expansion`
     chain without a trade-off — it can't: `eslint-plugin-react@7.37.5`
     (latest published) still caps its peer range at `eslint ^9.7`, with no
     v10-compatible release yet, so there is no forward-only fix available.
     Left both as-is; no dependency changes.

## 🟡 Security hardening (next)

3. **`refresh_tokens` has no pruning job** — every access-token refresh (every
   ~15 min for an active session) inserts a new row; revoked/expired rows are
   never deleted. Not a vulnerability (rows are useless once
   `revoked`/`expires_at` has passed, and lookups stay index-backed), but the
   table grows unbounded per tenant DB with no cap. Add a periodic sweep
   (e.g. alongside `backupScheduler`'s per-tenant loop) deleting rows where
   `revoked = 1 OR expires_at < now`.

4. **CSP `connectSrc` allows `cdn.jsdelivr.net` for no reason** — grep
   confirms `cdn.jsdelivr.net` is only ever fetched server-side
   (`services/exchangeRates.js`, a Node `fetch()` for currency rates, which
   CSP doesn't govern). No frontend code references it. Drop it from
   `server/app.js`'s `connectSrc` — one less allowed origin for no loss of
   functionality.

## 🟠 Architecture & scalability

5. **`MAX_OPEN_DBS = 50` tenant-connection cap is a hardcoded, unmonitored
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

6. **No self-service password reset** — `routes/auth.js` has no
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

---

# Ops notes — Microsoft SSO lockout (2026-08-05/06)

Production locked every user out of Microsoft sign-in. Three independent
faults stacked, which is worth knowing because fixing any one of them alone
left the symptom unchanged and made it look like the fix hadn't worked.

1. **Azure rejected the `/common` endpoint** (`AADSTS50194`). The app
   registration is single-tenant, and single-tenant apps created after
   2018-10-15 cannot use `/common` at all. `loginWithMicrosoft` and the
   matching token exchange now resolve their authority from
   `VITE_MICROSOFT_TENANT_ID` (`src/lib/microsoft-auth.js`), falling back to
   `common`. `signupWithMicrosoft` deliberately stays on `common` — self-serve
   signup cannot know the new agency's tenant until after they authenticate,
   so `handleMicrosoftCallback` picks the authority off `ms_mode` to keep the
   exchange matched to the authorize step. No server change was needed:
   `verifyMicrosoftIdToken` already derives the tenant from the token's `tid`.

   Making the registration multi-tenant instead would have been the other
   fix, but it needs Azure tenant-admin rights on `marveltour.com.tr` that
   we do not have — as does consenting `Application.ReadWrite.All` in Graph
   Explorer. Assume that route is closed unless told otherwise.

2. **The fix wasn't deployed.** Railway builds from git; the change sat
   uncommitted while the env var was set, so the deployed bundle still had
   `/common` hardcoded and the new variable had no code reading it. Worth
   checking `git status` before concluding an env-var change didn't work.

3. **The tenant registry was empty.** The SaaS layer shipped without its
   one-off registration step ever running against production, so `platform.db`
   had no row at all. See the tenant-zero bullet above; this is the state
   `checkTenantZeroRegistered()` now reports at boot.

Added along the way, all inert unless invoked:

- `scripts/diagnose-tenants.mjs` — read-only; reports the registry against
  what is on disk and names the mismatch. Safe against production.
- `scripts/register-tenant-zero.mjs` — writes just the registry row. Refuses a
  non-GUID `azure_tenant_id` for the reason in the env-var bullet above.
- `scripts/unlock-local-login.mjs` — break-glass for an SSO-only admin locked
  out with no password login. Clears `microsoft_id` (what makes
  `authenticateLocal` reject SSO accounts) and mints a reset link so the
  operator chooses their own password; it never generates or prints one. The
  link is minted directly rather than emailed because `sendEmail` degrades to
  logging when SMTP is unset **and** persists an empty body for template
  emails, which would leave the token unrecoverable.

Still open: `SMTP_*` is unset (placeholders removed 2026-08-06), so all
outbound email silently logs instead of sending — no password resets, invites,
or reminders reach anyone until a real host is configured. Until then,
`unlock-local-login.mjs --reset-link` is the only account-recovery path.

---

# Ops notes — the deploy branch is a moving part (2026-08-08)

**Railway's deploy branch is configured in the dashboard, not in this repo,
and it has not always been `main`.** During the Google SSO work it pointed at
`saas-standalone`; `main` sat unused for days. A push to `main` therefore
deployed nothing at all, silently — the service stayed Online, the app stayed
healthy, and only the _absence_ of a new deployment gave it away. It is back
on `main` now (2026-08-08), and `main` was made a superset of every branch
before the switch, so nothing regressed.

Do not infer the deploy branch from this file. Check it, especially when a
push appears to have no effect:

- `railway status` — the **deployment ID** changes on every real deploy. An
  unchanged id after a push is the tell.
- `railway logs | grep -iE "migrat|server started"` — a fresh boot logs its
  pre-migration backup and either `Applying: <file>` or
  `All migrations already applied`. A migration name here that doesn't exist
  on the branch you just pushed means you are looking at a different branch's
  build — that is exactly how the `saas-standalone` split was found.
- `railway ssh 'echo $RAILWAY_GIT_BRANCH'` when SSH is available.

Two consequences worth keeping in mind:

- **Migration numbers collide across long-lived branches.** `031` was taken
  twice — `031_google_sso.js` on `saas-standalone` and a task-status backfill
  on `main` — the same footgun as the 027/028 renumber recorded above. Nothing
  breaks (the runner keys on filename, extension stripped, so both apply), but
  renumber before merging while the migration has not yet run anywhere: once
  production records a name, renaming it makes that database see the new name
  as pending. Idempotent migrations survive this; others would not.
- **Environment variables live on the service, not the branch.** Switching
  the deploy branch carries none of them, and a second service
  (`marvelops-testing-setup`) shares nothing with production. A feature can be
  fully merged and still invisible because its variable was never set — Google
  SSO shipped its code and migration long before it ever rendered, because
  `VITE_GOOGLE_CLIENT_ID` was unset and Vite compiles `import.meta.env` in at
  **build** time, so the button was simply absent from the bundle.

## Google SSO configuration (live since 2026-08-08)

Three variables, all on the Railway service: `VITE_GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_ID` (the same public value) and `GOOGLE_CLIENT_SECRET`. The
secret must never take a `VITE_` prefix — that would publish it in the browser
bundle. Setting the `VITE_` one requires a rebuild, not a restart.

To tell a bad credential apart from a bad login attempt without attempting a
real sign-in, exchange a deliberately fake code from inside the container so
the secret never leaves it:

```
railway ssh "node -e 'fetch(\"https://oauth2.googleapis.com/token\",{method:\"POST\",body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,code:\"probe\",grant_type:\"authorization_code\",redirect_uri:\"https://marvelops-production.up.railway.app/auth/google/callback\"})}).then(r=>r.text().then(t=>console.log(r.status,t)))'"
```

`401 invalid_client` means the id/secret pair is wrong (Google names which
half). `400 invalid_grant` is the healthy answer — credentials accepted, only
the fake code rejected. That one call distinguishes a credential problem from
every other failure in the flow.

Remember that **Google sign-in never provisions**: an email with no existing
user row is rejected outright, which looks identical to a misconfiguration.
Check the user row before suspecting the OAuth setup.
