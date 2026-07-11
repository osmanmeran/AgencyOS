import { db } from '@/lib/DbContext';
import { getCurrencySymbol } from '@/lib/formatters';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, Calendar, Save, RefreshCw, AlertCircle, Copy, CalendarOff } from 'lucide-react';
import { categoryIdsBySupplier, getSupplierCategoryIds } from '@/lib/supplierCategories';
import { resolvePaxTier } from '@/lib/pricing';
import { getBlockingStopSale } from '@/lib/supplierStopSales';
import { useT } from '@/lib/i18n/I18nContext';

const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'TRY', 'AED', 'SAR', 'EGP', 'MAD', 'JPY', 'CHF', 'CAD', 'AUD'];
// These lists are stored verbatim as the service's field value (not a separate
// enum code), so they're kept in English to avoid mismatches with existing data.
const HOTEL_TREATMENTS = [
  'Room Only',
  'Bed & Breakfast',
  'Half Board',
  'Full Board',
  'All Inclusive',
  'Ultra All Inclusive',
];
const ROOM_TYPES = ['Standard', 'Superior', 'Deluxe', 'Suite', 'Junior Suite', 'Executive', 'Family Room', 'Studio'];
const ROOM_OCCUPANCIES = ['Single', 'Double', 'Triple', 'Quadruple', 'Twin', 'Twin/Double'];
const TRANSFER_TYPES = [
  'Airport Pickup',
  'Airport Drop-off',
  'Point to Point',
  'Hotel to Hotel',
  'Port Transfer',
  'City Transfer',
];
const GUIDE_LANGUAGES = [
  'English',
  'French',
  'Spanish',
  'Arabic',
  'German',
  'Italian',
  'Portuguese',
  'Chinese',
  'Japanese',
  'Russian',
  'Turkish',
];

export default function ServiceLineEditor({
  service,
  categories,
  onUpdate,
  onRemove,
  onDuplicate,
  _passengerCount,
  services,
  onChange,
}) {
  const { t } = useT();
  const [formData, setFormData] = useState(service);
  const [convertingCost, setConvertingCost] = useState(false);
  const [convertingSell, setConvertingSell] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['suppliers'],
      queryFn: () => db.entities.Supplier.list(),
    })
  );

  const { data: subcategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['allSupplierSubcategories'],
      queryFn: () => db.entities.SupplierSubcategory.list(),
    })
  );
  const supplierCategoryMap = categoryIdsBySupplier(subcategories);

  const { data: stopSales = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['allSupplierStopSales'],
      queryFn: () => db.entities.SupplierStopSale.list(),
    })
  );

  const categoryName = (formData.category || '').toLowerCase();
  const isLodging =
    categoryName.includes('hotel') ||
    categoryName.includes('lodging') ||
    categoryName.includes('accommodation') ||
    categoryName.includes('resort');
  const isTransfer = categoryName.includes('transfer');
  const isFlight = categoryName.includes('flight');
  const isGuided =
    categoryName.includes('tour') ||
    categoryName.includes('guide') ||
    categoryName.includes('excursion') ||
    categoryName.includes('activity');
  const categorySelected = !!formData.category;
  const selectedCategoryObj = categories.find(
    (c) => formData.category && (c.id === formData.category || c.name === formData.category),
  );
  const filteredSuppliers = selectedCategoryObj
    ? suppliers.filter((s) => getSupplierCategoryIds(supplierCategoryMap, s.id).includes(selectedCategoryObj.id))
    : suppliers;

  const outboundDate = isTransfer ? formData.service_date || formData.start_date : formData.start_date;
  const outboundEnd = isTransfer ? outboundDate : formData.end_date;
  const stopSale =
    getBlockingStopSale(stopSales, formData.supplier_id, outboundDate, outboundEnd) ||
    (isTransfer && formData.return_leg?.enabled && formData.return_leg?.date
      ? getBlockingStopSale(stopSales, formData.supplier_id, formData.return_leg.date, formData.return_leg.date)
      : null);

  const calcQuantity = () => {
    const qty = formData.quantity || 1;
    if (formData.unit === 'per_night' || formData.unit === 'per_day') {
      if (formData.start_date && formData.end_date) {
        const days = Math.max(
          1,
          Math.round((+new Date(formData.end_date) - +new Date(formData.start_date)) / 86400000),
        );
        return qty * days;
      }
      return qty;
    }
    return qty;
  };

  const totalCost = calcQuantity() * (parseFloat(formData.acquiring_price) || 0);
  const totalSell = calcQuantity() * (parseFloat(formData.selling_price) || 0);

  const handleChange = (field, value) => {
    setFormData((prev) => {
      const next =
        field === 'return_leg'
          ? { ...prev, return_leg: { ...prev.return_leg, ...value } }
          : { ...prev, [field]: value };
      onChange?.(next);
      return next;
    });
  };

  const convertCurrency = async (type) => {
    const fromCur = type === 'cost' ? formData.supplier_currency : formData.client_currency;
    const toCur = type === 'cost' ? formData.cost_display_currency : formData.sell_display_currency;
    const amount =
      type === 'cost' ? parseFloat(formData.acquiring_price) || 0 : parseFloat(formData.selling_price) || 0;
    if (!fromCur || !toCur || fromCur === toCur || !amount) return;
    if (type === 'cost') setConvertingCost(true);
    else setConvertingSell(true);
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
    } catch {
      /* ignore */
    }
    if (type === 'cost') setConvertingCost(false);
    else setConvertingSell(false);
  };

  const handleSave = () => {
    setSaveAttempted(true);
    if (
      !formData.category ||
      !formData.supplier_id ||
      formData.acquiring_price == null ||
      formData.selling_price == null ||
      stopSale
    )
      return;
    // For transfers, sync service_date into start_date/end_date
    const data =
      isTransfer && formData.service_date
        ? { ...formData, start_date: formData.service_date, end_date: formData.service_date }
        : formData;
    onUpdate?.(data);
  };

  const err = (field) =>
    saveAttempted && (formData[field] === undefined || formData[field] === null || formData[field] === '');

  // Find selected supplier name for display
  //   const selectedSupplier = suppliers.find(s => s.id === formData.supplier_id);

  return (
    <Card className="p-5 bg-card border-l-4 border-l-blue-500 relative">
      <div className="absolute top-3 right-3 flex items-center gap-1">
        {onDuplicate && (
          <button
            onClick={() => onDuplicate()}
            className="p-1.5 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded"
            title={t('serviceLineEditor.duplicateServiceTitle')}
          >
            <Copy className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onRemove()}
          className="p-1.5 text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* STEP 1: Category — must choose first */}
      <div className="mb-5">
        <Label
          className={`text-xs mb-1 block font-semibold ${err('category') ? 'text-red-600 dark:text-red-300' : 'text-foreground'}`}
        >
          {t('serviceLineEditor.selectCategoryLabel')} <span className="text-red-500 dark:text-red-300">*</span>
        </Label>
        <Select value={formData.category || ''} onValueChange={(v) => handleChange('category', v)}>
          <SelectTrigger className={`text-sm ${err('category') ? 'border-red-400' : ''}`}>
            <SelectValue placeholder={t('serviceLineEditor.chooseCategoryPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.name || cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {err('category') && (
          <p className="text-xs text-red-500 dark:text-red-300 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {t('serviceLineEditor.categoryRequired')}
          </p>
        )}
      </div>

      {/* Rest of form — only shown after category is selected */}
      {categorySelected && (
        <>
          {/* STEP 2: Provider */}
          <div className="mb-5">
            <Label
              className={`text-xs mb-1 block font-semibold ${err('supplier_id') ? 'text-red-600 dark:text-red-300' : 'text-foreground'}`}
            >
              {t('serviceLineEditor.providerLabel')} <span className="text-red-500 dark:text-red-300">*</span>
            </Label>
            <Select
              value={formData.supplier_id || ''}
              onValueChange={(v) => {
                if (v !== formData.supplier_id) {
                  setFormData((prev) => ({ ...prev, supplier_id: v, pricing_id: '' }));
                }
              }}
            >
              <SelectTrigger className={`text-sm ${err('supplier_id') ? 'border-red-400' : ''}`}>
                <SelectValue
                  placeholder={
                    selectedCategoryObj
                      ? t('serviceLineEditor.selectProviderPlaceholder')
                      : t('serviceLineEditor.chooseCategoryFirstPlaceholder')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredSuppliers.length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                    {t('serviceLineEditor.noSuppliersInCategory')}
                  </div>
                )}
                {filteredSuppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err('supplier_id') && (
              <p className="text-xs text-red-500 dark:text-red-300 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {t('serviceLineEditor.providerRequired')}
              </p>
            )}
            {stopSale && (
              <p className="text-xs text-red-600 dark:text-red-300 mt-1 flex items-center gap-1 font-medium">
                <CalendarOff className="w-3.5 h-3.5 flex-shrink-0" />
                {t('serviceLineEditor.stopSaleWarning', {
                  start: stopSale.start_date,
                  end: stopSale.end_date,
                  reasonSuffix: stopSale.reason ? ` (${stopSale.reason})` : '',
                })}
              </p>
            )}

            {/* Pricing Tiers — shown after supplier is selected */}
            {formData.supplier_id &&
              (() => {
                const PricingsTierSelector = () => {
                  const { data: pricings = /** @type {any} */ ([]) } = /** @type {any} */ (
                    useQuery({
                      queryKey: ['supplierPricings', formData.supplier_id],
                      queryFn: () => db.entities.SupplierPricing.filter({ supplier_id: formData.supplier_id }),
                      enabled: !!formData.supplier_id,
                    })
                  );
                  const { data: subcategories = /** @type {any} */ ([]) } = /** @type {any} */ (
                    useQuery({
                      queryKey: ['supplierSubcategories', formData.supplier_id],
                      queryFn: () => db.entities.SupplierSubcategory.filter({ supplier_id: formData.supplier_id }),
                      enabled: !!formData.supplier_id,
                    })
                  );
                  const activePricings = pricings.filter((p) => p.is_active !== false);
                  const getSubcatName = (id) => subcategories.find((s) => s.id === id)?.name || '';

                  const handlePricingSelect = (pricingId) => {
                    const p = pricings.find((x) => x.id === pricingId);
                    if (!p) return;
                    const pUnit = p.unit || formData.unit || 'per_person';
                    const quantity =
                      pUnit === 'per_night' || pUnit === 'per_day' ? 1 : p.min_quantity || formData.quantity || 1;
                    // Guided-tour prices can vary by group size — use the
                    // per-pax band matching the line's quantity when there is one.
                    const paxTier = resolvePaxTier(p, formData.quantity || quantity);
                    const updates = {
                      pricing_id: p.id,
                      name: p.name || formData.name,
                      description: p.description || formData.description || '',
                      acquiring_price: paxTier ? paxTier.price_per_person : (p.base_price ?? formData.acquiring_price),
                      selling_price: paxTier
                        ? (paxTier.client_price_per_person ?? paxTier.price_per_person)
                        : (p.client_price ?? formData.acquiring_price ?? formData.selling_price),
                      unit: pUnit,
                      subcategory_id: p.subcategory_id || '',
                      supplier_currency: p.currency || formData.supplier_currency || 'USD',
                      client_currency: p.currency || formData.client_currency || 'USD',
                      quantity,
                    };
                    if (isTransfer && p.car_capacity) updates.car_capacity = p.car_capacity;
                    if (isLodging && p.occupancy) updates.room_occupancy = p.occupancy;
                    setFormData((prev) => ({ ...prev, ...updates }));
                  };

                  return activePricings.length > 0 ? (
                    <div className="mb-4">
                      <Label className="text-xs text-muted-foreground mb-1 block font-semibold">
                        {t('serviceLineEditor.pricingTierOptional')}
                      </Label>
                      <Select value={formData.pricing_id || ''} onValueChange={handlePricingSelect}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder={t('serviceLineEditor.selectPricingTierPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {activePricings.map((p) => {
                            const occLabel = p.occupancy
                              ? ` | ${p.occupancy.charAt(0).toUpperCase() + p.occupancy.slice(1)}`
                              : '';
                            const mealLabel = p.meal_treatment
                              ? ` | ${{ RO: 'Room Only', BB: 'B&B', HB: 'Half Board', FB: 'Full Board', AI: 'All Inc.', UAI: 'Ultra AI' }[p.meal_treatment] || p.meal_treatment}`
                              : '';
                            return (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} — {p.currency} {p.base_price}/{p.unit?.replace('_', ' ')}
                                {occLabel}
                                {mealLabel}
                                {p.subcategory_id ? ` (${getSubcatName(p.subcategory_id)})` : ''}
                                {(p.pricing_type || 'individual') === 'group' ? ' [GROUP]' : ''}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {formData.pricing_id && (
                        <p className="text-xs text-blue-600 dark:text-blue-300 mt-1 flex items-center gap-1">
                          {t('serviceLineEditor.autoFilledHint')}
                        </p>
                      )}
                    </div>
                  ) : null;
                };
                return <PricingsTierSelector />;
              })()}

            {/* Booking Source */}
            <div className="mt-4">
              <Label className="text-xs text-muted-foreground mb-1 block font-semibold">
                {t('serviceLineEditor.bookingSourceLabel')}
              </Label>
              <Select
                value={formData.booking_source || 'direct'}
                onValueChange={(v) => handleChange('booking_source', v)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">{t('serviceLineEditor.directBooking')}</SelectItem>
                  <SelectItem value="via_supplier">{t('serviceLineEditor.viaAnotherSupplier')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* STEP 3: Service details */}
          <div className="border-t border-border pt-4 mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {t('serviceLineEditor.serviceDetailsStep')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  {t('serviceLineEditor.serviceNameLabel')}
                </Label>
                <Input
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder={t('serviceLineEditor.serviceNamePlaceholder')}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  {t('serviceLineEditor.locationLabel')}
                </Label>
                <Input
                  value={formData.location || ''}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder={t('serviceLineEditor.locationPlaceholder')}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Lodging-specific fields */}
            {isLodging && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800">
                <div>
                  <Label className="text-xs text-blue-700 dark:text-blue-300 mb-1 block font-semibold">
                    {t('serviceLineEditor.treatmentMealPlanLabel')}
                  </Label>
                  <Select
                    value={formData.hotel_treatment || ''}
                    onValueChange={(v) => handleChange('hotel_treatment', v)}
                  >
                    <SelectTrigger className="text-sm bg-card">
                      <SelectValue placeholder={t('serviceLineEditor.selectTreatmentPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {HOTEL_TREATMENTS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-blue-700 dark:text-blue-300 mb-1 block font-semibold">
                    {t('serviceLineEditor.roomTypeLabel')}
                  </Label>
                  <Select value={formData.room_type || ''} onValueChange={(v) => handleChange('room_type', v)}>
                    <SelectTrigger className="text-sm bg-card">
                      <SelectValue placeholder={t('serviceLineEditor.selectRoomTypePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {ROOM_TYPES.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-blue-700 dark:text-blue-300 mb-1 block font-semibold">
                    {t('serviceLineEditor.roomOccupancyLabel')}
                  </Label>
                  <Select
                    value={formData.room_occupancy || ''}
                    onValueChange={(v) => handleChange('room_occupancy', v)}
                  >
                    <SelectTrigger className="text-sm bg-card">
                      <SelectValue placeholder={t('serviceLineEditor.selectOccupancyPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {ROOM_OCCUPANCIES.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Transfer-specific fields */}
            {isTransfer && (
              <div className="space-y-4 mb-4 p-3 bg-orange-50 dark:bg-orange-950/40 rounded-lg border border-orange-200 dark:border-orange-800">
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                  {t('serviceLineEditor.outboundLegLabel')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
                      {t('serviceLineEditor.transferTypeLabel')}
                    </Label>
                    <Select
                      value={formData.transfer_type || ''}
                      onValueChange={(v) => handleChange('transfer_type', v)}
                    >
                      <SelectTrigger className="text-sm bg-card">
                        <SelectValue placeholder={t('serviceLineEditor.selectTransferTypePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSFER_TYPES.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
                      {t('serviceLineEditor.pickupLocationLabel')}
                    </Label>
                    <Input
                      value={formData.pickup_location || ''}
                      onChange={(e) => handleChange('pickup_location', e.target.value)}
                      placeholder={t('serviceLineEditor.pickupLocationPlaceholder')}
                      className="text-sm bg-card"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
                      {t('serviceLineEditor.dropoffLocationLabel')}
                    </Label>
                    <Input
                      value={formData.dropoff_location || ''}
                      onChange={(e) => handleChange('dropoff_location', e.target.value)}
                      placeholder={t('serviceLineEditor.dropoffLocationPlaceholder')}
                      className="text-sm bg-card"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
                      {t('serviceLineEditor.dateLabel')}
                    </Label>
                    <Input
                      type="date"
                      value={formData.service_date || formData.start_date || ''}
                      onChange={(e) => handleChange('service_date', e.target.value)}
                      className="text-sm bg-card"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
                      {t('serviceLineEditor.pickupTimeLabel')}
                    </Label>
                    <Input
                      type="time"
                      value={formData.pickup_time || ''}
                      onChange={(e) => handleChange('pickup_time', e.target.value)}
                      className="text-sm bg-card"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
                      {t('serviceLineEditor.flightNumberOptionalLabel')}{' '}
                      <span className="font-normal text-orange-400">{t('serviceLineEditor.optionalSuffix')}</span>
                    </Label>
                    <Input
                      value={formData.transfer_flight_number || ''}
                      onChange={(e) => handleChange('transfer_flight_number', e.target.value)}
                      placeholder={t('serviceLineEditor.flightNumberPlaceholder')}
                      className="text-sm bg-card"
                    />
                  </div>
                </div>

                {/* Return Leg */}
                <div className="border-t border-orange-200 dark:border-orange-800 pt-3 mt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.return_leg?.enabled || false}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        if (enabled) {
                          const lodgingServices = (services || []).filter((s) => {
                            const cat = (s.category || '').toLowerCase();
                            return cat.includes('hotel') || cat.includes('lodging') || cat.includes('accommodation');
                          });
                          const defaultDate = lodgingServices.length > 0 ? lodgingServices[0].end_date || '' : '';
                          setFormData((prev) => ({
                            ...prev,
                            return_leg: {
                              enabled: true,
                              date: defaultDate,
                              pickup_location: prev.dropoff_location || '',
                              dropoff_location: prev.pickup_location || '',
                              transfer_type: prev.transfer_type || '',
                              pickup_time: '',
                              flight_number: '',
                            },
                          }));
                        } else {
                          setFormData((prev) => ({ ...prev, return_leg: { enabled: false } }));
                        }
                      }}
                    />
                    <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                      {t('serviceLineEditor.returnLegLabel')}
                    </span>
                  </label>
                  {formData.return_leg?.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 p-2 bg-card rounded-lg border border-orange-100">
                      <div>
                        <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
                          {t('serviceLineEditor.returnDateLabel')}
                        </Label>
                        <Input
                          type="date"
                          value={formData.return_leg.date || ''}
                          onChange={(e) => handleChange('return_leg', { ...formData.return_leg, date: e.target.value })}
                          className="text-sm bg-card"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
                          {t('serviceLineEditor.returnPickupTimeLabel')}
                        </Label>
                        <Input
                          type="time"
                          value={formData.return_leg.pickup_time || ''}
                          onChange={(e) =>
                            handleChange('return_leg', { ...formData.return_leg, pickup_time: e.target.value })
                          }
                          className="text-sm bg-card"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
                          {t('serviceLineEditor.returnPickupLocationLabel')}
                        </Label>
                        <Input
                          value={formData.return_leg.pickup_location || ''}
                          onChange={(e) =>
                            handleChange('return_leg', { ...formData.return_leg, pickup_location: e.target.value })
                          }
                          placeholder="e.g., Burj Al Arab Hotel"
                          className="text-sm bg-card"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
                          {t('serviceLineEditor.returnDropoffLocationLabel')}
                        </Label>
                        <Input
                          value={formData.return_leg.dropoff_location || ''}
                          onChange={(e) =>
                            handleChange('return_leg', { ...formData.return_leg, dropoff_location: e.target.value })
                          }
                          placeholder="e.g., Dubai Airport T3"
                          className="text-sm bg-card"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
                          {t('serviceLineEditor.returnTransferTypeLabel')}
                        </Label>
                        <Select
                          value={formData.return_leg.transfer_type || ''}
                          onValueChange={(v) =>
                            handleChange('return_leg', { ...formData.return_leg, transfer_type: v })
                          }
                        >
                          <SelectTrigger className="text-sm bg-card">
                            <SelectValue placeholder={t('serviceLineEditor.selectTransferTypePlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            {TRANSFER_TYPES.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
                          {t('serviceLineEditor.returnFlightNumberLabel')}{' '}
                          <span className="font-normal text-orange-400">{t('serviceLineEditor.optionalSuffix')}</span>
                        </Label>
                        <Input
                          value={formData.return_leg.flight_number || ''}
                          onChange={(e) =>
                            handleChange('return_leg', { ...formData.return_leg, flight_number: e.target.value })
                          }
                          placeholder={t('serviceLineEditor.returnFlightNumberPlaceholder')}
                          className="text-sm bg-card"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Guided tour / activity-specific fields */}
            {isGuided && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 bg-green-50 dark:bg-green-950/40 rounded-lg border border-green-200 dark:border-green-800">
                <div>
                  <Label className="text-xs text-green-700 dark:text-green-300 mb-1 block font-semibold">
                    {t('serviceLineEditor.guideNameLabel')}{' '}
                    <span className="font-normal text-green-500 dark:text-green-300">
                      {t('serviceLineEditor.optionalSuffix')}
                    </span>
                  </Label>
                  <Input
                    value={formData.guide_name || ''}
                    onChange={(e) => handleChange('guide_name', e.target.value)}
                    placeholder={t('serviceLineEditor.guideNamePlaceholder')}
                    className="text-sm bg-card"
                  />
                </div>
                <div>
                  <Label className="text-xs text-green-700 dark:text-green-300 mb-1 block font-semibold">
                    {t('serviceLineEditor.guideLanguageLabel')}
                  </Label>
                  <Select
                    value={formData.guide_language || ''}
                    onValueChange={(v) => handleChange('guide_language', v)}
                  >
                    <SelectTrigger className="text-sm bg-card">
                      <SelectValue placeholder={t('serviceLineEditor.selectLanguagePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {GUIDE_LANGUAGES.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-green-700 dark:text-green-300 mb-1 block font-semibold">
                    {t('serviceLineEditor.serviceDurationLabel')}
                  </Label>
                  <Input
                    value={formData.service_duration || ''}
                    onChange={(e) => handleChange('service_duration', e.target.value)}
                    placeholder={t('serviceLineEditor.serviceDurationPlaceholder')}
                    className="text-sm bg-card"
                  />
                </div>
              </div>
            )}

            {/* Flight-specific fields */}
            {isFlight && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 bg-purple-50 dark:bg-purple-950/40 rounded-lg border border-purple-200 dark:border-purple-800">
                <div>
                  <Label className="text-xs text-purple-700 dark:text-purple-300 mb-1 block font-semibold">
                    {t('serviceLineEditor.departureAirportLabel')}
                  </Label>
                  <Input
                    value={formData.departure_airport || ''}
                    onChange={(e) => handleChange('departure_airport', e.target.value)}
                    placeholder={t('serviceLineEditor.departureAirportPlaceholder')}
                    className="text-sm bg-card"
                  />
                </div>
                <div>
                  <Label className="text-xs text-purple-700 dark:text-purple-300 mb-1 block font-semibold">
                    {t('serviceLineEditor.arrivalAirportLabel')}
                  </Label>
                  <Input
                    value={formData.arrival_airport || ''}
                    onChange={(e) => handleChange('arrival_airport', e.target.value)}
                    placeholder={t('serviceLineEditor.arrivalAirportPlaceholder')}
                    className="text-sm bg-card"
                  />
                </div>
                <div>
                  <Label className="text-xs text-purple-700 dark:text-purple-300 mb-1 block font-semibold">
                    {t('serviceLineEditor.flightNumberLabel')}
                  </Label>
                  <Input
                    value={formData.flight_number || ''}
                    onChange={(e) => handleChange('flight_number', e.target.value)}
                    placeholder={t('serviceLineEditor.flightNumberPlaceholder')}
                    className="text-sm bg-card"
                  />
                </div>
              </div>
            )}

            {/* Dates */}
            {!isTransfer && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {t('serviceLineEditor.startDateLabel')}
                  </Label>
                  <Input
                    type="date"
                    value={formData.start_date || ''}
                    onChange={(e) => handleChange('start_date', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {t('serviceLineEditor.endDateLabel')}
                  </Label>
                  <Input
                    type="date"
                    value={formData.end_date || ''}
                    onChange={(e) => handleChange('end_date', e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            {/* Unit & Quantity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">{t('serviceLineEditor.unitLabel')}</Label>
                <Select value={formData.unit || 'per_person'} onValueChange={(v) => handleChange('unit', v)}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_person">{t('serviceLineEditor.perPerson')}</SelectItem>
                    <SelectItem value="per_night">{t('serviceLineEditor.perNight')}</SelectItem>
                    <SelectItem value="per_day">{t('serviceLineEditor.perDay')}</SelectItem>
                    <SelectItem value="per_hour">{t('serviceLineEditor.perHour')}</SelectItem>
                    <SelectItem value="flat_rate">{t('serviceLineEditor.flatRate')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  {formData.unit === 'per_hour'
                    ? t('serviceLineEditor.hoursLabel')
                    : formData.unit === 'per_night'
                      ? t('serviceLineEditor.roomsLabel')
                      : formData.unit === 'per_day'
                        ? t('serviceLineEditor.unitsLabel')
                        : t('serviceLineEditor.quantityLabel')}
                </Label>
                <Input
                  type="number"
                  value={formData.quantity || 1}
                  onChange={(e) => handleChange('quantity', parseFloat(e.target.value))}
                  min="1"
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          {/* STEP 4: Pricing */}
          <div className="border-t border-border pt-4 mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {t('serviceLineEditor.pricingStep')} <span className="text-red-500 dark:text-red-300">*</span>
            </p>

            {/* Costing price */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="md:col-span-2">
                <Label
                  className={`text-xs mb-1 block font-semibold ${err('acquiring_price') ? 'text-red-600 dark:text-red-300' : 'text-foreground'}`}
                >
                  {t('serviceLineEditor.costingPriceLabel')} <span className="text-red-500 dark:text-red-300">*</span>
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
                  <Select
                    value={formData.supplier_currency || 'USD'}
                    onValueChange={(v) => handleChange('supplier_currency', v)}
                  >
                    <SelectTrigger className="w-20 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(CURRENCY_CODES).map((cur) => (
                        <SelectItem key={cur} value={cur}>
                          {cur}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {err('acquiring_price') && (
                  <p className="text-xs text-red-500 dark:text-red-300 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {t('serviceLineEditor.costingPriceRequired')}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  {t('serviceLineEditor.convertToLabel')}
                </Label>
                <div className="flex gap-1">
                  <Select
                    value={formData.cost_display_currency || formData.supplier_currency || 'USD'}
                    onValueChange={(v) => handleChange('cost_display_currency', v)}
                  >
                    <SelectTrigger className="w-20 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(CURRENCY_CODES).map((cur) => (
                        <SelectItem key={cur} value={cur}>
                          {cur}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => convertCurrency('cost')}
                    disabled={convertingCost}
                    className="px-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${convertingCost ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  {t('serviceLineEditor.totalCostLabel')}
                </Label>
                <div className="text-sm font-bold text-foreground p-2 bg-amber-50 dark:bg-amber-950/40 rounded border">
                  {getCurrencySymbol(formData.supplier_currency || 'USD')}
                  {totalCost.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Selling price */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="md:col-span-2">
                <Label
                  className={`text-xs mb-1 block font-semibold ${err('selling_price') ? 'text-red-600 dark:text-red-300' : 'text-foreground'}`}
                >
                  {t('serviceLineEditor.sellingPriceLabel')} <span className="text-red-500 dark:text-red-300">*</span>
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
                  <Select
                    value={formData.client_currency || 'USD'}
                    onValueChange={(v) => handleChange('client_currency', v)}
                  >
                    <SelectTrigger className="w-20 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(CURRENCY_CODES).map((cur) => (
                        <SelectItem key={cur} value={cur}>
                          {cur}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {err('selling_price') && (
                  <p className="text-xs text-red-500 dark:text-red-300 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {t('serviceLineEditor.sellingPriceRequired')}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  {t('serviceLineEditor.convertToLabel')}
                </Label>
                <div className="flex gap-1">
                  <Select
                    value={formData.sell_display_currency || formData.client_currency || 'USD'}
                    onValueChange={(v) => handleChange('sell_display_currency', v)}
                  >
                    <SelectTrigger className="w-20 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(CURRENCY_CODES).map((cur) => (
                        <SelectItem key={cur} value={cur}>
                          {cur}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => convertCurrency('sell')}
                    disabled={convertingSell}
                    className="px-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${convertingSell ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  {t('serviceLineEditor.totalSellingLabel')}
                </Label>
                <div className="text-sm font-bold text-green-700 dark:text-green-300 p-2 bg-green-50 dark:bg-green-950/40 rounded border">
                  {getCurrencySymbol(formData.client_currency || 'USD')}
                  {totalSell.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Margin summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  {t('serviceLineEditor.effectiveQtyLabel')}
                </Label>
                <div className="text-sm font-semibold text-foreground p-2 bg-muted rounded border">
                  {formData.unit === 'per_night' && formData.start_date && formData.end_date
                    ? t('serviceLineEditor.roomsNightsFormat', {
                        qty: formData.quantity || 1,
                        nights: Math.max(
                          1,
                          Math.round((+new Date(formData.end_date) - +new Date(formData.start_date)) / 86400000),
                        ),
                      })
                    : formData.unit === 'per_day' && formData.start_date && formData.end_date
                      ? t('serviceLineEditor.unitsDaysFormat', {
                          qty: formData.quantity || 1,
                          days: Math.max(
                            1,
                            Math.round((+new Date(formData.end_date) - +new Date(formData.start_date)) / 86400000),
                          ),
                        })
                      : `${calcQuantity()} ${
                          formData.unit === 'per_hour'
                            ? t('serviceLineEditor.hrsUnit')
                            : formData.unit === 'per_person'
                              ? t('serviceLineEditor.paxUnit')
                              : t('serviceLineEditor.unitsUnit')
                        }`}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">{t('serviceLineEditor.marginLabel')}</Label>
                <div className="text-sm font-semibold text-foreground p-2 bg-muted rounded border">
                  {totalCost > 0 ? (((totalSell - totalCost) / totalCost) * 100).toFixed(0) : 0}%
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground mb-1 block">
              {t('serviceLineEditor.descriptionOptionalLabel')}
            </Label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={t('serviceLineEditor.descriptionPlaceholder')}
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Itinerary visibility */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.show_in_itinerary !== false}
                onChange={(e) => handleChange('show_in_itinerary', e.target.checked)}
                className="rounded border-border text-blue-600 dark:text-blue-300 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-foreground">
                {t('serviceLineEditor.showInItineraryLabel')}
              </span>
            </label>
            <p className="text-[11px] text-muted-foreground mt-0.5 ml-5">
              {t('serviceLineEditor.showInItineraryHint')}
            </p>
          </div>

          {/* Save */}
          {saveAttempted && (!formData.category || !formData.supplier_id) && (
            <p className="text-xs text-red-500 dark:text-red-300 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {t('serviceLineEditor.fillCategoryProviderError')}
            </p>
          )}
          {saveAttempted && (formData.acquiring_price == null || formData.selling_price == null) && (
            <p className="text-xs text-red-500 dark:text-red-300 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {t('serviceLineEditor.pricesRequiredError')}
            </p>
          )}
          {saveAttempted && stopSale && (
            <p className="text-xs text-red-500 dark:text-red-300 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {t('serviceLineEditor.stopSaleSaveError')}
            </p>
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={!!stopSale}>
              <Save className="w-3.5 h-3.5 mr-1" />
              {t('serviceLineEditor.saveServiceButton')}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
