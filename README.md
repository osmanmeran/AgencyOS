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
- **SQL-level entity filtering** — Push `findEntities` filtering/sorting/pagination from JavaScript to SQL for large datasets

### Code Quality

- **Standardize module system** — Migrate remaining CJS files (`migrations/*.cjs`) to ESM
- **Import ordering** — Enforce import ordering rules and eliminate barrel files that cause circular dependencies

### Backend

- **Formal transactions** — Wrap multi-step entity operations in database transactions (unit-of-work pattern)
- **Dedicated admin routes** — Move inline admin endpoints (`/api/admin/fix-user`, `/api/admin/fix-trip-agents`) into a proper admin route module
- **Refresh token rotation** — Replace single 24h JWT with short-lived access tokens + rotating refresh tokens
- **CSRF protection** — Add CSRF tokens for cookie-based auth (currently relies on same-origin only)
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

Reviewed `server/` (auth, permissions, entities, b2b, integrations, app) and `src/lib/`. The codebase is generally solid — all SQL is parameterized, there are prototype-pollution guards, audit logging, Helmet, rate limiting, and email HTML escaping. The items below are the gaps to close, ordered by priority.

### 🔴 HIGH — Enforce read permissions server-side (broken access control)

`server/services/entities.js` → `userCanAccessEntity` (line ~168) returns `true` for **any** `agent` or `accounting` user regardless of the per-type `read` permission declared in `ENTITY_PERMISSION_MAP` (lines ~8-79). The generic REST list/get API (`routes/entities.js` → `findEntities` / `findEntityById`) only calls `userCanAccessEntity` and never the `read` key from the map.

- **Impact:** an `accounting` user (documented as read-only for trips/invoices/reports/search) — and any `agent` — can read **all** entity types via the API directly: `Supplier`, `Client`, `Proposal`, `Service`, `Category`, `TourContract`, `AppSettings`, etc. The read permission model is effectively unenforced; only client/portal scoping and create/update/delete are truly gated. This relies on the frontend hiding UI, which is not a security boundary.
- **Fix:** In `findEntities` / `findEntityById`, also call `requireEntityPermission(user, type, 'read')` (or fold the `read` permission into `userCanAccessEntity`), mirroring how `create`/`update`/`delete` are already gated.

### 🟡 MEDIUM — SSO-created users get a password derived from their Microsoft `oid`

`server/services/auth.js` → `authenticateMicrosoft` (line ~147) sets `bcrypt.hashSync(microsoftId, 10)` as the local password for auto-provisioned SSO users. A Microsoft `oid` is opaque but not secret; anyone who learns it could authenticate locally.

- **Fix:** Store an unusable random password for SSO-provisioned accounts, and consider rejecting local password login when `microsoft_id` is set.

### 🟡 MEDIUM — JWT embeds permissions at login time

`server/middleware/auth.js` → `generateToken` (line ~19) bakes `user_tier` / `custom_permissions` into the token, and `middleware/permissions.js` trusts those claims. Permission/tier changes only take effect on next login (up to 24h).

- **Fix:** Re-read effective permissions from the DB per request for sensitive routes, or shorten token lifetime + add refresh rotation (see roadmap).

### 🟡 MEDIUM — Inline admin endpoints bypass audit logging and rate limiting

`server/app.js` (lines ~167-227): `/api/admin/fix-user`, `/api/admin/fix-trip-agents`, `/api/admin/list-users`, plus `/api/email/test*`, `/api/app-logs` are **not** under `auditMiddleware` (only the mounted routers at lines ~116-127 are), so admin tier changes and user fixes leave no audit trail.

- **Fix:** Move these into a dedicated admin route module mounted with `auditMiddleware` (already noted in the roadmap). Add rate limiting if not covered by the global limiter.

### 🟢 LOW — Helmet CSP allows `unsafe-eval` and `unsafe-inline`

`server/app.js` (line ~48): `scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"]` significantly weakens XSS protection.

- **Fix:** Drop `unsafe-eval` if MUI/Recharts don't require it; move toward nonces instead of `unsafe-inline`.

### 🟢 LOW — `schemas.entityData` is dead code

`server/middleware/validate.js` (line ~238) defines a prohibited-keys schema that is never wired into `routes/entities.js` POST/PUT. Body safety currently relies only on `sanitizeEntityData` (which is sufficient), but the Zod schema's intent is unused.

- **Fix:** Apply `validate(schemas.entityData, 'body')` on entity write routes, or remove the unused schema.

### 🟢 LOW — Quality / consistency notes

- **In-memory entity queries:** `findEntities` loads the full entity table then filters/sorts in JS (`entities.js` lines ~293-304). Acceptable at current scale; push to SQL when data grows (roadmap item).
- **SSO auto-provisioning:** any tenant member is auto-created as `agent` (`auth.js` ~139) — confirm this is intended for a single-org tenant.
- **Mixed-language strings:** `sendOutlookEmail` and the test email endpoints still contain Italian (`"non connesso"`, `"Funziona correttamente"`) — finish the English-unification pass.
- **Confirm document upload limits:** global `express.json({ limit: '10mb' })` is fine; verify `routes/documents.js` enforces its own multer size limit.

### Suggested execution order

1. HIGH — server-side read-permission enforcement.
2. MEDIUM — audit-log the inline admin endpoints.
3. MEDIUM — unusable SSO passwords + per-request permission refresh.
4. LOW — tighten CSP, wire/remove `entityData` schema, clean up i18n.
