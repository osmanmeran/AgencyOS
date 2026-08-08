# FAQ

## Tasks & the "To Do" board

**Where is the Task Board?**
Open **Task Board** from the navigation (route `/TaskBoard`). It's a Kanban board over every task in the workspace — the ones you create by hand _and_ the ones bookings generate automatically.

**What are the columns?**
`Pending` → `In Progress` → `Done`. Drag a card between columns to change its status. Dropping a card on **Done** goes through the audited complete endpoint (stamps `completed_at`, writes an audit entry); dragging it back out clears the stamp. Cancelled tasks are archived — the board doesn't show them.

**How do I create / edit a task?**
Click **New Task** to open the dialog (title, description, type, client, due date, priority, assignee). Click the pencil icon on any card to edit it. Deleting (from the card or the edit dialog) asks for confirmation first.

**What do the badges on a card mean?**
**Auto** — generated from a booking template rather than typed by hand (the title links to the booking). **Escalated** — its SLA window elapsed while the task was still open. **Overdue** — the due date has passed. Open cards sort by due date, soonest first, with undated ones last.

**Why does the Done column say some tasks aren't shown?**
It loads only the most recently updated page of completed tasks (50). Every booking auto-generates up to nine tasks, so a workspace's completed history grows quickly and fetching all of it would slow the board down. Older completed tasks stay visible from the client and booking task panels.

**What does "Assignee" mean?**
The assignee is a staff user (picked from `db.auth.users()`), stored by user id in `assigned_to_user_id`. It also drives permissions: the assignee and the task's creator can update and delete their own task even without `modify_trips`/`delete_trips`; anyone else needs those permissions.

**What does "My tasks" do?**
The toggle in the top-right filters the board to tasks **assigned to you or created by you**.

**Do reminders actually notify me?**
Yes. A global hook (`useReminderNotifications`, mounted in the app shell) polls every 5 minutes and shows an in-app toast for any **reminder** whose due date has passed and that is assigned to you or created by you. (Email/SMS reminders are not wired up yet.)

**Where else can I see tasks?**

- Each client's **Tasks** panel on the CRM client page (`ClientTasksPanel`) — manual entries only, with an **In Progress** filter and assignee names resolved.
- The booking detail page's **Booking Tasks** panel, showing that booking's operational tasks with their SLA state.
- The **Dashboard**'s **My Tasks** widget, linking to the board.

## Contextual Tasks (booking-linked, SLA-aware)

**Are Task Board tasks and booking tasks two different things?**
No — they're one `Task` entity and one board (they used to be two, `ClientTask` and `Task`; that split was merged away). What differs is where a task came from: a task with a `template_key` was generated from a booking and carries the SLA machinery below; one without it is something a person typed. The client Tasks panel filters to the latter so the CRM view stays a personal to-do list.

**Are tasks created automatically when I make a booking?**
Yes. Saving a **Trip** generates a task per applicable template. The nine defaults span the booking lifecycle — **Collect Deposit** (+3d after booking, High), **Follow Up on Travel Insurance** (+14d, Medium), **Confirm Visa / Travel Documents** (−45d, High), **Pay Supplier Balance** (−21d, High), **Collect Final Balance** (−30d, High), **Send Rooming List to Hotel** (−14d, Medium), **Issue Tickets / Final Docs** (−7d, Critical), **Pre-Departure Confirmation Call** (−3d, Medium), and **Post-Trip Follow-Up** (+2d after return, Low) — each anchored to the trip's creation, departure, or return date.

They're linked via `booking_id`/`customer_id` and assigned to the Trip's creator. If the booking already has a task for a template, it's resynced (not duplicated), and completed/cancelled ones are never resurrected.

**Can we change which tasks get generated?**
Yes — an admin edits them in **Settings → Task Templates** (title, description with `{client_name}`/`{destination}`/`{start_date}` placeholders, anchor date, day offset, priority, and an optional department restriction). A saved list fully replaces the defaults; the editor pre-fills with the defaults so you're editing a visible starting point.

**What happens if I change the departure date?**
`rescheduleTasksForBooking` recomputes every auto-task's due date (and SLA window) from the new departure. Manually created tasks (no template) keep their own dates.

**What is the SLA / escalation thing?**
Each task has an `escalation_trigger_time` — a priority-based lead before the due date (Critical 48h, High 24h, Medium 12h, Low 0). Once that time passes and the task is still open, it's flagged `is_escalated`. Separately, `is_due_soon` is true when the due date is within 24 hours — that's what the priority banner / countdown uses. Both flags are computed live by `GET /api/tasks`, so no background job is required.

**How do I complete a task?**
Tick it off in the Booking Tasks or client Tasks panel, or drag its card to **Done** on the board. All three call `PUT /api/tasks/:id/complete`, which sets `status=completed`, stamps `completed_at`, clears the escalation flag, and writes an audit entry.

**How do I fetch a trip's tasks for the widget?**
`GET /api/tasks?booking_id=<tripId>` returns that booking's tasks with the SLA flags. Add `&overdue=1` or `&escalated=1` to filter, and `?status=` / `?priority=` / `?assigned_to_user_id=` for the others. `status`, `priority` and `type` also take a comma-separated list (`?status=pending,in_progress`), and `?limit=`/`?offset=` paginate.

**Why can't I set `is_escalated` / `is_overdue` through the entity API?**
Those are computed per request from the due date and SLA window, so the write path strips them — otherwise saving a task you'd just read back would freeze a momentary value into storage and, in `is_escalated`'s case, leave it stuck on forever. Only the escalation job writes `is_escalated`.

**I'm on Linux/Railway and imports broke / casing issues?**
Railway runs Linux, with a case-sensitive filesystem. Keep file/import casing exact. Locally on macOS the filesystem is case-insensitive, so a casing mismatch only fails at deploy — a case-mismatch import scan was run and came back clean.

**Which branch does Railway deploy?**
`main` today — but that is configured in the Railway dashboard, not in this repo, and it has not always been `main` (it pointed at `saas-standalone` for several days in August 2026, during which pushes to `main` deployed nothing and said nothing). Never assume it from the docs: `railway status` shows a **deployment ID** that changes on every real deploy, and `railway logs` shows each boot's migrations. See CLAUDE.md's "the deploy branch is a moving part" note for the full diagnosis.

## Workspaces & Tenants (multi-tenant SaaS)

**What is a workspace?**
Marvelops is multi-tenant: every travel agency runs in its own isolated workspace, backed by its own SQLite database file. There's no shared table across agencies — data isolation is at the file level, not a `tenant_id` column. See `SAAS_PROJECT.md` for the full rationale and phase-by-phase implementation log.

**How do I reach my agency's workspace?**
Two modes, chosen automatically based on config. If `APP_ROOT_DOMAIN` is set (and wildcard DNS/TLS are in place), each workspace gets a subdomain (`acme.marvelops.app`) resolved from the `Host` header. Otherwise the app runs in **single-domain (cookie) mode** — an `active_tenant` cookie set at login/signup selects the workspace on the bare domain, which is what a default `*.up.railway.app` URL needs since wildcard subdomains aren't possible there.

**How is a new workspace created?**
Self-serve, if `ALLOW_PUBLIC_SIGNUP=true`: `POST /api/tenants/signup` takes an agency name, a unique slug, and either an admin email/password or a Microsoft SSO id token (the workspace's Azure AD tenant is derived from the token). New workspaces start in `trial` status with a `TRIAL_DAYS`-day deadline (default 14). Otherwise an operator provisions one by hand, or with `scripts/adopt-tenant-zero.mjs` for the original pre-multi-tenant production DB.

**Can each agency use its own Microsoft 365 login?**
Yes. A workspace admin sets the workspace's Azure AD tenant id from **Workspace Settings** — no server env var change needed. Empty/unset falls back to the server-wide `MICROSOFT_TENANT_ID`.

**Can users sign in with Google?**
Yes, where it's configured (`VITE_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` on the service; live in production since 2026-08-08). A user row can hold `microsoft_id` and `google_id` at once, so linking Google adds a sign-in method rather than replacing one. Unlike Microsoft, **Google never provisions**: Microsoft can safely create accounts because the token's `tid` proves the user belongs to the workspace's Azure directory, while a Google token carries no equivalent claim — so an unrecognized email is rejected instead of turned into an account. That also means there's no per-workspace Google setting matching `tenants.azure_tenant_id`. `email_verified` is enforced and is load-bearing: accounts are matched to Google identities by email, so an unverified address would let anyone who registers a Google account asserting it sign in as that user. The button is gated at **build** time on `VITE_GOOGLE_CLIENT_ID`, so an unset variable removes it from the bundle entirely rather than showing a broken control. See CLAUDE.md for the credential probe that separates a bad client secret from every other failure.

**What happens when a trial expires or a workspace is suspended?**
`tenantAccessState()` blocks `/api` access (error codes `WORKSPACE_SUSPENDED` / `TRIAL_EXPIRED`), except for auth/health/tenant/platform endpoints so a blocked workspace can still sign in and see its own status. Users see a status banner once suspended or within 7 days of trial expiry. A platform admin can suspend/reactivate/mark-paid/extend-trial from the Platform Admin dashboard (gated by `PLATFORM_ADMIN_EMAILS`).

**Can a workspace be renamed or deleted?**
Renamed anytime by a platform admin. Deletion is deliberately guarded: the primary/legacy workspace can never be deleted, the workspace must already be suspended, the exact slug must be typed to confirm, and a final snapshot is written outside the directory being removed (and pushed off-box if configured) before anything is deleted.

**Are uploaded files/PDFs isolated per workspace too, not just the database?**
Yes (Phase 7). Each workspace's uploads, generated PDFs, and OCR scratch files live under `data/tenants/<id>/`, served through an authenticated, permission-checked route — not the old shared, unauthenticated static mount.

**Are backups protected against losing the whole disk?**
Optionally, yes. With `BACKUP_S3_BUCKET` configured, nightly snapshots and uploaded files are mirrored to S3-compatible storage (S3, R2, MinIO); it's a no-op without that var set. `scripts/backup-cli.mjs restore <snapshot> --tenant <slug> --from-offsite` can pull a snapshot back from object storage and integrity-checks it before ever overwriting a live database. Every backup pass is recorded, and failures email `BACKUP_ALERT_EMAIL` (or `PLATFORM_ADMIN_EMAILS`) so a silently-dead scheduler doesn't go unnoticed.

**What if I run migrations across many tenants and one database is broken?**
`npm run db:migrate:bootstrap` isolates each tenant's migration in its own try/catch and reports a per-tenant result plus a summary — one bad database no longer aborts the whole run. `npm run db:migrate:fleet:status` previews what would happen (pending counts, unreadable databases) without applying anything.

**Does the `refresh_tokens` table just grow forever?**
No — a daily job (`server/services/refreshTokenPruning.js`, same `forEachTenant` pattern as the other maintenance jobs) deletes rows that are revoked or past their expiry, across every workspace. Every access-token refresh writes a new row and revokes the old one, so without this the table would grow unbounded per tenant even though the rows are harmless once revoked/expired (lookups stay index-backed regardless of table size).

## Online Payments (bring-your-own-key Stripe)

**How do clients pay online?**
Each workspace pastes its own Stripe secret key directly into Settings → Integrations → Payments (generated instantly from their own Stripe Dashboard — no approval process, no OAuth redirect). Once that's saved, a client sees a **Pay Now** button on their invoice in the Client Portal; it redirects to a Stripe Checkout page for the remaining balance and comes back to the invoice afterward.

**Can staff send a payment link without the client logging into the portal?**
Yes — the same Checkout Session is available as **Generate Payment Link** on the staff invoice page (replacing the old placeholder "simulated" link, which never actually charged anyone), for copying into an email or message.

**Does the "Send Reminder" button also include a pay link?**
Yes, when Stripe is configured for the workspace — `PaymentReminderButton.jsx` fetches a live Checkout Session as soon as the reminder dialog opens and splices a "Pay online now" line into the default message (only if the admin hasn't started editing it, so an in-progress edit is never clobbered). If Stripe isn't set up yet, the dialog shows "Connect Stripe in Settings to include a pay-online link" and the reminder still sends without one — it's a nice-to-have, not a requirement.

**Whose Stripe account does the money land in?**
The agency's own, always — there's no Connect umbrella, no platform Stripe account, and no application fee. Each workspace's Checkout Sessions are created directly on their own account using their own key, so funds settle straight into that agency's Stripe balance.

**How does the invoice actually get marked paid?**
A webhook is the only thing that marks a payment as received — the Checkout Session's "success" redirect is just a UX nicety, not a trust boundary. Because every tenant has a fully independent Stripe account (not a Connect sub-account), each workspace registers its **own** webhook endpoint in its **own** Stripe Dashboard, pointed at a URL with its tenant id baked in (`POST /api/webhooks/stripe/<tenantId>`, shown to the admin in Settings) and pastes back the signing secret Stripe gives them. On `checkout.session.completed`, the route resolves the tenant from that URL path, verifies the signature against _that tenant's own_ saved webhook secret (one workspace's secret can't be used to forge events for another), then atomically updates the `Invoice`, inserts a `ClientPayment` row, and bumps the client's running totals. Each Stripe event id is recorded so a retried/duplicate webhook delivery can't double-credit a payment.

**Does this need any hosting/environment changes?**
No. Zero env vars, on Railway or anywhere else — that was the whole point of moving off Stripe Connect. Each workspace configures itself entirely through its own Settings page:

1. Paste a Stripe secret key (verified against Stripe immediately, so a typo is caught on the spot rather than surfacing later as a confusing failure).
2. Create a webhook endpoint in their own Stripe Dashboard pointed at the URL Settings shows them, listening for `checkout.session.completed`.
3. Paste the resulting webhook signing secret back into Settings.

No new ports, no new system packages (unlike the OCR feature's Python/tesseract requirement), no CSP changes (Stripe Checkout is a full-page redirect, not an embedded script or iframe), and no manual DB step — the new per-tenant `stripe_settings`/`stripe_webhook_events` tables run through the same automatic migration path as everything else, on next boot / next time each tenant's database opens. If you want every existing tenant migrated immediately after a deploy rather than lazily on first request, run `npm run db:migrate:bootstrap` once (same as any other migration rollout).

**Can clients see their own payment history?**
Yes — **My Payments** in the Client Portal (`/ClientPayments`) lists every `ClientPayment` record for that client: amount, date, method (card/bank transfer/PayPal/check/cash), status, and — for a Stripe payment — the transaction reference as a receipt. A payment linked to an invoice shows a **View Invoice** button straight to it. Same row-level scoping as every other Client Portal page (a client only ever sees their own `client_id`'s records).

## Login & Account Recovery

**What if a user forgets their password?**
Self-service password reset: **Forgot password?** on the login page (`/forgot-password`) takes an email and, if it matches an active, password-based account, emails a reset link (`/reset-password?token=...`) that expires in 1 hour. Choosing a new password there immediately revokes every refresh token the account currently holds — logging out any other active session, in case the reset was prompted by a compromised password.

**Does this leak which emails are registered?**
No — `POST /api/auth/forgot-password` responds with the exact same message ("If that email is registered, a reset link has been sent") whether or not the email exists, is active, or is even a password-based account at all. A Microsoft-SSO-linked account gets no token minted (there's no local password to reset — `authenticateLocal` already refuses password login for those), but the caller can't tell the difference from an unknown email.

**Which workspace does a reset apply to, if the same email exists in more than one?**
Only the workspace the request came from (the one already selected via subdomain or the `active_tenant` cookie) — unlike login, there's no password yet to disambiguate a same-email match across workspaces, so this deliberately doesn't guess or email every matching workspace.

## Email & reservations

**Reservation emails had a white-on-white company header / missing service locations.**
Fixed in `719d0a3`: the header now has a solid `background-color` fallback, and each service line shows its location (auto-filled from the supplier's city/area, or the explicitly entered location).

**Global search opens the wrong page for trips.**
Fixed in `ba9fcf5`: Trip results now open `/ReservationDetails?id=` (the page all Trip links use) instead of the unreachable `/TripDetails`.
