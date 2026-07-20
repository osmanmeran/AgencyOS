import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ChevronDown,
  ChevronRight,
  Search,
  HelpCircle,
  Mail,
  FileText,
  Users,
  Shield,
  FileDown,
  Calendar,
  SendHorizontal,
  DollarSign,
  Building2,
} from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

const CATEGORIES = [
  { key: 'general', label: 'General', icon: HelpCircle },
  { key: 'account', label: 'Account & Users', icon: Users },
  { key: 'bookings', label: 'Bookings & Reservations', icon: FileText },
  { key: 'tasks', label: 'Calendar & Tasks', icon: Calendar },
  { key: 'suppliers', label: 'Suppliers & RFP', icon: SendHorizontal },
  { key: 'email', label: 'Email & Notifications', icon: Mail },
  { key: 'permissions', label: 'Roles & Permissions', icon: Shield },
  { key: 'documents', label: 'Documents & PDFs', icon: FileDown },
  { key: 'finance', label: 'Finance & Reports', icon: DollarSign },
  { key: 'saas', label: 'Workspaces & Tenants', icon: Building2 },
];

const FAQS = [
  {
    q: 'How do I create a new booking?',
    a: 'Navigate to Reservations in the top nav and click "New Reservation". Fill in the client details, select services, and save. You can also create bookings directly from a client profile.',
    category: 'bookings',
  },
  {
    q: 'How do I generate a proposal?',
    a: 'Click "New Proposal" in the nav bar or go to Proposals and click "Create Proposal". Add client details, services, pricing, and click Save. You can then download a PDF or send it via email.',
    category: 'bookings',
  },
  {
    q: 'How do I send an invoice?',
    a: 'Go to Invoices, create a new invoice with the client and line items. Once saved, click the email button to send it directly to the client. You can also download a PDF copy.',
    category: 'bookings',
  },
  {
    q: 'How do I reset my password?',
    a: 'Click your avatar in the top-right, go to your profile settings, and use the "Change Password" section. You\'ll need your current password to set a new one.',
    category: 'account',
  },
  {
    q: 'How do I add a new user to the system?',
    a: 'Go to Settings > User Management (shield icon in the nav). Click "Add User", fill in the email, name, and password, and assign a role tier. The user will receive access immediately.',
    category: 'permissions',
  },
  {
    q: 'What are the user tiers and what can they do?',
    a: "There are four staff tiers: Admin — full system control, including user management and app settings (the only tier that can delete records); Manager — full operations management, can create/modify/cancel trips, invoices, suppliers, clients, proposals, and services (no delete); Agent — daily ops: creates trips/invoices/proposals, can view all trips but can't modify or cancel them, edits supplier pricing, and handles B2B quote requests; Accounting — read-only access to trips, invoices, reports, search, and export. Each tier's defaults can be overridden per user in Permission Manager. Client and Supplier portal accounts don't use these tiers at all — their access is limited to their own data.",
    category: 'permissions',
  },
  {
    q: 'How do I attach a file to a client or booking?',
    a: 'Open the client or booking detail page and use the document upload section. You can upload images, PDFs, Word docs, and spreadsheets. Uploaded files are linked to the entity and accessible from its detail view.',
    category: 'documents',
  },
  {
    q: 'How do I download a PDF of a proposal/invoice?',
    a: 'On the proposal or invoice detail page, click the "Download PDF" button. The PDF will be generated server-side and downloaded automatically. You can also generate PDFs from the PDF generation endpoint in the API.',
    category: 'documents',
  },
  {
    q: 'Can I send emails from the app?',
    a: 'Yes. Go to Settings and connect your Microsoft 365/Outlook account under the Outlook section. Once connected, you can send emails directly from client profiles, booking details, and the email composer.',
    category: 'email',
  },
  {
    q: 'How do real-time notifications work?',
    a: 'When someone creates or updates a booking, invoice, or proposal, a notification appears in the bell icon in the top nav bar. Notifications arrive in real-time via WebSocket — no page refresh needed.',
    category: 'email',
  },
  {
    q: 'How do I change the app language?',
    a: 'Click your avatar in the top-right, hover over the Language option, and select your preferred language. The app supports English, Spanish, French, German, Italian, Turkish, and Portuguese.',
    category: 'general',
  },
  {
    q: 'How do I enable dark mode?',
    a: 'Click the sun/moon icon in the top nav bar next to the notification bell. You can choose Light, Dark, or System mode (follows your OS setting).',
    category: 'general',
  },
  {
    q: 'Where can I see the audit trail?',
    a: 'Admins can access the Audit Trail from the admin nav section (History icon). It shows all state-changing actions: who did what, when, and what changed. Filter by entity type, action, or user.',
    category: 'general',
  },
  {
    q: 'How does the global search work?',
    a: 'Press Ctrl+K (Cmd+K on Mac) to open the command palette. Start typing to search across clients, bookings, suppliers, invoices, and proposals. Results are grouped by type.',
    category: 'general',
  },
  {
    q: 'Can I customize invoice headers and branding?',
    a: 'Yes. Go to Settings and scroll to the Invoice Header section. You can add your company name, address, tax ID, bank details, and logo. These details appear on all generated invoices.',
    category: 'general',
  },
  {
    q: 'What file types are supported for upload?',
    a: 'The system accepts images (JPEG, PNG, GIF, WebP, SVG), PDFs, plain text, CSV, Word documents (DOC/DOCX), Excel spreadsheets (XLS/XLSX), and JSON files. Maximum file size is 20 MB.',
    category: 'documents',
  },
  {
    q: 'How do I import data into the system?',
    a: 'Go to Settings > Import Hub. You can import suppliers from CSV files, analyze market pricing, and import contacts from Outlook. The import hub guides you through each format.',
    category: 'general',
  },
  {
    q: 'Why did my session expire?',
    a: 'Sessions expire after 24 hours for security. If you see a login prompt, just sign in again — your data is preserved.',
    category: 'account',
  },
  {
    q: 'How do I use the Calendar view?',
    a: 'Go to "Calendar" in the top nav. The month grid shows all trips color-coded by status (planning/confirmed/in_progress/completed/cancelled). Click any date to see day details in the side panel. Use the arrows to navigate between months.',
    category: 'tasks',
  },
  {
    q: 'How does the Task Board work?',
    a: 'Go to "Tasks" in the top nav. The Kanban board has three columns: Pending, In Progress, and Done. Drag cards between columns or click "New Task" to create one. Each task can have a client, priority (low/medium/high), and due date.',
    category: 'tasks',
  },
  {
    q: 'Are tasks created automatically when I create a booking?',
    a: "Yes. Saving a new Trip auto-generates three operational tasks tied to its departure date: Collect Final Balance (due 30 days before, High priority), Send Rooming List to Hotel (due 14 days before, Medium), and Issue Tickets / Final Docs (due 7 days before, Critical). They are linked to the booking and customer and assigned to the booking's creator. If those tasks already exist they are resynced rather than duplicated.",
    category: 'tasks',
  },
  {
    q: "What happens to tasks if I change a trip's departure date?",
    a: 'The tasks auto-generated from that Trip are rescheduled automatically — each due date (and SLA window) is recomputed from the new departure date. Tasks you created manually keep their own dates.',
    category: 'tasks',
  },
  {
    q: 'What do the SLA / escalation flags mean on tasks?',
    a: 'Each task has an escalation trigger time based on its priority (Critical 48h, High 24h, Medium 12h, Low 0 before the due date). Once that passes and the task is still open it is flagged "escalated". Separately, a task is "due soon" in the 24 hours before its due date — that drives the priority banner / countdown in the booking view. Both flags are computed live, so no manual action is needed.',
    category: 'tasks',
  },
  {
    q: 'How do I request quotes from multiple suppliers at once?',
    a: 'Go to Suppliers > RFP Manager (or navigate directly to the RFP Manager page). Click "New RFP" and follow the 3-step wizard: (1) enter service details like name, quantity, and deadline, (2) select suppliers individually or filter by category, (3) review and send. Each supplier gets a Booking Request that you can track through pending → quoted → confirmed/rejected.',
    category: 'suppliers',
  },
  {
    q: 'How do I track agent commissions?',
    a: 'Go to Revenue > Commission Report. It calculates commissions from completed/confirmed trips based on profit × commission rate. The dashboard shows total revenue, profit, commission, and average rate. Bar and pie charts break down commission by agent. Use the Export CSV button to download the data.',
    category: 'finance',
  },
  {
    q: 'Can clients request a quote online?',
    a: 'Yes, two ways. (1) Share the public link /request-quote with potential clients — the form collects name, email, destination, dates, traveler count, budget, and trip description, and creates a new lead with source "web_quote_request". (2) Existing B2B clients with portal access can log in, browse the curated e-shop catalog, and submit a quote request directly.',
    category: 'general',
  },
  {
    q: 'How does B2B client quoting work?',
    a: 'Client portal accounts see an e-shop-style catalog of services (organized by category and supplier, with photos) priced with their markup automatically applied. They pick services and submit a quote request. Your team reviews it in Quote Requests, can adjust pricing or availability, and approves or rejects it. Once approved, the quote converts into a reservation.',
    category: 'bookings',
  },
  {
    q: 'How does the multi-currency dashboard work?',
    a: 'Go to Revenue and select the "Multi-Currency" tab. Choose a base currency (USD, EUR, GBP, etc.) and the dashboard converts all invoices and trip costs using live exchange rates. Bar charts show revenue by currency and by month, all converted to your selected base currency.',
    category: 'finance',
  },
  {
    q: 'What automated reminders exist?',
    a: 'The system runs hourly checks: (1) invoices due in 3 days trigger a "due soon" notification, (2) overdue invoices trigger an "overdue" notification, (3) trips starting tomorrow trigger a "trip starting soon" notification. Notifications appear in the bell icon. Reminders are deduplicated so you won\'t get the same alert twice in 24 hours.',
    category: 'email',
  },
  {
    q: 'How do I create and manage extra columns in the supplier table?',
    a: 'On the Suppliers page, click "Columns" (admin only) to add custom fields like contact info, tags, or region. These appear as new columns in the table and as editable fields in the supplier form.',
    category: 'suppliers',
  },
  {
    q: 'How does the supplier "Search Web" feature work?',
    a: 'Open a supplier and click "Search Web". The app queries several sources to find matching businesses and returns a list of candidates you can pick from: OpenStreetMap via Nominatim and Photon (both enriched through Overpass for phone, website, email, brand, and opening hours — Photon adds better fuzzy matching), Wikipedia, Wikidata (official site / phone / email), and optionally Yelp Fusion (phone, rating, reviews, categories) when a YELP_API_KEY is configured. Pick one and click "Apply Data" to autofill the supplier\'s name, address, phone, website, email, rating, and notes (including brand and opening hours) into the edit form. Queries broaden automatically (name + city → bare name → stripped of generic words) so it still finds suppliers whose listed name differs from the official one.',
    category: 'suppliers',
  },
  {
    q: 'What is a workspace?',
    a: "Marvelops is multi-tenant: every travel agency runs inside its own isolated workspace (tenant). Each workspace has its own database, users, clients, suppliers, and bookings — your agency's data is completely separate from every other agency on the platform, with no shared records across workspaces.",
    category: 'saas',
  },
  {
    q: "How do I open my agency's workspace?",
    a: "Each workspace has its own subdomain. Visit <your-agency>.marvelops.app (for example acme.marvelops.app) to land directly in your agency's workspace. Bookmarks and shared links should use your subdomain so you always return to the right workspace.",
    category: 'saas',
  },
  {
    q: "Is my agency's data kept separate from other agencies?",
    a: "Yes. Workspaces are isolated at the database level — each agency's data lives in its own dedicated database file. There is no shared table across agencies, so a user in one workspace can never see or modify another agency's records, even through real-time notifications or live updates.",
    category: 'saas',
  },
  {
    q: 'Can our agency sign in with our own Microsoft / Office 365 accounts?',
    a: "Yes. Each workspace can connect its own Azure AD tenant for Microsoft single sign-on, so your team logs in with your organization's Microsoft accounts rather than a shared one. Your administrator sets the workspace's Microsoft tenant; if none is configured, the platform falls back to the default Microsoft app.",
    category: 'saas',
  },
  {
    q: 'How is a new workspace created?',
    a: 'New workspaces are provisioned by the platform administrator. Reach out to your account manager or support to set up an additional agency workspace; once provisioned you get your own subdomain and an isolated database.',
    category: 'saas',
  },
  {
    q: 'Can one login belong to more than one workspace?',
    a: "Each login is scoped to a single workspace via its subdomain. To work in a different agency, sign in through that agency's subdomain. A single account spanning multiple workspaces is not enabled in this release.",
    category: 'saas',
  },
];

export default function FAQ() {
  const { t: _t } = useT();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [openItems, setOpenItems] = useState(new Set());

  const filtered = FAQS.filter((faq) => {
    const matchesSearch =
      !search ||
      faq.q.toLowerCase().includes(search.toLowerCase()) ||
      faq.a.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleItem = (index) => {
    const next = new Set(openItems);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setOpenItems(next);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">{_t('faq.frequently')}</h1>
        <p className="text-slate-500 dark:text-slate-400">{_t('faq.find')}</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder={_t('faq.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 text-base"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeCategory === 'all'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          {_t('faq.all')}
        </button>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.key
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {cat.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400">{_t('faq.no')}</h3>
            <p className="text-sm text-slate-400 mt-1">{_t('faq.try')}</p>
          </Card>
        ) : (
          filtered.map((faq, _i) => {
            const idx = FAQS.indexOf(faq);
            const isOpen = openItems.has(idx);
            const cat = CATEGORIES.find((c) => c.key === faq.category);
            const CatIcon = cat?.icon || HelpCircle;
            return (
              <Card
                key={idx}
                className="overflow-hidden transition-shadow hover:shadow-md cursor-pointer dark:bg-slate-900 dark:border-slate-700"
                onClick={() => toggleItem(idx)}
              >
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 mt-0.5 flex-shrink-0">
                      <CatIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{faq.q}</h3>
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform" />
                        )}
                      </div>
                      {isOpen && (
                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{faq.a}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <div className="text-center py-8">
        <p className="text-sm text-slate-400 dark:text-slate-500">{_t('faq.still')}</p>
      </div>
    </div>
  );
}
