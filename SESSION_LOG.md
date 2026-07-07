# Session log — Client portal / B2B quoting

_Last updated: 2026-07-07. All work below is committed and pushed to `main` (auto-deploys on Railway). Working tree clean._

_Branch housekeeping (2026-07-04): analyzed the two stale remote branches and deleted both — `claude/github-connection-b8nlcx` (OAuth/SSO, already a direct ancestor of `main`) and `claude/app-review-suggestions-mh01ks` (reporting/backups/notifications, all features already in `main` via `178c015`). Recorded tips if ever needed: `3e170ba` / `c76b459`. `origin/main` is now the only remote branch._

## What we shipped this session (in order)

| Commit    | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `b694e84` | **Client portal home → travel shop.** Storefront on the Home page: categories + curated suppliers (new `Supplier.show_in_portal` flag, toggled in SupplierDetails). Category → supplier → services navigation. New `ClientSupplier` page. Shared cart (`src/lib/b2bCart.jsx`, localStorage). Also fixed a floating-point markup-rounding bug (unified into `applyMarkup` / `roundSellPrice`, test in `tests/services/pricing.test.js`).                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `481e59f` | **Reservation-style quote builder.** New `src/pages/ClientQuoteBuilder.jsx` (nav "Request a Quote" points here; "Dashboard" renamed "Home"). No cost/margin shown. Prices in the client's `preferred_currency`, auto-converted at live FX rate and frozen on submit. Client enters trip details, passengers/rooming, picks suppliers + catalog services, rooming nights, transfer details. Staff set `preferred_currency` + `default_markup` in the ClientDetails edit modal.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `73075cf` | **Rich quote detail display.** `src/components/b2b/QuoteRichDetails.jsx` shows destination/dates/passengers-by-room + per-line nights/transfer/details, wired into `ClientQuoteDetails` (client) and `QuoteRequests` (staff). All quote amounts now use `formatCurrency(amount, quote.currency)` instead of a hardcoded `$`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `9fb910b` | **Staff notification on new quote.** `POST /api/b2b/quote` notifies every active staff user with `manage_quote_requests` (in-app + WebSocket + opt-in email), type `quote_request`, links to `/QuoteRequests`. NotificationBell got the icon + general click-to-navigate (marks read, goes to `data.url`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `0e5f8a2` | **Staff can view the portal as a specific client (read-only).** New "View portal as client" button on any CRM client record (`ClientDetails`). Staff (who have no `client_id`) browse that client's real home/shop/proposals/trips/invoices/quotes with the correct per-client markup + currency. Backed by `src/lib/actAsClient.js` (sessionStorage store + reactive hook); `useMyClient`, `ClientPortal` and the b2b pages honor the override and key queries by client id; `b2bApi` forwards `?clientId=`. Backend: new `resolveReadClientContext(req)` in `b2b.js` lets **staff tiers** pass `?clientId=` on **read** routes only — write routes still reject staff, so the view is strictly read-only (quote builder also hidden from nav while impersonating). Amber banner + "Back to Admin"/"Exit" to leave. Replaced the old empty "Client Portal (Preview)" staff nav link. |

Every change was verified with an end-to-end backend smoke test (seed → API → assert → cleanup) plus the full vitest suite (150 green) and a clean `vite build`. **Not** browser-tested by me — Microsoft SSO blocks Claude's preview browser; Osman tested in an incognito window with the `osman@test.com` client account and confirmed it all works.

## How to test / operate (reminder)

- Prod = Railway, auto-deploys on push to `main`. Real DB reachable via `railway ssh`.
- Local: `npm run server` (port 3001) + `npm run dev` (5173). Log in via `/mock-login` (email+password) since SSO can't be used locally.
- For a client to see the shop/builder: as admin, set the client's **Portal Currency** + **Default Markup %** (ClientDetails → Edit) and **publish suppliers** (SupplierDetails → "Show in client portal"; the supplier needs ≥1 _approved_ price).
- Test client account: `osman@test.com` (tier `client`, linked to client "Osman Meran"). It has **no password and no SSO identity** — Osman logs in via incognito/SSO. If email+password login is ever needed for it, a password must be set.

## Open follow-ups / next steps (not started)

1. **Extend the quote builder to the remaining service types** — currently v1 = lodging (nights) + transfers + generic services. Add guides, restaurants, transportation, guided tours, extra activities with their specific detail fields (mirror the staff `ServiceLineEditor` / `SERVICE_TYPES` in `CreateReservation.jsx`). _This is the agreed next task._
2. Staff email on new quote only reaches members who enabled "email notifications" in their profile — worth confirming the intended staff have it on.
3. `default_markup` UI now exists only in ClientDetails edit modal (added this session); the near-duplicate client form in `AppSettings.jsx`/`UserManagement.jsx` flows may still lack it — check if needed.
4. **Staff "view as client" is read-only by design** (`0e5f8a2`). If staff should ever be able to _submit_ a quote on a client's behalf, relax `requireClientContext` on the b2b write routes (`POST /quote`) to accept a staff-supplied `clientId`, and un-hide the quote builder in the client nav.
5. Older/unrelated suggested feature: per-contract utilization view (booked vs open departure dates) — separate track, see memory `project_next_feature_contract_utilization`.

## Key files touched

- Backend: `server/routes/b2b.js` (storefront, supplier detail, currency conversion, rich quote submit, staff notify), `server/middleware/validate.js` (b2bSubmitQuote schema), `entities/Client`, `entities/QuoteRequest`, `entities/Supplier`.
- Frontend: `src/pages/ClientPortal.jsx`, `ClientSupplier.jsx`, `ClientQuoteBuilder.jsx`, `ClientCatalog.jsx`, `ClientQuoteDetails.jsx`, `ClientQuotes.jsx`, `QuoteRequests.jsx`, `SupplierDetails.jsx`, `ClientDetails.jsx`; `src/lib/{b2bApi,b2bCart,pricing,actAsClient}.js`; `src/hooks/useMyClient.js`; `src/components/b2b/{ServiceCard,QuoteCart,QuoteRichDetails}.jsx`; `src/components/layout/NotificationBell.jsx`; `src/Layout.jsx`, `src/App.jsx`, `src/pages.config.js`.
- Staff "view as client" (`0e5f8a2`): `src/lib/actAsClient.js` (new store), `src/hooks/useMyClient.js`, `src/lib/b2bApi.js`, `src/pages/{ClientPortal,ClientDetails,ClientQuotes,ClientCatalog,ClientSupplier}.jsx`, `src/Layout.jsx`, `server/routes/b2b.js`.

_Full detail is also in Claude's persistent memory: `project_b2b_client_quoting.md`._

---

# Session log — Code audit & fixes (2026-07-06)

_Focus: Frontend + backend audit, fixing ~90 issues across both tiers._

## Frontend fixes

### Console logs removed (11 locations)

- `src/lib/microsoft-auth.js` — debug `console.log` leaking auth state
- `src/lib/AuthContext.jsx` — `console.error` in auth check (error already handled)
- `src/lib/ErrorBoundary.jsx` — `console.error` in componentDidCatch
- `src/pages/MicrosoftCallback.jsx` — `console.error` on login failure
- `src/pages/OutlookCallback.jsx` — `console.error` on connection failure
- `src/pages/SupplierPortal.jsx` — `console.error` on supplier load
- `src/pages/AuditLogViewer.jsx` — `console.error` in catch block
- `src/components/pdf/PdfDownloadButton.jsx` — `console.error` on PDF failure
- `src/components/services/ServiceLineEditor.jsx` — `console.error` on conversion error
- `src/lib/VisualEditAgent.jsx` — 2x `console.warn` for invalid messages

### Stub / placeholder code

- `src/lib/google-auth.js` — `isGoogleSsoConfigured()` now checks `VITE_GOOGLE_CLIENT_ID` env var instead of always returning `false`
- `src/lib/PageNotFound.jsx` — Removed admin-facing note "This could mean that the AI hasn't implemented this page yet"

### Mixed languages (Italian → English)

- `src/pages/MicrosoftCallback.jsx` — Step strings unified to English ("Verifying authorization code...", "Exchanging code...", etc.)
- `src/pages/MockLogin.jsx` — Error fallback changed from "Login Microsoft fallito" to "Login failed"

### Dead code

- `src/api/entities.js`, `src/api/integrations.js`, `src/api/marvelopsClient.js` — Unused exports identified (kept to avoid breaking unknown references)

### Logic bug

- `src/lib/app-params.js:32` — Changed `if (defaultValue)` to `if (defaultValue !== undefined)` to handle falsy defaults (`0`, `""`, `false`)

### Deprecated API

- `src/hooks/usePaginatedEntities.js` — Replaced `keepPreviousData` import with inline `placeholderData: (previousData) => previousData` (TanStack Query v5+)

### React StrictMode

- `src/main.jsx` — Uncommented `<React.StrictMode>` wrapper

### Commented-out code removed

- 12+ lines across 10 files: `SupplierDetails.jsx`, `ProposalDetails.jsx`, `SupplierBookingDetails.jsx`, `Suppliers.jsx`, `ClientItinerary.jsx`, `ReservationDetails.jsx` (2x), `UserManagement.jsx` (2x), `ProposalBuilder.jsx` (2x), `SupplierBookings.jsx`, `ServiceLibrary.jsx`, `ClientPortal.jsx` (2x), `AuditLogViewer.jsx`

---

## Backend fixes

### Critical

| File                                                         | Issue                                                                                           | Fix                                                                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `server/app.js:217-221`                                      | API 404s returned SPA HTML in production                                                        | Catch-all now checks `req.path.startsWith('/api')` and calls `next()` to reach `notFoundHandler` for JSON error response   |
| `server/server.js:20-58`                                     | WebSockets dead when SSL enabled (`wss` attached to unstarted HTTP server)                      | `wss` now created after the server variable is assigned — attaches to whichever server (HTTP or HTTPS) is actually started |
| `server/services/documents.js:10` + `routes/documents.js:10` | Upload dir `server/uploads/` mismatched static server `data/uploads/` — documents unreachable   | Changed both to `data/uploads/` using same `DATA_DIR` logic as `app.js`                                                    |
| `server/routes/ocr.js:62-66`                                 | `spawnSync` blocking event loop for 60s                                                         | Replaced with async `spawn` + Promise wrapper; same for `/ocr/parse-text`                                                  |
| `server/routes/b2b.js:161-199`                               | `getActiveCatalogItems` loaded ALL suppliers/categories/pricing into memory then filtered in JS | Added `json_extract` WHERE clauses to filter `is_active` + `approval_status` at SQL level                                  |
| `server/routes/b2b.js:222-252`                               | N+1 queries: each quote item called `getEntityById` individually (100+ DB queries for 50 items) | Batch-loads all pricing + supplier entities with a single `IN (...)` query each                                            |

### High

| File                                      | Issue                                                                                      | Fix                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `server/app.js:6,86`                      | `ipKeyGenerator(req.ip)` passes string instead of `req` object                             | Removed `ipKeyGenerator` import, use `req.ip` directly                             |
| `server/app.js:205`                       | Empty `catch (e) {}` swallows all DB errors                                                | Added `logger.error` with context                                                  |
| `server/seed.js:23`                       | Admin password logged in plaintext                                                         | Removed `password` from `logger.warn` call                                         |
| `server/middleware/auth.js:7-12`          | Ephemeral JWT secret on restart invalidates all tokens                                     | Logs `logger.error` instead of silently generating; maintains fallback for startup |
| `server/services/email.js:36-41`          | Infinite retry loop on SMTP failure — `transporter` set to `null`, recreated on every send | Added `smtpFailed` flag to cache failure state                                     |
| `server/services/integrations.js:137-139` | Transient network errors permanently delete Outlook token                                  | 400/401 deletes token; other errors preserve it (retry-safe)                       |
| `server/services/pdf.js:28`               | `throw` inside stream event handler = unhandled promise rejection                          | Changed to `logger.error`                                                          |
| `server/app.js:115-119`                   | Admin user list returns all users unbounded                                                | Added `LIMIT/OFFSET` pagination + total count                                      |

### Medium

| File                                | Issue                                                                           | Fix                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `server/middleware/validate.js:170` | Email template whitelist missing `quote_response`                               | Added to `z.enum()`                                      |
| `server/lib/sanitizeFilename.js`    | Strips all non-ASCII chars (breaks Turkish/Italian)                             | Changed regex to preserve `\u00C0-\u024F` accented range |
| `server/db.js`                      | `console.log/error` instead of structured logger                                | Replaced with `logger.info/warn`                         |
| `server/db.js`                      | Dead `rebuildFts()` function (defined but never exported/called)                | Removed                                                  |
| `server/services/audit.js:61`       | Entity type derived heuristically from URL (produces `'b2b'`, `'integrations'`) | Prefers `req.params.type` when available                 |
| `server/routes/b2b.js:291-301`      | `/api/b2b/quotes` sorts in JS after loading all rows                            | Moved ORDER BY to SQL                                    |

---

## Summary

| Category                                                       | Fixed                                |
| -------------------------------------------------------------- | ------------------------------------ |
| Console logs removed                                           | 11 frontend + 3 backend              |
| Stub/placeholder code                                          | 2 files                              |
| Mixed languages                                                | 2 files                              |
| Logic bugs                                                     | 1 frontend + 1 backend               |
| Dead code removed                                              | 4 files examined, rebuildFts removed |
| Commented-out code                                             | 12+ lines across 10 files            |
| Security (password logging, empty catches, ephemeral secrets)  | 3 fixes                              |
| Performance (N+1, sync blocking, in-memory filtering)          | 4 fixes                              |
| Bug fixes (WebSocket+SSL, upload dir, SMTP loop, rate limiter) | 6 fixes                              |
| Deprecated API                                                 | 1 fix                                |
| **Total**                                                      | **~40+ individual fixes**            |

---

# Session log — Cleanup + security/stability/perf hardening (2026-07-07)

_All work below is committed and pushed to `main` (auto-deploys on Railway). Verified on prod via `railway ssh`. Working tree clean._

_Method: three read-only audit sub-agents (security, stability, performance) produced findings; each was fact-checked against the source before acting. Several agent claims were rejected as false positives — e.g. agent/accounting "unrestricted read" is intentional per the documented permission tiers, and the b2b quote-approve "race condition" isn't real because better-sqlite3 is synchronous with no `await` between read and write._

## What we shipped this session (in order)

| Commit    | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `a3a2e6e` | **Dead-code cleanup.** Removed `ItineraryAgent.jsx` (orphaned AI-chat experiment importing a `db.agents` API that never existed) and `Invoices.jsx` (superseded by the invoice tab in `Revenue.jsx`); dropped unused `react-markdown` dep, the broken "Test Notifications" button in `TestingArea.jsx` (called a nonexistent endpoint), and stale files `bin/tunnel.sh` + `OPTIMIZATION_PROMPT.txt`.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `ec8dbc1` | **Security/stability/performance hardening.** Security: document-access IDOR fix (`documents.js` — access derived from the attached entity), email-template HTML escaping, email case-normalization (login + SSO now agree, no mixed-case dupes), prod-blocked test-user endpoints, audit-log redaction, upload-filename collision fix, `Content-Disposition` encoding. Stability: global `uncaughtException`/`unhandledRejection` handlers, timeouts on Graph/Nominatim/Wikipedia/SMTP calls, report-scheduler overlap guard, WebSocket socket-terminate + server error handler. Performance: gzip compression, React Query `staleTime`/`gcTime`, MUI split into its own Vite chunk + dropped `three` (vendor 1.34MB→1.09MB), Dashboard memoization, SQL-level b2b/quotes scoping, suggestions pagination. |
| `094d7e8` | **Entity JSON indexes (migration 013).** Composite `(type, json_extract(...))` indexes on `status`, `due_date`, `proposal_status`, `client_id`, `approval_status` — matching the SQL hot paths in `reports.js` / `reminders.js` / `b2b.js`. Chosen by tracing every SQL `json_extract` filter and confirming via `EXPLAIN QUERY PLAN` that the planner seeks each (the dues index also removes the `ORDER BY` sort). The migration guards with a `json_valid` count check and **skips rather than throws** if any row is malformed, so a bad row can never crash startup while building the functional index.                                                                                                                                                                                               |

Verified each step with lint (baseline), typecheck (baseline), `vite build`, and the full vitest suite (**176 green**, incl. new document-access, email-normalization, and migration-planner tests). **Not** browser-tested — Microsoft SSO blocks Claude's preview browser. Prod verified via `railway ssh`: 516 entity rows, 0 malformed JSON, `013` applied, all 5 indexes present.

## Deliberately deferred (with reasons)

- **DB functional indexes on `json_extract` — done, but note the tradeoff:** at 516 rows the planner wins aren't yet _noticeable_ (a scan over a few hundred rows is sub-ms); value is future-proofing + the dues-sort elimination.
- **`findEntities` still filters/sorts in JS** — the generic entity list wasn't moved to SQL (only the b2b/quotes and suggestions endpoints were). Bigger change; left for a dedicated pass.
- **JWT_SECRET ephemeral fallback** — left as-is (env/ops concern, not code); confirmed `JWT_SECRET` **is** set in Railway prod, so the fallback never triggers there.
- **Not done:** b2b reversed-date pricing (audit overstated — `effectiveQuantity` already falls back to qty≥1), WebSocket broadcast tier-scoping, image thumbnails (needs `sharp`), log rotation (Railway manages stdout).

## Key files touched

- Backend: `server/services/{documents,email,auth,audit,integrations,reportScheduler}.js`, `server/routes/{documents,pdf,testing,suggestions,b2b}.js`, `server/lib/ws.js`, `server/server.js`, `server/app.js`, `server/migrations/013_add_entity_query_indexes.cjs`.
- Frontend: `src/pages/{Dashboard,TestingArea}.jsx`, `src/lib/query-client.js`, `vite.config.js`, `package.json`.
- Tests: `tests/services/{documents,auth,search}.test.js`, `tests/migrations/013_add_entity_query_indexes.test.js`.
