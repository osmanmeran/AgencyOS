# CLAUDE.md

Marvelops TravelPro — a full-stack travel agency operations platform.
React 18 + Vite frontend, Express + better-sqlite3 backend, JWT/Microsoft SSO
auth, WebSocket real-time sync. See `README.md` for features/setup and
`ARCHITECTURE.md` for the entity system, permission model, and data flow.

## Commands

- `npm run dev` — Vite dev server; `npm run server` — Express backend
- `npm test` — Vitest (20 files, ~176 tests, backend-only)
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

Overall: a feature-rich, well-documented codebase in good health — all 176
tests pass, security fundamentals are solid (parameterized SQL, Helmet, rate
limiting, httpOnly JWT cookies, prototype-pollution guards, audit logging,
automatic pre-migration DB backups). The suggestions below are ordered by
priority; each was verified against the current code, not carried over blindly
from the README's earlier review.

## 🔴 Fix now

1. **`npm run typecheck` fails on current `main`** — `src/pages/Suppliers.jsx:723`
   (TS2322: `string | number` not assignable to `number`, from the Rating
   `Select`'s `onValueChange` storing `isNaN(Number(v)) ? v : Number(v)`).
   CI's typecheck job is red, which blocks the build job. Normalize
   `formData.rating` to one type.

2. **Read permissions are not enforced server-side** — still open from the
   README review. `userCanAccessEntity` (`server/services/entities.js:122`)
   returns `true` for any `agent`/`accounting` user (line ~168), and
   `requireEntityPermission` is only called for `create`/`update`/`delete`
   (lines 345–515), never `read`. The per-type `read` keys in
   `ENTITY_PERMISSION_MAP` are dead letter: an `accounting` user can read every
   entity type (Suppliers, TourContracts, AppSettings, …) via the generic API.
   Fix: call `requireEntityPermission(user, type, 'read')` in
   `findEntities`/`findEntityById`, mirroring the write paths.

## 🟡 Security hardening (next)

3. **SSO-provisioned users get a guessable local password** —
   `server/services/auth.js:147` sets `bcrypt.hashSync(microsoftId, 10)` as the
   password for auto-provisioned SSO accounts. A Microsoft `oid` is opaque but
   not secret. Use a random unusable password and reject local password login
   when `microsoft_id` is set.

4. **Inline admin endpoints bypass audit logging** —
   `/api/admin/fix-user` (`server/app.js:181`) and `/api/admin/fix-trip-agents`
   (`app.js:206`) are not mounted under `auditMiddleware` (only the routers at
   lines 116–123 are), so admin tier changes leave no audit trail. Move them
   into a dedicated admin router mounted with `auditMiddleware`.

5. **JWT bakes permissions in at login** — `generateToken` embeds
   `user_tier`/`custom_permissions`; permission changes take up to 24h to
   apply. Re-read effective permissions from the DB on sensitive routes, or
   move to short-lived access tokens + refresh rotation.

6. **CSP allows `unsafe-inline` and `unsafe-eval`** (`server/app.js:47`).
   Test whether MUI/Recharts actually need `unsafe-eval`; work toward nonces.

7. **No CSRF protection for cookie auth** — relies on same-origin only.

## 🟠 Architecture & scalability

8. **In-memory entity querying** — `findEntities` loads the whole table for a
   type, then filters/sorts/paginates in JS. Fine today; will degrade with
   data growth. Push filter/sort/pagination into SQL via `json_extract`
   (migration 013's indexes already exist for the hot paths).

9. **Triple entity registration is error-prone** — `server/db.js`,
   `public/api-client.js`, and `CLIENT_SCOPED_TYPES` must be kept in sync by
   hand. Short term, add a test that diffs the two `ENTITIES` lists; longer
   term, generate the client list at build time or serve it from the API.

10. **Duplicated permission logic** — the two `hasPermission` implementations
    (server + `src/lib`) are "parity-kept" by convention only. Extract a
    `shared/` module (or at minimum a parity test importing both).

11. **`I18nContext.jsx` is ~14,100 lines** — six locales inlined in one JSX
    file that every bundle chunk depends on. Split into per-locale JSON files
    and lazy-load the non-active locales; this also makes translation diffs
    reviewable. Finish translating the remaining ~14 pages.

## 🟢 Code quality & testing

12. **Frontend has zero test coverage** — all 20 test files target the
    backend. Priorities: React Testing Library tests for permission-gated UI
    and the CRUD hooks (`usePaginatedEntities`, `useEntitySync`), then a
    small Playwright E2E for login → create trip → create proposal.

13. **Decompose the largest pages** — `ReservationDetails.jsx` (1,876 lines),
    `CreateReservation.jsx` (1,552), `UserManagement.jsx` (1,447),
    `ClientQuoteBuilder.jsx` (1,363) mix data fetching, form state, and layout.
    Extract per-tab/per-section components before adding features to them.

14. **Clean up the 9 ESLint warnings** (unused vars/imports) so warnings stay
    a meaningful signal.

15. **Migrations are `.cjs` in an ESM project** — standardize to ESM
    (roadmap item; low risk, do opportunistically).

16. **Wire or delete `schemas.entityData`** — defined in
    `server/middleware/validate.js` but never applied to entity write routes;
    body safety currently rests on `sanitizeEntityData` alone.

## Deployment/ops notes

- SQLite on Railway: confirm the DB file lives on a persistent volume and add
  off-box backups (S3/R2) — `createBackupSync` snapshots are on the same disk.
- `server/ocr_parse.py` is invoked as a subprocess but is not in the repo;
  either vendor it or feature-flag the OCR route.
