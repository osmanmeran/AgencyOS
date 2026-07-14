import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  OCCUPANCY_LABELS,
  locationOf,
  isLodgingCategory,
  resolveRoomRatesForRange,
  occupancyForAdults,
  nightsBetween,
  unitPriceFor,
} from '@/lib/hotelPricing';
import { getBlockingStopSale } from '@/lib/supplierStopSales';
import HotelResultCard from '@/components/hotelSearch/HotelResultCard';
import { sym, CATEGORY_HINT_MATCHERS } from './helpers';

// Sequential service picker, mirroring the staff reservation builder's
// category -> service selection (ServiceLineEditor.jsx). Category -> Location
// (each narrowing the next), then branches: non-lodging continues the
// dropdown chain (Supplier -> Service); lodging switches to a guided
// Dates -> Rooms/Adults/Children -> Results flow spanning every supplier at
// that location. Occupancy is derived from adults-per-room rather than
// picked directly, so the client sees matching rooms (with meal treatment,
// child supplement, and per-night/total pricing) instead of having to
// self-classify a room type or pick a supplier blind.
function ServicePickerDialog({
  open,
  onOpenChange,
  services,
  stopSales,
  currency,
  onSelect,
  onSelectResolvedRoom,
  initialValues,
}) {
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [roomCount, setRoomCount] = useState(1);
  const [adultsPerRoom, setAdultsPerRoom] = useState(2);
  const [childAges, setChildAges] = useState(/** @type {string[]} */ ([]));
  // Guards the category-change reset effect below from wiping out the dates
  // it just seeded for the same category change (see the seed effect further
  // down, once categoryOptions is available).
  const seedingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setCategory('');
      setLocation('');
      setSupplierId('');
      setStartDate('');
      setEndDate('');
      setRoomCount(1);
      setAdultsPerRoom(2);
      setChildAges([]);
      seedingRef.current = false;
    }
  }, [open]);
  useEffect(() => {
    if (seedingRef.current) {
      seedingRef.current = false;
      return;
    }
    setLocation('');
    setSupplierId('');
    setStartDate('');
    setEndDate('');
    setRoomCount(1);
    setAdultsPerRoom(2);
    setChildAges([]);
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

  // Seeds category/dates/guests from the hero search hand-off (initialValues)
  // the first time the dialog opens with nothing picked yet. Runs again if
  // it's closed and reopened (category resets to '' on close above).
  useEffect(() => {
    if (!open || !initialValues || category) return;
    const matcher = CATEGORY_HINT_MATCHERS[initialValues.categoryHint];
    const matchedCategory = matcher ? categoryOptions.find(([name]) => matcher(name))?.[0] : undefined;
    if (!matchedCategory) return;
    seedingRef.current = true;
    setCategory(matchedCategory);
    if (initialValues.checkin) setStartDate(initialValues.checkin);
    if (initialValues.checkout) setEndDate(initialValues.checkout);
    if (initialValues.guests) setAdultsPerRoom(initialValues.guests);
  }, [open, initialValues, categoryOptions, category]);

  const locationOptions = useMemo(() => {
    const byLoc = new Map();
    for (const s of categoryItems) {
      const loc = locationOf(s);
      byLoc.set(loc, (byLoc.get(loc) || 0) + 1);
    }
    return [...byLoc.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [categoryItems]);

  // Once the category above finished seeding, also seed the location — the
  // portal home only ever hands off a destination that exactly matches a
  // real hotel location (see ClientPortal.jsx's suggestion list), so an
  // exact case-insensitive match here is safe rather than a guess.
  useEffect(() => {
    if (!open || !initialValues?.destination || !category || location) return;
    const target = initialValues.destination.trim().toLowerCase();
    const matchedLocation = locationOptions.find(([loc]) => loc.toLowerCase() === target)?.[0];
    if (matchedLocation) setLocation(matchedLocation);
  }, [open, initialValues, category, location, locationOptions]);

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

  // Occupancy is derived from adults-per-room (not picked directly) — the
  // system checks the supplier database for a matching room type rather than
  // asking the client to self-classify as "Double"/"Triple"/etc.
  const derivedOccupancy = occupancyForAdults(adultsPerRoom);
  // Age <= 2 rides free (infant); age >= 3 pays the flat child supplement —
  // matching the Infant(0-2)/Child(3-11) boundary AGE_CATEGORIES already uses
  // in this file's own passenger rows.
  const payingChildrenCount = childAges.filter((age) => Number(age) >= 3).length;

  const nights = nightsBetween(startDate, endDate);

  const lodgingResults = useMemo(() => {
    if (!isLodgingCat || nights <= 0) return [];
    const candidates = locationItems.filter((s) => s.occupancy === derivedOccupancy);
    const matched = resolveRoomRatesForRange(candidates, startDate, endDate);
    return matched.filter((item) => !getBlockingStopSale(stopSales, item.supplier_id, startDate, endDate));
  }, [isLodgingCat, derivedOccupancy, nights, startDate, endDate, locationItems, stopSales]);

  const setChildCount = (n) => {
    const count = Math.max(0, n);
    setChildAges((prev) => {
      const next = prev.slice(0, count);
      while (next.length < count) next.push('');
      return next;
    });
  };

  const pick = (pricingId) => {
    onSelect(pricingId);
    onOpenChange(false);
  };
  const pickRoomResult = (item) => {
    onSelectResolvedRoom(item, startDate, endDate, roomCount, payingChildrenCount, item.child_unit_price || 0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
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
              isLodgingCat ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0 space-y-1.5">
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
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Rooms</Label>
                    <Input
                      type="number"
                      min={1}
                      value={roomCount}
                      onChange={(e) => setRoomCount(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>
                </div>
              ) : (
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
              )
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No services in this category</p>
            ))}

          {location && isLodgingCat && (
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Check-in</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Check-out</Label>
                <Input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {location && isLodgingCat && (
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Adults per room</Label>
                <Input
                  type="number"
                  min={1}
                  value={adultsPerRoom}
                  onChange={(e) => setAdultsPerRoom(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Children</Label>
                <Input
                  type="number"
                  min={0}
                  value={childAges.length}
                  onChange={(e) => setChildCount(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          )}

          {location && isLodgingCat && childAges.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {childAges.map((age, i) => (
                <div key={i} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Child {i + 1} age</Label>
                  <Input
                    type="number"
                    min={0}
                    max={17}
                    className="w-20"
                    value={age}
                    onChange={(e) => setChildAges((prev) => prev.map((a, idx) => (idx === i ? e.target.value : a)))}
                  />
                </div>
              ))}
            </div>
          )}

          {location &&
            isLodgingCat &&
            nights > 0 &&
            (lodgingResults.length ? (
              <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                {lodgingResults.map((item) => (
                  <HotelResultCard
                    key={item.pricing_id}
                    item={item}
                    unitPrice={unitPriceFor(item, 1)}
                    nights={nights}
                    rooms={roomCount}
                    childrenCount={payingChildrenCount}
                    childUnitPrice={item.child_unit_price || 0}
                    onSelect={pickRoomResult}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No {OCCUPANCY_LABELS[derivedOccupancy] || derivedOccupancy} rooms match these dates at this location
              </p>
            ))}

          {location &&
            !isLodgingCat &&
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

export default ServicePickerDialog;
