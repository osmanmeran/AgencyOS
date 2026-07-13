import { db } from '@/lib/DbContext';
import { getCurrencySymbol } from '@/lib/formatters';
import { DEFAULT_CURRENCIES } from '@/lib/currencies';

import { useState, useEffect } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { applyMarkup } from '@/lib/pricing';
import { createSupplierWithCategory } from '@/lib/supplierCategories';
import { Plus, Trash2, TrendingUp, Building2, RefreshCw, ArrowRightLeft, Users, X, Save } from 'lucide-react';
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
  pax_tiers: [],
  supplier_currency: supCur,
  client_currency: cliCur,
});

export default function ProposalEditModal({ proposal, open, onClose }) {
  const { t } = useT();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    client_name: '',
    client_email: '',
    destination: '',
    start_date: '',
    end_date: '',
    num_travelers: 1,
    notes: '',
    terms_and_conditions: '',
  });

  const [services, setServices] = useState([emptyService()]);
  const [markupPct, setMarkupPct] = useState(0);
  const [acquiringCurrency, setAcquiringCurrency] = useState('USD');
  const [sellingCurrency, setSellingCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [loadingRate, setLoadingRate] = useState(false);

  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const [addProviderForIndex, setAddProviderForIndex] = useState(null);
  const [newProvider, setNewProvider] = useState({ name: '', email: '', phone: '', city: '' });

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

  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clients'],
      queryFn: () => db.entities.Client.list(),
    })
  );

  const { data: user } = /** @type {any} */ (
    useQuery({
      queryKey: ['currentUser'],
      queryFn: () => db.auth.me(),
    })
  );

  useEffect(() => {
    if (proposal && open) {
      setFormData({
        title: proposal.title || '',
        client_id: proposal.client_id || '',
        client_name: proposal.client_name || '',
        client_email: proposal.client_email || '',
        destination: proposal.destination || '',
        start_date: proposal.start_date || '',
        end_date: proposal.end_date || '',
        num_travelers: proposal.num_travelers || 1,
        notes: proposal.notes || '',
        terms_and_conditions: proposal.terms_and_conditions || '',
      });

      if (proposal.services?.length) {
        setServices(
          proposal.services.map((s) => ({
            _key: `svc-${Date.now()}-${Math.random()}`,
            supplier_id: s.supplier_id || '',
            name: s.name || '',
            description: s.description || '',
            location: s.location || '',
            acquiring_price: s.acquiring_price ?? '',
            selling_price: s.cost ?? '',
            quantity: s.quantity || 1,
            pricing_id: s.pricing_id || '',
            pax_tiers: s.pax_tiers || [],
            supplier_currency: s.supplier_currency || acquiringCurrency,
            client_currency: s.client_currency || sellingCurrency,
          })),
        );
      } else {
        setServices([emptyService()]);
      }

      setMarkupPct(proposal.markup_percentage || 0);
      if (proposal.acquiring_currency) setAcquiringCurrency(proposal.acquiring_currency);
      if (proposal.selling_currency) setSellingCurrency(proposal.selling_currency);
      if (proposal.exchange_rate) setExchangeRate(proposal.exchange_rate);
    }
  }, [proposal, open]);

  const updateProposalMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.Proposal.update(proposal.id, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['proposal', proposal.id] });
        queryClient.invalidateQueries({ queryKey: ['proposals'] });
        onClose();
      },
    })
  );

  const createSupplierMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) =>
        createSupplierWithCategory(db, data, categories[0]?.id, categories[0]?.name),
      onSuccess: async (/** @type {any} */ created) => {
        await refetchSuppliers();
        queryClient.invalidateQueries({ queryKey: ['allSupplierSubcategories'] });
        if (addProviderForIndex !== null) updateService(addProviderForIndex, 'supplier_id', created.id);
        setAddProviderOpen(false);
        setNewProvider({ name: '', email: '', phone: '', city: '' });
        setAddProviderForIndex(null);
      },
    })
  );

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

  const addService = () => setServices((prev) => [...prev, emptyService(acquiringCurrency, sellingCurrency)]);

  const updateService = (index, field, value) => {
    setServices((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const updated = { ...s, [field]: value };
        if (field === 'quantity' && s.pax_tiers?.length) {
          const pax = parseInt(value) || 1;
          const best =
            s.pax_tiers.find((tier) => pax >= tier.min && pax <= (tier.max || 99999)) ||
            s.pax_tiers[s.pax_tiers.length - 1];
          if (best) updated.acquiring_price = best.base_price;
        }
        return updated;
      }),
    );
  };

  const removeService = (index) => setServices((prev) => prev.filter((_, i) => i !== index));

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
      pricing_id: s.pricing_id || null,
      pax_tiers: s.pax_tiers?.length ? s.pax_tiers : null,
      supplier_currency: s.supplier_currency || acquiringCurrency,
      client_currency: s.client_currency || sellingCurrency,
    }));

    const changeEntry = {
      date: new Date().toISOString(),
      changed_by: user?.email || t('proposalEditModal.unknownFallback'),
      changes_description: t('proposalEditModal.changeLogDescription'),
    };

    updateProposalMutation.mutate({
      ...formData,
      services: proposalServices,
      total_cost: finalTotal,
      markup_percentage: markupPct,
      change_history: [...(proposal.change_history || []), changeEntry],
    });
  };

  const currSymbol = (cur) => getCurrencySymbol(cur);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-2xl font-bold text-foreground">{t('proposalEditModal.title')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="px-6 pb-6 max-h-[calc(90vh-80px)]">
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            {/* Client Info */}
            <Card className="p-6 bg-card shadow-sm">
              <h2 className="text-xl font-bold text-foreground mb-4">{t('proposalEditModal.clientInfoTitle')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('proposalEditModal.proposalTitleLabel')}</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t('proposalEditModal.proposalTitlePlaceholder')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('proposalEditModal.selectClientLabel')}</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(v) => {
                      const c = clients.find((x) => x.id === v);
                      if (c) setFormData({ ...formData, client_id: v, client_name: c.name, client_email: c.email });
                      else setFormData({ ...formData, client_id: '' });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('proposalEditModal.chooseFromDatabase')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>{t('proposalEditModal.noneManualEntry')}</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} – {c.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('proposalEditModal.clientNameLabel')}</Label>
                  <Input
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('proposalEditModal.clientEmailLabel')}</Label>
                  <Input
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {t('proposalEditModal.numberOfTravelersLabel')}
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

            {/* Trip Details */}
            <Card className="p-6 bg-card shadow-sm">
              <h2 className="text-xl font-bold text-foreground mb-4">{t('proposalEditModal.tripDetailsTitle')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('proposalEditModal.destinationLabel')}</Label>
                  <Input
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('proposalEditModal.startDateLabel')}</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('proposalEditModal.endDateLabel')}</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
            </Card>

            {/* Currency Settings */}
            <Card className="p-5 bg-card shadow-sm border-l-4 border-blue-500">
              <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                {t('proposalEditModal.currencySettingsTitle')}
              </h2>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label>
                    {t('proposalEditModal.acquiringCurrencyLabel')}{' '}
                    <span className="text-red-500 dark:text-red-300 text-xs">
                      {t('proposalEditModal.acquiringCurrencyHint')}
                    </span>
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
                    {t('proposalEditModal.sellingCurrencyLabel')}{' '}
                    <span className="text-green-600 dark:text-green-300 text-xs">
                      {t('proposalEditModal.sellingCurrencyHint')}
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
                        {t('proposalEditModal.exchangeRateLabel')}{' '}
                        <span className="text-xs text-muted-foreground">
                          {t('proposalEditModal.exchangeRateHint', { from: acquiringCurrency, to: sellingCurrency })}
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
                      {loadingRate ? t('proposalEditModal.fetchingRate') : t('proposalEditModal.getLiveRate')}
                    </Button>
                  </>
                )}
              </div>
            </Card>

            {/* Services */}
            <Card className="p-6 bg-card shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{t('proposalEditModal.servicesPricingTitle')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t('proposalEditModal.servicesPricingSubtitle')}
                  </p>
                </div>
                <Button type="button" onClick={addService} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('proposalEditModal.addServiceButton')}
                </Button>
              </div>

              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                <div className="col-span-3">{t('proposalEditModal.providerColumn')}</div>
                <div className="col-span-2">{t('proposalEditModal.serviceColumn')}</div>
                <div className="col-span-1 text-center">{t('proposalEditModal.paxColumn')}</div>
                <div className="col-span-3 text-right">{t('proposalEditModal.acqPerPaxColumn')}</div>
                <div className="col-span-3 text-right">{t('proposalEditModal.sellPerPaxColumn')}</div>
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
                  const activeTier = service.pax_tiers?.find((tier) => pax >= tier.min && pax <= (tier.max || 99999));

                  return (
                    <div key={service._key} className="rounded-xl border border-border bg-muted/60 p-4 space-y-3">
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-3">
                          <div className="flex items-center gap-1">
                            <Select
                              value={service.supplier_id}
                              onValueChange={(v) => updateService(index, 'supplier_id', v)}
                            >
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder={t('proposalEditModal.providerPlaceholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={null}>{t('proposalEditModal.noneProviderOption')}</SelectItem>
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
                        <div className="col-span-2">
                          <Input
                            value={service.name}
                            onChange={(e) => updateService(index, 'name', e.target.value)}
                            placeholder={t('proposalEditModal.serviceNamePlaceholder')}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="col-span-1">
                          <Input
                            type="number"
                            min="1"
                            value={service.quantity}
                            onChange={(e) => updateService(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="h-9 text-sm text-center"
                          />
                        </div>
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
                        <div className="col-span-3 flex justify-end items-end gap-3">
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">{t('proposalEditModal.acqTotalLabel')}</div>
                            <div className="font-semibold text-red-600 dark:text-red-300 text-sm">
                              {currSymbol(sCur)}
                              {lineAcquiring.toFixed(2)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">
                              {t('proposalEditModal.sellTotalLabel')}
                              {markupPct > 0 ? t('proposalEditModal.sellTotalMarkupSuffix', { pct: markupPct }) : ''}
                            </div>
                            <div className="font-semibold text-green-700 dark:text-green-300 text-sm">
                              {currSymbol(cCur)}
                              {lineSelling.toFixed(2)}
                            </div>
                          </div>
                          {lineMargin !== null ? (
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">{t('proposalEditModal.marginLabel')}</div>
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

                      {service.pax_tiers?.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {t('proposalEditModal.priceTiersLabel')}
                          </span>
                          {service.pax_tiers.map((tier) => (
                            <Badge
                              key={tier.id}
                              variant="outline"
                              className={`text-xs cursor-pointer ${activeTier?.id === tier.id ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 text-blue-700 dark:text-blue-300' : 'text-muted-foreground'}`}
                              onClick={() => updateService(index, 'acquiring_price', tier.base_price)}
                            >
                              {tier.min}
                              {tier.max ? `–${tier.max}` : '+'} {t('proposalEditModal.paxColumn')} · {currSymbol(sCur)}
                              {tier.base_price}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-12 gap-3 items-start">
                        <div className="col-span-12">
                          <Textarea
                            value={service.description}
                            onChange={(e) => updateService(index, 'description', e.target.value)}
                            placeholder={t('proposalEditModal.serviceDescriptionPlaceholder')}
                            rows={2}
                            className="text-xs resize-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-3 items-start mt-2">
                        <div className="col-span-12">
                          <LocationSearch
                            value={service.location}
                            onChange={(v) => updateService(index, 'location', v)}
                            placeholder={t('proposalEditModal.locationSearchPlaceholder')}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {services.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="flex justify-end">
                    <div className="w-96 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-orange-500 dark:text-orange-300" />
                          <span className="text-foreground font-medium">{t('proposalEditModal.markupLabel')}</span>
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
                        <span className="text-xs text-muted-foreground">
                          {t('proposalEditModal.appliedToEachLine')}
                        </span>
                      </div>
                      <Separator />
                      {Object.entries(acquiringByCurrency).map(([cur, total]) => (
                        <div key={`acq-${cur}`} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t('proposalEditModal.costCurrencyLabel', { cur })}
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
                            {t('proposalEditModal.sellingCurrencyAmountLabel', { cur })}
                          </span>
                          <span className="font-semibold text-green-700 dark:text-green-300">
                            {currSymbol(cur)}
                            {total.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {!currenciesMixed && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t('tripCostSummary.grossMargin')}</span>
                          <span
                            className={`font-semibold ${margin >= 0 ? 'text-blue-600 dark:text-blue-300' : 'text-red-600 dark:text-red-300'}`}
                          >
                            {margin.toFixed(1)}%
                          </span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-lg font-bold text-foreground">
                            {t('proposalEditModal.proposalTotalLabel')}
                          </div>
                          <div className="text-xs text-muted-foreground">{t('proposalEditModal.allCurrencies')}</div>
                        </div>
                        <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                          {currSymbol(Object.keys(sellingByCurrency)[0] || sellingCurrency)}
                          {finalTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Notes & Terms */}
            <Card className="p-6 bg-card shadow-sm">
              <h2 className="text-xl font-bold text-foreground mb-4">{t('proposalEditModal.additionalInfoTitle')}</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('proposalEditModal.proposalNotesLabel')}</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder={t('proposalEditModal.proposalNotesPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('clientProposalDetails.termsAndConditions')}</Label>
                  <Textarea
                    value={formData.terms_and_conditions}
                    onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                    rows={4}
                  />
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-3 pb-2">
              <Button type="button" variant="outline" onClick={onClose}>
                <X className="w-4 h-4 mr-2" />
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={updateProposalMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {updateProposalMutation.isPending ? t('common.saving') : t('tripEditModal.saveChanges')}
              </Button>
            </div>
          </form>
        </ScrollArea>

        {/* Add Provider Dialog */}
        <Dialog open={addProviderOpen} onOpenChange={setAddProviderOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('proposalEditModal.addNewProviderTitle')}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createSupplierMutation.mutate(newProvider);
              }}
              className="space-y-4 mt-2"
            >
              <div className="space-y-2">
                <Label>{t('proposalEditModal.providerNameLabel')}</Label>
                <Input
                  value={newProvider.name}
                  onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                  placeholder={t('proposalEditModal.providerNamePlaceholder')}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('common.city')}</Label>
                  <Input
                    value={newProvider.city}
                    onChange={(e) => setNewProvider({ ...newProvider, city: e.target.value })}
                    placeholder="Istanbul"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('common.phone')}</Label>
                  <Input
                    value={newProvider.phone}
                    onChange={(e) => setNewProvider({ ...newProvider, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('common.email')}</Label>
                <Input
                  type="email"
                  value={newProvider.email}
                  onChange={(e) => setNewProvider({ ...newProvider, email: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setAddProviderOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={createSupplierMutation.isPending}
                >
                  {createSupplierMutation.isPending
                    ? t('proposalEditModal.addingProvider')
                    : t('proposalEditModal.addProviderButton')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
