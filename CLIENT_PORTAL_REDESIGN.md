# Client portal → B2C travel-site redesign

Handoff/continuation doc. If this chat session gets compacted or a new
session picks this up, start here instead of re-deriving context.

## Status: implemented (2026-07-11), pending visual QA + push

`ClientPortal.jsx` was rewritten per the approved layout below (all 6
sections). `ClientQuoteBuilder.jsx` got new plumbing so the hero search
hands off into it via URL params (`?category=hotels&destination=&checkin=&
checkout=&guests=`): the first (empty) service line auto-opens its picker
with the matching category pre-selected (fuzzy keyword match against
whatever `category_name` strings exist in the catalog — same approach
`ServiceLineCard` already used) and, for hotels, dates/guests pre-filled;
the destination text also pre-fills the Trip Details destination field.
Location is **not** auto-selected — the hero's free-text destination isn't
guaranteed to match one of the picker's structured location options, so
that's left as one manual step rather than silently guessing wrong.

Judgment calls made without re-confirming (flagged here in case they're
wrong):

- The old standalone "Upcoming Trips" grid, "My Invoices" list, and "Need
  Help" card were **dropped** from the page body — the new design is meant
  to be leaner, and Trips/Invoices already have their own pages linked from
  the stats/View All. The overdue-invoice signal was folded into a small
  red sub-label on the "Amount Owed" stat tile instead of a full section.
- Recent proposal cards use a generic tinted icon block, not real photos —
  `Proposal.services[]` items don't carry an `image_url`/`pricing_id` link
  back to `SupplierPricing` reliably, so joining for real photos here would
  be guesswork. (The "Continue planning" trip card _does_ show a real photo
  when `Trip.image_url` is set, since that field already exists on the
  entity.)
- Non-hotel category pills (Tours/Transfers/Car rental) are fully wired,
  not "coming soon" — they route into the generic picker with their
  category pre-selected, same mechanism as hotels minus the guided
  dates/rooms/results flow.

`npm run lint`, `typecheck`, `build`, and `test` all pass. Not yet visually
verified — this sandbox can't log into the client portal (Microsoft SSO
blocked); needs a check in an actual browser. Not pushed yet.

## Goal

Make the client portal feel like a modern B2C travel site (Expedia/
Booking.com-ish) instead of a generic internal-tool dashboard — cleaner,
search-forward, image-led. Explicitly **not** about pulling in a new UI kit
(evaluated github.com/seraui/seraui — technically compatible with this
app's existing shadcn/Radix/Tailwind stack, but it's a marketing-flourish
library and would duplicate the 52 shadcn components already installed;
decided not to adopt it). The existing "new-york" shadcn component set is
the right toolkit — the gap is layout/composition, not primitives.

## Already shipped (this session, before the redesign work started)

The hotel side of the client quote builder got a full B2C-style overhaul.
For full detail, `git log --oneline` on `main` — key commits:

- Guided hotel search folded into `ClientQuoteBuilder.jsx`'s "Choose a
  service" picker: pick Hotel category → location → dates → rooms/adults/
  children (with child ages) → results showing photo, star rating, meal
  treatment, per-night + total pricing, matched against real supplier
  inventory.
- Real child-supplement pricing added to `SupplierPricing` (flat per-child,
  per-night, infants 0-2 free) — staff set it in Supplier Pricing Manager,
  server computes/recomputes it authoritatively.
- Shared hotel pricing/rate-matching logic lives in `src/lib/hotelPricing.js`
  (`isRateValidForRange`, `resolveRoomRatesForRange`, `occupancyForAdults`,
  `unitPriceFor`, etc.) — reused by the picker and `HotelResultCard.jsx`.
- A standalone "Browse Hotels" page was built, then **removed** in favor of
  folding the flow into the existing picker (the user's explicit
  preference — don't resurrect the standalone page).

None of the above needs revisiting unless a bug turns up. It's the
foundation the redesign builds on (e.g. the portal home's search bar should
route into this same picker/flow, not a new search system).

## Current task: redesign `src/pages/ClientPortal.jsx`

User approved a mockup (rendered via the visualize tool earlier in this
session — not saved as a file, described below). Implement it in
`ClientPortal.jsx` using real Tailwind/CSS-variable classes (`bg-primary`,
`text-primary-foreground`, `bg-card`, `border-border`, `text-muted-foreground`,
`bg-secondary`, etc.) — **not** hardcoded hex; the mockup used literal hex
converted from the app's HSL tokens just to preview accurately outside the
app's own CSS, but the real implementation must stay theme/dark-mode aware
like the rest of the app.

### Approved layout, top to bottom

1. **Understated welcome header** — small "Welcome back" eyebrow + bigger
   "Hi {name} — where to next?" headline. Replaces the current plain
   `h1`/subtitle block.
2. **Hero search card** — primary-colored card containing:
   - Category pills (Hotels / Tours / Transfers / Car rental), Hotels
     active by default. Only Hotels is functional today (matches what's
     built); other pills can be present but should visibly indicate
     "coming soon" or just route into the generic `ClientQuoteBuilder`
     picker with that category pre-selected if reasonably easy.
   - A horizontal search bar (destination / check-in / check-out / guests
     / Search button) styled like Expedia/Booking. Open question (see
     below): what exactly "Search" should do.
3. **Quick category tiles** — 4 icon tiles (Hotels/Tours/Transfers/Car
   rental) below the hero, for direct navigation without using the search
   bar.
4. **"Continue planning" card** — only shown if the client has an upcoming
   trip. Horizontal card: image/icon block + trip name + date range +
   "departs in N days" + a "View itinerary" button. Needs real logic to
   pick the most relevant upcoming `Trip` (soonest future `start_date`).
5. **Condensed stats row** — Proposals / Active trips / Total paid /
   Amount owed, same 4 numbers the page shows today, just restyled as a
   slimmer row (smaller cards) since the hero now leads visually. Reuses
   existing query data (`myProposals`, `myTrips`, `myPayments`,
   `myInvoices`) already fetched in the current `ClientPortal.jsx`.
6. **Recent proposals grid** — 3-up image-forward cards (thumbnail/icon +
   title + nights/guests + price + status badge), replacing whatever the
   current "Recent Proposals" list looks like. Reuses existing `Proposal`
   data already fetched.

### Open questions to resolve before/while implementing

- **What does the hero "Search" button actually do?** Most consistent
  option: navigate to `ClientQuoteBuilder`, auto-open the "Choose a
  service" dialog with Hotel pre-selected and the destination/dates
  pre-filled from the search bar. Needs `ServicePickerDialog` (in
  `ClientQuoteBuilder.jsx`) to accept initial values as props/URL params —
  not currently supported, would be new plumbing.
- **Non-hotel category pills** — Tours/Transfers/Car rental have no guided
  flow (only the generic dropdown chain exists for them in the picker).
  Decide: show them as visually disabled/"coming soon", or just route into
  the generic picker with that category pre-selected.
- **Image sourcing** — real property/tour photos would come from
  `SupplierPricing.image_url` (same field the hotel picker already uses)
  for "Recent proposals"/"Continue planning" cards where a linked service
  exists; need a sensible fallback icon block when there isn't one (the
  mockup used Tabler-style icons on a tinted background as the fallback —
  match that using `lucide-react`, which is what this codebase actually
  uses, not Tabler).
- **"Continue planning" trip selection logic** — needs a real query/filter
  (soonest upcoming `Trip.start_date` for this client) and a "days until
  departure" calculation (there's likely a `date-fns` helper pattern
  already used elsewhere in the codebase for this — check before writing
  new date math).

### Files involved

- `src/pages/ClientPortal.jsx` — the target file, full rewrite of the body
  below the top-level data fetching (keep the existing `useQuery` calls for
  proposals/trips/payments/invoices; the client-resolution `useEffect` at
  the top could arguably be replaced with `useMyClient()` from
  `src/hooks/useMyClient.js` while touching this file, but that's a
  drive-by cleanup, not required for the redesign).
- `src/pages/ClientQuoteBuilder.jsx` — where the hero search bar's "Search"
  action likely needs to route into/pre-fill.
- `src/lib/hotelPricing.js`, `src/components/hotelSearch/HotelResultCard.jsx`
  — existing hotel picker internals, reference for consistent styling
  (badges, price formatting via `getCurrencySymbol` from
  `src/lib/formatters.js`) if the redesigned home page shows hotel-specific
  info.
- Design tokens: `src/index.css` (`:root`/`.dark` CSS variables, M3-based —
  `--primary`, `--background`, `--card`, `--border`, `--muted-foreground`,
  etc.) and `tailwind.config.js` (maps them to `bg-primary`, `text-foreground`
  etc. Tailwind classes). Use these classes, never raw hex, so dark mode
  keeps working.

### Broader roadmap (not this task, but the direction)

Once the portal home is done, the same visual language (search-forward,
image-led cards, condensed stat chips instead of big blocks) should extend
to `ClientTrips.jsx`, `ClientProposals.jsx`, `ClientInvoices.jsx` — flagged
by the user as the eventual goal, not scoped yet.

## Process notes for whoever picks this up

- User's established workflow this session: implement → run
  `npm run lint && npm run typecheck && npm run build && npm test` (all
  must stay green) → summarize → **ask before pushing** (push to `main`
  auto-deploys to Railway/production, confirmed in project memory — never
  push without an explicit go-ahead in the same turn).
- This sandbox cannot log into the client portal (Microsoft SSO is
  blocked, no local admin/client credentials) — visual verification has to
  happen either via the `visualize` mockup tool (design review before
  coding) or by asking the user to check in their own browser after
  deploy. Don't claim visual verification that didn't happen.
- Commit messages in this session explain the _why_, not just the _what_
  (see recent `git log` on `main` for the established tone/style) — keep
  matching it.
