# Session Log — Marvelops App Vercel Deployment

## Goal
Deploy the full-stack Marvelops travel management app (React/Vite + Express + SQLite) on Vercel.

## Repo
`https://github.com/osmanmeran/marvelops`

## Branch
`main`

## What Was Done

### 1. Fixed Blank Page (Circular Chunk Dependency)
- **File**: `vite.config.js`
- Removed `react` and `leaflet` from `manualChunks` config
- **Cause**: React, react-dom (in vendor), and leaflet were split across chunks with circular imports, causing `Cannot set properties of undefined (setting 'AsyncMode')`
- Build was warning: `Circular chunk: vendor -> react -> vendor` and `Circular chunk: react -> leaflet -> react`

### 2. Fixed Vercel Routing (vercel.json)
- `outputDirectory: "dist"` — matches Vite build output
- Rewrites: `/api/(.*)` → `/api` for backend, `/(.*)` → `/index.html` for SPA
- Vercel serves existing static files before applying rewrites, so assets load correctly

### 3. Adapted Express for Vercel (server/app.js)
- Static file serving (`express.static`) and SPA catch-all `app.get('*', ...)` wrapped in `if (!process.env.VERCEL)`
- Vercel CDN handles static files directly; Express only handles API routes

### 4. Database: better-sqlite3 + Vercel Blob Persistence (server/db.js)
- Kept `better-sqlite3` (FTS5 support needed, not available in sql.js)
- On Vercel cold start: downloads SQLite DB from Vercel Blob (`marvelops.db`)
- Every 60s: checkpoints WAL and uploads DB back to Blob
- Graceful fallback if `BLOB_READ_WRITE_TOKEN` is not set (fresh DB created)
- Uses `/tmp/data/` on Vercel, `./data/` locally

### 5. Fixed Microsoft SSO Redirect URI (src/lib/microsoft-auth.js)
- Changed redirect URI from `/mock-login` to `/mock-login/` (trailing slash)
- Azure AD requires trailing slash when configured with one

### 6. Fixed manifest.json Syntax Error (public/manifest.json)
- Created minimal manifest to stop browser console error

## Environment Variables Needed in Vercel

| Key | Value | When |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | From Vercel Storage → Blob | Always (for DB persistence) |
| `JWT_SECRET` | `openssl rand -hex 32` | Always |
| `VITE_MARVELOPS_BACKEND_URL` | (empty) | Always |
| `VITE_MARVELOPS_APP_ID` | `marvelops-prod` | Always |
| `VITE_MICROSOFT_CLIENT_ID` | `68b816cf-4549-4a41-95af-09850768d12a` | For SSO |
| `MICROSOFT_CLIENT_ID` | `68b816cf-4549-4a41-95af-09850768d12a` | For SSO |

## Azure AD Configuration
- App Registration: `68b816cf-4549-4a41-95af-09850768d12a`
- Redirect URI (SPA): `https://marvelops.vercel.app/mock-login/`

## Known Issues / Next Steps
1. **Microsoft SSO** — Code now sends redirect URI with trailing slash; needs Azure propagation + Vercel redeploy to test
2. **Outlook integration** — Its redirect URI (`/auth/outlook-callback`) may also need Azure config for Vercel domain
3. **Database persistence** — Blob upload every 60s; data loss possible if function terminates mid-interval
4. **Cold start** — ~1s initialization; Blob download adds latency
5. **`.gitignore`** — Added `data/*.db*` to prevent accidental SQLite file commits
