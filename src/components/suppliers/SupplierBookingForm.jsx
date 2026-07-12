import { db } from '@/lib/DbContext';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Users, Loader2, CheckCircle, CalendarOff } from 'lucide-react';
import { getBlockingStopSale } from '@/lib/supplierStopSales';
import { useT } from '@/lib/i18n/I18nContext';

const MEAL_BASIS_KEYS = [
  { value: 'RO', labelKey: 'supplierBookingForm.mealRO' },
  { value: 'BB', labelKey: 'supplierBookingForm.mealBB' },
  { value: 'HB', labelKey: 'supplierBookingForm.mealHB' },
  { value: 'FB', labelKey: 'supplierBookingForm.mealFB' },
  { value: 'AI', labelKey: 'supplierBookingForm.mealAI' },
  { value: 'UAI', labelKey: 'supplierBookingForm.mealUAI' },
];

const TRANSFER_TYPE_KEYS = [
  { value: 'airport_pickup', labelKey: 'supplierBookingForm.transferTypeAirportPickup' },
  { value: 'airport_dropoff', labelKey: 'supplierBookingForm.transferTypeAirportDropoff' },
  { value: 'point_to_point', labelKey: 'supplierBookingForm.transferTypePointToPoint' },
];

function isHotel(categoryName) {
  return categoryName?.toLowerCase().includes('hotel');
}
function isTransfer(categoryName) {
  return categoryName?.toLowerCase().includes('transfer');
}
function isCarRental(categoryName) {
  const c = categoryName?.toLowerCase() || '';
  return c.includes('rent a car') || c.includes('car rental') || c.includes('rental');
}

export default function SupplierBookingForm({ open, onClose, onCreated, supplier, categoryName }) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState(null);
  const [form, setForm] = useState({
    service_date: '',
    num_people: 1,
    service_type: '',
    notes: '',
    total_cost: '',
    currency: 'EUR',
    pricing_id: '',
    pricing_name: '',
    // Transfer fields
    transfer_type: 'airport_pickup',
    origin_supplier_id: '',
    origin_supplier_name: '',
    destination_supplier_id: '',
    destination_supplier_name: '',
    pickup_location: '',
    dropoff_location: '',
    flight_number: '',
    flight_time: '',
    client_phone: '',
    // Hotel fields
    room_category: '',
    meal_basis: 'BB',
    num_nights: 1,
    check_in_date: '',
    check_out_date: '',
    // Car rental fields
    pickup_date: '',
    num_days: 1,
    dropoff_date: '',
  });

  const { data: pricings = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierPricings', supplier?.id],
      queryFn: () => db.entities.SupplierPricing.filter({ supplier_id: supplier.id }),
      enabled: !!supplier?.id && open,
    })
  );

  const { data: subcategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierSubcategories', supplier?.id],
      queryFn: () => db.entities.SupplierSubcategory.filter({ supplier_id: supplier.id }),
      enabled: !!supplier?.id && open,
    })
  );

  const { data: allSuppliers = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['allSuppliers'],
      queryFn: () => db.entities.Supplier.list(),
      enabled: open,
    })
  );

  const { data: stopSales = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['allSupplierStopSales'],
      queryFn: () => db.entities.SupplierStopSale.list(),
      enabled: open,
    })
  );
  const bookingStart = isHotel(categoryName)
    ? form.check_in_date
    : isCarRental(categoryName)
      ? form.pickup_date
      : form.service_date;
  const bookingEnd = isHotel(categoryName)
    ? form.check_out_date
    : isCarRental(categoryName)
      ? form.dropoff_date
      : form.service_date;
  const stopSale = getBlockingStopSale(stopSales, supplier?.id, bookingStart, bookingEnd);

  useEffect(() => {
    if (open) {
      setSuccess(false);
      setForm((f) => ({
        ...f,
        service_date: '',
        num_people: 1,
        pricing_id: '',
        pricing_name: '',
        origin_supplier_id: '',
        origin_supplier_name: '',
        destination_supplier_id: '',
        destination_supplier_name: '',
        pickup_location: '',
        dropoff_location: '',
      }));
    }
  }, [open]);

  // Auto-set check_out from check_in + nights
  useEffect(() => {
    if (form.check_in_date && form.num_nights > 0) {
      const d = new Date(form.check_in_date);
      d.setDate(d.getDate() + Number(form.num_nights));
      const out = d.toISOString().split('T')[0];
      setForm((f) => ({ ...f, check_out_date: out, service_date: form.check_in_date }));
    }
  }, [form.check_in_date, form.num_nights]);

  // Auto-set dropoff_date from pickup_date + days (car rental)
  useEffect(() => {
    if (form.pickup_date && form.num_days > 0) {
      const d = new Date(form.pickup_date);
      d.setDate(d.getDate() + Number(form.num_days));
      const out = d.toISOString().split('T')[0];
      setForm((f) => ({ ...f, dropoff_date: out, service_date: form.pickup_date }));
    }
  }, [form.pickup_date, form.num_days]);

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.SupplierBooking.create(data),
      onSuccess: (/** @type {any} */ created) => {
        queryClient.invalidateQueries({ queryKey: ['supplierBookings'] });
        setCreatedBookingId(created.id);
        if (onCreated) onCreated(created);
        setSuccess(true);
      },
    })
  );

  const selectedPricing = pricings.find((p) => p.id === form.pricing_id);
  const getSubcatName = (id) => subcategories.find((s) => s.id === id)?.name || '';

  // Auto-calculate total from pricing for hotels (rate × nights)
  useEffect(() => {
    if (selectedPricing && isHotel(categoryName) && form.num_nights > 0) {
      const total = selectedPricing.base_price * Number(form.num_nights);
      setForm((f) => ({ ...f, total_cost: total.toFixed(2) }));
    }
  }, [form.pricing_id, form.num_nights, form.check_in_date]);

  // Auto-calculate total from pricing for car rental (daily rate × days)
  useEffect(() => {
    if (selectedPricing && isCarRental(categoryName) && form.num_days > 0) {
      const total = selectedPricing.base_price * Number(form.num_days);
      setForm((f) => ({ ...f, total_cost: total.toFixed(2) }));
    }
  }, [form.pricing_id, form.num_days, form.pickup_date]);

  const handlePricingSelect = (id) => {
    const p = pricings.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      pricing_id: id,
      pricing_name: p?.name || '',
      currency: p?.currency || f.currency,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (stopSale) return;
    const payload = {
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      category_name: categoryName || '',
      ...form,
      num_people: Number(form.num_people),
      total_cost: form.total_cost ? Number(form.total_cost) : undefined,
      num_nights: form.num_nights ? Number(form.num_nights) : undefined,
      num_days: form.num_days ? Number(form.num_days) : undefined,
    };
    // Clean up unused fields
    if (!isTransfer(categoryName)) {
      delete payload.transfer_type;
      delete payload.pickup_location;
      delete payload.dropoff_location;
      delete payload.flight_number;
      delete payload.flight_time;
      delete payload.client_phone;
      delete payload.origin_supplier_id;
      delete payload.origin_supplier_name;
      delete payload.destination_supplier_id;
      delete payload.destination_supplier_name;
    }
    if (!isHotel(categoryName)) {
      delete payload.room_category;
      delete payload.meal_basis;
      delete payload.num_nights;
      delete payload.check_in_date;
      delete payload.check_out_date;
    }
    if (!isCarRental(categoryName)) {
      delete payload.pickup_date;
      delete payload.dropoff_date;
      delete payload.num_days;
    }
    createMutation.mutate(payload);
  };

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center py-8 gap-4 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-300" />
            <h2 className="text-xl font-bold text-foreground">{t('supplierBookingForm.bookingSubmittedTitle')}</h2>
            <p className="text-muted-foreground">
              {t('supplierBookingForm.bookingSubmittedMessage', { name: supplier?.name })}{' '}
              <Badge>{t('common.pending')}</Badge>.
            </p>
            <div className="flex gap-3 mt-2">
              {createdBookingId && (
                <Link to={createPageUrl(`SupplierBookingDetails?id=${createdBookingId}`)}>
                  <Button>{t('common.viewDetails')}</Button>
                </Link>
              )}
              <Button variant="outline" onClick={onClose}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            {t('supplierBookingForm.title', { name: supplier?.name })}
            {categoryName && (
              <Badge variant="outline" className="ml-2">
                {categoryName}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {stopSale && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-300">
              <CalendarOff className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                {t('supplierBookingForm.stopSaleWarning', {
                  start: stopSale.start_date,
                  end: stopSale.end_date,
                  reasonSuffix: stopSale.reason ? ` (${stopSale.reason})` : '',
                })}
              </span>
            </div>
          )}
          {/* Common Fields */}
          <div className="grid grid-cols-2 gap-4">
            {!isHotel(categoryName) && !isCarRental(categoryName) && (
              <div className="space-y-2">
                <Label>{t('supplierBookingForm.serviceDateLabel')}</Label>
                <Input
                  type="date"
                  value={form.service_date}
                  onChange={(e) => set('service_date', e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {t('supplierBookingForm.numberOfPeopleLabel')}
              </Label>
              <Input
                type="number"
                min={1}
                value={form.num_people}
                onChange={(e) => set('num_people', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('supplierBookingForm.serviceTypeLabel')}</Label>
            <Input
              value={form.service_type}
              onChange={(e) => set('service_type', e.target.value)}
              placeholder={t('supplierBookingForm.serviceTypePlaceholder')}
              required
            />
          </div>

          {/* Pricing Selector */}
          {pricings.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('supplierBookingForm.selectPricingTier')}</Label>
                {Number(form.num_people) >= 12 && (
                  <Badge className="bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                    {t('supplierBookingForm.groupRateBadge')}
                  </Badge>
                )}
                {Number(form.num_people) < 12 && (
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300"
                  >
                    {t('supplierBookingForm.individualRateBadge')}
                  </Badge>
                )}
              </div>
              <Select value={form.pricing_id} onValueChange={handlePricingSelect}>
                <SelectTrigger>
                  <SelectValue placeholder={t('supplierBookingForm.choosePricingPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {pricings
                    .filter((p) => p.is_active !== false)
                    .filter((p) => {
                      const pType = p.pricing_type || 'individual';
                      if (Number(form.num_people) >= (p.min_group_size || 12)) return true;
                      if (Number(form.num_people) < 12) return pType === 'individual';
                      return pType === 'group';
                    })
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {p.currency} {p.base_price} / {p.unit?.replace('_', ' ')}
                        {p.subcategory_id ? ` (${getSubcatName(p.subcategory_id)})` : ''}
                        {(p.pricing_type || 'individual') === 'group' && ' [GROUP]'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedPricing && <p className="text-xs text-muted-foreground">{selectedPricing.description}</p>}
            </div>
          )}

          {/* Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('supplierBookingForm.estimatedCostLabel')}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.total_cost}
                onChange={(e) => set('total_cost', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('supplierBookingForm.currencyLabel')}</Label>
              <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['EUR', 'USD', 'GBP', 'TRY', 'CHF'].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* TRANSFER-SPECIFIC FIELDS */}
          {isTransfer(categoryName) && (
            <div className="border rounded-lg p-4 space-y-4 bg-blue-50 dark:bg-blue-950/40">
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 text-sm">
                {t('supplierBookingForm.transferDetailsTitle')}
              </h3>
              <div className="space-y-2">
                <Label>{t('supplierBookingForm.transferTypeLabel')}</Label>
                <Select value={form.transfer_type} onValueChange={(v) => set('transfer_type', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSFER_TYPE_KEYS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {t(opt.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Origin / Destination Supplier Selectors */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('supplierBookingForm.originLabel')}</Label>
                  <Select
                    value={form.origin_supplier_id}
                    onValueChange={(v) => {
                      const s = allSuppliers.find((x) => x.id === v);
                      setForm((f) => ({
                        ...f,
                        origin_supplier_id: v,
                        origin_supplier_name: s?.name || '',
                        pickup_location: s?.name || '',
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('supplierBookingForm.selectSupplierPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {allSuppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('supplierBookingForm.destinationLabel')}</Label>
                  <Select
                    value={form.destination_supplier_id}
                    onValueChange={(v) => {
                      const s = allSuppliers.find((x) => x.id === v);
                      setForm((f) => ({
                        ...f,
                        destination_supplier_id: v,
                        destination_supplier_name: s?.name || '',
                        dropoff_location: s?.name || '',
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('supplierBookingForm.selectSupplierPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {allSuppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Car capacity info */}
              {selectedPricing && selectedPricing.unit === 'per_car' && selectedPricing.car_capacity && (
                <div className="bg-card rounded p-3 text-sm border border-blue-200 dark:border-blue-800">
                  <span className="font-semibold">{t('supplierBookingForm.carCapacityLabel')}</span>{' '}
                  {t('supplierBookingForm.carCapacityInfo', { capacity: selectedPricing.car_capacity })}
                  {Number(form.num_people) > 0 && (
                    <span className="ml-2">
                      {t('supplierBookingForm.carsNeededInfo', {
                        cars: Math.ceil(Number(form.num_people) / Number(selectedPricing.car_capacity)),
                        pax: form.num_people,
                      })}
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    {form.transfer_type === 'airport_pickup'
                      ? t('supplierBookingForm.pickupAirportNameLabel')
                      : form.transfer_type === 'airport_dropoff'
                        ? t('supplierBookingForm.dropoffAirportNameLabel')
                        : t('supplierBookingForm.pickupLocationLabel')}
                  </Label>
                  <Input
                    value={form.pickup_location}
                    onChange={(e) => set('pickup_location', e.target.value)}
                    placeholder={
                      form.transfer_type?.includes('airport')
                        ? t('supplierBookingForm.pickupPlaceholderAirport')
                        : t('supplierBookingForm.pickupPlaceholderHotel')
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {form.transfer_type === 'airport_pickup'
                      ? t('supplierBookingForm.dropoffDestinationLabel')
                      : form.transfer_type === 'airport_dropoff'
                        ? t('supplierBookingForm.pickupLocationLabel')
                        : t('supplierBookingForm.dropoffLocationLabel')}
                  </Label>
                  <Input
                    value={form.dropoff_location}
                    onChange={(e) => set('dropoff_location', e.target.value)}
                    placeholder={t('supplierBookingForm.dropoffPlaceholder')}
                  />
                </div>
              </div>
              {(form.transfer_type === 'airport_pickup' || form.transfer_type === 'airport_dropoff') && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('supplierBookingForm.flightNumberLabel')}</Label>
                    <Input
                      value={form.flight_number}
                      onChange={(e) => set('flight_number', e.target.value)}
                      placeholder={t('supplierBookingForm.flightNumberPlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('supplierBookingForm.flightTimeLabel')}</Label>
                    <Input type="time" value={form.flight_time} onChange={(e) => set('flight_time', e.target.value)} />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t('supplierBookingForm.clientPhoneNumberLabel')}</Label>
                <Input
                  value={form.client_phone}
                  onChange={(e) => set('client_phone', e.target.value)}
                  placeholder={t('supplierBookingForm.clientPhonePlaceholder')}
                />
              </div>
            </div>
          )}

          {/* HOTEL-SPECIFIC FIELDS */}
          {isHotel(categoryName) && (
            <div className="border rounded-lg p-4 space-y-4 bg-green-50 dark:bg-green-950/40">
              <h3 className="font-semibold text-green-900 dark:text-green-300 text-sm">
                {t('supplierBookingForm.hotelDetailsTitle')}
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('supplierBookingForm.checkInDateLabel')}</Label>
                  <Input
                    type="date"
                    value={form.check_in_date}
                    onChange={(e) => set('check_in_date', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('supplierBookingForm.numberOfNightsLabel')}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.num_nights}
                    onChange={(e) => set('num_nights', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('supplierBookingForm.checkOutDateLabel')}</Label>
                  <Input
                    type="date"
                    value={form.check_out_date}
                    readOnly
                    className="bg-card cursor-not-allowed opacity-70"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('supplierBookingForm.roomCategoryLabel')}</Label>
                  {subcategories.length > 0 ? (
                    <Select value={form.room_category} onValueChange={(v) => set('room_category', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('supplierBookingForm.selectRoomTypePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {subcategories.map((s) => (
                          <SelectItem key={s.id} value={s.name}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={form.room_category}
                      onChange={(e) => set('room_category', e.target.value)}
                      placeholder={t('supplierBookingForm.roomCategoryPlaceholder')}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t('supplierBookingForm.mealBasisLabel')}</Label>
                  <Select value={form.meal_basis} onValueChange={(v) => set('meal_basis', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEAL_BASIS_KEYS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* CAR RENTAL-SPECIFIC FIELDS */}
          {isCarRental(categoryName) && (
            <div className="border rounded-lg p-4 space-y-4 bg-amber-50 dark:bg-amber-950/40">
              <h3 className="font-semibold text-amber-900 dark:text-amber-300 text-sm">
                {t('supplierBookingForm.carRentalDetailsTitle')}
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('supplierBookingForm.pickupDateLabel')}</Label>
                  <Input
                    type="date"
                    value={form.pickup_date}
                    onChange={(e) => set('pickup_date', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('supplierBookingForm.numberOfDaysLabel')}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.num_days}
                    onChange={(e) => set('num_days', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('supplierBookingForm.dropoffDateLabel')}</Label>
                  <Input
                    type="date"
                    value={form.dropoff_date}
                    readOnly
                    className="bg-card cursor-not-allowed opacity-70"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>{t('supplierBookingForm.additionalNotesLabel')}</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder={t('supplierBookingForm.notesPlaceholder')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !!stopSale}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                t('supplierBookingForm.submitBooking')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
