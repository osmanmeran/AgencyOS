import { db } from '@/lib/DbContext';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Copy } from 'lucide-react';
import { categoryIdsBySupplier, getSupplierCategoryIds } from '@/lib/supplierCategories';

const HOTEL_TREATMENTS = [
  'Room Only',
  'Bed & Breakfast',
  'Half Board',
  'Full Board',
  'All Inclusive',
  'Ultra All Inclusive',
];
const ROOM_OCCUPANCIES = ['Single', 'Double', 'Triple', 'Quadruple', 'Twin', 'Twin/Double'];
const TRANSFER_TYPES = [
  'Airport Pickup',
  'Airport Drop-off',
  'Point to Point',
  'Hotel to Hotel',
  'Port Transfer',
  'City Transfer',
];

// Purpose-built row editor for a TourContract's fixed itinerary line. Unlike
// ServiceLineEditor (used for a real booking's services), a contract line has
// no client-facing selling price — the client is quoted one fixed per-person
// package price from pricing_tiers — and no absolute dates, only a day offset
// relative to whatever departure date a booking is later generated for.
export default function ContractItineraryRow({ item, categories, onUpdate, onRemove, onDuplicate }) {
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

  const categoryName = (item.category || '').toLowerCase();
  const isLodging =
    categoryName.includes('hotel') ||
    categoryName.includes('lodging') ||
    categoryName.includes('accommodation') ||
    categoryName.includes('resort');
  const isTransfer = categoryName.includes('transfer');
  const selectedCategoryObj = categories.find(
    (c) => item.category && (c.id === item.category || c.name === item.category),
  );
  const filteredSuppliers = selectedCategoryObj
    ? suppliers.filter((s) => getSupplierCategoryIds(supplierCategoryMap, s.id).includes(selectedCategoryObj.id))
    : suppliers;

  const { data: pricings = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierPricings', item.supplier_id],
      queryFn: () => db.entities.SupplierPricing.filter({ supplier_id: item.supplier_id }),
      enabled: !!item.supplier_id,
    })
  );
  const activePricings = pricings.filter((p) => p.is_active !== false);

  const set = (field, value) => onUpdate({ ...item, [field]: value });

  const handlePricingSelect = (pricingId) => {
    const p = pricings.find((x) => x.id === pricingId);
    if (!p) return;
    const pUnit = p.unit || item.unit || 'per_person';
    const updates = {
      pricing_id: p.id,
      name: p.name || item.name,
      description: p.description || item.description || '',
      acquiring_price: p.base_price ?? item.acquiring_price,
      unit: pUnit,
      supplier_currency: p.currency || item.supplier_currency || 'EUR',
      quantity: pUnit === 'per_night' || pUnit === 'per_day' ? 1 : p.min_quantity || item.quantity || 1,
    };
    if (isTransfer && p.car_capacity) updates.car_capacity = p.car_capacity;
    if (isLodging && p.occupancy) updates.room_occupancy = p.occupancy;
    onUpdate({ ...item, ...updates });
  };

  return (
    <Card className="p-5 bg-card border-l-4 border-l-blue-500 relative">
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <button
          onClick={onDuplicate}
          className="p-1.5 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded"
          title="Duplicate line"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={onRemove}
          className="p-1.5 text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
          title="Remove line"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pr-12">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block font-semibold">Category *</Label>
          <Select value={item.category || ''} onValueChange={(v) => set('category', v)}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select category…" />
            </SelectTrigger>
            <SelectContent>
              {categories?.map((cat) => (
                <SelectItem key={cat.id} value={cat.name || cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block font-semibold">Supplier *</Label>
          <Select
            value={item.supplier_id || ''}
            onValueChange={(v) => onUpdate({ ...item, supplier_id: v, pricing_id: '' })}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder={selectedCategoryObj ? 'Select a supplier…' : 'Choose category first'} />
            </SelectTrigger>
            <SelectContent>
              {filteredSuppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {item.supplier_id && activePricings.length > 0 && (
        <div className="mb-4">
          <Label className="text-xs text-muted-foreground mb-1 block font-semibold">
            Pricing Tier (optional — auto-fills cost)
          </Label>
          <Select value={item.pricing_id || ''} onValueChange={handlePricingSelect}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select a pricing tier to auto-fill..." />
            </SelectTrigger>
            <SelectContent>
              {activePricings.map((p) => {
                const occLabel = p.occupancy ? ` | ${p.occupancy.charAt(0).toUpperCase() + p.occupancy.slice(1)}` : '';
                const mealLabel = p.meal_treatment
                  ? ` | ${{ RO: 'Room Only', BB: 'B&B', HB: 'Half Board', FB: 'Full Board', AI: 'All Inc.', UAI: 'Ultra AI' }[p.meal_treatment] || p.meal_treatment}`
                  : '';
                return (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.currency} {p.base_price}/{p.unit?.replace('_', ' ')}
                    {occLabel}
                    {mealLabel}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Line Name</Label>
          <Input
            value={item.name || ''}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g., 5-star Hotel"
            className="text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Location</Label>
          <Input
            value={item.location || ''}
            onChange={(e) => set('location', e.target.value)}
            placeholder="e.g., Dubai downtown"
            className="text-sm"
          />
        </div>
      </div>

      {isLodging && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800">
          <div>
            <Label className="text-xs text-blue-700 dark:text-blue-300 mb-1 block font-semibold">
              Treatment / Meal Plan
            </Label>
            <Select value={item.hotel_treatment || ''} onValueChange={(v) => set('hotel_treatment', v)}>
              <SelectTrigger className="text-sm bg-card">
                <SelectValue placeholder="Select treatment" />
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
          <div>
            <Label className="text-xs text-blue-700 dark:text-blue-300 mb-1 block font-semibold">Room Occupancy</Label>
            <Select value={item.room_occupancy || ''} onValueChange={(v) => set('room_occupancy', v)}>
              <SelectTrigger className="text-sm bg-card">
                <SelectValue placeholder="Select occupancy" />
              </SelectTrigger>
              <SelectContent>
                {ROOM_OCCUPANCIES.map((t) => (
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-3 bg-orange-50 dark:bg-orange-950/40 rounded-lg border border-orange-200 dark:border-orange-800">
          <div>
            <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
              Transfer Type
            </Label>
            <Select value={item.transfer_type || ''} onValueChange={(v) => set('transfer_type', v)}>
              <SelectTrigger className="text-sm bg-card">
                <SelectValue placeholder="Select transfer type" />
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
          <div>
            <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
              Car Capacity (pax/car)
            </Label>
            <Input
              type="number"
              min="1"
              value={item.car_capacity || ''}
              onChange={(e) => set('car_capacity', parseInt(e.target.value) || '')}
              placeholder="e.g., 4"
              className="text-sm bg-card"
            />
            <p className="text-[11px] text-orange-500 dark:text-orange-300 mt-0.5">
              When unit is "Per Car", extra cars are added automatically for larger groups.
            </p>
          </div>
          <div>
            <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
              Pick Up Location
            </Label>
            <Input
              value={item.pickup_location || ''}
              onChange={(e) => set('pickup_location', e.target.value)}
              className="text-sm bg-card"
            />
          </div>
          <div>
            <Label className="text-xs text-orange-700 dark:text-orange-300 mb-1 block font-semibold">
              Drop Off Location
            </Label>
            <Input
              value={item.dropoff_location || ''}
              onChange={(e) => set('dropoff_location', e.target.value)}
              className="text-sm bg-card"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Day Offset Start</Label>
          <Input
            type="number"
            min="0"
            value={item.day_offset_start ?? 0}
            onChange={(e) => set('day_offset_start', parseInt(e.target.value) || 0)}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground mt-0.5">0 = departure day</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Day Offset End</Label>
          <Input
            type="number"
            min="0"
            value={item.day_offset_end ?? item.day_offset_start ?? 0}
            onChange={(e) => set('day_offset_end', parseInt(e.target.value) || 0)}
            className="text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Unit</Label>
          <Select value={item.unit || 'per_person'} onValueChange={(v) => set('unit', v)}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="per_person">Per Person</SelectItem>
              <SelectItem value="per_night">Per Night</SelectItem>
              <SelectItem value="per_day">Per Day</SelectItem>
              <SelectItem value="per_car">Per Car</SelectItem>
              <SelectItem value="per_hour">Per Hour</SelectItem>
              <SelectItem value="flat_rate">Flat Rate</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Quantity</Label>
          <Input
            type="number"
            min="1"
            value={item.quantity || 1}
            onChange={(e) => set('quantity', parseFloat(e.target.value) || 1)}
            className="text-sm"
            disabled={item.unit === 'per_car' && !!item.car_capacity}
          />
          {item.unit === 'per_car' && !!item.car_capacity && (
            <p className="text-[11px] text-muted-foreground mt-0.5">Auto-computed from participants at booking time</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block font-semibold">Cost Price / Unit *</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              value={item.acquiring_price ?? ''}
              onChange={(e) => set('acquiring_price', parseFloat(e.target.value))}
              placeholder="0.00"
              className="text-sm flex-1"
            />
            <Select value={item.supplier_currency || 'EUR'} onValueChange={(v) => set('supplier_currency', v)}>
              <SelectTrigger className="w-24 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['EUR', 'USD', 'GBP', 'TRY', 'AED'].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Real supplier cost, used for internal margin tracking. The client is billed the fixed per-person package
            price from the pricing tiers below, not this line individually.
          </p>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={item.show_in_itinerary !== false}
              onChange={(e) => set('show_in_itinerary', e.target.checked)}
              className="rounded border-border text-blue-600 dark:text-blue-300 focus:ring-blue-500"
            />
            <span className="text-xs font-semibold text-foreground">Show in client itinerary</span>
          </label>
        </div>
      </div>
    </Card>
  );
}
