# CLAUDE.md

Marvelops TravelPro — a full-stack travel agency operations platform.
React 18 + Vite frontend, Express + better-sqlite3 backend, JWT/Microsoft SSO
auth, WebSocket real-time sync. See `README.md` for features/setup and
`ARCHITECTURE.md` for the entity system, permission model, and data flow.

## Commands

- `npm run dev` — Vite dev server; `npm run server` — Express backend
- `npm test` — Vitest (26 files, ~248 tests, backend-only)
- `npm run lint` / `npm run typecheck` — both run in CI alongside test + build
- `npm run db:migrate` / `db:migrate:status` — migrations (`server/migrations/*.js`, filename order)

## Things to know before editing

- Almost all business objects live in a **single `entities` table** (`type` + JSON
  `data` blob). Adding an entity type requires **three registrations**:
  `ENTITIES` in `server/db.js`, `ENTITIES` in `public/api-client.js` (loaded as a
  plain `<script>`, not bundled), and `CLIENT_SCOPED_TYPES` in
  `server/services/entities.js` if client-portal-scoped. `entities/<TypeName>`
  JSON Schema files are documentation only — not enforced.
- Permissions have **two parity-kept implementations**: `server/permissions.js`
  and `src/lib/permissions.js`. Change both together.
- i18n lives entirely in `src/lib/i18n/I18nContext.jsx` (6 locales, ~14k lines).
  Pages use `useT()`; translation of pages is in progress (~44 of 58 done).

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

11. **`I18nContext.jsx` is ~14,100 lines** — six locales inlined in one JSX
    file that every bundle chunk depends on. Split into per-locale JSON files
    and lazy-load the non-active locales; this also makes translation diffs
    reviewable. Finish translating the remaining ~14 pages.

## 🟢 Code quality & testing

12. **Frontend has zero test coverage** — all test files target the
    backend. Priorities: React Testing Library tests for permission-gated UI
    and the CRUD hooks (`usePaginatedEntities`, `useEntitySync`), then a
    small Playwright E2E for login → create trip → create proposal.

13. **Decompose the largest pages** — `ReservationDetails.jsx` (1,876 lines),
    `CreateReservation.jsx` (1,552), `UserManagement.jsx` (1,447),
    `ClientQuoteBuilder.jsx` (1,363) mix data fetching, form state, and layout.
    Extract per-tab/per-section components before adding features to them.

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

- SQLite on Railway: confirm the DB file lives on a persistent volume and add
  off-box backups (S3/R2) — `createBackupSync` snapshots are on the same disk.
- `server/ocr_parse.py` is invoked as a subprocess but is not in the repo;
  either vendor it or feature-flag the OCR route.
