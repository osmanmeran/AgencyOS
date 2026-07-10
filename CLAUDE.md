# CLAUDE.md

Marvelops TravelPro — a full-stack travel agency operations platform.
React 18 + Vite frontend, Express + better-sqlite3 backend, JWT/Microsoft SSO
auth, WebSocket real-time sync. See `README.md` for features/setup and
`ARCHITECTURE.md` for the entity system, permission model, and data flow.

## Commands

- `npm run dev` — Vite dev server; `npm run server` — Express backend
- `npm test` — Vitest (21 files, ~192 tests, backend-only)
- `npm run lint` / `npm run typecheck` — both run in CI alongside test + build
- `npm run db:migrate` / `db:migrate:status` — migrations (`server/migrations/*.cjs`, filename order)

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

6. **CSP allows `unsafe-inline` and `unsafe-eval`** (`server/app.js:47`).
   Test whether MUI/Recharts actually need `unsafe-eval`; work toward nonces.
   Left open: needs runtime verification across every page before tightening.

7. **No CSRF protection for cookie auth** — relies on `sameSite: 'strict'`
   plus same-origin only. Left open: adding token-based CSRF touches every
   frontend mutation; plan it as its own change.

## 🟠 Architecture & scalability

8. **In-memory entity querying** — `findEntities` loads the whole table for a
   type, then filters/sorts/paginates in JS. Fine today; will degrade with
   data growth. Push filter/sort/pagination into SQL via `json_extract`
   (migration 013's indexes already exist for the hot paths).

9. **Triple entity registration is error-prone** — `server/db.js`,
   `public/api-client.js`, and `CLIENT_SCOPED_TYPES` must be kept in sync by
   hand. ✅ Short term done: `tests/lib/parity.test.js` diffs the two
   `ENTITIES` lists (and found real drift: a dead client-side `Suggestion`
   entry — the type was never registered server-side; the suggestion UI now
   calls `/api/suggestions` directly). Longer term, generate the client list
   at build time or serve it from the API.

10. **Duplicated permission logic** — the two `hasPermission` implementations
    (server + `src/lib`) are "parity-kept" by convention only. ✅ Parity test
    added in `tests/lib/parity.test.js` (and found real drift: the frontend
    was missing `view_quote_requests`/`manage_quote_requests` and the `client`
    tier — now synced). Extracting a true `shared/` module remains open.
    Note: the server ignores the live `AppSettings.tier_permissions` overrides
    that the frontend honors — server enforcement uses the hardcoded defaults
    plus per-user custom_permissions. Unifying these is the next step here.

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

15. **Migrations are `.cjs` in an ESM project** — standardize to ESM
    (roadmap item; low risk, do opportunistically).

16. ✅ **FIXED — `schemas.entityData` is wired** into the entity POST/PUT
    routes, rejecting prohibited keys with a 400 before they reach
    `sanitizeEntityData` (which remains as defense in depth).

17. **Complete `ENTITY_PERMISSION_MAP` write coverage** — types without a
    mapping (ServiceTemplate, SupplierCategory, ItineraryEvent, …) are
    writable by any staff tier. Each addition needs care to not break agent
    workflows; AppSettings (the dangerous one) is now mapped.

## Deployment/ops notes

- SQLite on Railway: confirm the DB file lives on a persistent volume and add
  off-box backups (S3/R2) — `createBackupSync` snapshots are on the same disk.
- `server/ocr_parse.py` is invoked as a subprocess but is not in the repo;
  either vendor it or feature-flag the OCR route.
