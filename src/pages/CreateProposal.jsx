import { db } from '@/lib/DbContext';
import { getCurrencySymbol } from '@/lib/formatters';
import { DEFAULT_CURRENCIES } from '@/lib/currencies';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import LocationSearch from '@/components/services/LocationSearch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Plus,
  Trash2,
  TrendingUp,
  Building2,
  RefreshCw,
  ArrowRightLeft,
  BookOpen,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import ServiceLibraryPanel from '../components/proposals/ServiceLibraryPanel';
import { applyMarkup } from '@/lib/pricing';
import { createSupplierWithCategory } from '@/lib/supplierCategories';
import { useT } from '@/lib/i18n/I18nContext';

const CURRENCIES = DEFAULT_CURRENCIES;

const emptyService = (supCur = 'USD', cliCur = 'USD') => ({
  _key: `svc-${Date.now()}-${Math.random()}`,
  supplier_id: '',
  name: '',
  description: '',
  location: '',
  acquiring_price: '',
  selling_price: '',
  quantity: 1,
  pricing_id: '',
  pax_tiers: [], // [{id, name, min, max, base_price}]
  supplier_currency: supCur,
  client_currency: cliCur,
});

export default function CreateProposal() {
  const { t: _t } = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    client_name: '',
    client_email: '',
    destination: '',
    start_date: '',
    end_date: '',
    num_travelers: 2,
    notes: '',
    terms_and_conditions:
      'Payment terms: 50% deposit required upon booking confirmation, balance due 30 days prior to departure.\nCancellation policy: Cancellations made more than 60 days before departure receive 80% refund, 30-60 days receive 50% refund, less than 30 days no refund.',
  });

  const [services, setServices] = useState([emptyService()]);
  const [markupPct, setMarkupPct] = useState(0);
  const [acquiringCurrency, setAcquiringCurrency] = useState('USD');
  const [sellingCurrency, setSellingCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [loadingRate, setLoadingRate] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  // Add provider dialog
  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const [addProviderForIndex, setAddProviderForIndex] = useState(null);
  const [newProvider, setNewProvider] = useState({ name: '', email: '', phone: '', city: '' });

  const isDirty = useDirtyState({ formData, services, markupPct, acquiringCurrency, sellingCurrency, exchangeRate });
  useUnsavedChangesGuard(isDirty);

  const { data: suppliers = /** @type {any} */ ([]), refetch: refetchSuppliers } = /** @type {any} */ (
    useQuery({
      queryKey: ['suppliers'],
      queryFn: () => db.entities.Supplier.list(),
    })
  );
  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierCategories'],
      queryFn: () => db.entities.SupplierCategory.list(),
    })
  );
  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['trips'],
      queryFn: () => db.entities.Trip.list(),
    })
  );
  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clients'],
      queryFn: () => db.entities.Client.list(),
    })
  );
  const { data: proposalTemplates = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['proposalTemplates'],
      queryFn: () => db.entities.ProposalTemplate.list('-created_date'),
    })
  );

  const createProposalMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.Proposal.create(data),
      onSuccess: (/** @type {any} */ newProposal) => {
        showSuccess('Proposal created');
        queryClient.invalidateQueries({ queryKey: ['proposals'] });
        navigate(createPageUrl(`ProposalDetails?id=${newProposal.id}`));
      },
      onError: (error) => showError('Failed to create proposal', error.message),
    })
  );

  const createSupplierMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) =>
        createSupplierWithCategory(db, data, categories[0]?.id, categories[0]?.name),
      onSuccess: async (/** @type {any} */ created) => {
        showSuccess('Supplier created');
        await refetchSuppliers();
        queryClient.invalidateQueries({ queryKey: ['allSupplierSubcategories'] });
        if (addProviderForIndex !== null) updateService(addProviderForIndex, 'supplier_id', created.id);
        setAddProviderOpen(false);
        setNewProvider({ name: '', email: '', phone: '', city: '' });
        setAddProviderForIndex(null);
      },
      onError: (error) => showError('Failed to create supplier', error.message),
    })
  );

  // ── Exchange rate ──────────────────────────────────────────────────────────
  const fetchExchangeRate = async () => {
    if (acquiringCurrency === sellingCurrency) {
      setExchangeRate(1);
      return;
    }
    setLoadingRate(true);
    try {
      const res = await db.integrations.Core.GetExchangeRate(acquiringCurrency, sellingCurrency);
      setExchangeRate(res.rate || 1);
    } catch {
      setExchangeRate(1);
    }
    setLoadingRate(false);
  };

  // ── Service helpers ────────────────────────────────────────────────────────
  const addService = () => setServices((prev) => [...prev, emptyService(acquiringCurrency, sellingCurrency)]);

  const addServiceFromLibrary = useCallback(
    (serviceData) => {
      const sCur = serviceData.supplier_currency || acquiringCurrency;
      const cCur = serviceData.client_currency || sellingCurrency;
      const sellPrice = serviceData.selling_price ?? serviceData.acquiring_price ?? 0;
      const convertedSelling = sCur !== cCur ? sellPrice * (serviceData.exchange_rate || exchangeRate) : sellPrice;
      setServices((prev) => [
        ...prev,
        {
          ...emptyService(sCur, cCur),
          ...serviceData,
          selling_price: parseFloat(convertedSelling.toFixed(2)),
          supplier_currency: sCur,
          client_currency: cCur,
          quantity: formData.num_travelers,
        },
      ]);
    },
    [acquiringCurrency, sellingCurrency, exchangeRate, formData.num_travelers],
  );

  const updateService = (index, field, value) => {
    setServices((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const updated = { ...s, [field]: value };
        // If pax changes and there are tiers, find best tier
        if (field === 'quantity' && s.pax_tiers?.length) {
          const pax = parseInt(value) || 1;
          const best =
            s.pax_tiers.find((t) => pax >= t.min && pax <= (t.max || 99999)) || s.pax_tiers[s.pax_tiers.length - 1];
          if (best) updated.acquiring_price = best.base_price;
        }
        return updated;
      }),
    );
  };

  const removeService = (index) => setServices((prev) => prev.filter((_, i) => i !== index));

  // ── Cost calculations ──────────────────────────────────────────────────────
  // Markup is baked into each service line. Totals grouped by per-service currencies.
  const withMarkup = (price) => applyMarkup(price, markupPct);

  const acquiringByCurrency = services.reduce((acc, s) => {
    const cur = s.supplier_currency || acquiringCurrency;
    acc[cur] = (acc[cur] || 0) + (parseFloat(s.acquiring_price) || 0) * (parseInt(String(s.quantity)) || 1);
    return acc;
  }, {});
  const sellingByCurrency = services.reduce((acc, s) => {
    const cur = s.client_currency || 'USD';
    const basePrice = parseFloat(s.base_selling_price ?? s.selling_price) || 0;
    acc[cur] = (acc[cur] || 0) + withMarkup(basePrice) * (parseInt(String(s.quantity)) || 1);
    return acc;
  }, {});
  const totalSellingAll = Object.values(sellingByCurrency).reduce((s, v) => s + v, 0);
  const totalAcquiringAll = Object.values(acquiringByCurrency).reduce((s, v) => s + v, 0);
  const finalTotal = totalSellingAll;
  const currenciesMixed = Object.keys(sellingByCurrency).length > 1 || Object.keys(acquiringByCurrency).length > 1;
  const margin =
    !currenciesMixed && totalSellingAll > 0 ? ((totalSellingAll - totalAcquiringAll) / totalSellingAll) * 100 : 0;

  // ── Load from trip ─────────────────────────────────────────────────────────
  const loadFromTrip = (tripId) => {
    const trip = trips.find((t) => t.id === tripId);
    if (trip)
      setFormData((prev) => ({
        ...prev,
        trip_id: tripId,
        destination: trip.destination,
        start_date: trip.start_date,
        end_date: trip.end_date,
      }));
  };

  // ── Load from template ─────────────────────────────────────────────────────
  const loadFromTemplate = (templateId) => {
    const tpl = proposalTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    setFormData((prev) => ({
      ...prev,
      destination: tpl.destination || prev.destination,
      notes: tpl.notes || prev.notes,
      terms_and_conditions: tpl.terms_and_conditions || prev.terms_and_conditions,
    }));
    if (tpl.acquiring_currency) setAcquiringCurrency(tpl.acquiring_currency);
    if (tpl.selling_currency) setSellingCurrency(tpl.selling_currency);
    if (tpl.services?.length) {
      setServices(
        tpl.services.map((s) => ({
          ...emptyService(
            s.supplier_currency || tpl.acquiring_currency || acquiringCurrency,
            s.client_currency || tpl.selling_currency || sellingCurrency,
          ),
          supplier_id: s.supplier_id || '',
          name: s.name || '',
          description: s.description || '',
          acquiring_price: s.acquiring_price || '',
          selling_price: s.selling_price || '',
          quantity: s.quantity || 1,
        })),
      );
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    const proposalServices = services.map((s) => ({
      supplier_id: s.supplier_id,
      name: s.name,
      description: s.description,
      location: s.location || '',
      base_selling_price: parseFloat(s.base_selling_price ?? s.selling_price) || 0,
      cost: withMarkup(parseFloat(s.base_selling_price ?? s.selling_price) || 0),
      quantity: parseInt(String(s.quantity)) || 1,
      acquiring_price: s.acquiring_price ? parseFloat(s.acquiring_price) : 0,
      supplier_currency: s.supplier_currency || acquiringCurrency,
      client_currency: s.client_currency || sellingCurrency,
    }));
    createProposalMutation.mutate({
      ...formData,
      services: proposalServices,
      total_cost: finalTotal,
      markup_percentage: markupPct,
    });
  };

  const currSymbol = (cur) => getCurrencySymbol(cur);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Link to={createPageUrl('Proposals')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          {_t('createProposal.back')}
        </Button>
      </Link>

      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-1">{_t('createProposal.create')}</h1>
          <p className="text-muted-foreground">{_t('createProposal.build')}</p>
        </div>
        <Button
          type="button"
          variant={showLibrary ? 'default' : 'outline'}
          onClick={() => setShowLibrary((v) => !v)}
          className={showLibrary ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          <BookOpen className="w-4 h-4 mr-2" />
          {showLibrary ? 'Hide Library' : 'Service Library'}
        </Button>
      </div>

      <div className="flex gap-6">
        {/* LEFT: Library Panel */}
        {showLibrary && (
          <div className="w-72 flex-shrink-0">
            <ServiceLibraryPanel
              numTravelers={formData.num_travelers}
              acquiringCurrency={acquiringCurrency}
              _sellingCurrency={sellingCurrency}
              onAddService={addServiceFromLibrary}
            />
          </div>
        )}

        {/* RIGHT: Form */}
        <div className="flex-1 min-w-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ── Client Info ── */}
            <Card className="p-6 bg-card shadow-md">
              <h2 className="text-xl font-bold text-foreground mb-4">{_t('createProposal.client')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{_t('createProposal.proposal')}</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={_t('createProposal.summer')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{_t('createProposal.select')}</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(v) => {
                      const c = clients.find((x) => x.id === v);
                      if (c) setFormData({ ...formData, client_id: v, client_name: c.name, client_email: c.email });
                      else setFormData({ ...formData, client_id: '' });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={_t('createProposal.choose')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>{_t('createProposal.none_2')}</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} – {c.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{_t('createProposal.clientName')}</Label>
                  <Input
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{_t('createProposal.clientEmail')}</Label>
                  <Input
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {_t('createProposal.number')}
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.num_travelers}
                    onChange={(e) => setFormData({ ...formData, num_travelers: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
            </Card>

            {/* ── Trip Details ── */}
            <Card className="p-6 bg-card shadow-md">
              <h2 className="text-xl font-bold text-foreground mb-4">{_t('createProposal.trip')}</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{_t('createProposal.load')}</Label>
                    <Select onValueChange={loadFromTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder={_t('createProposal.chooseA')} />
                      </SelectTrigger>
                      <SelectContent>
                        {proposalTemplates.length === 0 && (
                          <SelectItem value="_none" disabled>
                            {_t('createProposal.no')}
                          </SelectItem>
                        )}
                        {proposalTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                            {t.destination ? ` — ${t.destination}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{_t('createProposal.loadFrom')}</Label>
                    <Select onValueChange={loadFromTrip}>
                      <SelectTrigger>
                        <SelectValue placeholder={_t('createProposal.selectA')} />
                      </SelectTrigger>
                      <SelectContent>
                        {trips.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{_t('createProposal.destination')}</Label>
                    <Input
                      value={formData.destination}
                      onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{_t('createProposal.start')}</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{_t('createProposal.end')}</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Currency Settings ── */}
            <Card className="p-5 bg-card shadow-md border-l-4 border-blue-500">
              <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                {_t('createProposal.currency')}
              </h2>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label>
                    {_t('createProposal.acquiring')}{' '}
                    <span className="text-red-500 dark:text-red-300 text-xs">{_t('createProposal.what')}</span>
                  </Label>
                  <Select
                    value={acquiringCurrency}
                    onValueChange={(v) => {
                      setAcquiringCurrency(v);
                      setExchangeRate(1);
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center pb-1 text-muted-foreground">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>

                <div className="space-y-2">
                  <Label>
                    {_t('createProposal.selling_2')}{' '}
                    <span className="text-green-600 dark:text-green-300 text-xs">
                      {_t('createProposal.whatClient')}
                    </span>
                  </Label>
                  <Select
                    value={sellingCurrency}
                    onValueChange={(v) => {
                      setSellingCurrency(v);
                      setExchangeRate(1);
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {acquiringCurrency !== sellingCurrency && (
                  <>
                    <div className="space-y-2">
                      <Label>
                        {_t('createProposal.exchange')}{' '}
                        <span className="text-xs text-muted-foreground">
                          (1 {acquiringCurrency} = ? {sellingCurrency})
                        </span>
                      </Label>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                        className="w-36"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={fetchExchangeRate}
                      disabled={loadingRate}
                      className="gap-2 mb-0.5"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingRate ? 'animate-spin' : ''}`} />
                      {loadingRate ? 'Fetching...' : 'Get Live Rate'}
                    </Button>
                    {exchangeRate !== 1 && (
                      <div className="pb-1 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-xs text-blue-700 dark:text-blue-300 font-medium">
                        1 {acquiringCurrency} = {exchangeRate} {sellingCurrency}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>

            {/* ── Services ── */}
            <Card className="p-6 bg-card shadow-md">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{_t('createProposal.services')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{_t('createProposal.per')}</p>
                </div>
                <Button type="button" onClick={addService} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  {_t('createProposal.add')}
                </Button>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                <div className="col-span-3">{_t('createProposal.provider')}</div>
                <div className="col-span-2">{_t('createProposal.service')}</div>
                <div className="col-span-1 text-center">{_t('createProposal.pax')}</div>
                <div className="col-span-3 text-right">{_t('createProposal.acq')}</div>
                <div className="col-span-3 text-right">{_t('createProposal.sell')}</div>
              </div>
              <Separator className="mb-4" />

              <div className="space-y-4">
                {services.map((service, index) => {
                  const pax = parseInt(String(service.quantity)) || 1;
                  const sCur = service.supplier_currency || acquiringCurrency;
                  const cCur = service.client_currency || sellingCurrency;
                  const acqUnit = parseFloat(service.acquiring_price) || 0;
                  const sellUnit = parseFloat(service.selling_price) || 0;
                  const effectiveSellUnit = withMarkup(sellUnit);
                  const lineAcquiring = acqUnit * pax;
                  const lineSelling = effectiveSellUnit * pax;
                  const sameCurrency = sCur === cCur;
                  const lineMargin =
                    sameCurrency && lineSelling > 0 ? ((lineSelling - lineAcquiring) / lineSelling) * 100 : null;

                  const activeTier = service.pax_tiers?.find((t) => pax >= t.min && pax <= (t.max || 99999));

                  return (
                    <div key={service._key} className="rounded-xl border border-border bg-muted/60 p-4 space-y-3">
                      <div className="grid grid-cols-12 gap-2 items-end">
                        {/* Provider */}
                        <div className="col-span-3">
                          <div className="flex items-center gap-1">
                            <Select
                              value={service.supplier_id}
                              onValueChange={(v) => updateService(index, 'supplier_id', v)}
                            >
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder={_t('createProposal.provider')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={null}>{_t('createProposal.none_2')}</SelectItem>
                                {suppliers.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 flex-shrink-0 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              onClick={() => {
                                setAddProviderForIndex(index);
                                setAddProviderOpen(true);
                              }}
                            >
                              <Building2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Name */}
                        <div className="col-span-2">
                          <Input
                            value={service.name}
                            onChange={(e) => updateService(index, 'name', e.target.value)}
                            placeholder={_t('createProposal.serviceName')}
                            className="h-9 text-sm"
                          />
                        </div>

                        {/* Pax */}
                        <div className="col-span-1">
                          <Input
                            type="number"
                            min="1"
                            value={service.quantity}
                            onChange={(e) => updateService(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="h-9 text-sm text-center"
                          />
                        </div>

                        {/* Acquiring price / pax */}
                        <div className="col-span-3">
                          <div className="flex gap-1 items-end">
                            <Select value={sCur} onValueChange={(v) => updateService(index, 'supplier_currency', v)}>
                              <SelectTrigger className="h-9 w-20 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CURRENCIES.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-red-400 text-xs font-bold">
                                {currSymbol(sCur)}
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={service.acquiring_price}
                                onChange={(e) => updateService(index, 'acquiring_price', e.target.value)}
                                className="h-9 text-sm text-right pl-6 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Selling price / pax */}
                        <div className="col-span-3">
                          <div className="flex gap-1 items-end">
                            <Select value={cCur} onValueChange={(v) => updateService(index, 'client_currency', v)}>
                              <SelectTrigger className="h-9 w-20 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CURRENCIES.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-300 text-xs font-bold">
                                {currSymbol(cCur)}
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={service.selling_price}
                                onChange={(e) => updateService(index, 'selling_price', e.target.value)}
                                className="h-9 text-sm text-right pl-6 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          {markupPct > 0 && effectiveSellUnit !== sellUnit && (
                            <div className="text-xs text-orange-600 dark:text-orange-300 text-right mt-0.5">
                              +{markupPct}% = {currSymbol(cCur)}
                              {effectiveSellUnit.toFixed(2)}
                            </div>
                          )}
                        </div>

                        {/* Remove */}
                        <div className="col-span-3 flex justify-end items-end gap-3">
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">{_t('createProposal.acqTotal')}</div>
                            <div className="font-semibold text-red-600 dark:text-red-300 text-sm">
                              {currSymbol(sCur)}
                              {lineAcquiring.toFixed(2)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">
                              {_t('createProposal.sellTotal')}
                              {markupPct > 0 ? ` (incl. ${markupPct}% markup)` : ''}
                            </div>
                            <div className="font-semibold text-green-700 dark:text-green-300 text-sm">
                              {currSymbol(cCur)}
                              {lineSelling.toFixed(2)}
                            </div>
                          </div>
                          {lineMargin !== null ? (
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">{_t('createProposal.margin')}</div>
                              <div
                                className={`font-semibold text-sm ${lineMargin >= 0 ? 'text-blue-600 dark:text-blue-300' : 'text-red-600 dark:text-red-300'}`}
                              >
                                {lineMargin.toFixed(1)}%
                              </div>
                            </div>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 flex-shrink-0"
                            onClick={() => removeService(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Pax tiers indicator */}
                      {service.pax_tiers?.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">{_t('createProposal.price')}</span>
                          {service.pax_tiers.map((t) => (
                            <Badge
                              key={t.id}
                              variant="outline"
                              className={`text-xs cursor-pointer ${activeTier?.id === t.id ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 text-blue-700 dark:text-blue-300' : 'text-muted-foreground'}`}
                              onClick={() => updateService(index, 'acquiring_price', t.base_price)}
                            >
                              {t.min}
                              {t.max ? `–${t.max}` : '+'} {_t('createProposal.pax_2')} {currSymbol(sCur)}
                              {t.base_price}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Description */}
                      <div className="grid grid-cols-12 gap-3 items-start">
                        <div className="col-span-12">
                          <Textarea
                            value={service.description}
                            onChange={(e) => updateService(index, 'description', e.target.value)}
                            placeholder={_t('createProposal.serviceDescription')}
                            rows={2}
                            className="text-xs resize-none"
                          />
                        </div>
                      </div>

                      {/* Location */}
                      <div className="grid grid-cols-12 gap-3 items-start mt-2">
                        <div className="col-span-12">
                          <LocationSearch
                            value={service.location}
                            onChange={(v) => updateService(index, 'location', v)}
                            placeholder={_t('createProposal.search')}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Cost Summary ── */}
              {services.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="flex justify-end">
                    <div className="w-96 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-orange-500 dark:text-orange-300" />
                          <span className="text-foreground font-medium">{_t('createProposal.markup')}</span>
                          <Input
                            type="number"
                            min="0"
                            max="200"
                            step="0.5"
                            value={markupPct}
                            onChange={(e) => setMarkupPct(parseFloat(e.target.value) || 0)}
                            className="w-16 h-7 text-xs text-center px-1"
                          />
                          <span className="text-muted-foreground text-xs">%</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{_t('createProposal.applied')}</span>
                      </div>

                      <Separator />

                      {Object.entries(acquiringByCurrency).map(([cur, total]) => (
                        <div key={`acq-${cur}`} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {_t('createProposal.cost')}
                            {cur})
                          </span>
                          <span className="font-semibold text-red-600 dark:text-red-300">
                            {currSymbol(cur)}
                            {total.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {Object.entries(sellingByCurrency).map(([cur, total]) => (
                        <div key={`sell-${cur}`} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {_t('createProposal.selling_2')}
                            {cur})
                          </span>
                          <span className="font-semibold text-green-700 dark:text-green-300">
                            {currSymbol(cur)}
                            {total.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {!currenciesMixed && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{_t('createProposal.gross')}</span>
                          <span
                            className={`font-semibold ${margin >= 0 ? 'text-blue-600 dark:text-blue-300' : 'text-red-600 dark:text-red-300'}`}
                          >
                            {margin.toFixed(1)}%
                          </span>
                        </div>
                      )}

                      <Separator />

                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div>
                          <div className="text-lg font-bold text-foreground">{_t('createProposal.final')}</div>
                          <div className="text-xs text-muted-foreground">{_t('createProposal.all')}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                            {currSymbol(Object.keys(sellingByCurrency)[0] || sellingCurrency)}
                            {finalTotal.toFixed(2)}
                          </div>
                          {formData.num_travelers > 1 && (
                            <div className="text-xs text-muted-foreground">
                              ~{currSymbol(Object.keys(sellingByCurrency)[0] || sellingCurrency)}
                              {(finalTotal / formData.num_travelers).toFixed(2)} / person
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* ── Notes & Terms ── */}
            <Card className="p-6 bg-card shadow-md">
              <h2 className="text-xl font-bold text-foreground mb-4">{_t('createProposal.additional')}</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{_t('createProposal.proposalNotes')}</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder={_t('createProposal.special')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{_t('createProposal.terms')}</Label>
                  <Textarea
                    value={formData.terms_and_conditions}
                    onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                    rows={4}
                  />
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-3 pb-8">
              <Link to={createPageUrl('Proposals')}>
                <Button type="button" variant="outline">
                  {_t('createProposal.cancel')}
                </Button>
              </Link>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={createProposalMutation.isPending}
              >
                {createProposalMutation.isPending ? 'Creating...' : 'Create Proposal'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Add New Provider Dialog ── */}
      <Dialog open={addProviderOpen} onOpenChange={setAddProviderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{_t('createProposal.addNew')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createSupplierMutation.mutate(newProvider);
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-2">
              <Label>{_t('createProposal.providerName')}</Label>
              <Input
                value={newProvider.name}
                onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                placeholder={_t('createProposal.e')}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{_t('createProposal.city')}</Label>
                <Input
                  value={newProvider.city}
                  onChange={(e) => setNewProvider({ ...newProvider, city: e.target.value })}
                  placeholder={_t('createProposal.istanbul')}
                />
              </div>
              <div className="space-y-2">
                <Label>{_t('createProposal.phone')}</Label>
                <Input
                  value={newProvider.phone}
                  onChange={(e) => setNewProvider({ ...newProvider, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{_t('createProposal.email')}</Label>
              <Input
                type="email"
                value={newProvider.email}
                onChange={(e) => setNewProvider({ ...newProvider, email: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddProviderOpen(false)}>
                {_t('createProposal.cancel')}
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={createSupplierMutation.isPending}
              >
                {createSupplierMutation.isPending ? 'Adding...' : 'Add Provider'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
