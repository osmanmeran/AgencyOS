import { db } from '@/lib/DbContext';

import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkeletonCard } from '@/components/ui/skeletons';
import { showSuccess, showError } from '@/lib/toast';
import {
  ArrowLeft,
  Building2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Users,
  DollarSign,
  Edit2,
  Check,
  X,
  Upload,
  FileText,
  CreditCard,
  ChevronRight,
  Star,
} from 'lucide-react';

const PAYMENT_METHODS = ['credit_card', 'bank_transfer', 'paypal', 'check', 'cash', 'other'];

const EDIT_FIELDS = [
  ['name', 'Company Name', 'text'],
  ['industry', 'Industry', 'text'],
  ['email', 'Email', 'email'],
  ['phone', 'Phone', 'text'],
  ['website', 'Website', 'text'],
  ['address', 'Address', 'text'],
  ['city', 'City', 'text'],
  ['region', 'Region / State', 'text'],
  ['country', 'Country', 'text'],
];

const BILLING_FIELDS = [
  ['tax_id', 'Tax ID / VAT', 'text'],
  ['invoice_address', 'Invoice Address', 'text'],
  ['default_markup', 'Default Markup %', 'number'],
];

export default function CompanyDetails() {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('id');
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(/** @type {any} */ ({}));
  const [uploading, setUploading] = useState(false);

  const { data: company, isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['company', companyId],
      queryFn: () => db.entities.Company.get(companyId),
      enabled: !!companyId,
    })
  );

  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clients'],
      queryFn: () => db.entities.Client.list('-created_date'),
    })
  );

  const { data: invoices = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['invoices'],
      queryFn: () => db.entities.Invoice.list('-created_date'),
    })
  );

  const contacts = useMemo(() => clients.filter((c) => c.company_id === companyId), [clients, companyId]);
  const contactIds = useMemo(() => new Set(contacts.map((c) => c.id)), [contacts]);

  const rollup = useMemo(() => {
    const companyInvoices = invoices.filter((i) => contactIds.has(i.client_id));
    const paid = companyInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.total_amount || 0), 0);
    const owed = companyInvoices
      .filter((i) => ['sent', 'overdue'].includes(i.status))
      .reduce((s, i) => s + (i.amount_due || i.total_amount || 0), 0);
    return { paid, owed, invoiceCount: companyInvoices.length };
  }, [invoices, contactIds]);

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.Company.update(companyId, data),
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: ['company', companyId] });
        queryClient.invalidateQueries({ queryKey: ['companies'] });
        // Keep contacts' denormalized company name in sync if the name changed.
        if (updated?.name) {
          const stale = contacts.filter((c) => c.company !== updated.name);
          Promise.all(stale.map((c) => db.entities.Client.update(c.id, { company: updated.name }))).then(() =>
            queryClient.invalidateQueries({ queryKey: ['clients'] }),
          );
        }
        setEditing(false);
        showSuccess('Company updated');
      },
      onError: () => showError('Could not save company'),
    })
  );

  const startEdit = () => {
    setForm({ ...company });
    setEditing(true);
  };
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      set('logo_url', file_url);
    } catch {
      showError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (isLoading)
    return (
      <div className="max-w-5xl mx-auto">
        <SkeletonCard />
      </div>
    );
  if (!company) {
    return (
      <div className="max-w-5xl mx-auto text-center py-16">
        <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Company not found.</p>
        <Link
          to={createPageUrl('Companies')}
          className="text-indigo-600 dark:text-indigo-300 text-sm mt-2 inline-block"
        >
          Back to companies
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link
        to={createPageUrl('Companies')}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Companies
      </Link>

      {/* Header */}
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border bg-gradient-to-r from-muted to-indigo-50 dark:to-indigo-950/40">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className="w-16 h-16 rounded-2xl object-cover border border-border flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-bold text-xl flex items-center justify-center flex-shrink-0">
                  {(company.name || '?')
                    .split(' ')
                    .map((s) => s[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground truncate">{company.name}</h1>
                  <Badge
                    className={`text-[10px] ${company.status === 'inactive' ? 'bg-muted text-muted-foreground' : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'}`}
                  >
                    {company.status || 'active'}
                  </Badge>
                </div>
                {company.industry && <div className="text-sm text-muted-foreground">{company.industry}</div>}
                <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                  {company.website && (
                    <a
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-300"
                    >
                      <Globe className="w-3 h-3" />
                      {company.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  {company.email && (
                    <a
                      href={`mailto:${company.email}`}
                      className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-300"
                    >
                      <Mail className="w-3 h-3" />
                      {company.email}
                    </a>
                  )}
                  {company.phone && (
                    <a
                      href={`tel:${company.phone}`}
                      className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-300"
                    >
                      <Phone className="w-3 h-3" />
                      {company.phone}
                    </a>
                  )}
                  {(company.city || company.country) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {[company.city, company.country].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {!editing && (
              <Button variant="outline" size="sm" className="h-8 text-xs flex-shrink-0" onClick={startEdit}>
                <Edit2 className="w-3 h-3 mr-1" />
                Edit
              </Button>
            )}
          </div>

          {/* Rollup stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <Stat label="Contacts" value={contacts.length} icon={Users} tone="text-foreground" />
            <Stat
              label="Paid"
              value={`$${rollup.paid.toFixed(0)}`}
              icon={DollarSign}
              tone="text-green-700 dark:text-green-300"
            />
            <Stat
              label="Outstanding"
              value={`$${rollup.owed.toFixed(0)}`}
              icon={DollarSign}
              tone="text-orange-600 dark:text-orange-300"
            />
            <Stat label="Invoices" value={rollup.invoiceCount} icon={FileText} tone="text-foreground" />
          </div>
        </div>

        {/* Body */}
        {editing ? (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-4">
              {form.logo_url ? (
                <img src={form.logo_url} alt="" className="w-14 h-14 rounded-xl object-cover border border-border" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                  <Building2 className="w-6 h-6" />
                </div>
              )}
              <div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  {uploading ? 'Uploading…' : 'Upload logo'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {EDIT_FIELDS.map(([field, label, type]) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type={type}
                    value={form[field] || ''}
                    onChange={(e) => set(field, e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status || 'active'} onValueChange={(v) => set('status', v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Shared Billing
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BILLING_FIELDS.map(([field, label, type]) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type={type}
                      value={form[field] ?? ''}
                      onChange={(e) => set(field, type === 'number' ? Number(e.target.value) : e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label className="text-xs">Payment Method</Label>
                  <Select
                    value={form.payment_method || 'bank_transfer'}
                    onValueChange={(v) => set('payment_method', v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Preferred Currency</Label>
                  <Input
                    value={form.preferred_currency || 'USD'}
                    onChange={(e) => set('preferred_currency', e.target.value.toUpperCase())}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes || ''}
                onChange={(e) => set('notes', e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                <X className="w-3.5 h-3.5 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => updateMutation.mutate(form)}
                disabled={updateMutation.isPending}
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="contacts" className="w-full">
            <TabsList className="mx-6 mt-3 bg-muted">
              <TabsTrigger value="contacts" className="text-xs data-[state=active]:bg-card">
                Contacts ({contacts.length})
              </TabsTrigger>
              <TabsTrigger value="details" className="text-xs data-[state=active]:bg-card">
                Details & Billing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="contacts" className="p-6 pt-4">
              {contacts.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No contacts linked to this company yet.</p>
                  <p className="text-xs mt-1">Assign a company on a contact in the CRM to link them here.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {contacts.map((c) => (
                    <Link
                      key={c.id}
                      to={createPageUrl(`ClientDetails?id=${c.id}`)}
                      className="flex items-center gap-3 p-2.5 -mx-2.5 rounded-lg hover:bg-muted transition-colors group"
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${c.status === 'vip' ? 'bg-gradient-to-br from-purple-500 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-blue-600'}`}
                      >
                        {(c.name || '?')
                          .split(' ')
                          .map((s) => s[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          {c.name}
                          {c.status === 'vip' && (
                            <Star className="w-3 h-3 text-purple-500 dark:text-purple-300 fill-purple-500" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{c.email || c.phone || '—'}</div>
                      </div>
                      {(c.total_paid || 0) > 0 && (
                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                          ${(c.total_paid || 0).toFixed(0)}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="details" className="p-6 pt-4 space-y-6">
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                {company.email && <Info icon={Mail} label="Email" value={company.email} />}
                {company.phone && <Info icon={Phone} label="Phone" value={company.phone} />}
                {company.website && <Info icon={Globe} label="Website" value={company.website} />}
                {(company.city || company.country) && (
                  <Info
                    icon={MapPin}
                    label="Location"
                    value={[company.city, company.region, company.country].filter(Boolean).join(', ')}
                  />
                )}
                {company.tax_id && <Info icon={FileText} label="Tax ID / VAT" value={company.tax_id} />}
                {company.payment_method && (
                  <Info icon={CreditCard} label="Payment Method" value={company.payment_method.replace('_', ' ')} />
                )}
                {company.preferred_currency && (
                  <Info icon={DollarSign} label="Currency" value={company.preferred_currency} />
                )}
                {(company.default_markup ?? 0) > 0 && (
                  <Info icon={DollarSign} label="Default Markup" value={`${company.default_markup}%`} />
                )}
              </div>
              {company.invoice_address && (
                <div className="bg-muted rounded-xl p-4">
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
                    Invoice Address
                  </div>
                  <div className="text-sm text-foreground whitespace-pre-wrap">{company.invoice_address}</div>
                </div>
              )}
              {company.address && (
                <div className="bg-muted rounded-xl p-4">
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
                    Address
                  </div>
                  <div className="text-sm text-foreground">{company.address}</div>
                </div>
              )}
              {company.notes && (
                <div className="bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-100 rounded-xl p-4">
                  <div className="text-[10px] font-semibold text-yellow-700 dark:text-yellow-300 uppercase tracking-wider mb-1">
                    Internal Notes
                  </div>
                  <div className="text-sm text-foreground whitespace-pre-wrap">{company.notes}</div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }) {
  return (
    <div className="bg-card rounded-xl p-3 shadow-sm border border-border">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className={`font-bold text-lg ${tone}`}>{value}</div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</div>
        <div className="text-sm text-foreground font-medium">{value || '—'}</div>
      </div>
    </div>
  );
}
