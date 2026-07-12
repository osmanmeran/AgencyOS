# Marvelops TravelPro

A full-stack travel agency operations management platform for tour operators and travel agents.

## Tech Stack

- **Frontend:** React 18, Vite 6, MUI 9, Radix UI (shadcn-style), Tailwind CSS, Framer Motion, Recharts
- **Backend:** Express.js, WebSockets, SQLite (better-sqlite3 with FTS5), JWT auth, Microsoft SSO
- **Infrastructure:** Railway (deploy on push to `main`), GitHub Actions CI (lint, typecheck, test, build)

## Features

### Core Operations

- **Dashboard** — Upcoming arrivals/departures, trip calendar, pending tasks, quick actions
- **Trips / Reservations** — Full CRUD with pagination, search, bulk actions, status workflow
- **Clients** — Table view + Kanban CRM pipeline (lead → contacted → proposal → negotiation → won/lost)
- **Suppliers** — CRUD with categories/subcategories, pricing tiers, ratings
- **Calendar** — Monthly view of trip arrivals and departures

### Sales & Finance

- **Proposals** — Create, track status (delivered/changed/approved/rejected), change history
- **Invoices** — CRUD with line items, status tracking (draft/sent/paid/overdue/cancelled)
- **Revenue Reports** — Charts and breakdowns
- **Commission Reports** — Profit/commission calculation from trip data
- **Client Payments** — Manual payment recording (no gateway integration)

### Advanced Tools

- **Itinerary Builder** — Day-by-day editor with drag-and-drop, category detection
- **Tour Contracts** — Recurring serial contracts with pricing tiers, Utravel import
- **RFP Manager** — Request for Proposal wizard, supplier quoting
- **Task Board** — Kanban tasks (pending / in progress / done)
- **Service Library** — Reusable service categories and templates
- **Import Hub** — Outlook contacts, bulk supplier CSV, AI price analyzer

### Guided Tours

- **Daily Tours** — Single-day experiences with language, location, starting time, visited museums & sights, meal treatment, transportation flag, and per-participant pricing tiers
- **Multi-Day Tours** — Extended tours adding starting/finishing city, per-night lodging, and hotel meal treatment
- **Occupancy** — Minimum and maximum occupancy enforced per tour
- **Private or Regular** — Daily tours can be private or regular (other passengers grouped into the same departure)
- **Pricing Tiers** — Per-participant pricing bands (min/max participants → price)
- **Supplier Link** — Each tour is associated with a supplier (tour operator)
- **Multi-Day Scheduling** — Compulsory departure date + general availability per departure; optional weekly repeat with a start/end repetition window (generates weekly departures)
- **Bookings & Remaining Availability** — Staff can record bookings per departure; the staff tour list shows remaining availability (availability − booked) for every departure
- Accessible from two pills on the Dashboard home page and the **Tours** nav group

### Integrations

- **Microsoft SSO** — Azure AD login with auto-provisioning
- **Outlook Mail** — Send/receive via Microsoft Graph API
- **SMTP Email** — HTML templates for proposals, confirmations, invoices, invites
- **Currency Exchange** — Live rates with caching
- **Supplier Enrichment** — OpenStreetMap + Wikipedia lookup
- **Full-Text Search** — SQLite FTS5 across all entities
- **WebSocket** — Real-time multi-user sync
- **Audit Logging** — All mutations logged with user, action, timestamp

### Admin

- **User Management** — CRUD with invite tokens, 4 permission tiers (admin/manager/agent/accounting)
- **Permission Manager** — Granular custom permissions per user
- **App Settings** — Branding, departments, invoice header, default currency
- **Notifications** — In-app bell with WebSocket push
- **File Uploads** — Documents with MIME validation

### Portal Access

- **Client Portal** — View proposals, trips, invoices
- **B2B Client Quoting** — Curated e-shop catalog (categories, suppliers, photos) with markup-based pricing; clients submit quote requests, staff review/price/approve, accepted quotes convert into reservations
- **Supplier Portal** — View bookings, invoices, ratings

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your settings

# Start development
npm run dev      # Frontend on :5173
npm run server   # Backend on :3001

# Run tests
npm test

# Build for production
npm run build
npm run start    # Serves built frontend + API on :3001
```

## Architecture

```
src/               — React frontend (Vite)
├── api/           — API client SDK
├── components/    — Shared UI components
├── hooks/         — Custom React hooks
├── lib/           — Utility functions
├── pages/         — Route-level page components (58 pages)
└── pages.config.js — Route definitions (with permissions)

server/            — Express.js backend
├── app.js         — Express app setup
├── server.js      — HTTP/HTTPS + WebSocket server
├── db.js          — SQLite setup + migrations
├── routes/        — 13 API route modules
├── services/      — Business logic (auth, entities, email, etc.)
├── middleware/     — Auth, permissions, error handling
├── lib/           — Logger, WebSocket helpers
└── migrations/    — 13 migration files

entities/          — JSON schemas for 25+ entity types
tests/             — Vitest test suite (server-side only)
```

## Permission Tiers

| Tier           | Access                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin**      | Full system control — user management, app settings, branding, integrations, billing; only tier that can delete records                  |
| **Manager**    | Full operations management — create/modify/cancel trips, invoices, suppliers, clients, proposals, services (no delete)                   |
| **Agent**      | Daily ops — create trips/invoices/proposals, view all trips (can't modify/cancel them), edit supplier pricing, handle B2B quote requests |
| **Accounting** | Read-only — view trips & invoices, reports, search, export; no create/modify access                                                      |

Each user's effective permissions are their tier's defaults plus any per-user overrides granted in **Permission Manager** (see `server/permissions.js`). Client and Supplier portal accounts don't use these tiers at all — their access is scoped to their own `client_id`/`linked_supplier_id` via dedicated routes, not the permission engine.

## Environment Variables

| Variable                  | Required | Default | Purpose                     |
| ------------------------- | -------- | ------- | --------------------------- |
| `JWT_SECRET`              | Yes      | —       | JWT signing key             |
| `PORT`                    | No       | 3001    | Server port                 |
| `MICROSOFT_CLIENT_ID`     | No       | —       | Microsoft SSO & Outlook     |
| `MICROSOFT_TENANT_ID`     | No       | —       | Azure AD tenant             |
| `SMTP_HOST / USER / PASS` | No       | —       | Email sending               |
| `APP_URL`                 | No       | —       | Callback URLs, invite links |
| `DATA_DIR`                | No       | ./data  | Database + uploads path     |

## Recent Fixes

### Backend (Audit)

- **API 404s now return JSON** — SPA catch-all skips `/api` routes so unmatched API paths return proper JSON errors
- **WebSocket+SSL fixed** — WebSocket server now attaches to whichever server (HTTP/HTTPS) is actually started
- **Upload directory unified** — Document uploads now save to `data/uploads/` matching the static server path
- **OCR non-blocking** — Replaced synchronous `spawnSync` (60s event loop pause) with async `spawn`
- **SQL filtering in catalog** — `getActiveCatalogItems` uses `json_extract` in SQL instead of loading all rows into memory
- **N+1 queries eliminated** — Quote creation batches pricing/supplier lookups into 2 queries instead of 100+
- **SMTP retry loop fixed** — Failed SMTP verification is now cached to prevent infinite retry on every email send
- **Outlook token retention** — Transient network errors no longer permanently delete Outlook tokens (only 400/401 do)
- **PDF error handling** — Stream errors logged instead of thrown (was causing unhandled promise rejections)
- **OCR maxBuffer restored** — The async `spawn`-based OCR conversion needed its output size cap (10MB/5MB) restored to match the original `spawnSync` behavior
- **Empty catch blocks resolved** — Silent error swallowing in `/api/app-logs` replaced with proper logging
- **JWT_SECRET warning** — Missing secret now logs at `error` level instead of silently generating ephemeral key
- **Admin user list paginated** — Added `LIMIT/OFFSET` parameters to prevent unbounded response growth
- **Seed password not logged** — Initial admin password no longer written to server logs
- **Console.log → logger** — All remaining `console.log/error` calls replaced with structured `logger.*` calls
- **Dead code removed** — Unreachable `rebuildFts()` function removed
- **Non-ASCII filenames preserved** — `sanitizeFilename` now allows accented/Unicode characters (Turkish, Italian, etc.)
- **Email template whitelist** — Added `quote_response` to allowed templates in validation schema

### Frontend (Audit)

- **Console logs removed** — 11 production `console.log/error/warn` calls stripped or replaced
- **React StrictMode enabled** — Uncommented `<React.StrictMode>` wrapper in `main.jsx`
- **Stub code fixed** — `google-auth.js` now properly checks `VITE_GOOGLE_CLIENT_ID` env var
- **Admin note removed** — `PageNotFound.jsx` no longer shows "AI hasn't implemented this page" to admin users
- **Deprecated API fixed** — `keepPreviousData` replaced with inline `placeholderData` function (TanStack Query v5)
- **Logic bug fixed** — `app-params.js` now handles falsy default values (`0`, `""`, `false`) correctly via `!== undefined` check
- **Mixed language cleanup** — Microsoft OAuth callback step strings and error messages unified to English
- **Commented-out code removed** — 12+ lines of dead commented code cleaned across 10 files

### Roadmap cleanup (2026-07-06)

- **Deduplicated `hasFts()`** — moved into `server/db.js`, `search.js`/`entities.js` now import it instead of each defining their own copy
- **Deduplicated `ALLOWED_MIME_TYPES`** — moved into new `server/lib/mimeTypes.js`, shared by `documents.js` and `routes/integrations.js`
- **`getEntityById` duplication was stale** — turned out to only exist once (`server/routes/b2b.js`), nothing to deduplicate
- **Enhanced health check** — `/api/health` now checks DB connectivity, pending migrations, and disk free space, returning `503`/`degraded` if any fail
- **Request correlation IDs** — every request gets a `req.id` (returned as `X-Request-Id`), logged via a per-request child logger, and included as `request_id` in validation/error responses
- **Prettier added** — `.prettierrc.json` + `npm run format`/`format:check` (config only; no repo-wide reformat was run)
- **Pre-commit hooks** — husky + lint-staged now run `eslint --fix` (scoped to the files ESLint already covers) and `prettier --write` on staged files
- **JSDoc pass** — added to exported functions across `server/services/` and `src/lib/` (documentation only — neither directory is covered by `jsconfig.json`'s typecheck)
- **`ARCHITECTURE.md` added** — documents the entity system, permission model, auth, data flow, and real-time sync

### UI polish (2026-07-10)

- **Browser tab favicon added** — `public/favicon.svg` (segmented-ring logo mark) linked via `<link rel="icon">` in `index.html`

### Cleanup + hardening pass (2026-07-07)

**Dead code removed**

- Deleted `ItineraryAgent.jsx` (orphaned AI-chat experiment referencing a `db.agents` API that never existed) and `Invoices.jsx` (superseded by the invoice tab in `Revenue.jsx`)
- Removed the unused `react-markdown` and `three` dependencies, the broken "Test Notifications" button in `TestingArea.jsx` (hit a nonexistent endpoint), and stale scratch files (`bin/tunnel.sh`, `OPTIMIZATION_PROMPT.txt`)

**Security**

- **Document access control** — listing/downloading/deleting a document now verifies the caller can access the entity it's attached to (fixes an IDOR where any authenticated user could fetch any document by id)
- **Email templates escaped** — user-controlled fields (client name, destination, notes) are HTML-escaped before interpolation into email HTML
- **Email casing normalized** — every user write and lookup lowercases/trims, so password login and SSO agree and mixed-case duplicate accounts can't be created
- **Test-user endpoints blocked in production** — `/api/testing/create-test-user*` (fixed-password accounts) return 403 when `NODE_ENV=production`
- **Audit redaction** — password/token/secret fields are stripped before request bodies are written to the audit trail
- **Misc** — `uid()` in stored upload filenames (no same-ms collisions), `encodeURIComponent` on `Content-Disposition` filenames

**Stability**

- **Global crash handlers** — `uncaughtException`/`unhandledRejection` log and exit cleanly so Railway restarts from a known-good state instead of serving corrupt state
- **External-call timeouts** — Microsoft Graph, Nominatim, Wikipedia, and SMTP calls now time out instead of hanging a request indefinitely
- **Report scheduler overlap guard** — skips a tick if the previous email batch is still running
- **WebSocket hardening** — faulty sockets are terminated (and cleaned from the client map); added a server-level error handler

**Performance**

- **gzip compression** enabled on API responses
- **React Query** — `staleTime` (60s) and `gcTime` (10m) set to cut needless refetches and cap long-session memory
- **Bundle** — MUI split into its own Vite chunk; dropping `three` shrank the vendor chunk from ~1.34 MB to ~1.09 MB
- **Dashboard** — filter/sort passes and `getDayEvents` memoized
- **SQL over JS** — `/api/b2b/quotes` scopes by `client_id` in SQL; `/api/suggestions` is bounded with `LIMIT/OFFSET`
- **Entity indexes (migration 013)** — composite `(type, json_extract(...))` indexes on `status`, `due_date`, `proposal_status`, `client_id`, `approval_status` for the report/reminder/B2B hot paths; the migration guards with a `json_valid` check so it can never crash startup on a malformed row

## Improvement Roadmap

### Architecture

- **Shared types package** — Introduce a `shared/` package with Zod schemas consumed by both frontend and backend to eliminate duplication and enforce API contracts
- **Replace JSON blob with typed columns** — The generic `data` JSON field pattern sacrifices type safety and queryability. Migrate to typed columns or adopt an ORM (Knex/Drizzle)
- **API documentation** — Auto-generate OpenAPI/Swagger docs from Zod schemas to formalize the API contract

### Code Quality

- **Standardize module system** — Migrate remaining CJS files (`migrations/*.cjs`) to ESM
- **Import ordering** — Enforce import ordering rules and eliminate barrel files that cause circular dependencies

### Backend

- **Formal transactions** — Wrap multi-step entity operations in database transactions (unit-of-work pattern)
- **Dedicated admin routes** — Move inline admin endpoints (`/api/admin/fix-user`, `/api/admin/fix-trip-agents`) into a proper admin route module
- **Refresh token rotation** — Replace single 24h JWT with short-lived access tokens + rotating refresh tokens
- **Audit auth events** — Log all login/logout/failed-attempt events alongside entity mutations
- **Response shape consistency** — Standardize entity list responses to always return `{ data, total }` instead of mixing plain arrays with paginated objects

### Frontend

- **Break up monolithic pages** — Pages like Dashboard (367 lines), ItineraryBuilder, and others should be decomposed into smaller composable components
- **State machines for complex flows** — Use XState or `useReducer` for multi-step flows (ItineraryBuilder, ProposalBuilder)
- **Accessibility audit** — Add aria labels, keyboard navigation, focus traps across all interactive components
- **Granular code splitting** — Extend the existing lazy loading to route-level and component-level chunks

### Testing (Current coverage: minimal)

- **Unit tests** — Target ~80% coverage on all `server/services/` modules
- **Integration tests** — Test all route handlers via supertest with the isolated test DB
- **Component tests** — Add React Testing Library tests for key UI flows
- **E2E tests** — Cover critical paths: login, entity CRUD, proposal creation workflow
- **Permission system tests** — Exhaustively test the permission engine (most error-prone layer)
- **WebSocket tests** — Test real-time broadcast and connection lifecycle

### DevOps

- **Docker Compose** — Containerize dev environment (DB + app + optional mailhog for email testing); no `Dockerfile` exists in the repo yet
- **Cloud backups** — Automated DB backup to S3/R2

### Documentation

- **Inline comments** — Add explanations for non-obvious logic (e.g., client portal redirect, auth guards)

### Remaining Gaps

- **No payment gateway** — `ClientPayment` entity exists but Stripe/PayPal integration is absent
- **No SMS provider** — SMS endpoint logs locally but sends nothing
- **No LLM/AI features** — `InvokeLLM` and `GenerateImage` are stubbed but unimplemented
- **No calendar sync** — iCal, Google Calendar, Outlook calendar sync absent
- **No mobile app** — Responsive web only
- **OCR requires Python** — `server/ocr_parse.py` is called as a subprocess and is not in the repo
- **Google OAuth** — Environment variables documented but server-side code is not implemented

## Code Review Findings — Next Actions

Reviewed `server/` (auth, permissions, entities, b2b, integrations, app) and `src/lib/`. The codebase is generally solid — all SQL is parameterized, there are prototype-pollution guards, audit logging, Helmet, rate limiting, and email HTML escaping. The security-hardening findings from the last audit are now fixed (verified against current code, 2026-07-10):

- ✅ **Read permissions enforced server-side** — `userCanAccessEntity` (`server/services/entities.js`) now gates agent/accounting reads through `staffCanReadType`; a type is readable wholesale only via its mapped `read` key, a modify permission, or a workflow grant in `STAFF_READ_EXTRA`. `AppSettings` and `OutlookToken` are no longer wide open, and global search filters every hit through the same check.
- ✅ **SSO-provisioned users no longer get a guessable password** — auto-provisioned accounts get an unusable password, and `authenticateLocal` rejects password login for any account with a `microsoft_id`.
- ✅ **Admin endpoints audited** — `/api/admin/*` moved to `server/routes/admin.js`, mounted under `auditMiddleware`.
- ✅ **Permissions re-read from DB per request** — `authMiddleware` re-reads tier/custom_permissions/is_active on every request instead of trusting the JWT, so changes and deactivations apply immediately.
- ✅ **`schemas.entityData` wired in** — applied on the entity POST/PUT routes (`routes/entities.js`), rejecting prohibited keys with a 400 before `sanitizeEntityData`.
- ✅ **CSP tightened** (`server/app.js`) — `scriptSrc` no longer has `unsafe-eval` or `unsafe-inline`; it's `'self'` only now. Verified there are zero inline `<script>` tags anywhere in the built output, and the only `Function(...)` call in the bundled vendor code is an unreachable lodash-style `root` fallback (`self.Object === Object` is always true in a browser, so it never executes). `styleSrc` keeps `unsafe-inline`, which MUI/emotion's runtime style injection genuinely needs — nonces would require converting the static SPA shell into a per-request template, which isn't worth it for a style-only residual risk.
- ✅ **CSRF protection added** — double-submit cookie pattern. `setTokenCookie` (`server/services/auth.js`) now also sets a non-httpOnly `csrf_token` cookie alongside the JWT; `server/middleware/csrf.js` requires every mutating request to echo it back as `X-CSRF-Token`, exempting only the session-establishing endpoints (login/microsoft/accept-invite) and requests authenticated via an explicit `Authorization: Bearer` header. Every frontend fetch wrapper (`api-client.js`, `useApi`, `b2bApi`, and the handful of ad-hoc `fetch()` calls in Profile/AppSettings/NotificationBell/SuggestionsManager/TestingArea/OutlookCallback) now attaches the header. Covered by `tests/middleware/csrf.test.js` and verified against a live server with a real login → cookie → mutation round trip.
- ✅ **In-memory entity queries pushed into SQL where it's safe** — `findEntities` (`server/services/entities.js`) now runs filter/sort/pagination as SQL via `json_extract` (using migration 013's indexes) whenever the caller has unconditional read access to the type — admin, manager, or staff with that type's read permission via `hasUnconditionalReadAccess` — and isn't doing a text `search` (full-text search still needs `entities_fts`, not `json_extract`, so it stays on the JS path). Row-scoped reads (client/supplier portal, user-scoped types, staff without a read grant) are naturally bounded to one client's/supplier's/user's records already, so they're left on the existing JS path rather than translating the full `userCanAccessEntity` branching logic into SQL. Covered by `tests/services/entitiesFindSql.test.js`, including the type-coercion edge cases (JSON booleans come back from `json_extract` as integer 0/1, not text) and a verified-dormant pre-existing quirk (a filter combining `$gte`+`$lte` on one field only ever applies `$gte` — true of the old JS code too, and unused by any current caller).
- ✅ **Permission logic deduplicated, and the server now honors live tier-permission overrides** — `PERMISSION_GROUPS`/`ALL_PERMISSION_KEYS`/`DEFAULT_TIER_PERMISSIONS` moved into `shared/permissions.js`, a single source of truth imported by both `server/permissions.js` and `src/lib/permissions.js` (the frontend adds its own `PERMISSION_MAP` label/description lookup on top). Separately, `server/permissions.js` gained `getEffectiveTierPermissions`, which reads the admin-configurable `AppSettings.tier_permissions` override the same way the frontend's `PermissionContext.jsx` already did — closing a real gap where an admin revoking a permission via that override hid the UI but the backend still allowed the action via direct API access. Covered by `tests/services/permissions.test.js`.
- ✅ **Mixed-language strings — already clean** — re-checked `server/`, `src/` (JS/JSX), `.cjs` migrations, and email templates for stray non-English text; the only accented-character matches left are the language picker's native-language labels (`Français`, `Türkçe`), which is correct. The Outlook/test-email strings this item originally flagged were unified to English in earlier commits (`8632d95`, `560a1a5`) — this note was just stale.

All items from the last code review are now resolved.
