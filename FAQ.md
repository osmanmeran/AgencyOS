# FAQ

## Tasks & the "To Do" board

**Where is the Task Board?**
Open **Task Board** from the navigation (route `/TaskBoard`). It's a Kanban board of tasks, reminders, and notes across all clients.

**What are the columns?**
`Pending` → `In Progress` → `Done`. Drag a card between columns to change its status. Moving a card to **Done** stamps `completed_at`; moving it out clears it.

**How do I create / edit a task?**
Click **New Task** to open the dialog (title, description, type, client, due date, priority, assignee). Click the pencil icon on any card to edit or delete it.

**What does "Assignee" mean?**
The assignee is a staff user (picked from `db.auth.users()`). It's stored as the user's email in `assigned_to`, which also drives row-level security — an assigned user and the task's creator can both see and edit the task. Unassigned tasks are visible to users with unconditional read access to the `ClientTask` type (admins/managers) and to the creator.

**What does "My tasks" do?**
The toggle in the top-right filters the board to tasks **assigned to you or created by you**.

**Do reminders actually notify me?**
Yes. A global hook (`useReminderNotifications`, mounted in the app shell) polls every 5 minutes and shows an in-app toast for any **reminder** whose due date has passed and that is assigned to you or created by you. (Email/SMS reminders are not wired up yet.)

**Where else can I see tasks?**

- Each client's **Tasks** panel on the CRM client page (`ClientTasksPanel`) now shows an **In Progress** filter and resolves assignee emails to names.
- The trip detail page has a **Tasks** tab showing the linked client's tasks.
- The **Dashboard** has a **My Open Tasks** widget linking to the board.

## Contextual Tasks (booking-linked, SLA-aware)

**What's the difference between the Task Board and Contextual Tasks?**
The **Task Board** (`ClientTask`) is a lightweight personal/client to-do list (tasks, reminders, notes) you create by hand. **Contextual Tasks** (`Task`) are operational to-dos automatically generated from a **Trip** and tied to that booking, a customer, and/or a supplier — built for collaborative ops with SLA tracking. They're two separate entity types.

**Are tasks created automatically when I make a booking?**
Yes. Saving a new **Trip** generates three tasks keyed to its departure date (`start_date`):

- **Collect Final Balance** — due 30 days before departure (priority High)
- **Send Rooming List to Hotel** — due 14 days before (priority Medium)
- **Issue Tickets / Final Docs** — due 7 days before (priority Critical)

They're linked via `booking_id`/`customer_id` and assigned to the Trip's creator. If the booking already has these tasks, they're resynced (not duplicated).

**What happens if I change the departure date?**
`rescheduleTasksForBooking` recomputes every auto-task's due date (and SLA window) from the new departure. Manually created tasks (no template) keep their own dates.

**What is the SLA / escalation thing?**
Each task has an `escalation_trigger_time` — a priority-based lead before the due date (Critical 48h, High 24h, Medium 12h, Low 0). Once that time passes and the task is still open, it's flagged `is_escalated`. Separately, `is_due_soon` is true when the due date is within 24 hours — that's what the priority banner / countdown uses. Both flags are computed live by `GET /api/tasks`, so no background job is required.

**How do I complete a task?**
`PUT /api/tasks/:id/complete` sets `status=completed`, stamps `completed_at`, and writes an audit entry. The booking-detail Contextual Task Widget will call this; until it ships you can hit the endpoint directly.

**How do I fetch a trip's tasks for the widget?**
`GET /api/tasks?booking_id=<tripId>` returns that booking's tasks with the SLA flags. Add `&overdue=1` or `&escalated=1` to filter, and `?status=` / `?priority=` / `?assigned_to_user_id=` for the others.

**I'm on Linux/Railway and imports broke / casing issues?**
The app deploys from `main` to Railway (Linux, case-sensitive filesystem). Keep file/import casing exact. Locally on macOS the filesystem is case-insensitive, so a casing mismatch only fails at deploy — a case-mismatch import scan was run and came back clean.

## Email & reservations

**Reservation emails had a white-on-white company header / missing service locations.**
Fixed in `719d0a3`: the header now has a solid `background-color` fallback, and each service line shows its location (auto-filled from the supplier's city/area, or the explicitly entered location).

**Global search opens the wrong page for trips.**
Fixed in `ba9fcf5`: Trip results now open `/ReservationDetails?id=` (the page all Trip links use) instead of the unreachable `/TripDetails`.
