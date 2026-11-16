# Marvelops TravelPro

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](package.json)
[![React](https://img.shields.io/badge/React-18-blue.svg)](package.json)
[![Vite](https://img.shields.io/badge/Vite-6-purple.svg)](package.json)

A full-stack, multi-tenant travel agency operations management & ERP platform for tour operators and travel agents.

## Tech Stack

- **Frontend:** React 18, Vite 6, MUI 9, Radix UI (shadcn-style), Tailwind CSS, Framer Motion, Recharts
- **Backend:** Express.js, WebSockets, SQLite (better-sqlite3 with FTS5), JWT auth, Microsoft SSO
- **Infrastructure:** Railway (deploy on push to `main`), GitHub Actions CI (lint, typecheck, test, build)

## Features

### Core Operations

- **Dashboard** — Upcoming arrivals/departures, trip calendar, pending tasks, quick actions
- **Trips / Reservations** — Full CRUD with pagination, search, bulk actions, status workflow
- **Clients** — Table view + Kanban CRM pipeline (lead → contacted → proposal → negotiation → won/lost). Each contact is linked to a **Company** via a searchable picker that creates the company inline if it doesn't exist yet; the linked Company scopes what the contact sees in the Client Portal.
- **Suppliers** — CRUD with categories/subcategories, pricing tiers, ratings
- **Calendar** — Monthly view of trip arrivals and departures

### Sales & Finance

- **Proposals** — Create, track status (delivered/changed/approved/rejected), change history
- **Invoices** — CRUD with line items, status tracking (draft/sent/paid/overdue/cancelled)
- **Revenue Reports** — Charts and breakdowns
- **Commission Reports** — Profit/commission calculation from trip data
- **Client Payments** — Manual payment recording, plus real online payments via bring-your-own-key Stripe (no platform Stripe account, no Connect approval process — each workspace pastes its own secret key in Settings → Integrations). Clients pay an invoice's remaining balance from the Client Portal ("Pay Now"), and staff can generate the same Stripe Checkout link to send outside the portal. Each workspace's own webhook confirms payment and updates the invoice/`ClientPayment`/client totals atomically — funds settle directly into the agency's own Stripe account, there's no platform account for money to pass through

### Advanced Tools

- **Itinerary Builder** — Day-by-day editor with drag-and-drop, category detection
- **Tour Contracts** — Recurring serial contracts with pricing tiers, Utravel import
- **RFP Manager** — Request for Proposal wizard, supplier quoting
- **Task Board** — One Kanban inbox (route `/TaskBoard`) over the single `Task` entity: hand-created tasks/reminders/notes _and_ the auto-generated booking tasks below, with a pending / in-progress / done workflow, drag-and-drop status changes, an edit dialog, an assignee picker (staff users), and a "My tasks" filter. Cards show live SLA state (Auto / Escalated / Overdue badges) and open tasks sort by due date; auto-generated cards link to their booking. The Done column loads a recent page rather than the workspace's whole task history. Due **reminders** surface as global toasts (polled every 5 min), and a **My Tasks** widget appears on the Dashboard. Each client's manual tasks are also reachable from the **Tasks** panel on the CRM client page.
- **Contextual Task Management** — The same `Task` entity, booking-linked and SLA-aware. Saving a **Trip** auto-generates operational tasks from the workspace's task templates (nine by default, from _Collect Deposit_ at +3d after booking through _Post-Trip Follow-Up_ at +2d after return; admins edit them in **Settings → Task Templates**), each keyed off a trip date, linked via `booking_id`/`customer_id`, and pre-assigned to the booking's creator. Changing a Trip's dates reschedules them automatically. Tasks carry `priority` (low→critical), user/team assignment, and an SLA `escalation_trigger_time` that drives a live `is_escalated` / `is_due_soon` (within 24h) flag for the booking-detail priority banner; escalations notify the assignee and their manager. Managed via `POST/GET /api/tasks` and `PUT /api/tasks/:id/complete` (audit-logged). See **FAQ → Contextual Tasks**.
- **Import Hub** — Outlook contacts, bulk supplier CSV, AI price analyzer

### Guided Tours

- **Daily Tours** — Single-day experiences with language, location, starting time, visited museums & sights, meal treatment, transportation flag, and per-participant pricing tiers
- **Multi-Day Tours** — Extended tours adding starting/finishing city, per-night lodging, and hotel meal treatment
- **Occupancy** — Minimum and maximum occupancy enforced per tour
- **Private or Regular** — Daily tours can be private or regular (other passengers grouped into the same departure)
- **Pricing Tiers** — Per-participant pricing bands (min/max participants → price)
- **Supplier Link** — Each tour is associated with a supplier (tour operator)
- **Descriptions & Cover Photos** — Every tour has a public description and a cover photo; descriptions are stored per language (en/it/tr/es/fr/de) and shown in the visitor's language in the client portal. Multi-day tours also build a day-by-day itinerary (auto-generated from the number of days) with a description and cover photo per day
- **Multi-Day Scheduling** — Compulsory departure date + general availability per departure; optional weekly repeat with a start/end repetition window (generates weekly departures)
- **Bookings & Remaining Availability** — Staff can record bookings per departure; the staff tour list shows remaining availability (availability − booked) for every departure
- **Featured Tours** — Staff flag any tour as _Featured_ from the tours page (star toggle or the edit form). Featured tours are highlighted in the client portal's Featured Tours section
- **Special Offers** — Staff set a time-limited percentage discount (valid-from / valid-until dates) per tour. While active, the client portal shows the original price, the discounted price, and the discount percentage as a special offer
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
- **Self-Service Password Reset** — `/forgot-password` + `/reset-password`, scoped to the current workspace, 1-hour token expiry, resets every other active session on completion. Responds identically whether or not the email is registered (no enumeration), and mints no token for Microsoft-SSO-linked accounts (they have no local password to reset)
- **Permission Manager** — Granular custom permissions per user
- **App Settings** — Branding, departments, invoice header, default currency
- **Setup Guide** — A dismissible checklist (`/SetupWizard`, admin-only) for finishing a new workspace: branding, invoice details, Stripe payments, Outlook email, and inviting the team, each showing live completion status with a link into the real settings section. A Dashboard banner nudges toward it until it's dismissed or every step is done.
- **Getting Started** — A staff-facing guide (`/GettingStarted`) covering the core day-to-day workflows (suppliers & pricing, clients, trips, proposals, invoices, tours, tasks, search), each section linking straight into the real page.
- **Notifications** — In-app bell with WebSocket push
- **File Uploads** — Documents with MIME validation

### Portal Access

- **Client Portal** — Clients log in to view proposals, trips, invoices, payment history, and browse the tour catalog. Staff provision access per client directly from the CRM (grant / revoke): granting auto-creates a `client`-tier login with an admin-set temporary password and auto-creates/links the client's **Company**, while revoking disables the account. The portal header is branded with the agency's invoice logo.
- **Tour Catalog Search** — Clients browse the tour catalog from two pills (**Daily Tours** / **Multi-Day Tours**), filter by travel date and a destination dropdown of all available destinations, and see cover photos, descriptions, and day-by-day itineraries. Featured tours are highlighted in a dedicated section, and active special offers show original/discounted prices with the discount percentage. Tours are readable by all authenticated portal users (writes remain staff-only)
- **B2B Client Quoting** — Curated e-shop catalog (categories, suppliers, photos) with markup-based pricing; clients submit quote requests, staff review/price/approve, accepted quotes convert into reservations
- **Supplier Portal** — View bookings, invoices, ratings

### Multi-Tenant SaaS / Workspaces

Marvelops is multi-tenant: every travel agency runs in its own isolated **workspace**, backed by its own SQLite database file (not a shared table with a `tenant_id` column — see `SAAS_PROJECT.md` for why). Full phase-by-phase implementation log lives in `SAAS_PROJECT.md`; summary below.

- **Tenant isolation** — Each workspace's data (`entities`, `users`, `audit_logs`, `documents`, uploads, generated PDFs, OCR scratch files) lives under `data/tenants/<id>/`, resolved per-request; there is no cross-tenant table. A central `data/platform.db` holds the `tenants` registry (slug, name, status, Azure tenant id, trial deadline).
- **Workspace routing** — Two modes, chosen automatically: **subdomain routing** (`<agency>.marvelops.app`, requires `APP_ROOT_DOMAIN` + wildcard DNS/TLS) resolves the tenant from the `Host` header; **single-domain (cookie) mode** (default when no root domain is configured, e.g. a bare Railway `*.up.railway.app` URL) resolves it from an `active_tenant` cookie set at login/signup, so subdomain-less hosts can still serve multiple workspaces. A token whose tenant doesn't match the resolved workspace is rejected (`TENANT_MISMATCH`).
- **Self-serve signup** — `POST /api/tenants/signup` (gated by `ALLOW_PUBLIC_SIGNUP`) creates a new workspace from an agency name + unique slug + admin email/password, or via "Sign up with Microsoft" (the new workspace's Azure AD tenant is derived from the id token). New workspaces start in `trial` status with a `TRIAL_DAYS`-day deadline.
- **Per-workspace Microsoft SSO** — Each workspace can set its own Azure AD tenant id from **Workspace Settings** (admin only), scoping SSO login to that org instead of a single global `MICROSOFT_TENANT_ID`.
- **Workspace lifecycle** — `trial → active → suspended`, enforced on every `/api` request (`WORKSPACE_SUSPENDED` / `TRIAL_EXPIRED`, with auth/health/tenant endpoints allowlisted so a blocked workspace can still sign in and see its own status). Users see a status banner when suspended or within 7 days of trial expiry.
- **Platform admin dashboard** (`src/pages/PlatformAdmin.jsx`, gated by `PLATFORM_ADMIN_EMAILS`) — cross-tenant workspace list with user/entity counts, suspend/reactivate/mark-paid/extend-trial, rename, and a deliberately guarded delete (primary workspace exempt, must already be suspended, exact slug confirmation, final snapshot taken before removal).
- **Off-box backups & restore** — Nightly snapshots (and uploaded files) are optionally mirrored to S3-compatible storage (`server/services/offsiteBackup.js`, opt-in via `BACKUP_S3_BUCKET`). `scripts/backup-cli.mjs` is workspace-aware (`--tenant <slug|id>`, `--from-offsite`) and integrity-checks a snapshot before ever overwriting a live database. Every backup pass is recorded and failures email an operator; the platform dashboard surfaces backup health, including a scheduler that died silently.
- **Fleet-resilient migrations** — `npm run db:migrate:bootstrap` runs migrations across every tenant DB with per-tenant error isolation (one bad database doesn't abort the run); `npm run db:migrate:fleet:status` reports pending/unreadable tenants read-only, without applying anything.

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
├── db.js          — SQLite setup + per-tenant DB resolution/migrations
├── routes/        — 18 API route modules (incl. tenants, platform, uploads)
├── services/      — Business logic (auth, entities, email, tenants, offsiteBackup, etc.)
├── middleware/     — Auth, permissions, tenant resolution/status, error handling
├── lib/           — Logger, WebSocket helpers
└── migrations/    — 23 tenant-DB migration files, + migrations/platform/ (3 files, for platform.db)

data/
├── marvelops.db            — legacy/tenant-zero DB (pre-multi-tenant deployments)
├── platform.db             — tenant registry (slug, name, status, trial deadline, Azure tenant id)
└── tenants/<id>/            — per-workspace DB + uploads/pdfs/ocr_uploads, one dir per tenant

entities/          — JSON schemas for 30+ entity types
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

| Variable                                                                          | Required | Default                               | Purpose                                                                                    |
| --------------------------------------------------------------------------------- | -------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `JWT_SECRET`                                                                      | Yes      | —                                     | JWT signing key                                                                            |
| `PORT`                                                                            | No       | 3001                                  | Server port                                                                                |
| `MICROSOFT_CLIENT_ID`                                                             | No       | —                                     | Microsoft SSO & Outlook                                                                    |
| `MICROSOFT_TENANT_ID`                                                             | No       | —                                     | Azure AD tenant                                                                            |
| `SMTP_HOST / USER / PASS`                                                         | No       | —                                     | Email sending                                                                              |
| `APP_URL`                                                                         | No       | —                                     | Callback URLs, invite links (fallback when no tenant/root domain resolves)                 |
| `DATA_DIR`                                                                        | No       | ./data                                | Database + uploads path                                                                    |
| `APP_ROOT_DOMAIN`                                                                 | No       | —                                     | Enables subdomain workspace routing (`<slug>.<domain>`); unset ⇒ single-domain cookie mode |
| `ALLOW_PUBLIC_SIGNUP`                                                             | No       | false                                 | Enables self-serve workspace signup (`/api/tenants/signup`)                                |
| `TRIAL_DAYS`                                                                      | No       | 14                                    | Trial length for new self-serve workspaces                                                 |
| `PLATFORM_ADMIN_EMAILS`                                                           | No       | —                                     | Comma-separated emails granted the platform admin dashboard                                |
| `BACKUP_S3_BUCKET`                                                                | No       | —                                     | Enables off-box (S3/R2) backups; unset ⇒ every off-box entry point is a no-op              |
| `BACKUP_S3_ACCESS_KEY_ID` / `BACKUP_S3_SECRET_ACCESS_KEY`                         | No       | —                                     | Off-box backup credentials                                                                 |
| `BACKUP_S3_REGION` / `BACKUP_S3_ENDPOINT` / `BACKUP_S3_PREFIX` / `BACKUP_S3_KEEP` | No       | `auto` / — / — / 30                   | Off-box backup config (endpoint required for R2/MinIO)                                     |
| `BACKUP_ALERT_EMAIL`                                                              | No       | falls back to `PLATFORM_ADMIN_EMAILS` | Who gets emailed when a backup pass fails                                                  |

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

### Features & UX (2026-07-13)

- **Multi-currency support** — shared currency module (`src/lib/currencies.js`); the `ClientDetails` currency dropdown is fixed and now driven by an admin-configurable `supported_currencies` list in App Settings.
- **Automatic exchange rates** — a daily scheduler fetches live rates (stored via migration `018_exchange_rates`); rates are viewable/refreshable from Integrations (admin only).
- **Featured Tours carousel** — the client-portal Featured Tours section is now a swipeable embla carousel and hides while a tour search is active.
- **Car-rental drop-off surcharge** — the search now lists every car type (not just the cheapest per supplier); an underlined different-dropoff surcharge is shown and folded into the total.
- **Hotel catalog** — 47 hotels with approved pricing were imported from a supplier rate sheet into production, and star ratings were populated from the sheet.

### Features & UX (2026-07-14)

- **Contextual Task Management** — new `Task` entity type (migration `020_add_task_entity_indexes.js`) backing a booking-linked, SLA-aware to-do system. Generating/saving a **Trip** auto-creates three operational tasks keyed to its departure date; editing the departure date reschedules them. The engine lives in `server/services/tasks.js` (`generateTasksForBooking`, `rescheduleTasksForBooking`, `completeTask`, `listTasks`) and is wired into Trip create/update in `routes/entities.js` (best-effort, never fails the booking request). `listTasks` returns live `is_overdue` / `is_due_soon` / `is_escalated` flags. Exposed via `POST/GET /api/tasks` and `PUT /api/tasks/:id/complete` (audit-logged). Permissions reuse the trip workflow family (`create_trips` / `view_all_trips` / `modify_trips` / `delete_trips`). See the "Contextual Task Management" bullet under Advanced Tools and **FAQ → Contextual Tasks**.

### Multi-Tenant SaaS conversion (2026-07-20 → 2026-07-30)

Converted Marvelops from a single-tenant internal tool into a multi-tenant SaaS product, in 10 phases — full rationale and rehearsal notes in `SAAS_PROJECT.md`. See the **Multi-Tenant SaaS / Workspaces** feature section above for the user-facing summary; highlights by phase:

- **Phase 1-2 — Data layer & auth** — one SQLite file per tenant under `data/tenants/<id>/`, a central `platform.db` tenant registry, subdomain-based (`Host` header) tenant resolution, `tenant_id` added to the JWT, WebSocket broadcasts scoped per tenant via `AsyncLocalStorage`.
- **Phase 3 — Self-serve signup** — public `POST /api/tenants/signup` (email/password or Microsoft SSO), gated by `ALLOW_PUBLIC_SIGNUP`, with live slug-availability checking.
- **Phase 4 — Workspace control plane** — `GET/PATCH /api/tenants/me` + `WorkspaceSettings.jsx` so an admin can rename their workspace and set its own Azure AD tenant without touching server env vars.
- **Phase 5 — Platform admin dashboard** — `PlatformAdmin.jsx`, cross-tenant workspace list + stats, gated by `PLATFORM_ADMIN_EMAILS`.
- **Phase 6 — Ops enablement** — DNS/TLS runbook (Cloudflare wildcard cert recommended), `scripts/adopt-tenant-zero.mjs` to migrate the pre-existing production DB into the new layout as tenant zero.
- **Phase 7 — File isolation & lifecycle enforcement** — uploads/PDFs/OCR scratch files moved off the shared, unauthenticated `express.static` mount onto per-tenant, permission-checked routes; `trial`/`suspended` status now actually enforced on every request, with a `WorkspaceStatusBanner` and platform-admin suspend/reactivate/extend-trial controls.
- **Phase 8 — Off-box backups + workspace admin** — nightly snapshots and uploaded files optionally mirrored to S3/R2 (`BACKUP_S3_BUCKET`); workspace rename/delete added to the platform console with guardrails (primary workspace exempt, must be suspended first, exact slug confirmation, pre-delete snapshot).
- **Phase 9 — Restore + backup monitoring** — `scripts/backup-cli.mjs` is workspace-aware and can pull a snapshot back from off-box storage (`--from-offsite`), integrity-checking it before overwriting anything; every backup pass is now recorded, failures email an operator, and the dashboard flags a scheduler that died silently.
- **Phase 10 — Invite links & fleet migrations** — invite/notification emails now link to the issuing workspace's own subdomain instead of a global `APP_URL`; `db:migrate:bootstrap` isolates each tenant's migration run so one bad database can't abort the whole fleet, with a new read-only `db:migrate:fleet:status` preview.
- **Single-domain (cookie) mode** — added alongside these phases for hosts that can't do wildcard subdomains (e.g. a bare Railway URL): an `active_tenant` cookie selects the workspace instead of the `Host` header, so multi-tenant SaaS works even without `APP_ROOT_DOMAIN`/wildcard DNS configured.

Still missing (tracked in `SAAS_PROJECT.md`): billing/plan gating (Stripe), signup email verification, self-serve data export/account closure.

## Improvement Roadmap

### Architecture

- **Shared types package** — Introduce a `shared/` package with Zod schemas consumed by both frontend and backend to eliminate duplication and enforce API contracts
- **Replace JSON blob with typed columns** — The generic `data` JSON field pattern sacrifices type safety and queryability. Migrate to typed columns or adopt an ORM (Knex/Drizzle)
- **API documentation** — Auto-generate OpenAPI/Swagger docs from Zod schemas to formalize the API contract

### Code Quality

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

## Open Source & License

Marvelops TravelPro is free and open-source software licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).

- **Contributing**: Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, architectural guidelines, and pull request procedures.
- **Security**: For responsible disclosure of security vulnerabilities, please refer to [SECURITY.md](SECURITY.md).
