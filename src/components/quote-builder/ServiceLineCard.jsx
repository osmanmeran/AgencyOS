import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Plus, CalendarOff, AlertTriangle } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';
import { isLodgingCategory, nightsBetween, unitPriceFor, OCCUPANCY_LABELS } from '@/lib/hotelPricing';
import { getBlockingStopSale } from '@/lib/supplierStopSales';
import ServicePickerDialog from './ServicePickerDialog';
import {
  sym,
  NIGHT_UNITS,
  FIXED_UNITS,
  HOTEL_TREATMENTS,
  MEAL_CODE_TO_LABEL,
  TRANSFER_TYPES,
  CAR_CATEGORY_LABELS,
  newLine,
  lineTotal,
} from './helpers';

function ServiceLineCard({
  line,
  services,
  servicesById,
  currency,
  stopSales,
  onChange,
  onRemove,
  autoOpenPicker,
  initialPickerValues,
}) {
  const { t } = useT();
  const svc = servicesById.get(line.pricing_id);
  const catName = (svc?.category_name || '').toLowerCase();
  const isLodging = isLodgingCategory(catName);
  const isTransfer = catName.includes('transfer');
  const isCarRental = catName.includes('rent a car') || catName.includes('rental') || catName.includes('car rental');
  const isGuided =
    catName.includes('tour') ||
    catName.includes('guide') ||
    catName.includes('excursion') ||
    catName.includes('activity');
  const isTour = !!line.tour_id;
  const isNightly = NIGHT_UNITS.includes(line.unit);
  const isFixed = FIXED_UNITS.includes(line.unit);
  const nights = nightsBetween(line.start_date, line.end_date);
  const unitPrice = unitPriceFor(svc, line.quantity);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Arriving from the portal home's hero search: open this (empty, first)
  // line's picker automatically instead of making the client click "Choose a
  // service" again after already filling in a destination/dates there.
  useEffect(() => {
    if (autoOpenPicker && !svc) setPickerOpen(true);
  }, []);

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
  const pickResolvedRoom = (item, resolvedStartDate, resolvedEndDate, rooms, childrenCount) => {
    onChange({
      ...newLine(),
      _key: line._key,
      pricing_id: item.pricing_id,
      service_name: item.name,
      unit: item.unit,
      min_quantity: item.min_quantity || 1,
      quantity: Math.max(item.min_quantity || 1, rooms || 1),
      children_count: childrenCount || 0,
      supplier_id: item.supplier_id,
      start_date: resolvedStartDate,
      end_date: resolvedEndDate,
      room_type: OCCUPANCY_LABELS[item.occupancy] || item.occupancy,
      hotel_treatment: MEAL_CODE_TO_LABEL[item.meal_treatment] || '',
    });
    setPickerOpen(false);
  };
  const set = (field, value) => onChange({ ...line, [field]: value });

  return (
    <div className="border border-border rounded-lg bg-muted p-4 space-y-3">
      <div className="flex flex-wrap gap-3 items-start">
        {isTour ? (
          <div className="flex-1 min-w-[220px] flex items-center gap-3 px-3 py-2.5 bg-card border border-border rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-blue-600 dark:text-blue-300 font-medium">Guided Tour</div>
              <div className="text-sm font-semibold text-foreground truncate">{line.service_name}</div>
            </div>
          </div>
        ) : svc ? (
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
        stopSales={stopSales}
        currency={currency}
        onSelect={pickService}
        onSelectResolvedRoom={pickResolvedRoom}
        initialValues={initialPickerValues}
      />

      {line.pricing_id && (
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
                {isCarRental ? (
                  <>
                    {nights} day{nights !== 1 ? 's' : ''}
                  </>
                ) : (
                  <>
                    {nights} night{nights !== 1 ? 's' : ''}
                  </>
                )}
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
              {line.children_count > 0 && (
                <div className="text-xs text-muted-foreground self-end pb-2">
                  + {line.children_count} child{line.children_count === 1 ? '' : 'ren'}
                </div>
              )}
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
              {nights <= 0 && (
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  Pick a pick-up and drop-off date above to price this rental by day.
                </p>
              )}
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
                  {lineTotal(
                    line,
                    unitPrice,
                    {
                      insuranceSurcharge: svc?.insurance_surcharge || 0,
                      childUnitPrice: svc?.child_unit_price || 0,
                    },
                    nights,
                  ).toFixed(2)}
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
                {sym(currency)}
                {unitPrice.toFixed(2)} {line.unit?.replace('per_', '/ ')}
                {isNightly && nights > 0 ? ` · ${nights} night${nights !== 1 ? 's' : ''}` : ''}
              </span>
              <span className="font-semibold text-green-700 dark:text-green-300">
                {sym(currency)}
                {lineTotal(line, unitPrice, {
                  insuranceSurcharge: svc?.insurance_surcharge || 0,
                  childUnitPrice: svc?.child_unit_price || 0,
                }).toFixed(2)}
              </span>
            </div>
          )}
        </>
      )}
      {isTour && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('quoteBuilder.tourDate')}</Label>
              <Input
                type="date"
                className="w-44"
                value={line.service_date || ''}
                onChange={(e) => set('service_date', e.target.value)}
              />
            </div>
            {Number(line.tour_display_price) > 0 && (
              <div className="flex items-center gap-2 pb-1 text-sm">
                {line.tour_discount_percent > 0 && Number(line.tour_original_price) > 0 && (
                  <span className="line-through text-muted-foreground">
                    {sym(line.tour_display_currency)}
                    {Number(line.tour_original_price).toFixed(2)}
                  </span>
                )}
                <span className="font-semibold text-green-700 dark:text-green-300">
                  {sym(line.tour_display_currency)}
                  {Number(line.tour_display_price).toFixed(2)}
                </span>
                <span className="text-muted-foreground">{t('quoteBuilder.perPerson')}</span>
                {line.tour_discount_percent > 0 && (
                  <span className="text-xs bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded-full">
                    -{line.tour_discount_percent}%
                  </span>
                )}
              </div>
            )}
          </div>
          <Textarea
            rows={2}
            placeholder={t('quoteBuilder.tourDetailsPlaceholder')}
            value={line.details || ''}
            onChange={(e) => set('details', e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export default ServiceLineCard;
