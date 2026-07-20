import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ServiceLineEditor from '@/components/services/ServiceLineEditor';
import { format } from 'date-fns';
import { getCurrencySymbol } from '@/lib/formatters';
import { Plus, Edit, DollarSign } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

export default function ServicesSection({
  trip,
  categories,
  supplierMap,
  sc,
  editingServiceIdx,
  setEditingServiceIdx,
  updateMutation,
  handleServiceUpdate,
  handleAddService,
  setAddingNewService,
  addingNewService,
  targetMarginPct,
  setTargetMarginPct,
  handleApplyTotalMargin,
}) {
  const { t: _t } = useT();
  return (
    <Card className="p-8 bg-card shadow-lg print:shadow-none">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">{_t('reservationDetails.services')}</h2>
        {trip.proposal_status !== 'confirmed' && (
          <Button size="sm" onClick={() => setAddingNewService(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {_t('reservationDetails.addService')}
          </Button>
        )}
      </div>

      {addingNewService && (
        <div className="mb-6">
          <ServiceLineEditor
            service={{}}
            services={trip.services}
            categories={categories}
            _passengerCount={trip.passengers?.length || 1}
            onUpdate={handleAddService}
            onRemove={() => setAddingNewService(false)}
            onDuplicate={() => {}}
            onChange={() => {}}
          />
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={() => setAddingNewService(false)}>
              {_t('reservationDetails.cancel')}
            </Button>
          </div>
        </div>
      )}

      {trip.services?.length > 0 ? (
        <div className="space-y-5">
          {(() => {
            const sortedServices = (trip.services || []).slice().sort((a, b) => {
              const aStart = a.start_date || '';
              const bStart = b.start_date || '';
              if (aStart < bStart) return -1;
              if (aStart > bStart) return 1;
              const aEnd = a.end_date || '';
              const bEnd = b.end_date || '';
              if (aEnd < bEnd) return -1;
              if (aEnd > bEnd) return 1;
              return (a.name || '').localeCompare(b.name || '');
            });

            const dayToServices = {};
            const dayOrder = [];
            const shownServiceKeys = new Set();
            if (trip.start_date && trip.end_date) {
              const start = new Date(trip.start_date);
              const end = new Date(trip.end_date);
              const cur = new Date(start);
              while (cur <= end) {
                const key = format(cur, 'yyyy-MM-dd');
                dayOrder.push(key);
                const active = sortedServices.filter((s) => {
                  if (!s.start_date) return false;
                  const sStart = new Date(s.start_date.split('T')[0]);
                  const sEnd = s.end_date ? new Date(s.end_date.split('T')[0]) : sStart;
                  return cur >= sStart && cur <= sEnd;
                });
                if (active.length > 0) {
                  dayToServices[key] = active;
                  active.forEach((s) => shownServiceKeys.add(s._key || s));
                }
                cur.setDate(cur.getDate() + 1);
              }
            }

            const unscheduled = sortedServices.filter((s) => !s.start_date || !shownServiceKeys.has(s._key || s));

            const fullServiceCard = (service, originalIdx) => {
              if (editingServiceIdx === originalIdx) {
                return (
                  <div key={originalIdx}>
                    <ServiceLineEditor
                      service={service}
                      services={trip.services}
                      categories={categories}
                      _passengerCount={trip.passengers?.length || 1}
                      onUpdate={handleServiceUpdate}
                      onRemove={() => {
                        const updatedServices = trip.services.filter((_, i) => i !== originalIdx);
                        updateMutation.mutate({ services: updatedServices });
                        setEditingServiceIdx(null);
                      }}
                      onDuplicate={() => {}}
                      onChange={() => {}}
                    />
                    <div className="flex justify-end gap-2 mt-3">
                      <Button variant="outline" onClick={() => setEditingServiceIdx(null)}>
                        {_t('reservationDetails.cancel')}
                      </Button>
                    </div>
                  </div>
                );
              }
              const supplierName = service.supplier_id ? supplierMap[service.supplier_id] || '—' : null;
              const scSupplier = getCurrencySymbol(service.supplier_currency || 'USD');
              const scClient = getCurrencySymbol(service.client_currency || 'USD');
              const serviceEffQty = (s) => {
                const qty = parseInt(s.quantity) || 1;
                if (s.unit === 'per_night' || s.unit === 'per_day') {
                  if (s.start_date && s.end_date) {
                    const days = Math.max(1, Math.round((+new Date(s.end_date) - +new Date(s.start_date)) / 86400000));
                    return qty * days;
                  }
                  return qty;
                }
                return qty;
              };
              const lineAcq = (parseFloat(service.acquiring_price) || 0) * serviceEffQty(service);
              const lineSell = (parseFloat(service.selling_price) || 0) * serviceEffQty(service);
              return (
                <div className="border border-border rounded-lg p-4 bg-muted relative">
                  {trip.proposal_status !== 'confirmed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingServiceIdx(originalIdx)}
                      className="absolute top-3 right-3 print:hidden"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      {_t('reservationDetails.edit')}
                    </Button>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <h3 className="font-bold text-lg text-foreground">{service.name}</h3>
                    {service.location && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                        {service.location}
                      </span>
                    )}
                    {service.category && (
                      <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-1 rounded">
                        {service.category}
                      </span>
                    )}
                    {supplierName && (
                      <span className="text-xs bg-muted text-foreground px-2 py-1 rounded">{supplierName}</span>
                    )}
                    {service.booking_source && (
                      <span
                        className={`text-xs px-2 py-1 rounded ${service.booking_source === 'direct' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'}`}
                      >
                        {service.booking_source === 'direct' ? 'Direct' : 'Via Supplier'}
                      </span>
                    )}
                  </div>
                  {service.start_date && service.end_date && (
                    <div className="text-sm text-muted-foreground mb-3">
                      <span className="font-medium">{_t('reservationDetails.dates')}</span>{' '}
                      {format(new Date(service.start_date), 'MMM d')} –{' '}
                      {format(new Date(service.end_date), 'MMM d, yyyy')}
                    </div>
                  )}
                  {service.pickup_location && (
                    <div className="text-sm text-muted-foreground mb-2 space-y-1">
                      <div>
                        <span className="font-medium">{_t('reservationDetails.pick')}</span> {service.pickup_location}
                        {service.pickup_time ? ` @ ${service.pickup_time}` : ''}
                      </div>
                      <div>
                        <span className="font-medium">{_t('reservationDetails.drop')}</span>{' '}
                        {service.dropoff_location || '—'}
                      </div>
                      {service.transfer_flight_number && (
                        <div>
                          <span className="font-medium">{_t('reservationDetails.flight')}</span>{' '}
                          {service.transfer_flight_number}
                        </div>
                      )}
                      {service.return_leg?.enabled && (
                        <div className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-800">
                          <div className="font-medium text-orange-700 dark:text-orange-300 text-xs uppercase tracking-wide mb-1">
                            {_t('reservationDetails.returnLeg')}
                          </div>
                          <div>
                            <span className="font-medium">{_t('reservationDetails.date')}</span>{' '}
                            {format(new Date(service.return_leg.date), 'MMM d, yyyy')}
                            {service.return_leg.pickup_time ? ` @ ${service.return_leg.pickup_time}` : ''}
                          </div>
                          <div>
                            <span className="font-medium">{_t('reservationDetails.pick')}</span>{' '}
                            {service.return_leg.pickup_location}
                          </div>
                          <div>
                            <span className="font-medium">{_t('reservationDetails.drop')}</span>{' '}
                            {service.return_leg.dropoff_location}
                          </div>
                          {service.return_leg.flight_number && (
                            <div>
                              <span className="font-medium">{_t('reservationDetails.flight')}</span>{' '}
                              {service.return_leg.flight_number}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {service.description && <p className="text-muted-foreground text-sm mb-3">{service.description}</p>}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="bg-card p-2 rounded border">
                      <div className="text-xs text-muted-foreground">{_t('reservationDetails.unit')}</div>
                      <div className="font-semibold text-foreground">
                        {service.unit?.replace('_', ' ') || 'per_person'}
                      </div>
                    </div>
                    <div className="bg-card p-2 rounded border">
                      <div className="text-xs text-muted-foreground">{_t('reservationDetails.qty')}</div>
                      <div className="font-semibold text-foreground">{service.quantity || 1}</div>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/40 p-2 rounded border border-amber-200 dark:border-amber-800">
                      <div className="text-xs text-muted-foreground">{_t('reservationDetails.supplier')}</div>
                      <div className="font-semibold text-amber-900 dark:text-amber-300">
                        {scSupplier}
                        {(parseFloat(service.acquiring_price) || 0).toFixed(2)}{' '}
                        <span className="text-xs font-normal text-muted-foreground">× {serviceEffQty(service)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {_t('reservationDetails.total')} {scSupplier}
                        {lineAcq.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/40 p-2 rounded border border-green-200 dark:border-green-800">
                      <div className="text-xs text-muted-foreground">{_t('reservationDetails.clientPrice')}</div>
                      <div className="font-semibold text-green-900 dark:text-green-300">
                        {scClient}
                        {(parseFloat(service.selling_price) || 0).toFixed(2)}{' '}
                        <span className="text-xs font-normal text-muted-foreground">× {serviceEffQty(service)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {_t('reservationDetails.total')} {scClient}
                        {lineSell.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{_t('reservationDetails.totalClient')}</span>
                    <span className="font-bold text-lg text-green-700 dark:text-green-300">
                      {scClient}
                      {lineSell.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            };

            const renderDayService = (service, originalIdx, dayKey) => {
              if (editingServiceIdx === originalIdx) {
                return (
                  <div key={originalIdx}>
                    <ServiceLineEditor
                      service={service}
                      services={trip.services}
                      categories={categories}
                      _passengerCount={trip.passengers?.length || 1}
                      onUpdate={handleServiceUpdate}
                      onRemove={() => {
                        const updatedServices = trip.services.filter((_, i) => i !== originalIdx);
                        updateMutation.mutate({ services: updatedServices });
                        setEditingServiceIdx(null);
                      }}
                      onDuplicate={() => {}}
                      onChange={() => {}}
                    />
                    <div className="flex justify-end gap-2 mt-3">
                      <Button variant="outline" onClick={() => setEditingServiceIdx(null)}>
                        {_t('reservationDetails.cancel')}
                      </Button>
                    </div>
                  </div>
                );
              }

              const isStartDay =
                service.start_date && format(new Date(service.start_date.split('T')[0]), 'yyyy-MM-dd') === dayKey;

              if (isStartDay) {
                return <div key={originalIdx}>{fullServiceCard(service, originalIdx)}</div>;
              }

              return (
                <div key={originalIdx} className="border border-dashed border-border rounded-lg p-3 bg-muted/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-blue-500 dark:text-blue-300 font-medium uppercase shrink-0">
                        {_t('reservationDetails.continuing')}
                      </span>
                      <span className="font-semibold text-foreground truncate">{service.name}</span>
                      {service.category && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {service.category}
                        </Badge>
                      )}
                    </div>
                    {service.selling_price > 0 && (
                      <span className="text-sm text-green-600 dark:text-green-300 font-semibold shrink-0">
                        {sc}
                        {(parseFloat(service.selling_price) || 0).toFixed(2)}
                        {service.unit === 'per_night' && '/night'}
                      </span>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <>
                {dayOrder
                  .filter((key) => dayToServices[key])
                  .map((key) => {
                    const date = new Date(key + 'T00:00:00');
                    const dayNum = dayOrder.indexOf(key) + 1;
                    return (
                      <div key={key}>
                        <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-blue-200 dark:border-blue-800">
                          <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                            {dayNum}
                          </div>
                          <div>
                            <div className="font-bold text-lg text-foreground">
                              {_t('reservationDetails.day')} {dayNum}
                            </div>
                            <div className="text-sm text-muted-foreground">{format(date, 'EEEE, MMM d, yyyy')}</div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {dayToServices[key].map((service) =>
                            renderDayService(service, trip.services.indexOf(service), key),
                          )}
                        </div>
                      </div>
                    );
                  })}

                {unscheduled.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-border">
                      <div className="bg-muted-foreground text-background rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                        ∞
                      </div>
                      <div className="font-bold text-lg text-muted-foreground">
                        {_t('reservationDetails.unscheduled')}
                      </div>
                    </div>
                    <div className="space-y-4">
                      {unscheduled.map((service) => (
                        <div key={trip.services.indexOf(service)}>
                          {fullServiceCard(service, trip.services.indexOf(service))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-6 mt-4 border-t-2 border-border">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <span className="text-2xl font-bold text-foreground">{_t('reservationDetails.total_2')}</span>
                    <div className="text-4xl font-bold text-green-700 dark:text-green-300">
                      {sc}
                      {(trip.total_cost || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {trip.proposal_status !== 'confirmed' && (
                  <div className="mt-4 flex items-center gap-3 flex-wrap bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      {_t('reservationDetails.target')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min="0"
                        max="99"
                        step="0.5"
                        value={targetMarginPct}
                        onChange={(e) => setTargetMarginPct(parseFloat(e.target.value) || 0)}
                        className="w-20 h-7 text-sm text-center px-1"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleApplyTotalMargin}
                      disabled={targetMarginPct <= 0 || targetMarginPct >= 100 || updateMutation.isPending}
                      className="text-xs h-7"
                    >
                      {_t('reservationDetails.apply')}
                    </Button>
                    <span className="text-xs text-muted-foreground ml-auto">
                      ={' '}
                      {targetMarginPct > 0 && targetMarginPct < 100
                        ? ((targetMarginPct / (100 - targetMarginPct)) * 100).toFixed(1)
                        : '0'}
                      {_t('reservationDetails.markup')}
                    </span>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        <p className="text-muted-foreground">{_t('reservationDetails.no')}</p>
      )}
    </Card>
  );
}
