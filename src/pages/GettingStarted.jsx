import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  PlaneTakeoff,
  FileText,
  CreditCard,
  MapPin,
  ListChecks,
  Search,
  ArrowRight,
} from 'lucide-react';

// Static reference guide (no progress tracking, no interactive tour library —
// just a table of contents + short instructions + a link into the real page
// for each core workflow). Not gated by permission: every staff tier benefits
// from knowing where things are.
const SECTIONS = [
  {
    key: 'suppliers',
    icon: Building2,
    title: 'Suppliers & Pricing',
    steps: [
      'Suppliers → New Supplier: name, category/subcategory, city, contact details.',
      'Open the supplier → Pricing tab to add pricing tiers (per-category, min/max participants → price).',
      'Optional: use "Search Web" on the New Supplier form to auto-fill contact details from OpenStreetMap/Wikipedia/Yelp.',
    ],
    page: 'Suppliers',
    cta: 'Go to Suppliers',
  },
  {
    key: 'clients',
    icon: Users,
    title: 'Clients & CRM',
    steps: [
      "CRM → New Client: contact details, and a Company (searchable, created inline if it doesn't exist yet).",
      'Drag a client card across the Kanban pipeline: lead → contacted → proposal → negotiation → won/lost.',
      'From a client\'s page, "Grant Client Portal Access" lets them log in to view proposals/invoices/trips and browse the tour catalog.',
    ],
    page: 'ClientCRM',
    cta: 'Go to CRM',
  },
  {
    key: 'trips',
    icon: PlaneTakeoff,
    title: 'Trips / Reservations',
    steps: [
      'Reservations → New Reservation: client, dates, services (hotels, transfers, tours, etc.).',
      'Open a trip → Itinerary tab to build a day-by-day plan with drag-and-drop.',
      'Recurring tours/packages: set up a Tour Contract once, then "Generate from Contract" for each new booking.',
    ],
    page: 'Reservations',
    cta: 'Go to Reservations',
  },
  {
    key: 'proposals',
    icon: FileText,
    title: 'Proposals & Quotes',
    steps: [
      'Create Proposal: build a priced itinerary to send a prospective client before they book.',
      'Track status as it moves: delivered → changed → approved/rejected.',
      'RFP Manager runs the same idea in reverse — request quotes from suppliers for a service you need.',
    ],
    page: 'CreateProposal',
    cta: 'Go to Proposals',
  },
  {
    key: 'invoices',
    icon: CreditCard,
    title: 'Invoices & Payments',
    steps: [
      'Create Invoice: line items, tax, due date — linked to a client and (optionally) a trip.',
      'Record Payment logs a manual payment (bank transfer, cash, etc.) against an invoice.',
      'If Stripe is connected (Settings → Payments), use "Generate Payment Link" on the invoice to collect payment online, or let the client pay from their own portal.',
    ],
    page: 'Revenue',
    cta: 'Go to Invoices',
  },
  {
    key: 'tours',
    icon: MapPin,
    title: 'Guided Tours (Catalog)',
    steps: [
      'Daily/Multi-Day Tours: pricing tiers, occupancy limits, per-language descriptions, cover photos.',
      'Flag a tour as Featured or add a time-limited Special Offer discount — both show automatically in the Client Portal catalog.',
    ],
    page: 'DailyTours',
    cta: 'Go to Tours',
  },
  {
    key: 'tasks',
    icon: ListChecks,
    title: 'Tasks & Reminders',
    steps: [
      'Task Board: a Kanban of to-dos/reminders/notes, assignable to any staff user, filterable to "My tasks."',
      'Every new Trip auto-generates a few operational tasks (collect balance, send rooming list, issue tickets) tied to its departure date — no setup needed.',
    ],
    page: 'TaskBoard',
    cta: 'Go to Task Board',
  },
  {
    key: 'search',
    icon: Search,
    title: 'Finding things fast',
    steps: [
      'The search bar in the top nav is full-text across trips, clients, proposals, invoices, and suppliers.',
      'Reference numbers (e.g. a reservation code) can be searched directly if you have the "Search References" permission.',
    ],
  },
];

export default function GettingStarted() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Getting Started</h1>
        <p className="text-muted-foreground">
          A quick tour of the core workflows. Each section links straight into the real page — the best way to learn is
          to just try it on a test record.
        </p>
      </div>

      {/* Jump-to nav — the page is long, this keeps it scannable. */}
      <Card className="p-4 bg-card">
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a
              key={s.key}
              href={`#${s.key}`}
              className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {s.title}
            </a>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.key} id={section.key} className="p-5 bg-card scroll-mt-4">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg shrink-0 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-semibold text-foreground text-lg">{section.title}</h3>
                    {section.page && (
                      <Link to={createPageUrl(section.page)}>
                        <Button variant="outline" size="sm" className="gap-1">
                          {section.cta}
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                  <ol className="mt-3 space-y-2 list-decimal list-inside text-sm text-muted-foreground">
                    {section.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
