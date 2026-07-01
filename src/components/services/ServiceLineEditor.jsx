import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, Calendar, Save, RefreshCw, AlertCircle, Copy } from 'lucide-react';


const CURRENCIES = { USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' };
const HOTEL_TREATMENTS = ['Room Only', 'Bed & Breakfast', 'Half Board', 'Full Board', 'All Inclusive', 'Ultra All Inclusive'];
const ROOM_TYPES = ['Standard', 'Superior', 'Deluxe', 'Suite', 'Junior Suite', 'Executive', 'Family Room', 'Studio'];
const ROOM_OCCUPANCIES = ['Single', 'Double', 'Triple', 'Quadruple', 'Twin', 'Twin/Double'];
const TRANSFER_TYPES = ['Airport Pickup', 'Airport Drop-off', 'Point to Point', 'Hotel to Hotel', 'Port Transfer', 'City Transfer'];
const GUIDE_LANGUAGES = ['English', 'French', 'Spanish', 'Arabic', 'German', 'Italian', 'Portuguese', 'Chinese', 'Japanese', 'Russian', 'Turkish'];

export default function ServiceLineEditor({ service, categories, onUpdate, onRemove, onDuplicate, _passengerCount, services, onChange }) {
  const [formData, setFormData] = useState(service);
  const [convertingCost, setConvertingCost] = useState(false);
  const [convertingSell, setConvertingSell] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['suppliers'],
    queryFn: () => db.entities.Supplier.list(),
  }));

  const categoryName = (formData.category || '').toLowerCase();
  const isLodging = categoryName.includes('hotel') || categoryName.includes('lodging') || categoryName.includes('accommodation') || categoryName.includes('resort');
  const isTransfer = categoryName.includes('transfer');
  const isFlight = categoryName.includes('flight');
  const isGuided = categoryName.includes('tour') || categoryName.includes('guide') || categoryName.includes('excursion') || categoryName.includes('activity');
  const categorySelected = !!formData.category;
  const selectedCategoryObj = categories.find(c => formData.category && (c.id === formData.category || c.name === formData.category));
  const filteredSuppliers = selectedCategoryObj
    ? suppliers.filter(s => s.category_id === selectedCategoryObj.id)
    : suppliers;

  const calcQuantity = () => {
    const qty = formData.quantity || 1;
    if (formData.unit === 'per_night' || formData.unit === 'per_day') {
      if (formData.start_date && formData.end_date) {
        const days = Math.max(1, Math.round((+(new Date(formData.end_date)) - +(new Date(formData.start_date))) / 86400000));
        return qty * days;
      }
      return qty;
    }
    return qty;
  };

  const totalCost = calcQuantity() * (parseFloat(formData.acquiring_price) || 0);
  const totalSell = calcQuantity() * (parseFloat(formData.selling_price) || 0);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const next = field === 'return_leg'
        ? { ...prev, return_leg: { ...prev.return_leg, ...value } }
        : { ...prev, [field]: value };
      onChange?.(next);
      return next;
    });
  };

  const convertCurrency = async (type) => {
    const fromCur = type === 'cost' ? formData.supplier_currency : formData.client_currency;
    const toCur = type === 'cost' ? formData.cost_display_currency : formData.sell_display_currency;
    const amount = type === 'cost' ? (parseFloat(formData.acquiring_price) || 0) : (parseFloat(formData.selling_price) || 0);
    if (!fromCur || !toCur || fromCur === toCur || !amount) return;
    if (type === 'cost') setConvertingCost(true); else setConvertingSell(true);
    try {
      const result = await db.integrations.Core.GetExchangeRate(fromCur, toCur);
      const rate = result?.rate;
      if (rate && type === 'cost') {
        const converted = parseFloat((amount * rate).toFixed(2));
        handleChange('acquiring_price', converted);
        handleChange('supplier_currency', toCur);
        handleChange('acquiring_price_converted', '');
      } else if (rate && type === 'sell') {
        const converted = parseFloat((amount * rate).toFixed(2));
        handleChange('selling_price', converted);
        handleChange('client_currency', toCur);
        handleChange('selling_price_converted', '');
      }
    } catch (err) {
      console.error('Conversion error:', err);
    }
    if (type === 'cost') setConvertingCost(false); else setConvertingSell(false);
  };

  const handleSave = () => {
    setSaveAttempted(true);
    if (!formData.category || !formData.supplier_id || formData.acquiring_price == null || formData.selling_price == null) return;
    // For transfers, sync service_date into start_date/end_date
    const data = isTransfer && formData.service_date
      ? { ...formData, start_date: formData.service_date, end_date: formData.service_date }
      : formData;
    onUpdate?.(data);
  };

  const err = (field) => saveAttempted && (formData[field] === undefined || formData[field] === null || formData[field] === '');

  // Find selected supplier name for display
//   const selectedSupplier = suppliers.find(s => s.id === formData.supplier_id);

  return (
    <Card className="p-5 bg-white border-l-4 border-l-blue-500 relative">
      <div className="absolute top-3 right-3 flex items-center gap-1">
        {onDuplicate && (
          <button onClick={() => onDuplicate()} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Duplicate service">
            <Copy className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => onRemove()} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* STEP 1: Category — must choose first */}
      <div className="mb-5">
        <Label className={`text-xs mb-1 block font-semibold ${err('category') ? 'text-red-600' : 'text-slate-700'}`}>
          1. Select Category <span className="text-red-500">*</span>
        </Label>
        <Select value={formData.category || ''} onValueChange={(v) => handleChange('category', v)}>
          <SelectTrigger className={`text-sm ${err('category') ? 'border-red-400' : ''}`}>
            <SelectValue placeholder="Choose a category to continue…" />
          </SelectTrigger>
          <SelectContent>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.name || cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {err('category') && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Category is required</p>}
      </div>

      {/* Rest of form — only shown after category is selected */}
      {categorySelected && (
        <>
          {/* STEP 2: Provider */}
          <div className="mb-5">
            <Label className={`text-xs mb-1 block font-semibold ${err('supplier_id') ? 'text-red-600' : 'text-slate-700'}`}>
              2. Provider / Supplier <span className="text-red-500">*</span>
            </Label>
            <Select value={formData.supplier_id || ''} onValueChange={(v) => {
              if (v !== formData.supplier_id) {
                setFormData(prev => ({ ...prev, supplier_id: v, pricing_id: '' }));
              }
            }}>
              <SelectTrigger className={`text-sm ${err('supplier_id') ? 'border-red-400' : ''}`}>
                <SelectValue placeholder={selectedCategoryObj ? 'Select a provider…' : 'Choose category first'} />
              </SelectTrigger>
              <SelectContent>
                {filteredSuppliers.length === 0 && (
                  <div className="px-2 py-3 text-xs text-slate-400 text-center">No suppliers in this category</div>
                )}
                {filteredSuppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err('supplier_id') && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Provider is required</p>}

            {/* Pricing Tiers — shown after supplier is selected */}
            {formData.supplier_id && (() => {
              const PricingsTierSelector = () => {
                const { data: pricings = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
                  queryKey: ['supplierPricings', formData.supplier_id],
                  queryFn: () => db.entities.SupplierPricing.filter({ supplier_id: formData.supplier_id }),
                  enabled: !!formData.supplier_id
                }));
                const { data: subcategories = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
                  queryKey: ['supplierSubcategories', formData.supplier_id],
                  queryFn: () => db.entities.SupplierSubcategory.filter({ supplier_id: formData.supplier_id }),
                  enabled: !!formData.supplier_id
                }));
                const activePricings = pricings.filter(p => p.is_active !== false);
                const getSubcatName = (id) => subcategories.find(s => s.id === id)?.name || '';

                const handlePricingSelect = (pricingId) => {
                  const p = pricings.find(x => x.id === pricingId);
                  if (!p) return;
                  const pUnit = p.unit || formData.unit || 'per_person';
                  const updates = {
                    pricing_id: p.id,
                    name: p.name || formData.name,
                    description: p.description || formData.description || '',
                    acquiring_price: p.base_price ?? formData.acquiring_price,
                    selling_price: p.client_price ?? formData.acquiring_price ?? formData.selling_price,
                    unit: pUnit,
                    subcategory_id: p.subcategory_id || '',
                    supplier_currency: p.currency || formData.supplier_currency || 'USD',
                    client_currency: p.currency || formData.client_currency || 'USD',
                    quantity: pUnit === 'per_night' || pUnit === 'per_day' ? 1 : (p.min_quantity || formData.quantity || 1),
                  };
                  if (isTransfer && p.car_capacity) updates.car_capacity = p.car_capacity;
                  if (isLodging && p.occupancy) updates.room_occupancy = p.occupancy;
                  setFormData(prev => ({ ...prev, ...updates }));
                };

                return activePricings.length > 0 ? (
                  <div className="mb-4">
                    <Label className="text-xs text-slate-600 mb-1 block font-semibold">Pricing Tier (optional)</Label>
                    <Select value={formData.pricing_id || ''} onValueChange={handlePricingSelect}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select a pricing tier to auto-fill..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activePricings.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} — {p.currency} {p.base_price}/{p.unit?.replace('_', ' ')}
                            {p.subcategory_id ? ` (${getSubcatName(p.subcategory_id)})` : ''}
                            {(p.pricing_type || 'individual') === 'group' ? ' [GROUP]' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.pricing_id && (
                      <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                        Fields auto-filled from selected tier. You can still edit them below.
                      </p>
                    )}
                  </div>
                ) : null;
              };
              return <PricingsTierSelector />;
            })()}

            {/* Booking Source */}
            <div className="mt-4">
              <Label className="text-xs text-slate-600 mb-1 block font-semibold">Booking Source</Label>
              <Select value={formData.booking_source || 'direct'} onValueChange={(v) => handleChange('booking_source', v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct Booking</SelectItem>
                  <SelectItem value="via_supplier">Via Another Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* STEP 3: Service details */}
          <div className="border-t border-slate-100 pt-4 mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">3. Service Details</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">Service Name</Label>
                <Input value={formData.name || ''} onChange={(e) => handleChange('name', e.target.value)} placeholder="e.g., 5-star Hotel" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">Location</Label>
                <Input value={formData.location || ''} onChange={(e) => handleChange('location', e.target.value)} placeholder="e.g., Dubai downtown" className="text-sm" />
              </div>
            </div>

            {/* Lodging-specific fields */}
            {isLodging && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <Label className="text-xs text-blue-700 mb-1 block font-semibold">Treatment / Meal Plan</Label>
                  <Select value={formData.hotel_treatment || ''} onValueChange={(v) => handleChange('hotel_treatment', v)}>
                    <SelectTrigger className="text-sm bg-white"><SelectValue placeholder="Select treatment" /></SelectTrigger>
                    <SelectContent>{HOTEL_TREATMENTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-blue-700 mb-1 block font-semibold">Room Type</Label>
                  <Select value={formData.room_type || ''} onValueChange={(v) => handleChange('room_type', v)}>
                    <SelectTrigger className="text-sm bg-white"><SelectValue placeholder="Select room type" /></SelectTrigger>
                    <SelectContent>{ROOM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-blue-700 mb-1 block font-semibold">Room Occupancy</Label>
                  <Select value={formData.room_occupancy || ''} onValueChange={(v) => handleChange('room_occupancy', v)}>
                    <SelectTrigger className="text-sm bg-white"><SelectValue placeholder="Select occupancy" /></SelectTrigger>
                    <SelectContent>{ROOM_OCCUPANCIES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Transfer-specific fields */}
            {isTransfer && (
              <div className="space-y-4 mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Outbound Leg</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label className="text-xs text-orange-700 mb-1 block font-semibold">Transfer Type</Label>
                    <Select value={formData.transfer_type || ''} onValueChange={(v) => handleChange('transfer_type', v)}>
                      <SelectTrigger className="text-sm bg-white"><SelectValue placeholder="Select transfer type" /></SelectTrigger>
                      <SelectContent>{TRANSFER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-orange-700 mb-1 block font-semibold">Pick Up Location</Label>
                    <Input value={formData.pickup_location || ''} onChange={(e) => handleChange('pickup_location', e.target.value)} placeholder="e.g., Dubai Airport T3" className="text-sm bg-white" />
                  </div>
                  <div>
                    <Label className="text-xs text-orange-700 mb-1 block font-semibold">Drop Off Location</Label>
                    <Input value={formData.dropoff_location || ''} onChange={(e) => handleChange('dropoff_location', e.target.value)} placeholder="e.g., Burj Al Arab Hotel" className="text-sm bg-white" />
                  </div>
                  <div>
                    <Label className="text-xs text-orange-700 mb-1 block font-semibold">Date</Label>
                    <Input type="date" value={formData.service_date || formData.start_date || ''} onChange={(e) => handleChange('service_date', e.target.value)} className="text-sm bg-white" />
                  </div>
                  <div>
                    <Label className="text-xs text-orange-700 mb-1 block font-semibold">Pick-Up Time</Label>
                    <Input type="time" value={formData.pickup_time || ''} onChange={(e) => handleChange('pickup_time', e.target.value)} className="text-sm bg-white" />
                  </div>
                  <div>
                    <Label className="text-xs text-orange-700 mb-1 block font-semibold">Flight Number <span className="font-normal text-orange-400">(optional)</span></Label>
                    <Input value={formData.transfer_flight_number || ''} onChange={(e) => handleChange('transfer_flight_number', e.target.value)} placeholder="e.g., EK001" className="text-sm bg-white" />
                  </div>
                </div>

                {/* Return Leg */}
                <div className="border-t border-orange-200 pt-3 mt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.return_leg?.enabled || false}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        if (enabled) {
                          const lodgingServices = (services || []).filter(s => {
                            const cat = (s.category || '').toLowerCase();
                            return cat.includes('hotel') || cat.includes('lodging') || cat.includes('accommodation');
                          });
                          const defaultDate = lodgingServices.length > 0
                            ? (lodgingServices[0].end_date || '')
                            : '';
                          setFormData(prev => ({
                            ...prev,
                            return_leg: {
                              enabled: true,
                              date: defaultDate,
                              pickup_location: prev.dropoff_location || '',
                              dropoff_location: prev.pickup_location || '',
                              transfer_type: prev.transfer_type || '',
                              pickup_time: '',
                              flight_number: '',
                            }
                          }));
                        } else {
                          setFormData(prev => ({ ...prev, return_leg: { enabled: false } }));
                        }
                      }}
                    />
                    <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Return Leg</span>
                  </label>
                  {formData.return_leg?.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 p-2 bg-white rounded-lg border border-orange-100">
                      <div>
                        <Label className="text-xs text-orange-700 mb-1 block font-semibold">Return Date</Label>
                        <Input type="date" value={formData.return_leg.date || ''} onChange={(e) => handleChange('return_leg', { ...formData.return_leg, date: e.target.value })} className="text-sm bg-white" />
                      </div>
                      <div>
                        <Label className="text-xs text-orange-700 mb-1 block font-semibold">Return Pick-Up Time</Label>
                        <Input type="time" value={formData.return_leg.pickup_time || ''} onChange={(e) => handleChange('return_leg', { ...formData.return_leg, pickup_time: e.target.value })} className="text-sm bg-white" />
                      </div>
                      <div>
                        <Label className="text-xs text-orange-700 mb-1 block font-semibold">Return Pick Up Location</Label>
                        <Input value={formData.return_leg.pickup_location || ''} onChange={(e) => handleChange('return_leg', { ...formData.return_leg, pickup_location: e.target.value })} placeholder="e.g., Burj Al Arab Hotel" className="text-sm bg-white" />
                      </div>
                      <div>
                        <Label className="text-xs text-orange-700 mb-1 block font-semibold">Return Drop Off Location</Label>
                        <Input value={formData.return_leg.dropoff_location || ''} onChange={(e) => handleChange('return_leg', { ...formData.return_leg, dropoff_location: e.target.value })} placeholder="e.g., Dubai Airport T3" className="text-sm bg-white" />
                      </div>
                      <div>
                        <Label className="text-xs text-orange-700 mb-1 block font-semibold">Return Transfer Type</Label>
                        <Select value={formData.return_leg.transfer_type || ''} onValueChange={(v) => handleChange('return_leg', { ...formData.return_leg, transfer_type: v })}>
                          <SelectTrigger className="text-sm bg-white"><SelectValue placeholder="Select transfer type" /></SelectTrigger>
                          <SelectContent>{TRANSFER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-orange-700 mb-1 block font-semibold">Return Flight Number <span className="font-normal text-orange-400">(optional)</span></Label>
                        <Input value={formData.return_leg.flight_number || ''} onChange={(e) => handleChange('return_leg', { ...formData.return_leg, flight_number: e.target.value })} placeholder="e.g., EK002" className="text-sm bg-white" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Guided tour / activity-specific fields */}
            {isGuided && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <Label className="text-xs text-green-700 mb-1 block font-semibold">Guide Name <span className="font-normal text-green-500">(optional)</span></Label>
                  <Input value={formData.guide_name || ''} onChange={(e) => handleChange('guide_name', e.target.value)} placeholder="e.g., Ahmed Hassan" className="text-sm bg-white" />
                </div>
                <div>
                  <Label className="text-xs text-green-700 mb-1 block font-semibold">Guide Language</Label>
                  <Select value={formData.guide_language || ''} onValueChange={(v) => handleChange('guide_language', v)}>
                    <SelectTrigger className="text-sm bg-white"><SelectValue placeholder="Select language" /></SelectTrigger>
                    <SelectContent>{GUIDE_LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-green-700 mb-1 block font-semibold">Service Duration</Label>
                  <Input value={formData.service_duration || ''} onChange={(e) => handleChange('service_duration', e.target.value)} placeholder="e.g., 4 hours, Full day" className="text-sm bg-white" />
                </div>
              </div>
            )}

            {/* Flight-specific fields */}
            {isFlight && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div>
                  <Label className="text-xs text-purple-700 mb-1 block font-semibold">Departure Airport</Label>
                  <Input value={formData.departure_airport || ''} onChange={(e) => handleChange('departure_airport', e.target.value)} placeholder="e.g., DXB – Dubai" className="text-sm bg-white" />
                </div>
                <div>
                  <Label className="text-xs text-purple-700 mb-1 block font-semibold">Arrival Airport</Label>
                  <Input value={formData.arrival_airport || ''} onChange={(e) => handleChange('arrival_airport', e.target.value)} placeholder="e.g., LHR – London" className="text-sm bg-white" />
                </div>
                <div>
                  <Label className="text-xs text-purple-700 mb-1 block font-semibold">Flight Number</Label>
                  <Input value={formData.flight_number || ''} onChange={(e) => handleChange('flight_number', e.target.value)} placeholder="e.g., EK001" className="text-sm bg-white" />
                </div>
              </div>
            )}

            {/* Dates */}
            {!isTransfer && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-xs text-slate-600 mb-1 block flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Start Date</Label>
                  <Input type="date" value={formData.start_date || ''} onChange={(e) => handleChange('start_date', e.target.value)} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-slate-600 mb-1 block flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />End Date</Label>
                  <Input type="date" value={formData.end_date || ''} onChange={(e) => handleChange('end_date', e.target.value)} className="text-sm" />
                </div>
              </div>
            )}

            {/* Unit & Quantity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">Unit</Label>
                <Select value={formData.unit || 'per_person'} onValueChange={(v) => handleChange('unit', v)}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_person">Per Person</SelectItem>
                    <SelectItem value="per_night">Per Night</SelectItem>
                    <SelectItem value="per_day">Per Day</SelectItem>
                    <SelectItem value="per_hour">Per Hour</SelectItem>
                    <SelectItem value="flat_rate">Flat Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">
                  {formData.unit === 'per_hour' ? 'Hours' : formData.unit === 'per_night' ? 'Rooms' : formData.unit === 'per_day' ? 'Units' : 'Quantity'}
                </Label>
                <Input type="number" value={formData.quantity || 1} onChange={(e) => handleChange('quantity', parseFloat(e.target.value))} min="1" className="text-sm" />
              </div>
            </div>
          </div>

          {/* STEP 4: Pricing */}
          <div className="border-t border-slate-100 pt-4 mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">4. Pricing <span className="text-red-500">*</span></p>

            {/* Costing price */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="md:col-span-2">
                <Label className={`text-xs mb-1 block font-semibold ${err('acquiring_price') ? 'text-red-600' : 'text-slate-700'}`}>
                  Costing Price / Unit <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={formData.acquiring_price ?? ''}
                    onChange={(e) => handleChange('acquiring_price', parseFloat(e.target.value))}
                    placeholder="0.00"
                    step="0.01"
                    className={`text-sm flex-1 ${err('acquiring_price') ? 'border-red-400' : ''}`}
                  />
                  <Select value={formData.supplier_currency || 'USD'} onValueChange={(v) => handleChange('supplier_currency', v)}>
                    <SelectTrigger className="w-20 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(CURRENCIES).map(cur => <SelectItem key={cur} value={cur}>{cur}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {err('acquiring_price') && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Costing price is required</p>}
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">Convert to</Label>
                <div className="flex gap-1">
                  <Select value={formData.cost_display_currency || formData.supplier_currency || 'USD'} onValueChange={(v) => handleChange('cost_display_currency', v)}>
                    <SelectTrigger className="w-20 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(CURRENCIES).map(cur => <SelectItem key={cur} value={cur}>{cur}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => convertCurrency('cost')} disabled={convertingCost} className="px-2">
                    <RefreshCw className={`w-3.5 h-3.5 ${convertingCost ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
                <div>
                  <Label className="text-xs text-slate-600 mb-1 block">Total Cost</Label>
                  <div className="text-sm font-bold text-slate-900 p-2 bg-amber-50 rounded border">
                    {CURRENCIES[formData.supplier_currency || 'USD']}{totalCost.toFixed(2)}
                  </div>
                </div>
            </div>

            {/* Selling price */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="md:col-span-2">
                <Label className={`text-xs mb-1 block font-semibold ${err('selling_price') ? 'text-red-600' : 'text-slate-700'}`}>
                  Selling Price / Unit <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={formData.selling_price ?? ''}
                    onChange={(e) => handleChange('selling_price', parseFloat(e.target.value))}
                    placeholder="0.00"
                    step="0.01"
                    className={`text-sm flex-1 ${err('selling_price') ? 'border-red-400' : ''}`}
                  />
                  <Select value={formData.client_currency || 'USD'} onValueChange={(v) => handleChange('client_currency', v)}>
                    <SelectTrigger className="w-20 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(CURRENCIES).map(cur => <SelectItem key={cur} value={cur}>{cur}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {err('selling_price') && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Selling price is required</p>}
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">Convert to</Label>
                <div className="flex gap-1">
                  <Select value={formData.sell_display_currency || formData.client_currency || 'USD'} onValueChange={(v) => handleChange('sell_display_currency', v)}>
                    <SelectTrigger className="w-20 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(CURRENCIES).map(cur => <SelectItem key={cur} value={cur}>{cur}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => convertCurrency('sell')} disabled={convertingSell} className="px-2">
                    <RefreshCw className={`w-3.5 h-3.5 ${convertingSell ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
                <div>
                  <Label className="text-xs text-slate-600 mb-1 block">Total Selling</Label>
                  <div className="text-sm font-bold text-green-700 p-2 bg-green-50 rounded border">
                    {CURRENCIES[formData.client_currency || 'USD']}{totalSell.toFixed(2)}
                  </div>
                </div>
            </div>

            {/* Margin summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">Effective Qty</Label>
                <div className="text-sm font-semibold text-slate-700 p-2 bg-slate-50 rounded border">
                  {formData.unit === 'per_night' && formData.start_date && formData.end_date
                    ? `${formData.quantity || 1} rooms × ${Math.max(1, Math.round((+(new Date(formData.end_date)) - +(new Date(formData.start_date))) / 86400000))} nights`
                    : formData.unit === 'per_day' && formData.start_date && formData.end_date
                    ? `${formData.quantity || 1} units × ${Math.max(1, Math.round((+(new Date(formData.end_date)) - +(new Date(formData.start_date))) / 86400000))} days`
                    : `${calcQuantity()} ${formData.unit === 'per_hour' ? 'hrs' : formData.unit === 'per_person' ? 'pax' : 'units'}`}
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">Margin</Label>
                <div className="text-sm font-semibold text-slate-700 p-2 bg-slate-50 rounded border">
                  {totalCost > 0 ? (((totalSell - totalCost) / totalCost) * 100).toFixed(0) : 0}%
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <Label className="text-xs text-slate-600 mb-1 block">Description (optional)</Label>
            <Textarea value={formData.description || ''} onChange={(e) => handleChange('description', e.target.value)} placeholder="Add service details, inclusions, or notes" rows={2} className="text-sm" />
          </div>

          {/* Itinerary visibility */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.show_in_itinerary !== false}
                onChange={(e) => handleChange('show_in_itinerary', e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-slate-700">Show in Itinerary Recap</span>
            </label>
            <p className="text-[11px] text-slate-400 mt-0.5 ml-5">Uncheck to hide this service from the client-facing itinerary</p>
          </div>

          {/* Save */}
          {saveAttempted && (!formData.category || !formData.supplier_id) && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Fill in Category and Provider, then click Save again</p>
          )}
          {saveAttempted && (formData.acquiring_price == null || formData.selling_price == null) && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Acquiring and selling prices are required</p>
          )}
          <div className="flex justify-end">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleSave}>
              <Save className="w-3.5 h-3.5 mr-1" />Save Service
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}