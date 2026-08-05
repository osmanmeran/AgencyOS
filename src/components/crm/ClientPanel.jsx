import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Mail,
  Phone,
  MapPin,
  Building,
  CreditCard,
  FileText,
  Plane,
  DollarSign,
  Star,
  Edit2,
  Check,
  X,
  ExternalLink,
  Clock,
  Send,
  MessageSquare,
  ChevronRight,
  Globe,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { format } from 'date-fns';
import EmailComposer from './EmailComposer';
import ClientTasksPanel from '@/components/clients/ClientTasksPanel';
import { colleaguesOf } from '../../lib/companySearch';
import CompanyPicker from './CompanyPicker';
import { useT } from '@/lib/i18n/I18nContext';
import { getCurrencySymbol } from '@/lib/formatters';

const STATUS_COLORS = {
  active: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  inactive: 'bg-muted text-muted-foreground border-border',
  vip: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  cancelled: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
};

const PROPOSAL_STATUS_COLORS = {
  delivered: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  approved: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  rejected: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  changed: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
};

const INVOICE_STATUS_COLORS = {
  draft: 'bg-muted text-foreground',
  sent: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  paid: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  overdue: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function ClientPanel({ client, onClientUpdated }) {
  const { t } = useT();
  const STATUS_LABEL_KEYS = {
    active: t('common.active'),
    vip: t('clientCRM.vip'),
    inactive: t('common.inactive'),
    cancelled: t('common.cancelled'),
  };
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(/** @type {any} */ ({}));
  const [composerState, setComposerState] = useState({ open: false, proposal: null, invoice: null });
  const queryClient = useQueryClient();

  const { data: proposals = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientProposals', client.id],
      queryFn: () => db.entities.Proposal.filter({ client_id: client.id }, '-created_date'),
    })
  );

  const { data: invoices = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientInvoices', client.id],
      queryFn: () => db.entities.Invoice.filter({ client_id: client.id }, '-created_date'),
    })
  );

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientTrips', client.id],
      queryFn: () => db.entities.Trip.filter({ client_id: client.id }, '-created_date'),
    })
  );

  const { data: emailLogs = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['emailLogs', client.id],
      queryFn: () => db.entities.EmailLog.filter({ client_id: client.id }, '-created_date'),
    })
  );

  const { data: messages = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientMessages', client.id],
      queryFn: () => db.entities.Message.filter({ client_id: client.id }, '-created_date'),
    })
  );

  // Same query key/shape as ClientTasksPanel's own internal query, so this
  // (used only for the tab badge count) shares its cache entry rather than
  // firing a second fetch.
  const { data: allClientTasks = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientTasks', client.id],
      queryFn: () => db.tasks.list({ customer_id: client.id, sort: '-created_date' }),
    })
  );
  const pendingTaskCount = allClientTasks.filter(
    (task) => !task.template_key && task.status !== 'completed' && task.status !== 'cancelled',
  ).length;

  // Shares the ['clients'] cache with the CRM list, so this is usually instant.
  const { data: allClients = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clients'],
      queryFn: () => db.entities.Client.list('-created_date'),
    })
  );

  const colleagues = colleaguesOf(client, allClients);

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.Client.update(client.id, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        onClientUpdated();
        setEditing(false);
      },
    })
  );

  const startEdit = () => {
    setEditForm({ ...client });
    setEditing(true);
  };

  const set = (field, value) => setEditForm((prev) => ({ ...prev, [field]: value }));

  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.total_amount || 0), 0);
  const totalOwed = invoices
    .filter((i) => ['sent', 'overdue'].includes(i.status))
    .reduce((s, i) => s + (i.amount_due || i.total_amount || 0), 0);

  const timeline = [
    ...messages.map((m) => ({ type: 'message', date: m.created_date, item: m })),
    ...proposals.map((p) => ({ type: 'proposal', date: p.created_date, item: p })),
    ...invoices.map((i) => ({ type: 'invoice', date: i.created_date, item: i })),
    ...trips.map((trip) => ({ type: 'trip', date: trip.created_date, item: trip })),
    ...emailLogs.map((e) => ({ type: 'email', date: e.created_date, item: e })),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border bg-gradient-to-r from-muted to-blue-50 dark:to-blue-950/40">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${
                client.status === 'vip'
                  ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                  : 'bg-gradient-to-br from-blue-500 to-blue-600'
              }`}
            >
              <span className="text-white font-bold text-lg">
                {(client.name || '?')
                  .split(' ')
                  .map((s) => s[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-foreground">{client.name}</h2>
                {client.status === 'vip' && (
                  <Star className="w-4 h-4 text-purple-500 dark:text-purple-300 fill-purple-500" />
                )}
                <Badge className={`text-[10px] font-medium border ${STATUS_COLORS[client.status]}`}>
                  {STATUS_LABEL_KEYS[client.status] || client.status || STATUS_LABEL_KEYS.active}
                </Badge>
              </div>
              {client.company && (
                <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Building className="w-3 h-3" />
                  {client.company_id ? (
                    <Link
                      to={createPageUrl(`CompanyDetails?id=${client.company_id}`)}
                      className="hover:text-indigo-600 dark:hover:text-indigo-300 hover:underline"
                    >
                      {client.company}
                    </Link>
                  ) : (
                    client.company
                  )}
                  {colleagues.length > 0 && (
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
                      +
                      {colleagues.length === 1
                        ? t('clientPanel.colleagueSingular', { count: colleagues.length })
                        : t('clientPanel.colleaguePlural', { count: colleagues.length })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={startEdit}>
              <Edit2 className="w-3 h-3 mr-1" />
              {t('common.edit')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setComposerState({ open: true, proposal: null, invoice: null })}
            >
              <Send className="w-3 h-3 mr-1" />
              {t('common.email')}
            </Button>
            <Link to={createPageUrl(`ClientDetails?id=${client.id}`)}>
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                <ExternalLink className="w-3 h-3 mr-1" />
                {t('clientPanel.fullProfile')}
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick contact */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          {client.email && (
            <a
              href={`mailto:${client.email}`}
              className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
            >
              <Mail className="w-3 h-3" />
              {client.email}
            </a>
          )}
          {client.phone && (
            <a
              href={`tel:${client.phone}`}
              className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
            >
              <Phone className="w-3 h-3" />
              {client.phone}
            </a>
          )}
          {(client.city || client.country) && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {[client.city, client.country].filter(Boolean).join(', ')}
            </span>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <div className="bg-card rounded-xl p-3 shadow-sm border border-border">
            <div className="text-[10px] text-muted-foreground mb-0.5 font-medium uppercase tracking-wider">
              {t('clientPanel.proposalsStat')}
            </div>
            <div className="font-bold text-foreground text-lg">{proposals.length}</div>
          </div>
          <div className="bg-card rounded-xl p-3 shadow-sm border border-border">
            <div className="text-[10px] text-muted-foreground mb-0.5 font-medium uppercase tracking-wider">
              {t('clientPanel.tripsStat')}
            </div>
            <div className="font-bold text-foreground text-lg">{trips.length}</div>
          </div>
          <div className="bg-card rounded-xl p-3 shadow-sm border border-border">
            <div className="text-[10px] text-muted-foreground mb-0.5 font-medium uppercase tracking-wider">
              {t('clientPanel.paidStat')}
            </div>
            <div className="font-bold text-green-700 dark:text-green-300 text-lg">
              {getCurrencySymbol(client.preferred_currency || 'USD')}
              {totalPaid.toFixed(0)}
            </div>
          </div>
          <div className="bg-card rounded-xl p-3 shadow-sm border border-border">
            <div className="text-[10px] text-muted-foreground mb-0.5 font-medium uppercase tracking-wider">
              {t('clientPanel.outstandingStat')}
            </div>
            <div className="font-bold text-orange-600 dark:text-orange-300 text-lg">
              {getCurrencySymbol(client.preferred_currency || 'USD')}
              {totalOwed.toFixed(0)}
            </div>
          </div>
        </div>
      </div>

      <EmailComposer
        open={composerState.open}
        onClose={() => setComposerState({ open: false, proposal: null, invoice: null })}
        client={client}
        proposal={composerState.proposal}
        invoice={composerState.invoice}
      />

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="activity" className="h-full flex flex-col">
          <TabsList className="mx-4 mt-3 mb-0 bg-muted p-0.5 gap-0">
            <TabsTrigger value="activity" className="text-xs data-[state=active]:bg-card">
              {t('clientPanel.activityTab')}
            </TabsTrigger>
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-card">
              {t('clientPanel.detailsTab')}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs data-[state=active]:bg-card">
              {t('clientPanel.tasksTab')} {pendingTaskCount > 0 && `(${pendingTaskCount})`}
            </TabsTrigger>
            <TabsTrigger value="proposals" className="text-xs data-[state=active]:bg-card">
              {t('clientPanel.proposalsTab', { count: proposals.length })}
            </TabsTrigger>
            <TabsTrigger value="invoices" className="text-xs data-[state=active]:bg-card">
              {t('clientPanel.invoicesTab', { count: invoices.length })}
            </TabsTrigger>
            <TabsTrigger value="trips" className="text-xs data-[state=active]:bg-card">
              {t('clientPanel.tripsTab', { count: trips.length })}
            </TabsTrigger>
          </TabsList>

          {/* ACTIVITY FEED (default tab — HubSpot style) */}
          <TabsContent value="activity" className="px-6 py-4 flex-1 overflow-y-auto">
            {timeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Clock className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">{t('clientPanel.noActivityYet')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {timeline.slice(0, 30).map((entry, idx) => {
                  const { type, date, item } = entry;
                  const isEmail = type === 'email';
                  const isProposal = type === 'proposal';
                  const isInvoice = type === 'invoice';
                  //                   const isTrip = type === 'trip';
                  const isMessage = type === 'message';

                  let Icon, color, label, sublabel, href;
                  if (isEmail) {
                    Icon = Mail;
                    color = 'bg-violet-100 text-violet-600';
                    label = t('clientPanel.emailSent');
                    sublabel = item.subject;
                  } else if (isMessage) {
                    Icon = MessageSquare;
                    color = 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-300';
                    label =
                      item.sender_type === 'client' ? t('clientPanel.clientMessage') : t('clientPanel.agentMessage');
                    sublabel = item.content?.slice(0, 80);
                  } else if (isProposal) {
                    Icon = FileText;
                    color = 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300';
                    label = item.title;
                    sublabel = t('clientPanel.proposalSublabel', { status: item.status });
                    href = createPageUrl(`ProposalDetails?id=${item.id}`);
                  } else if (isInvoice) {
                    Icon = DollarSign;
                    color = 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300';
                    label = item.invoice_number;
                    sublabel = `${getCurrencySymbol(item.currency || 'USD')}${(item.total_amount || 0).toFixed(0)} · ${item.status}`;
                    href = createPageUrl(`InvoiceDetails?id=${item.id}`);
                  } else {
                    Icon = Plane;
                    color = 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300';
                    label = item.name;
                    sublabel = item.destination || t('clientPanel.tripFallbackLabel');
                    href = createPageUrl(`ReservationDetails?id=${item.id}`);
                  }

                  const content = (
                    <div className="flex items-start gap-3 py-2.5 group hover:bg-muted px-2 rounded-lg transition-colors -mx-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${color} mt-0.5`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground text-sm">{label}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                            {date ? format(new Date(date), 'MMM d, HH:mm') : ''}
                          </span>
                        </div>
                        {sublabel && <div className="text-xs text-muted-foreground truncate mt-0.5">{sublabel}</div>}
                        {isMessage && item.content && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.content}</div>
                        )}
                        {isEmail && item.to_email && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {t('clientPanel.toEmailLabel', { email: item.to_email })}
                          </div>
                        )}
                      </div>
                      {href && (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      )}
                    </div>
                  );

                  return href ? (
                    <Link key={idx} to={href} className="block">
                      {content}
                    </Link>
                  ) : (
                    <div key={idx}>{content}</div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* OVERVIEW — Details */}
          <TabsContent value="overview" className="px-6 py-4 flex-1 overflow-y-auto space-y-6">
            {editing ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('clientPanel.editContactTitle')}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">{t('crm.company')}</Label>
                    <CompanyPicker
                      value={editForm.company_id}
                      companyName={editForm.company}
                      onChange={({ company_id, company }) => setEditForm((prev) => ({ ...prev, company_id, company }))}
                    />
                  </div>
                  {[
                    ['name', t('crm.fullName'), 'text'],
                    ['email', t('common.email'), 'email'],
                    ['phone', t('common.phone'), 'text'],
                    ['address', t('common.address'), 'text'],
                    ['city', t('common.city'), 'text'],
                    ['region', t('companyDetails.region'), 'text'],
                    ['country', t('common.country'), 'text'],
                    ['website', t('companyDetails.website'), 'text'],
                    ['passport_number', t('clientPanel.passportLabel'), 'text'],
                    ['tax_id', t('crm.taxId'), 'text'],
                    ['date_of_birth', t('crm.dateOfBirth'), 'date'],
                  ].map(([field, label, type]) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <Input
                        type={type}
                        value={editForm[field] || ''}
                        onChange={(e) => set(field, e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <Label className="text-xs">{t('common.status')}</Label>
                    <Select value={editForm.status || 'active'} onValueChange={(v) => set('status', v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t('common.active')}</SelectItem>
                        <SelectItem value="vip">{t('clientCRM.vip')}</SelectItem>
                        <SelectItem value="inactive">{t('common.inactive')}</SelectItem>
                        <SelectItem value="cancelled">{t('common.cancelled')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('clientPanel.typeLabel')}</Label>
                    <Select value={editForm.type || 'client'} onValueChange={(v) => set('type', v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">{t('clientPanel.clientTypeOption')}</SelectItem>
                        <SelectItem value="supplier">{t('clientPanel.supplierTypeOption')}</SelectItem>
                        <SelectItem value="representative">{t('clientPanel.representativeTypeOption')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('common.notes')}</Label>
                  <Textarea
                    value={editForm.notes || ''}
                    onChange={(e) => set('notes', e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                    <X className="w-3.5 h-3.5 mr-1" />
                    {t('common.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => updateMutation.mutate(editForm)}
                    disabled={updateMutation.isPending}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    {updateMutation.isPending ? t('common.saving') : t('common.save')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Contact info grid */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                  {client.email && (
                    <Info icon={Mail} label={t('common.email')} value={client.email} href={`mailto:${client.email}`} />
                  )}
                  {client.phone && (
                    <Info icon={Phone} label={t('common.phone')} value={client.phone} href={`tel:${client.phone}`} />
                  )}
                  {(client.city || client.country) && (
                    <Info
                      icon={MapPin}
                      label={t('clientPanel.locationLabel')}
                      value={[client.city, client.country].filter(Boolean).join(', ')}
                    />
                  )}
                  {client.company && <Info icon={Building} label={t('crm.company')} value={client.company} />}
                  {client.payment_method && (
                    <Info
                      icon={CreditCard}
                      label={t('clientPanel.paymentLabel')}
                      value={client.payment_method.replace('_', ' ')}
                    />
                  )}
                  {client.website && (
                    <Info
                      icon={Globe}
                      label={t('companyDetails.website')}
                      value={client.website}
                      href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                    />
                  )}
                  {client.passport_number && (
                    <Info icon={FileText} label={t('clientPanel.passportLabel')} value={client.passport_number} />
                  )}
                  {client.tax_id && <Info icon={FileText} label={t('crm.taxId')} value={client.tax_id} />}
                  {client.date_of_birth && (
                    <Info
                      icon={Clock}
                      label={t('crm.dateOfBirth')}
                      value={format(new Date(client.date_of_birth), 'MMM d, yyyy')}
                    />
                  )}
                </div>
                {client.company && colleagues.length > 0 && (
                  <div className="border border-border rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Building className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        {t('clientPanel.alsoAtLabel', { company: client.company, count: colleagues.length })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {colleagues.map((col) => (
                        <Link
                          key={col.id}
                          to={createPageUrl(`ClientDetails?id=${col.id}`)}
                          className="flex items-center gap-2.5 p-1.5 -mx-1.5 rounded-lg hover:bg-muted transition-colors group"
                        >
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {(col.name || '?')
                              .split(' ')
                              .map((s) => s[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-foreground truncate">{col.name}</div>
                            {col.email && <div className="text-[11px] text-muted-foreground truncate">{col.email}</div>}
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {client.address && (
                  <div className="bg-muted rounded-xl p-4">
                    <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
                      {t('common.address')}
                    </div>
                    <div className="text-sm text-foreground">{client.address}</div>
                  </div>
                )}
                {client.notes && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-100 rounded-xl p-4">
                    <div className="text-[10px] font-semibold text-yellow-700 dark:text-yellow-300 uppercase tracking-wider mb-1">
                      {t('clientProfile.internalNotes')}
                    </div>
                    <div className="text-sm text-foreground whitespace-pre-wrap">{client.notes}</div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* TASKS */}
          <TabsContent value="tasks" className="px-6 py-4 flex-1 overflow-y-auto">
            <ClientTasksPanel clientId={client.id} />
          </TabsContent>

          {/* PROPOSALS, INVOICES, TRIPS (same as before) */}
          <TabsContent value="proposals" className="px-6 py-4 space-y-3 flex-1 overflow-y-auto">
            {proposals.length === 0 ? (
              <EmptyState icon={FileText} label={t('clientPanel.noProposalsYet')} />
            ) : (
              proposals.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted transition-all gap-2"
                >
                  <Link to={createPageUrl(`ProposalDetails?id=${p.id}`)} className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm">{p.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.destination} · {p.created_date ? format(new Date(p.created_date), 'MMM d, yyyy') : ''}
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {p.total_cost > 0 && (
                      <span className="text-sm font-bold text-green-700 dark:text-green-300">
                        {getCurrencySymbol((p.services || []).map((s) => s.client_currency).find(Boolean) || 'USD')}
                        {p.total_cost.toFixed(0)}
                      </span>
                    )}
                    <Badge className={`text-xs ${PROPOSAL_STATUS_COLORS[p.status]}`}>{p.status}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={() => setComposerState({ open: true, proposal: p, invoice: null })}
                    >
                      <Send className="w-3 h-3" />
                      {t('clientPanel.sendButton')}
                    </Button>
                    <Link to={createPageUrl(`ProposalDetails?id=${p.id}`)}>
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="invoices" className="px-6 py-4 space-y-3 flex-1 overflow-y-auto">
            {invoices.length === 0 ? (
              <EmptyState icon={DollarSign} label={t('clientPanel.noInvoicesYet')} />
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted transition-all gap-2"
                >
                  <Link to={createPageUrl(`InvoiceDetails?id=${inv.id}`)} className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm">{inv.invoice_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {t('clientPanel.dueLabel', {
                        date: inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '—',
                      })}
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-bold text-foreground">
                      {getCurrencySymbol(inv.currency || 'USD')}
                      {(inv.total_amount || 0).toFixed(0)}
                    </span>
                    <Badge className={`text-xs ${INVOICE_STATUS_COLORS[inv.status]}`}>{inv.status}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={() => setComposerState({ open: true, proposal: null, invoice: inv })}
                    >
                      <Send className="w-3 h-3" />
                      {t('clientPanel.sendButton')}
                    </Button>
                    <Link to={createPageUrl(`InvoiceDetails?id=${inv.id}`)}>
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="trips" className="px-6 py-4 space-y-3 flex-1 overflow-y-auto">
            {trips.length === 0 ? (
              <EmptyState icon={Plane} label={t('clientPanel.noTripsYet')} />
            ) : (
              trips.map((trip) => (
                <Link key={trip.id} to={createPageUrl(`ReservationDetails?id=${trip.id}`)}>
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted hover:border-blue-200 dark:hover:border-blue-800 transition-all">
                    <div>
                      <div className="font-medium text-foreground text-sm">{trip.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {trip.destination} · {trip.start_date ? format(new Date(trip.start_date), 'MMM d') : ''} –{' '}
                        {trip.end_date ? format(new Date(trip.end_date), 'MMM d, yyyy') : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {trip.status}
                      </Badge>
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value, href = '' }) {
  const content = (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</div>
        <div className="text-sm text-foreground font-medium">{value || '—'}</div>
      </div>
    </div>
  );
  if (href)
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:bg-muted rounded-lg p-1 -m-1 transition-colors"
      >
        {content}
      </a>
    );
  return content;
}

function EmptyState({ icon: Icon, label }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon className="w-10 h-10 mb-2 opacity-20" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
