# Architecture

This document covers the parts of Marvelops TravelPro that aren't obvious from
skimming individual files: the generic entity system, the permission model,
authentication, the frontend data flow, and real-time sync. See `README.md`
for feature list, setup, and environment variables.

## The entity system

Almost every business object (Trip, Client, Supplier, Invoice, Proposal,
QuoteRequest, ...) is stored in a **single SQLite table**, not one table per
type:

```sql
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,       -- 'Trip', 'Client', 'Supplier', ...
  data TEXT NOT NULL,       -- arbitrary JSON blob for that record
  created_date TEXT,
  updated_date TEXT
);
CREATE INDEX idx_entities_type ON entities(type);
```

`users` is the one major exception — it's a real typed table (`server/migrations/001_initial_schema.js`),
since auth needs indexed lookups and column constraints the generic table
doesn't offer.

- **`ENTITIES`** (`server/db.js`) is the allowlist of valid `type` values the
  generic CRUD routes (`server/routes/entities.js`) will accept. Adding a new
  entity type means adding it here.
- **`entities/<TypeName>`** — JSON Schema _documentation_ files (one per
  type) describing the expected shape of `data`, including an `rls` block
  that documents intended read/write scoping. These are **not enforced by the
  server** — they exist for human/AI readability. Actual enforcement lives in
  `server/services/entities.js` (see below).
- **`public/api-client.js`** (loaded as a plain `<script>` tag, not part of
  the Vite bundle) exposes the browser-side
  `db.entities.<Type>.list()/.get()/.create()/...` API. It no longer keeps its
  own entity list: `db.entities` is a `Proxy` that lazily builds an API for any
  accessed `<Type>`, so `server/db.js`'s `ENTITIES` is the single source of
  truth (the server rejects unknown types via `assertKnownType`). **A new
  entity type must be added in `server/db.js`'s `ENTITIES`** and (if the type
  should be client-portal-scoped) `CLIENT_SCOPED_TYPES` in
  `server/services/entities.js`.
- **FTS5 full-text search** — `entities_fts` is a virtual table kept in sync
  by triggers (see `server/services/entities.js`'s `upsertFts`/`deleteFts`);
  `hasFts(db)` (`server/db.js`) checks it exists before every FTS query, since
  it's optional/best-effort.

## Permission model

Two layers, checked together:

1. **Tier defaults** — `DEFAULT_TIER_PERMISSIONS` (`shared/permissions.js`)
   maps each `user_tier` (`admin`/`manager`/`agent`/`accounting`/`client`) to
   a list of permission keys. These are the fallback when nothing's been
   customized. Staff can edit the _live_ tier defaults via
   `AppSettings.jsx`'s "Permissions" tab, which persists to
   `AppSettings.tier_permissions` in the entities table; both the frontend
   (`PermissionContext.jsx`) and the backend (`getEffectiveTierPermissions`
   in `server/permissions.js`) read this override, falling back to
   `DEFAULT_TIER_PERMISSIONS` per-tier when it's missing.
2. **Per-user custom permissions** — each `users` row has a
   `custom_permissions` JSON array that can grant permissions beyond the
   user's tier default (edited in `UserManagement.jsx`).

`hasPermission(userTier, customPermissions, key)` is the single check both
layers funnel through — `server/permissions.js` on the backend and
`src/lib/permissions.js` on the frontend both wrap the same
`shared/permissions.js` catalog (guarded against drifting apart again by
`tests/lib/parity.test.js`), so only the DB-aware override lookup and the
frontend's label/description lookup (`PERMISSION_MAP`) live outside it.

**Entity-level enforcement** happens in `server/services/entities.js`:

- `ENTITY_PERMISSION_MAP` maps each entity `type` to the permission key
  required for `create`/`read`/`update`/`delete` via the generic CRUD routes.
- `CLIENT_SCOPED_TYPES` (`Trip`, `Proposal`, `Invoice`, `ClientPayment`,
  `QuoteRequest`) and `USER_SCOPED_TYPES` (`Message`, `ClientTask`,
  `EmailLog`) additionally restrict a `client`-tier or regular user to only
  their own records, independent of the permission-key check above.
- The B2B client portal (`server/routes/b2b.js`) writes directly to the DB
  rather than going through the generic entity routes, so its own handlers
  do their own scoping (`requireClientContext`/`resolveReadClientContext`).

## Authentication

- **JWT** (`server/middleware/auth.js`) — signed with `JWT_SECRET` (falls
  back to an ephemeral per-process secret with a logged error if unset,
  which invalidates all sessions on every restart — set `JWT_SECRET` in
  production). Sent as an httpOnly cookie (`setTokenCookie`,
  `server/services/auth.js`) and also accepted via `Authorization: Bearer`.
- **Microsoft SSO** (`authenticateMicrosoft`, `server/services/auth.js`) —
  verifies the id token against Microsoft's JWKS via `jose`, checks the
  token's tenant matches `MICROSOFT_TENANT_ID`, and auto-provisions a new
  `agent`-tier user on first login (matched by `microsoft_id` first, then
  case-insensitive email as a fallback).
- **`/mock-login`** — plain email/password form, the only way to log in
  locally without going through Microsoft (SSO requires a real Azure AD
  tenant + redirect URI, which won't work against `localhost`).
- **Client portal** — a `user_tier: 'client'` account is scoped to exactly
  one `client_id`, checked via `CLIENT_SCOPED_TYPES` above and the b2b
  routes' own context helpers.

## Frontend data flow

```
React component
  → React Query (useQuery/useMutation)
  → db.entities.<Type>.list()/.get()/.create()/.update()/.delete()   (src/lib/DbContext.jsx, re-exports window.db)
  → public/api-client.js                                            (plain <script>, not bundled — fetch() wrapper)
  → Express routes (server/routes/*.js)
  → server/services/entities.js (permission + scope checks)
  → better-sqlite3 (server/db.js)
```

`public/api-client.js` is loaded via a `<script>` tag in `index.html`, not
imported through Vite — this is why it needs its own `ENTITIES` list (see
above) instead of importing the one from `server/db.js`.

## Real-time sync

- **Backend** (`server/lib/ws.js`) — a `ws` `WebSocketServer` attached to
  whichever HTTP/HTTPS server actually starts (see `server/server.js`).
  Connections are authenticated via the same JWT cookie (or a `?token=`
  query param), keyed by `userId` in an in-memory `Map<userId, Set<WebSocket>>`.
  `broadcast(data, { excludeUserId })` fans out to every connected user
  except the one who triggered the change; `sendToUser(userId, data)` targets
  one user (used for notifications).
- **Frontend** (`src/hooks/useEntitySync.js` + `src/lib/realtime.js`) —
  on any `{ type: 'entity_change', entityType }` message, invalidates every
  React Query cache entry whose key _substring-matches_ the entity type
  (case-insensitive), rather than requiring an exact key convention (query
  keys aren't consistent across pages — `'trip'`, `'trips'`, `'clientTrips'`,
  etc.). Broader than a perfect match, but safe: a false-positive match just
  causes an extra refetch, never a missed one.

## Migrations

`server/migrations/*.js` are plain SQL migration files (ES modules, `export
function up(db)` / `down(db)`) run in filename order by
`server/migrations/runner.js` (`migrate(db)` / `migrationStatus(db)`).
Applied migrations are tracked by name (extension stripped) in the
`_migrations` table, so renaming a migration file doesn't make the runner
re-apply it. A pre-migration
DB snapshot (`server/services/backup.js`'s `createBackupSync`) is taken
automatically whenever `server/db.js` detects unapplied migrations at
startup, so a bad migration can be undone by restoring that file instead of
just reverting code.
