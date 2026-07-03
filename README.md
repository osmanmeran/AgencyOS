# Marvelops TravelPro

A full-stack travel agency operations management platform for tour operators and travel agents.

## Tech Stack

- **Frontend:** React 18, Vite 6, MUI 9, Radix UI (shadcn-style), Tailwind CSS, Framer Motion, Recharts
- **Backend:** Express.js, WebSockets, SQLite (better-sqlite3 with FTS5), JWT auth, Microsoft SSO
- **Infrastructure:** Vercel / Railway, Docker-ready

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
├── pages/         — Route-level page components (56 pages)
└── pages.config.js — Route definitions (with permissions)

server/            — Express.js backend
├── app.js         — Express app setup
├── server.js      — HTTP/HTTPS + WebSocket server
├── db.js          — SQLite setup + migrations
├── routes/        — 11 API route modules
├── services/      — Business logic (auth, entities, email, etc.)
├── middleware/     — Auth, permissions, error handling
├── lib/           — Logger, WebSocket helpers
└── migrations/    — 8 migration files

entities/          — JSON schemas for 25+ entity types
tests/             — Vitest test suite (server-side only)
```

## Permission Tiers

| Tier | Access |
|------|--------|
| **Admin** | Full system control, user management, app settings |
| **Manager** | Operations management, modify/cancel trips & invoices |
| **Agent** | Daily ops: trips, proposals, invoices, supplier info |
| **Accounting** | Read-only finance, reports, search |

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `JWT_SECRET` | Yes | — | JWT signing key |
| `PORT` | No | 3001 | Server port |
| `MICROSOFT_CLIENT_ID` | No | — | Microsoft SSO & Outlook |
| `MICROSOFT_TENANT_ID` | No | — | Azure AD tenant |
| `SMTP_HOST / USER / PASS` | No | — | Email sending |
| `APP_URL` | No | — | Callback URLs, invite links |
| `DATA_DIR` | No | ./data | Database + uploads path |

## What's Missing / Areas to Improve

### Security
- **Rotate committed credentials** — The `.env` file contains real Microsoft OAuth client/tenant IDs and was committed. **Rotate these immediately.**
- **Set a strong JWT_SECRET** — `dev-secret-key-change-in-production` is the default; override in production.
- **React StrictMode is disabled** — `src/main.jsx` wraps the app without `<StrictMode>`, hiding potential issues.

### Gaps vs. Feature Completeness
- **No payment gateway** — `ClientPayment` entity exists but there is no Stripe/PayPal integration. Payments are recorded manually.
- **No SMS provider** — The `/api/integrations/sms` endpoint logs locally but sends nothing.
- **No LLM/AI features** — `InvokeLLM` and `GenerateImage` are referenced in the API client stub but have no server-side implementation.
- **No calendar sync** — iCal, Google Calendar, and Outlook calendar sync are absent.
- **No mobile app** — Responsive web only.
- **OCR requires Python** — `server/ocr_parse.py` is called as a subprocess; the script is not in the repo, and the endpoint fails if Python 3 is absent.

### Testing
- **No frontend tests** — The Vitest suite covers server services only. No component, integration, or E2E tests exist.
- **No API endpoint tests** — Routes are not tested via supertest or similar.
- **No WebSocket tests.**

### Code Quality
- **`PermissionManager.jsx` is not registered in the router** — It's a full page component but unreachable from navigation.
- **`ClientCRM.jsx` and `Clients.jsx` overlap** — Two UIs for client management (Kanban vs table). Users may find this confusing.
- **Mixed languages** — Error messages and comments use a mix of English and Italian.
- **`test.cjs` at root** — Unexplained test file outside the Vitest suite.

### Infrastructure
- **No Dockerfile** — The project has `railway.json` but no container config for other platforms.
- **No HTTPS setup** — SSL support exists via env vars but is undocumented and not automated.
- **Missing entity schema** — `TourContract` lacks a JSON schema in the `entities/` directory.

### Optional Integrations
- Google OAuth (environment variable documented, no server code)
- Google Maps / Places (uses OpenStreetMap instead)
- WhatsApp / messaging
- Additional email providers (SendGrid, Mailgun, Gmail API)
