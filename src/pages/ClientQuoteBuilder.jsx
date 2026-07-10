import { db } from '@/lib/DbContext';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SkeletonCard } from '@/components/ui/skeletons';
import {
  Plus,
  Trash2,
  Users,
  Star,
  Building,
  Send,
  Loader2,
  MapPin,
  ArrowRightLeft,
  Pencil,
  CalendarOff,
  AlertTriangle,
} from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { getCatalog, submitQuote } from '@/lib/b2bApi';
import { getCurrencySymbol } from '@/lib/formatters';
import { getActAsClientId, useActAsClientId } from '@/lib/actAsClient';
import LocationSearch from '@/components/services/LocationSearch';
import { getBlockingStopSale } from '@/lib/supplierStopSales';

const { sym } = { sym: (cur) => getCurrencySymbol(cur) };
const AGE_CATEGORIES = [
  { value: 'adult', label: 'Adult' },
  { value: 'children', label: 'Child (3–11)' },
  { value: 'infant', label: 'Infant (0–2)' },
];

const NIGHT_UNITS = ['per_night', 'per_day'];
const FIXED_UNITS = ['per_group', 'flat_rate'];
const HOTEL_TREATMENTS = ['Room Only', 'Bed & Breakfast', 'Half Board', 'Full Board', 'All Inclusive'];
const TRANSFER_TYPES = [
  'Airport Pickup',
  'Airport Drop-off',
  'Point to Point',
  'Hotel to Hotel',
  'Port Transfer',
  'City Transfer',
];

const CAR_CATEGORY_LABELS = {
  economy: 'Economy',
  compact: 'Compact',
  intermediate: 'Intermediate',
  standard: 'Standard',
  fullsize: 'Full Size',
  premium: 'Premium',
  luxury: 'Luxury',
  suv: 'SUV',
  minivan: 'Minivan',
  convertible: 'Convertible',
};

const rid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const newPassenger = () => ({
  id: rid('pax'),
  name: '',
  age_category: 'adult',
  date_of_birth: '',
  passport_number: '',
  phone: '',
  email: '',
  is_contact: false,
});
const newRoom = () => ({ id: rid('room'), type: 'double', passengers: [newPassenger(), newPassenger()] });
const newLine = () => ({
  _key: rid('line'),
  pricing_id: '',
  service_name: '',
  unit: '',
  min_quantity: 1,
  quantity: 1,
  supplier_id: '',
  room_occupancy: '',
  start_date: '',
  end_date: '',
  room_type: '',
  hotel_treatment: '',
  pickup_location: '',
  dropoff_location: '',
  flight_number: '',
  transfer_type: '',
  car_category: '',
  car_rental_days: 1,
  car_drop_off_surcharge: 0,
  car_insurance: false,
  service_date: '',
  service_time: '',
  duration: '',
  details: '',
});

const OCCUPANCY_LABELS = {
  single: 'Single',
  double: 'Double',
  twin: 'Twin',
  triple: 'Triple',
  quad: 'Quad',
  family: 'Family',
  extra_bed: 'Extra bed',
};

function isLodgingCategory(name) {
  const c = (name || '').toLowerCase();
  return c.includes('hotel') || c.includes('lodging') || c.includes('accommodation') || c.includes('resort');
}

// A rate is usable for a given check-in date if it's an all-year rate, or a
// 'custom' season whose date range contains it. high_season/low_season/peak
// carry no stored date range in the DB (season_start/season_end are only
// entered for 'custom' — see SupplierPricingManager.jsx) so they can never be
// auto-matched; they fall through to the ambiguous case in resolveRoomRate.
function isRateValidOn(rate, date) {
  if (rate.season_type === 'all_year') return true;
  if (!date) return false;
  if (rate.season_type === 'custom')
    return !!rate.season_start && !!rate.season_end && date >= rate.season_start && date <= rate.season_end;
  return false;
}

// Given every rate tier for a supplier + room type, pick the one that
// actually applies to the requested check-in date. If exactly one candidate
// exists it's used regardless of date (nothing to disambiguate). Otherwise a
// rate is only auto-selected when the date narrows it down to exactly one
// match; anything else (no date yet, an undated season label alongside an
// all-year rate, overlapping custom ranges) is left for the client to
// resolve manually from the returned candidate list.
function resolveRoomRate(candidates, date) {
  if (candidates.length === 0) return { rate: null, candidates: [] };
  if (candidates.length === 1) return { rate: candidates[0], candidates };
  const valid = date ? candidates.filter((r) => isRateValidOn(r, date)) : [];
  if (valid.length === 1) return { rate: valid[0], candidates };
  return { rate: null, candidates: valid.length > 0 ? valid : candidates };
}

function nightsBetween(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 86400000);
}

function lineQty(line) {
  let qty = Math.max(1, line.quantity || 1);
  if (NIGHT_UNITS.includes(line.unit)) {
    const n = nightsBetween(line.start_date, line.end_date);
    if (n > 0) qty *= n;
  }
  return qty;
}

function lineTotal(line, unitPrice, surcharges = {}) {
  if (!unitPrice) return 0;
  if (FIXED_UNITS.includes(line.unit)) return unitPrice;
  // Car rental: daily_rate * days + drop-off surcharge + insurance surcharge
  if (line.car_rental_days) {
    let total = unitPrice * line.car_rental_days * (line.quantity || 1);
    if (line.car_insurance) {
      total += line.car_rental_days * (surcharges.insuranceSurcharge || 0);
    }
    if (line.car_drop_off_surcharge) {
      total += line.car_drop_off_surcharge;
    }
    return total;
  }
  return unitPrice * lineQty(line);
}

// One passenger data-entry row — deliberately NOT the staff PassengerFieldsRow,
// which links to the full CRM client database a portal user can't access.
function PaxRow({ pax, onChange, onSetContact }) {
  const set = (field, value) => onChange({ ...pax, [field]: value });
  return (
    <div className="p-3 bg-card border border-border rounded-lg space-y-2">
      <div className="flex flex-wrap gap-2">
        <Input
          className="flex-1 min-w-[160px]"
          placeholder="Full name"
          value={pax.name}
          onChange={(e) => set('name', e.target.value)}
        />
        <Select value={pax.age_category} onValueChange={(v) => set('age_category', v)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGE_CATEGORIES.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={onSetContact}
          className={`px-3 rounded-lg text-xs font-medium border flex items-center gap-1 ${pax.is_contact ? 'bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300' : 'bg-muted border-border text-muted-foreground'}`}
          title="Main contact"
        >
          <Star className="w-3.5 h-3.5" fill={pax.is_contact ? 'currentColor' : 'none'} />
          Contact
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          className="flex-1 min-w-[130px]"
          type="date"
          title="Date of birth"
          value={pax.date_of_birth}
          onChange={(e) => set('date_of_birth', e.target.value)}
        />
        <Input
          className="flex-1 min-w-[130px]"
          placeholder="Passport #"
          value={pax.passport_number}
          onChange={(e) => set('passport_number', e.target.value)}
        />
        <Input
          className="flex-1 min-w-[130px]"
          placeholder="Phone"
          value={pax.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
        <Input
          className="flex-1 min-w-[160px]"
          placeholder="Email"
          value={pax.email}
          onChange={(e) => set('email', e.target.value)}
        />
      </div>
    </div>
  );
}

const locationOf = (s) => s.city || s.area || 'Other';

// Sequential dropdown service picker, mirroring the staff reservation
// builder's category -> service selection (ServiceLineEditor.jsx) instead of
// a photo card grid. Category -> Location -> Supplier (each narrowing the
// next) -> Service.
function ServicePickerDialog({ open, onOpenChange, services, currency, onSelect, onSelectRoom }) {
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [supplierId, setSupplierId] = useState('');

  useEffect(() => {
    if (!open) {
      setCategory('');
      setLocation('');
      setSupplierId('');
    }
  }, [open]);
  useEffect(() => {
    setLocation('');
    setSupplierId('');
  }, [category]);
  useEffect(() => {
    setSupplierId('');
  }, [location]);

  const categoryItems = useMemo(
    () => (category ? services.filter((s) => (s.category_name || 'Other services') === category) : []),
    [services, category],
  );
  const locationItems = useMemo(
    () => (location ? categoryItems.filter((s) => locationOf(s) === location) : []),
    [categoryItems, location],
  );
  const supplierItems = useMemo(
    () => (supplierId ? locationItems.filter((s) => s.supplier_id === supplierId) : []),
    [locationItems, supplierId],
  );

  const categoryOptions = useMemo(() => {
    const byCat = new Map();
    for (const s of services) {
      const name = s.category_name || 'Other services';
      byCat.set(name, (byCat.get(name) || 0) + 1);
    }
    return [...byCat.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [services]);

  const locationOptions = useMemo(() => {
    const byLoc = new Map();
    for (const s of categoryItems) {
      const loc = locationOf(s);
      byLoc.set(loc, (byLoc.get(loc) || 0) + 1);
    }
    return [...byLoc.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [categoryItems]);

  const supplierOptions = useMemo(() => {
    const bySupplier = new Map();
    for (const s of locationItems) {
      if (!bySupplier.has(s.supplier_id))
        bySupplier.set(s.supplier_id, { name: s.supplier_name || 'Unknown', count: 0 });
      bySupplier.get(s.supplier_id).count += 1;
    }
    return [...bySupplier.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [locationItems]);

  const isLodgingCat = isLodgingCategory(category);
  const roomOptions = useMemo(() => {
    if (!isLodgingCat) return [];
    const byOcc = new Map();
    for (const s of supplierItems) {
      if (!s.occupancy) continue;
      byOcc.set(s.occupancy, (byOcc.get(s.occupancy) || 0) + 1);
    }
    return [...byOcc.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [supplierItems, isLodgingCat]);

  const pick = (pricingId) => {
    onSelect(pricingId);
    onOpenChange(false);
  };
  const pickRoom = (occupancy) => {
    onSelectRoom(supplierId, occupancy);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a service</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map(([name, count]) => (
                  <SelectItem key={name} value={name}>
                    {name} ({count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {category &&
            (locationOptions.length ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Location</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationOptions.map(([loc, count]) => (
                      <SelectItem key={loc} value={loc}>
                        {loc} ({count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No services in this category</p>
            ))}

          {location &&
            (supplierOptions.length ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {supplierOptions.map(([id, info]) => (
                      <SelectItem key={id} value={id}>
                        {info.name} ({info.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No suppliers in this location</p>
            ))}

          {supplierId &&
            isLodgingCat &&
            (roomOptions.length ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Room type</Label>
                <Select onValueChange={pickRoom}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a room type" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomOptions.map(([occ, count]) => (
                      <SelectItem key={occ} value={occ}>
                        {OCCUPANCY_LABELS[occ] || occ} ({count} rate{count === 1 ? '' : 's'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The exact rate is picked from check-in date once you enter it.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No room types for this supplier</p>
            ))}

          {supplierId &&
            !isLodgingCat &&
            (supplierItems.length ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Service</Label>
                <Select onValueChange={pick}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {supplierItems.map((s) => (
                      <SelectItem key={s.pricing_id} value={s.pricing_id}>
                        {s.name} — {sym(currency)}
                        {s.unit_price.toFixed(2)} {(s.unit || '').replace('per_', '/ ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No services for this supplier</p>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// One service line: the client picks a service via the category -> location
// -> supplier -> service dropdown chain, then fills in day-specific details
// for it — mirroring the staff reservation builder's
// per-category fields, minus anything cost/margin/supplier related. Prices
// shown here are the client's own sell price: pulled from the catalog
// (server already applied the client's markup and converted to their
// preferred currency).
function ServiceLineCard({ line, services, servicesById, currency, stopSales, onChange, onRemove }) {
  const svc = servicesById.get(line.pricing_id);
  const catName = (svc?.category_name || '').toLowerCase();
  // A room type has been picked but the exact rate might still be unresolved
  // (ambiguous by date) — still treat the line as lodging so the check-in
  // date fields (needed to resolve it) render.
  const isLodging = !!line.room_occupancy || isLodgingCategory(catName);
  const isTransfer = catName.includes('transfer');
  const isCarRental = catName.includes('rent a car') || catName.includes('rental') || catName.includes('car rental');
  const isGuided =
    catName.includes('tour') ||
    catName.includes('guide') ||
    catName.includes('excursion') ||
    catName.includes('activity');
  const isNightly = NIGHT_UNITS.includes(line.unit);
  const isFixed = FIXED_UNITS.includes(line.unit);
  const nights = nightsBetween(line.start_date, line.end_date);
  const unitPrice = svc?.unit_price || 0;
  const [pickerOpen, setPickerOpen] = useState(false);

  // Car rental surcharges (computed client-side for display before submission)
  const carDropOffSurcharge =
    isCarRental && line.pickup_location && line.dropoff_location && line.pickup_location !== line.dropoff_location
      ? svc?.drop_off_surcharge || 0
      : 0;

  const stopSale = getBlockingStopSale(
    stopSales,
    svc?.supplier_id || line.supplier_id,
    line.start_date || line.service_date,
    line.end_date || line.service_date,
  );

  // Every rate tier for the chosen supplier + room type, and which one (if
  // any) unambiguously applies to the current check-in date.
  const mealTreatmentCode = line.hotel_treatment
    ? {
        'Room Only': 'RO',
        'Bed & Breakfast': 'BB',
        'Half Board': 'HB',
        'Full Board': 'FB',
        'All Inclusive': 'AI',
        'Ultra All Inclusive': 'UAI',
      }[line.hotel_treatment] || ''
    : '';
  const roomCandidates = useMemo(
    () =>
      line.room_occupancy && line.supplier_id
        ? services.filter(
            (s) =>
              s.supplier_id === line.supplier_id &&
              s.occupancy === line.room_occupancy &&
              (!mealTreatmentCode || !s.meal_treatment || s.meal_treatment === mealTreatmentCode),
          )
        : [],
    [services, line.supplier_id, line.room_occupancy, mealTreatmentCode],
  );
  const { rate: resolvedRate, candidates: rateOptions } = useMemo(
    () => resolveRoomRate(roomCandidates, line.start_date),
    [roomCandidates, line.start_date],
  );

  // Keep pricing_id in sync with whichever rate the check-in date resolves
  // to. Only clears an existing pick (forcing the manual "Rate" picker below)
  // if it's no longer valid for the current date — a manual choice made
  // before dates were entered, or one that's still in-season, is left alone.
  useEffect(() => {
    if (!line.room_occupancy) return;
    if (resolvedRate && line.pricing_id !== resolvedRate.pricing_id) {
      onChange({
        ...line,
        pricing_id: resolvedRate.pricing_id,
        service_name: resolvedRate.name,
        unit: resolvedRate.unit,
      });
      return;
    }
    if (!resolvedRate && line.pricing_id) {
      const stillValid = line.start_date
        ? roomCandidates.some((c) => c.pricing_id === line.pricing_id && isRateValidOn(c, line.start_date))
        : roomCandidates.some((c) => c.pricing_id === line.pricing_id);
      if (!stillValid) onChange({ ...line, pricing_id: '' });
    }
  }, [resolvedRate?.pricing_id, roomCandidates, line.room_occupancy, line.pricing_id, line.start_date]);

  const pickService = (pricing_id) => {
    const picked = servicesById.get(pricing_id);
    if (!picked) return;
    onChange({
      ...newLine(),
      _key: line._key,
      pricing_id,
      service_name: picked.name,
      unit: picked.unit,
      min_quantity: picked.min_quantity || 1,
      quantity: picked.min_quantity || 1,
    });
    setPickerOpen(false);
  };
  const pickRoom = (supplierId, occupancy) => {
    onChange({
      ...newLine(),
      _key: line._key,
      supplier_id: supplierId,
      room_occupancy: occupancy,
      room_type: OCCUPANCY_LABELS[occupancy] || occupancy,
      unit: 'per_night',
      min_quantity: 1,
      quantity: 1,
    });
    setPickerOpen(false);
  };
  const set = (field, value) => onChange({ ...line, [field]: value });

  return (
    <div className="border border-border rounded-lg bg-muted p-4 space-y-3">
      <div className="flex flex-wrap gap-3 items-start">
        {svc ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex-1 min-w-[220px] flex items-center gap-3 px-3 py-2.5 bg-card border border-border rounded-lg hover:border-blue-300 dark:hover:border-blue-800 transition-colors text-left"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs text-blue-600 dark:text-blue-300 font-medium">{svc.category_name || 'Other'}</div>
              <div className="text-sm font-semibold text-foreground truncate">{svc.name}</div>
            </div>
            <Pencil className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          </button>
        ) : line.room_occupancy ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex-1 min-w-[220px] flex items-center gap-3 px-3 py-2.5 bg-card border border-border rounded-lg hover:border-blue-300 dark:hover:border-blue-800 transition-colors text-left"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs text-blue-600 dark:text-blue-300 font-medium">
                {OCCUPANCY_LABELS[line.room_occupancy] || line.room_occupancy}
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                {line.start_date
                  ? 'Multiple rates match these dates — pick one below'
                  : 'Enter check-in date to find the rate'}
              </div>
            </div>
            <Pencil className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex-1 min-w-[220px] h-[70px] flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Choose a service
          </button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
          onClick={onRemove}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <ServicePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        services={services}
        currency={currency}
        onSelect={pickService}
        onSelectRoom={pickRoom}
      />

      {(line.pricing_id || line.room_occupancy) && (
        <>
          <div className="flex flex-wrap gap-3">
            {isNightly ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Check-in</Label>
                  <Input
                    type="date"
                    className="w-40"
                    value={line.start_date}
                    onChange={(e) => set('start_date', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Check-out</Label>
                  <Input
                    type="date"
                    className="w-40"
                    value={line.end_date}
                    onChange={(e) => set('end_date', e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input
                  type="date"
                  className="w-40"
                  value={line.service_date}
                  onChange={(e) => set('service_date', e.target.value)}
                />
              </div>
            )}
            {!isFixed && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{isNightly ? 'Rooms / units' : 'Quantity'}</Label>
                <Input
                  type="number"
                  min={line.min_quantity || 1}
                  className="w-28"
                  value={line.quantity}
                  onChange={(e) => set('quantity', Math.max(line.min_quantity || 1, parseInt(e.target.value) || 1))}
                />
              </div>
            )}
            {isNightly && nights > 0 && (
              <div className="flex items-end text-xs text-muted-foreground pb-2">
                {nights} night{nights !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {stopSale && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
              <CalendarOff className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                This service isn't available {stopSale.start_date} to {stopSale.end_date}. Please choose different
                dates.
              </span>
            </div>
          )}

          {line.room_occupancy && !line.pricing_id && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Rate</Label>
              {rateOptions.length ? (
                <Select onValueChange={(pricing_id) => set('pricing_id', pricing_id)}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        line.start_date ? 'Multiple rates match — choose one' : 'Select dates, or choose a rate'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {rateOptions.map((r) => (
                      <SelectItem key={r.pricing_id} value={r.pricing_id}>
                        {r.name} — {sym(currency)}
                        {r.unit_price.toFixed(2)} {(r.unit || '').replace('per_', '/ ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-red-500 dark:text-red-300">No rate is available for this room type.</p>
              )}
            </div>
          )}

          {isLodging && (
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1 flex-1 min-w-[160px]">
                <Label className="text-xs text-muted-foreground">Room type</Label>
                <Input
                  placeholder="e.g. Double"
                  value={line.room_type}
                  onChange={(e) => set('room_type', e.target.value)}
                />
              </div>
              <div className="space-y-1 flex-1 min-w-[160px]">
                <Label className="text-xs text-muted-foreground">Meal plan</Label>
                <Select value={line.hotel_treatment} onValueChange={(v) => set('hotel_treatment', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOTEL_TREATMENTS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {isTransfer && (
            <div className="flex flex-wrap gap-3">
              <Input
                className="flex-1 min-w-[150px]"
                placeholder="Pickup location"
                value={line.pickup_location}
                onChange={(e) => set('pickup_location', e.target.value)}
              />
              <Input
                className="flex-1 min-w-[150px]"
                placeholder="Drop-off location"
                value={line.dropoff_location}
                onChange={(e) => set('dropoff_location', e.target.value)}
              />
              <div className="space-y-1 min-w-[160px]">
                <Select value={line.transfer_type} onValueChange={(v) => set('transfer_type', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Transfer type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSFER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                className="w-36"
                placeholder="Flight no. (optional)"
                value={line.flight_number}
                onChange={(e) => set('flight_number', e.target.value)}
              />
              <Input
                type="time"
                className="w-32"
                title="Pickup time"
                value={line.service_time}
                onChange={(e) => set('service_time', e.target.value)}
              />
            </div>
          )}

          {isGuided && (
            <div className="flex flex-wrap gap-3">
              <Input
                className="flex-1 min-w-[150px]"
                placeholder="Duration (e.g. Half day, 4 hours)"
                value={line.duration}
                onChange={(e) => set('duration', e.target.value)}
              />
              <Input
                type="time"
                className="w-32"
                title="Start time"
                value={line.service_time}
                onChange={(e) => set('service_time', e.target.value)}
              />
            </div>
          )}

          {isCarRental && (
            <div className="p-4 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-lg space-y-4">
              <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300">Car Rental</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-orange-700 dark:text-orange-300">Pickup Location</Label>
                  <Select
                    value={line.pickup_location}
                    onValueChange={(v) => {
                      const surcharge =
                        v && line.dropoff_location && v !== line.dropoff_location ? svc?.drop_off_surcharge || 0 : 0;
                      set('pickup_location', v);
                      set('car_drop_off_surcharge', surcharge);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pickup location" />
                    </SelectTrigger>
                    <SelectContent>
                      {svc?.car_rental_locations?.map((loc, i) => (
                        <SelectItem key={i} value={loc}>
                          {loc}
                        </SelectItem>
                      ))}
                      {!svc?.car_rental_locations?.length && (
                        <SelectItem value={line.pickup_location || '__custom__'}>
                          {line.pickup_location || 'Enter manually below'}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-orange-700 dark:text-orange-300">Drop-off Location</Label>
                  <Select
                    value={line.dropoff_location}
                    onValueChange={(v) => {
                      const surcharge =
                        line.pickup_location && v && line.pickup_location !== v ? svc?.drop_off_surcharge || 0 : 0;
                      set('dropoff_location', v);
                      set('car_drop_off_surcharge', surcharge);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select drop-off location" />
                    </SelectTrigger>
                    <SelectContent>
                      {svc?.car_rental_locations?.map((loc, i) => (
                        <SelectItem key={i} value={loc}>
                          {loc}
                        </SelectItem>
                      ))}
                      {!svc?.car_rental_locations?.length && (
                        <SelectItem value={line.dropoff_location || '__custom__'}>
                          {line.dropoff_location || 'Same as pickup'}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-orange-700 dark:text-orange-300">Category</Label>
                  {svc?.car_category ? (
                    <Input
                      value={CAR_CATEGORY_LABELS[svc.car_category] || svc.car_category}
                      readOnly
                      className="bg-card"
                    />
                  ) : (
                    <Input value={line.car_category || svc?.name || 'Standard'} readOnly className="bg-card" />
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-orange-700 dark:text-orange-300">Rental Days</Label>
                  <Input
                    type="number"
                    min="1"
                    value={line.car_rental_days || 1}
                    onChange={(e) => set('car_rental_days', parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
              {line.pickup_location && line.dropoff_location && line.pickup_location !== line.dropoff_location && (
                <div className="flex items-center gap-2 text-sm text-orange-800 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40 px-3 py-2 rounded-lg">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Different drop-off location selected. A drop-off surcharge of {sym(currency)}
                    {carDropOffSurcharge.toFixed(2)} will be added.
                  </span>
                </div>
              )}
              {svc?.insurance_surcharge > 0 && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`insurance-${line._key}`}
                    checked={line.car_insurance}
                    onChange={(e) => set('car_insurance', e.target.checked)}
                    className="rounded"
                  />
                  <Label
                    htmlFor={`insurance-${line._key}`}
                    className="text-xs text-orange-700 dark:text-orange-300 cursor-pointer"
                  >
                    Add insurance ({sym(currency)}
                    {(svc?.insurance_surcharge || 0).toFixed(2)}/day)
                  </Label>
                </div>
              )}
              {svc?.car_rental_terms && (
                <div className="text-xs text-muted-foreground border-t border-orange-200 dark:border-orange-800 pt-2">
                  <p className="font-medium text-orange-700 dark:text-orange-300 mb-1">Terms & Conditions</p>
                  <p className="whitespace-pre-wrap">{svc.car_rental_terms}</p>
                </div>
              )}
              <div className="flex items-center justify-between text-sm pt-2 border-t border-orange-200 dark:border-orange-800">
                <span className="text-orange-800 dark:text-orange-300 font-medium">Total</span>
                <span className="font-semibold text-green-700 dark:text-green-300">
                  {sym(currency)}
                  {lineTotal(line, unitPrice, { insuranceSurcharge: svc?.insurance_surcharge || 0 }).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {!isLodging && !isTransfer && !isCarRental && !isGuided && (
            <div className="flex flex-wrap gap-3">
              <Input
                type="time"
                className="w-32"
                title="Time (optional)"
                value={line.service_time}
                onChange={(e) => set('service_time', e.target.value)}
              />
            </div>
          )}

          <Textarea
            rows={2}
            placeholder="Extra details for this service (optional)"
            value={line.details}
            onChange={(e) => set('details', e.target.value)}
          />

          {line.pricing_id && !isCarRental && (
            <div className="flex items-center justify-between text-sm pt-1">
              <span className="text-muted-foreground">
                {isCarRental ? (
                  <>
                    {sym(currency)}
                    {unitPrice.toFixed(2)} / day · {line.car_rental_days || 1} day
                    {(line.car_rental_days || 1) > 1 ? 's' : ''}
                  </>
                ) : (
                  <>
                    {sym(currency)}
                    {unitPrice.toFixed(2)} {line.unit?.replace('per_', '/ ')}
                    {isNightly && nights > 0 ? ` · ${nights} night${nights !== 1 ? 's' : ''}` : ''}
                  </>
                )}
                {line.car_insurance && svc?.insurance_surcharge > 0 && (
                  <span className="ml-2 text-orange-600 dark:text-orange-400">+ ins.</span>
                )}
                {line.car_drop_off_surcharge > 0 && (
                  <span className="ml-2 text-orange-600 dark:text-orange-400">+ drop-off fee</span>
                )}
              </span>
              <span className="font-semibold text-green-700 dark:text-green-300">
                {sym(currency)}
                {lineTotal(line, unitPrice, { insuranceSurcharge: svc?.insurance_surcharge || 0 }).toFixed(2)}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ClientQuoteBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [client, setClient] = useState(/** @type {any} */ (null));
  const [clientLoaded, setClientLoaded] = useState(false);
  const [isStaffPreview, setIsStaffPreview] = useState(false);
  const [trip, setTrip] = useState({ title: '', destination: '', start_date: '', end_date: '', notes: '' });
  const [rooms, setRooms] = useState(() => [newRoom()]);
  const [lines, setLines] = useState(() => [newLine()]);
  const actAsClientId = useActAsClientId();

  useEffect(() => {
    db.auth
      .me()
      .then(async (me) => {
        let resolved = null;
        // Staff previewing the portal "as" a client (via "View portal as
        // client" on a CRM record) have no client_id of their own — resolve
        // the chosen client instead, same as ClientPortal does. Submitting is
        // still blocked server-side for staff; see isStaffPreview below.
        const asClientId = getActAsClientId();
        if (asClientId && me.user_tier !== 'client') {
          resolved = await db.entities.Client.get(asClientId).catch(() => null);
          setIsStaffPreview(true);
        } else {
          setIsStaffPreview(false);
          if (me.client_id) resolved = await db.entities.Client.get(me.client_id).catch(() => null);
          if (!resolved && me.email) {
            const list = await db.entities.Client.filter({ email: me.email });
            resolved = list[0] || null;
          }
        }
        setClient(resolved);
        setClientLoaded(true);
      })
      .catch(() => setClientLoaded(true));
  }, [actAsClientId]);

  const currency = client?.preferred_currency || 'USD';

  const { data: catalog, isLoading: catLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['b2bCatalog'],
      queryFn: getCatalog,
      enabled: !!client,
    })
  );

  // All available services, filterable by category/location/supplier in the
  // picker. unit_price already has the client's markup applied and is
  // already converted to their preferred currency (both computed server-side).
  const services = catalog?.items || [];
  const servicesById = useMemo(() => new Map(services.map((s) => [s.pricing_id, s])), [services]);
  const stopSales = catalog?.stop_sales || [];

  // Rooms & passengers
  const setRoomOccupancy = (roomId, count) => {
    const typeMap = { 1: 'single', 2: 'double', 3: 'triple', 4: 'quad' };
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId) return r;
        const cur = r.passengers;
        let passengers;
        if (count > cur.length)
          passengers = [...cur, ...Array.from({ length: count - cur.length }, () => newPassenger())];
        else if (count < cur.length) passengers = cur.slice(0, count);
        else passengers = cur;
        return { ...r, type: typeMap[count] || 'double', passengers };
      }),
    );
  };
  const addRoom = () => setRooms((prev) => [...prev, newRoom()]);
  const removeRoom = (roomId) => setRooms((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== roomId)));
  const updatePax = (roomId, paxId, updated) =>
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId ? { ...r, passengers: r.passengers.map((p) => (p.id === paxId ? updated : p)) } : r,
      ),
    );
  const setContact = (roomId, paxId) =>
    setRooms((prev) =>
      prev.map((r) => ({
        ...r,
        passengers: r.passengers.map((p) => ({ ...p, is_contact: r.id === roomId && p.id === paxId })),
      })),
    );

  const allPassengers = rooms.flatMap((r) => r.passengers.map((p) => ({ ...p, room_id: r.id, room_type: r.type })));

  // Lines
  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const updateLine = (key, updated) => setLines((prev) => prev.map((l) => (l._key === key ? updated : l)));
  const removeLine = (key) => setLines((prev) => (prev.length <= 1 ? [newLine()] : prev.filter((l) => l._key !== key)));

  const validLines = lines.filter((l) => l.pricing_id);
  const blockedLines = validLines.filter((l) => {
    const svc = servicesById.get(l.pricing_id);
    const supplierId = svc?.supplier_id || l.supplier_id;
    const start = l.start_date || l.service_date;
    const end = l.end_date || l.service_date;
    return !!getBlockingStopSale(stopSales, supplierId, start, end);
  });
  const total = useMemo(
    () =>
      validLines.reduce((sum, l) => {
        const svc = servicesById.get(l.pricing_id);
        const unitPrice = svc?.unit_price || 0;
        return sum + lineTotal(l, unitPrice, { insuranceSurcharge: svc?.insurance_surcharge || 0 });
      }, 0),
    [validLines, servicesById],
  );

  const submitMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () =>
        submitQuote({
          title: trip.title || 'Quote request',
          destination: trip.destination,
          start_date: trip.start_date,
          end_date: trip.end_date,
          notes: trip.notes,
          passengers: allPassengers,
          items: validLines.map((l) => ({
            pricing_id: l.pricing_id,
            quantity: l.quantity || 1,
            start_date: l.start_date || l.service_date || undefined,
            end_date: l.end_date || l.service_date || undefined,
            room_type: l.room_type || undefined,
            pickup_location: l.pickup_location || undefined,
            dropoff_location: l.dropoff_location || undefined,
            flight_number: l.flight_number || undefined,
            service_time: l.service_time || undefined,
            details:
              [l.hotel_treatment, l.transfer_type, l.duration, l.details].filter(Boolean).join(' · ') || undefined,
          })),
        }),
      onSuccess: (quote) => {
        showSuccess('Quote request submitted');
        queryClient.invalidateQueries({ queryKey: ['myQuotes'] });
        navigate(createPageUrl(`ClientQuoteDetails?id=${quote.id}`));
      },
      onError: (error) => showError('Failed to submit quote request', error.message),
    })
  );

  if (!clientLoaded || (client && catLoading)) return <SkeletonCard />;

  if (!client) {
    return (
      <Card className="max-w-md mx-auto p-8 text-center mt-10">
        <h2 className="text-xl font-bold text-foreground mb-2">Account not ready</h2>
        <p className="text-muted-foreground">Your client account is being set up. Please contact your travel agent.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Request a Quote</h1>
        <p className="text-muted-foreground mt-1 flex items-center gap-2">
          Build your trip and send it to us for pricing
          <span className="inline-flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
            <ArrowRightLeft className="w-3 h-3" /> Prices in {currency}
          </span>
        </p>
      </div>

      {/* Trip details */}
      <Card className="p-6 bg-card shadow-md">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-300" />
          Trip Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Trip title</Label>
            <Input
              value={trip.title}
              onChange={(e) => setTrip({ ...trip, title: e.target.value })}
              placeholder="e.g. Summer in Cappadocia"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Destination</Label>
            <LocationSearch
              value={trip.destination}
              onChange={(v) => setTrip({ ...trip, destination: v })}
              placeholder="e.g. Istanbul & Cappadocia"
            />
          </div>
          <div className="space-y-2">
            <Label>Start date</Label>
            <Input
              type="date"
              value={trip.start_date}
              onChange={(e) => setTrip({ ...trip, start_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>End date</Label>
            <Input type="date" value={trip.end_date} onChange={(e) => setTrip({ ...trip, end_date: e.target.value })} />
          </div>
        </div>
      </Card>

      {/* Rooms & passengers */}
      <Card className="p-6 bg-card shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-300" />
            Rooms & Passengers
          </h2>
          <Button type="button" size="sm" variant="outline" onClick={addRoom}>
            <Plus className="w-4 h-4 mr-1" />
            Add room
          </Button>
        </div>
        <div className="space-y-4">
          {rooms.map((room, ri) => (
            <div key={room.id} className="border border-border rounded-lg bg-muted overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground text-sm">Room {ri + 1}</span>
                  <Select
                    value={String(room.passengers.length)}
                    onValueChange={(v) => setRoomOccupancy(room.id, parseInt(v))}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} Person{n > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-red-500 dark:text-red-300 hover:text-red-700 dark:hover:text-red-300"
                  onClick={() => removeRoom(room.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="p-3 space-y-2">
                {room.passengers.map((pax) => (
                  <PaxRow
                    key={pax.id}
                    pax={pax}
                    onChange={(u) => updatePax(room.id, pax.id, u)}
                    onSetContact={() => setContact(room.id, pax.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Services */}
      <Card className="p-6 bg-card shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-600 dark:text-blue-300" />
            Services
          </h2>
          <Button type="button" size="sm" variant="outline" onClick={addLine} disabled={services.length === 0}>
            <Plus className="w-4 h-4 mr-1" />
            Add service
          </Button>
        </div>
        {services.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">
            No services are available in your portal yet. Please contact your travel agent.
          </p>
        ) : (
          <div className="space-y-4">
            {lines.map((line) => (
              <ServiceLineCard
                key={line._key}
                line={line}
                services={services}
                servicesById={servicesById}
                currency={currency}
                stopSales={stopSales}
                onChange={(u) => updateLine(line._key, u)}
                onRemove={() => removeLine(line._key)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Notes + summary */}
      <Card className="p-6 bg-card shadow-md">
        <div className="space-y-2 mb-4">
          <Label>Notes (optional)</Label>
          <Textarea
            rows={3}
            value={trip.notes}
            onChange={(e) => setTrip({ ...trip, notes: e.target.value })}
            placeholder="Anything else we should know..."
          />
        </div>
        <Separator className="mb-4" />
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-bold text-foreground">Estimated total</span>
          <span className="text-2xl font-bold text-green-700 dark:text-green-300">
            {sym(currency)}
            {total.toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          This is an estimate in {currency}. Your final quote is confirmed by our team after review.
        </p>
        {blockedLines.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg py-2 px-3 mb-3">
            <CalendarOff className="w-3.5 h-3.5 flex-shrink-0" />
            {blockedLines.length} service{blockedLines.length > 1 ? 's are' : ' is'} unavailable for the dates selected
            — fix them above before submitting.
          </p>
        )}
        {isStaffPreview ? (
          <p className="text-center text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg py-2.5">
            Staff preview is read-only — sign in as the client to submit a quote request.
          </p>
        ) : (
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={validLines.length === 0 || blockedLines.length > 0 || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Quote Request
              </>
            )}
          </Button>
        )}
      </Card>
    </div>
  );
}
