const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useCallback } from 'react';
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
  ArrowLeft, Plus, Trash2, DollarSign, TrendingUp, Building2,
  RefreshCw, ArrowRightLeft, BookOpen, Users
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import ServiceLibraryPanel from '../components/proposals/ServiceLibraryPanel';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'AED', 'SAR', 'EGP', 'MAD', 'JPY', 'CHF', 'CAD', 'AUD'];

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
  pax_tiers: [],   // [{id, name, min, max, base_price}]
  supplier_currency: supCur,
  client_currency: cliCur,
});

export default function CreateProposal() {
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

  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => db.entities.Supplier.list(),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['supplierCategories'],
    queryFn: () => db.entities.SupplierCategory.list(),
  });
  const { data: trips = [] } = useQuery({
    queryKey: ['trips'],
    queryFn: () => db.entities.Trip.list(),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => db.entities.Client.list(),
  });
  const { data: proposalTemplates = [] } = useQuery({
    queryKey: ['proposalTemplates'],
    queryFn: () => db.entities.ProposalTemplate.list('-created_date'),
  });

  const createProposalMutation = useMutation({
    mutationFn: (data) => db.entities.Proposal.create(data),
    onSuccess: (newProposal) => {
      showSuccess('Proposal created');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      navigate(createPageUrl(`ProposalDetails?id=${newProposal.id}`));
    },
    onError: (error) => showError('Failed to create proposal', error.message)
  });

  const createSupplierMutation = useMutation({
    mutationFn: (data) => db.entities.Supplier.create(data),
    onSuccess: async (created) => {
      showSuccess('Supplier created');
      await refetchSuppliers();
      if (addProviderForIndex !== null) updateService(addProviderForIndex, 'supplier_id', created.id);
      setAddProviderOpen(false);
      setNewProvider({ name: '', email: '', phone: '', city: '' });
      setAddProviderForIndex(null);
    },
    onError: (error) => showError('Failed to create supplier', error.message)
  });

  // ── Exchange rate ──────────────────────────────────────────────────────────
  const fetchExchangeRate = async () => {
    if (acquiringCurrency === sellingCurrency) { setExchangeRate(1); return; }
    setLoadingRate(true);
    try {
      const res = await db.integrations.Core.GetExchangeRate(acquiringCurrency, sellingCurrency);
      setExchangeRate(res.rate || 1);
    } catch (err) {
      setExchangeRate(1);
    }
    setLoadingRate(false);
  };

  // ── Service helpers ────────────────────────────────────────────────────────
  const addService = () => setServices(prev => [...prev, emptyService(acquiringCurrency, sellingCurrency)]);

  const addServiceFromLibrary = useCallback((serviceData) => {
    const sCur = serviceData.supplier_currency || acquiringCurrency;
    const cCur = serviceData.client_currency || sellingCurrency;
    const sellPrice = serviceData.selling_price ?? serviceData.acquiring_price ?? 0;
    const convertedSelling = sCur !== cCur
      ? (sellPrice * (serviceData.exchange_rate || exchangeRate))
      : sellPrice;
    setServices(prev => [...prev, {
      ...emptyService(sCur, cCur),
      ...serviceData,
      selling_price: parseFloat(convertedSelling.toFixed(2)),
      supplier_currency: sCur,
      client_currency: cCur,
      quantity: formData.num_travelers,
    }]);
  }, [acquiringCurrency, sellingCurrency, exchangeRate, formData.num_travelers]);

  const updateService = (index, field, value) => {
    setServices(prev => prev.map((s, i) => {
      if (i !== index) return s;
      const updated = { ...s, [field]: value };
      // If pax changes and there are tiers, find best tier
      if (field === 'quantity' && s.pax_tiers?.length) {
        const pax = parseInt(value) || 1;
        const best = s.pax_tiers.find(t => pax >= t.min && pax <= (t.max || 99999))
          || s.pax_tiers[s.pax_tiers.length - 1];
        if (best) updated.acquiring_price = best.base_price;
      }
      return updated;
    }));
  };

  const removeService = (index) => setServices(prev => prev.filter((_, i) => i !== index));

  // ── Cost calculations ──────────────────────────────────────────────────────
  // Markup is baked into each service line. Totals grouped by per-service currencies.
  const withMarkup = (price) => Math.ceil(((parseFloat(price) || 0) * (1 + markupPct / 100)) * 10) / 10;

  const acquiringByCurrency = services.reduce((acc, s) => {
    const cur = s.supplier_currency || acquiringCurrency;
    acc[cur] = (acc[cur] || 0) + (parseFloat(s.acquiring_price) || 0) * (parseInt(s.quantity) || 1);
    return acc;
  }, {});
  const sellingByCurrency = services.reduce((acc, s) => {
    const cur = s.client_currency || 'USD';
    const basePrice = parseFloat(s.base_selling_price ?? s.selling_price) || 0;
    acc[cur] = (acc[cur] || 0) + withMarkup(basePrice) * (parseInt(s.quantity) || 1);
    return acc;
  }, {});
  const totalSellingAll = Object.values(sellingByCurrency).reduce((s, v) => s + v, 0);
  const totalAcquiringAll = Object.values(acquiringByCurrency).reduce((s, v) => s + v, 0);
  const finalTotal = totalSellingAll;
  const currenciesMixed = Object.keys(sellingByCurrency).length > 1 || Object.keys(acquiringByCurrency).length > 1;
  const margin = !currenciesMixed && totalSellingAll > 0
    ? ((totalSellingAll - totalAcquiringAll) / totalSellingAll) * 100
    : 0;

  // ── Load from trip ─────────────────────────────────────────────────────────
  const loadFromTrip = (tripId) => {
    const trip = trips.find(t => t.id === tripId);
    if (trip) setFormData(prev => ({ ...prev, trip_id: tripId, destination: trip.destination, start_date: trip.start_date, end_date: trip.end_date }));
  };

  // ── Load from template ─────────────────────────────────────────────────────
  const loadFromTemplate = (templateId) => {
    const tpl = proposalTemplates.find(t => t.id === templateId);
    if (!tpl) return;
    setFormData(prev => ({ ...prev, destination: tpl.destination || prev.destination, notes: tpl.notes || prev.notes, terms_and_conditions: tpl.terms_and_conditions || prev.terms_and_conditions }));
    if (tpl.acquiring_currency) setAcquiringCurrency(tpl.acquiring_currency);
    if (tpl.selling_currency) setSellingCurrency(tpl.selling_currency);
    if (tpl.services?.length) {
      setServices(tpl.services.map(s => ({
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
      })));
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    const proposalServices = services.map(s => ({
      supplier_id: s.supplier_id,
      name: s.name,
      description: s.description,
      location: s.location || '',
      base_selling_price: parseFloat(s.base_selling_price ?? s.selling_price) || 0,
      cost: withMarkup(parseFloat(s.base_selling_price ?? s.selling_price) || 0),
      quantity: parseInt(s.quantity) || 1,
      acquiring_price: s.acquiring_price ? parseFloat(s.acquiring_price) : 0,
      supplier_currency: s.supplier_currency || acquiringCurrency,
      client_currency: s.client_currency || sellingCurrency,
    }));
    createProposalMutation.mutate({ ...formData, services: proposalServices, total_cost: finalTotal, markup_percentage: markupPct });
  };

  const currSymbol = (cur) => ({ USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' }[cur] || cur);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Link to={createPageUrl('Proposals')}>
        <Button variant="ghost" className="gap-2"><ArrowLeft className="w-4 h-4" />Back to Proposals</Button>
      </Link>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-1">Create Proposal</h1>
          <p className="text-slate-600">Build a proposal with dual-currency cost breakdown and markup</p>
        </div>
        <Button
          type="button"
          variant={showLibrary ? 'default' : 'outline'}
          onClick={() => setShowLibrary(v => !v)}
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
              sellingCurrency={sellingCurrency}
              onAddService={addServiceFromLibrary}
            />
          </div>
        )}

        {/* RIGHT: Form */}
        <div className="flex-1 min-w-0">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── Client Info ── */}
            <Card className="p-6 bg-white shadow-md">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Client Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Proposal Title *</Label>
                  <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Summer Vacation Package" required />
                </div>
                <div className="space-y-2">
                  <Label>Select Client (Optional)</Label>
                  <Select value={formData.client_id} onValueChange={v => {
                    const c = clients.find(x => x.id === v);
                    if (c) setFormData({ ...formData, client_id: v, client_name: c.name, client_email: c.email });
                    else setFormData({ ...formData, client_id: '' });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Choose from database" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None (Manual Entry)</SelectItem>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name} – {c.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Client Name *</Label>
                  <Input value={formData.client_name} onChange={e => setFormData({ ...formData, client_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Client Email</Label>
                  <Input type="email" value={formData.client_email} onChange={e => setFormData({ ...formData, client_email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Number of Travelers</Label>
                  <Input
                    type="number" min="1"
                    value={formData.num_travelers}
                    onChange={e => setFormData({ ...formData, num_travelers: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
            </Card>

            {/* ── Trip Details ── */}
            <Card className="p-6 bg-white shadow-md">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Trip Details</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Load from Proposal Template</Label>
                    <Select onValueChange={loadFromTemplate}>
                      <SelectTrigger><SelectValue placeholder="Choose a saved template" /></SelectTrigger>
                      <SelectContent>
                        {proposalTemplates.length === 0 && <SelectItem value="_none" disabled>No templates saved yet</SelectItem>}
                        {proposalTemplates.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}{t.destination ? ` — ${t.destination}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Load from Existing Trip (Optional)</Label>
                    <Select onValueChange={loadFromTrip}>
                      <SelectTrigger><SelectValue placeholder="Select a trip" /></SelectTrigger>
                      <SelectContent>{trips.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Destination</Label>
                    <Input value={formData.destination} onChange={e => setFormData({ ...formData, destination: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Currency Settings ── */}
            <Card className="p-5 bg-white shadow-md border-l-4 border-blue-500">
              <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                Currency Settings
              </h2>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label>Acquiring Currency <span className="text-red-500 text-xs">(what you pay)</span></Label>
                  <Select value={acquiringCurrency} onValueChange={v => { setAcquiringCurrency(v); setExchangeRate(1); }}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="flex items-center pb-1 text-slate-400">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>

                <div className="space-y-2">
                  <Label>Selling Currency <span className="text-green-600 text-xs">(what client pays)</span></Label>
                  <Select value={sellingCurrency} onValueChange={v => { setSellingCurrency(v); setExchangeRate(1); }}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {acquiringCurrency !== sellingCurrency && (
                  <>
                    <div className="space-y-2">
                      <Label>Exchange Rate <span className="text-xs text-slate-400">(1 {acquiringCurrency} = ? {sellingCurrency})</span></Label>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        value={exchangeRate}
                        onChange={e => setExchangeRate(parseFloat(e.target.value) || 1)}
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
                      <div className="pb-1 px-3 py-2 bg-blue-50 rounded-lg text-xs text-blue-700 font-medium">
                        1 {acquiringCurrency} = {exchangeRate} {sellingCurrency}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>

            {/* ── Services ── */}
            <Card className="p-6 bg-white shadow-md">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Services & Pricing</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Per-service currencies — select supplier and client currency for each line
                  </p>
                </div>
                <Button type="button" onClick={addService} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />Add Service
                </Button>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
                <div className="col-span-3">Provider</div>
                <div className="col-span-2">Service</div>
                <div className="col-span-1 text-center">Pax</div>
                <div className="col-span-3 text-right">Acq. / pax</div>
                <div className="col-span-3 text-right">Sell / pax</div>
              </div>
              <Separator className="mb-4" />

              <div className="space-y-4">
                {services.map((service, index) => {
                  const pax = parseInt(service.quantity) || 1;
                  const sCur = service.supplier_currency || acquiringCurrency;
                  const cCur = service.client_currency || sellingCurrency;
                  const acqUnit = parseFloat(service.acquiring_price) || 0;
                  const sellUnit = parseFloat(service.selling_price) || 0;
                  const effectiveSellUnit = withMarkup(sellUnit);
                  const lineAcquiring = acqUnit * pax;
                  const lineSelling = effectiveSellUnit * pax;
                  const sameCurrency = sCur === cCur;
                  const lineMargin = sameCurrency && lineSelling > 0
                    ? ((lineSelling - lineAcquiring) / lineSelling) * 100
                    : null;

                  const activeTier = service.pax_tiers?.find(t => pax >= t.min && pax <= (t.max || 99999));

                  return (
                    <div key={service._key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                      <div className="grid grid-cols-12 gap-2 items-end">
                        {/* Provider */}
                        <div className="col-span-3">
                          <div className="flex items-center gap-1">
                            <Select value={service.supplier_id} onValueChange={v => updateService(index, 'supplier_id', v)}>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Provider" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={null}>— None —</SelectItem>
                                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 text-blue-600 hover:bg-blue-50" onClick={() => { setAddProviderForIndex(index); setAddProviderOpen(true); }}>
                              <Building2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Name */}
                        <div className="col-span-2">
                          <Input value={service.name} onChange={e => updateService(index, 'name', e.target.value)} placeholder="Service name" className="h-9 text-sm" />
                        </div>

                        {/* Pax */}
                        <div className="col-span-1">
                          <Input
                            type="number" min="1"
                            value={service.quantity}
                            onChange={e => updateService(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="h-9 text-sm text-center"
                          />
                        </div>

                        {/* Acquiring price / pax */}
                        <div className="col-span-3">
                          <div className="flex gap-1 items-end">
                            <Select value={sCur} onValueChange={v => updateService(index, 'supplier_currency', v)}>
                              <SelectTrigger className="h-9 w-20 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-red-400 text-xs font-bold">{currSymbol(sCur)}</span>
                              <Input
                                type="number" step="0.01" min="0"
                                value={service.acquiring_price}
                                onChange={e => updateService(index, 'acquiring_price', e.target.value)}
                                className="h-9 text-sm text-right pl-6 bg-red-50 border-red-200"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Selling price / pax */}
                        <div className="col-span-3">
                          <div className="flex gap-1 items-end">
                            <Select value={cCur} onValueChange={v => updateService(index, 'client_currency', v)}>
                              <SelectTrigger className="h-9 w-20 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-green-600 text-xs font-bold">{currSymbol(cCur)}</span>
                              <Input
                                type="number" step="0.01" min="0"
                                value={service.selling_price}
                                onChange={e => updateService(index, 'selling_price', e.target.value)}
                                className="h-9 text-sm text-right pl-6 bg-green-50 border-green-200"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          {markupPct > 0 && effectiveSellUnit !== sellUnit && (
                            <div className="text-xs text-orange-600 text-right mt-0.5">
                              +{markupPct}% = {currSymbol(cCur)}{effectiveSellUnit.toFixed(2)}
                            </div>
                          )}
                        </div>

                        {/* Remove */}
                        <div className="col-span-3 flex justify-end items-end gap-3">
                          <div className="text-right">
                            <div className="text-xs text-slate-400">Acq. total</div>
                            <div className="font-semibold text-red-600 text-sm">{currSymbol(sCur)}{lineAcquiring.toFixed(2)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-400">Sell total{markupPct > 0 ? ` (incl. ${markupPct}% markup)` : ''}</div>
                            <div className="font-semibold text-green-700 text-sm">{currSymbol(cCur)}{lineSelling.toFixed(2)}</div>
                          </div>
                          {lineMargin !== null ? (
                            <div className="text-right">
                              <div className="text-xs text-slate-400">Margin</div>
                              <div className={`font-semibold text-sm ${lineMargin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                {lineMargin.toFixed(1)}%
                              </div>
                            </div>
                          ) : null}
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0" onClick={() => removeService(index)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Pax tiers indicator */}
                      {service.pax_tiers?.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-slate-400">Price tiers:</span>
                          {service.pax_tiers.map(t => (
                            <Badge
                              key={t.id}
                              variant="outline"
                              className={`text-xs cursor-pointer ${activeTier?.id === t.id ? 'bg-blue-100 border-blue-400 text-blue-700' : 'text-slate-500'}`}
                              onClick={() => updateService(index, 'acquiring_price', t.base_price)}
                            >
                              {t.min}{t.max ? `–${t.max}` : '+'} pax · {currSymbol(sCur)}{t.base_price}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Description */}
                      <div className="grid grid-cols-12 gap-3 items-start">
                        <div className="col-span-12">
                          <Textarea
                            value={service.description}
                            onChange={e => updateService(index, 'description', e.target.value)}
                            placeholder="Service description (visible to client)..."
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
                            onChange={v => updateService(index, 'location', v)}
                            placeholder="Search or type service location..."
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Cost Summary ── */}
              {services.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <div className="flex justify-end">
                    <div className="w-96 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-orange-500" />
                          <span className="text-slate-700 font-medium">Markup</span>
                          <Input
                            type="number" min="0" max="200" step="0.5"
                            value={markupPct}
                            onChange={e => setMarkupPct(parseFloat(e.target.value) || 0)}
                            className="w-16 h-7 text-xs text-center px-1"
                          />
                          <span className="text-slate-500 text-xs">%</span>
                        </div>
                        <span className="text-xs text-slate-400">Applied to each line</span>
                      </div>

                      <Separator />

                      {Object.entries(acquiringByCurrency).map(([cur, total]) => (
                        <div key={`acq-${cur}`} className="flex justify-between text-sm">
                          <span className="text-slate-600">Cost ({cur})</span>
                          <span className="font-semibold text-red-600">{currSymbol(cur)}{total.toFixed(2)}</span>
                        </div>
                      ))}
                      {Object.entries(sellingByCurrency).map(([cur, total]) => (
                        <div key={`sell-${cur}`} className="flex justify-between text-sm">
                          <span className="text-slate-600">Selling ({cur})</span>
                          <span className="font-semibold text-green-700">{currSymbol(cur)}{total.toFixed(2)}</span>
                        </div>
                      ))}
                      {!currenciesMixed && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Gross Margin</span>
                          <span className={`font-semibold ${margin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{margin.toFixed(1)}%</span>
                        </div>
                      )}

                      <Separator />

                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-lg font-bold text-slate-900">Final Proposal Total</div>
                          <div className="text-xs text-slate-400">All currencies</div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-green-700">
                            {currSymbol(Object.keys(sellingByCurrency)[0] || sellingCurrency)}{finalTotal.toFixed(2)}
                          </div>
                          {formData.num_travelers > 1 && (
                            <div className="text-xs text-slate-400">
                              ~{currSymbol(Object.keys(sellingByCurrency)[0] || sellingCurrency)}{(finalTotal / formData.num_travelers).toFixed(2)} / person
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
            <Card className="p-6 bg-white shadow-md">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Additional Information</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Proposal Notes</Label>
                  <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={3} placeholder="Special notes for the client..." />
                </div>
                <div className="space-y-2">
                  <Label>Terms & Conditions</Label>
                  <Textarea value={formData.terms_and_conditions} onChange={e => setFormData({ ...formData, terms_and_conditions: e.target.value })} rows={4} />
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-3 pb-8">
              <Link to={createPageUrl('Proposals')}><Button type="button" variant="outline">Cancel</Button></Link>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={createProposalMutation.isPending}>
                {createProposalMutation.isPending ? 'Creating...' : 'Create Proposal'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Add New Provider Dialog ── */}
      <Dialog open={addProviderOpen} onOpenChange={setAddProviderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add New Provider</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createSupplierMutation.mutate({ ...newProvider, category_id: categories[0]?.id || '' }); }} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Provider Name *</Label>
              <Input value={newProvider.name} onChange={e => setNewProvider({ ...newProvider, name: e.target.value })} placeholder="e.g. Sunset Tours" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={newProvider.city} onChange={e => setNewProvider({ ...newProvider, city: e.target.value })} placeholder="Istanbul" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={newProvider.phone} onChange={e => setNewProvider({ ...newProvider, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newProvider.email} onChange={e => setNewProvider({ ...newProvider, email: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddProviderOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={createSupplierMutation.isPending}>
                {createSupplierMutation.isPending ? 'Adding...' : 'Add Provider'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}