import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Map, Check, Share2, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { SERVICE_TYPE_CONFIG } from './helpers';
import { useT } from '@/lib/i18n/I18nContext';

export default function ItineraryRecap({
  trip,
  companyLogoUrl,
  companyName,
  handleShareItinerary,
  shareCopied,
  supplierMap,
  handleRevokeShare,
}) {
  const { t: _t } = useT();
  return (
    <Card className="bg-card shadow-lg print:shadow-none overflow-hidden">
      {(companyLogoUrl || companyName) && (
        <div className="flex items-center gap-3 px-6 pt-6">
          {companyLogoUrl && <img src={companyLogoUrl} alt={companyName || 'Logo'} className="h-20 object-contain" />}
          {companyName && <span className="font-semibold text-foreground">{companyName}</span>}
        </div>
      )}
      {/* Cover Image */}
      <div className="relative h-48 md:h-56 overflow-hidden">
        <img
          src={
            trip.image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop'
          }
          alt={trip.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Map className="w-6 h-6 text-white" />
              <h2 className="text-xl font-bold text-white">{_t('reservationDetails.itinerary')}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outlined"
                size="small"
                onClick={handleShareItinerary}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.4)',
                  '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
                }}
              >
                {shareCopied ? (
                  <Check size={16} style={{ marginRight: 3, color: '#4ade80' }} />
                ) : (
                  <Share2 size={16} style={{ marginRight: 3 }} />
                )}
                {shareCopied ? 'Link Copied!' : 'Share'}
              </Button>
              {trip.share_enabled && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleRevokeShare}
                  sx={{
                    color: 'white',
                    borderColor: 'rgba(255,255,255,0.4)',
                    '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  {_t('reservationDetails.stopSharing')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {(() => {
          const start = new Date(trip.start_date);
          const end = new Date(trip.end_date);
          const days = [];
          const cur = new Date(start);
          let dayNum = 1;

          while (cur <= end) {
            const key = format(cur, 'yyyy-MM-dd');
            const allServices = (trip.services || []).filter((s) => {
              if (s.show_in_itinerary === false) return false;
              if (!s.start_date) return false;
              const sStart = new Date(s.start_date.split('T')[0]);
              const sEnd = s.end_date ? new Date(s.end_date.split('T')[0]) : sStart;
              return cur >= sStart && cur <= sEnd;
            });

            const dayServices = [];
            allServices.forEach((s) => {
              const isTransferWithReturn =
                (s.category || '').toLowerCase().includes('transfer') && s.return_leg?.enabled && s.return_leg?.date;
              const returnDate = isTransferWithReturn ? s.return_leg.date.split('T')[0] : null;

              if (returnDate === key) {
                dayServices.push({
                  _returnLegOf: s,
                  name: `${s.name} (Return)`,
                  category: s.category,
                  pickup_time: s.return_leg.pickup_time,
                  pickup_location: s.return_leg.pickup_location,
                  dropoff_location: s.return_leg.dropoff_location,
                  transfer_flight_number: s.return_leg.flight_number,
                  location: s.location,
                  description: null,
                  supplier_id: s.supplier_id,
                  _isReturnLeg: true,
                });
              } else if (!isTransferWithReturn || key === format(new Date(s.start_date.split('T')[0]), 'yyyy-MM-dd')) {
                dayServices.push({ ...s, _isReturnLeg: false });
              }
            });

            dayServices.sort((a, b) => {
              const aTime = a.pickup_time || '';
              const bTime = b.pickup_time || '';
              if (aTime < bTime) return -1;
              if (aTime > bTime) return 1;
              return (a.name || '').localeCompare(b.name || '');
            });

            days.push({ key, date: new Date(cur), dayNum, services: dayServices });
            cur.setDate(cur.getDate() + 1);
            dayNum++;
          }
          const totalDays = days.length;

          return days.map(({ key, date, dayNum, services }) => {
            let badge = null;
            if (dayNum === 1 && totalDays > 1) badge = 'Arrival';
            else if (dayNum === totalDays && totalDays > 1) badge = 'Departure';

            return (
              <div key={key} className="mb-7 last:mb-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shrink-0">
                    {dayNum}
                  </div>
                  <div className="font-bold text-foreground">
                    {_t('reservationDetails.day')} {dayNum}
                    <span className="font-normal text-muted-foreground ml-2">{format(date, 'EEEE, MMM d, yyyy')}</span>
                  </div>
                  {badge && (
                    <Badge
                      className={
                        badge === 'Arrival'
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
                          : 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300'
                      }
                    >
                      {badge}
                    </Badge>
                  )}
                </div>

                {services.length > 0 ? (
                  <div className="relative pl-9 space-y-4">
                    <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-muted" />
                    {services.map((s, idx) => {
                      const cfg = SERVICE_TYPE_CONFIG[s.category];
                      const Icon = cfg?.icon || Map;
                      const iconBg = cfg?.color?.split(' ')[0] || 'bg-muted';
                      const iconColor = cfg?.color?.split(' ')[1] || 'text-foreground';
                      return (
                        <div key={idx} className="relative">
                          <div
                            className={`absolute -left-9 top-1 w-[30px] h-[30px] rounded-full flex items-center justify-center ${iconBg} ${iconColor}`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="bg-card border border-border rounded-lg p-3 hover:shadow-sm transition-shadow">
                            <div className="flex items-start gap-2">
                              {s.pickup_time && (
                                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-300 whitespace-nowrap mt-0.5 min-w-[3rem]">
                                  {s.pickup_time}
                                </span>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                                  {s.name}
                                  {s._isReturnLeg && (
                                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                                      {_t('reservationDetails.return')}
                                    </span>
                                  )}
                                </div>
                                {s.location && (
                                  <div className="text-xs text-muted-foreground mt-0.5">📍 {s.location}</div>
                                )}
                                {s.pickup_location && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {_t('reservationDetails.pick')} {s.pickup_location}
                                  </div>
                                )}
                                {s.dropoff_location && (
                                  <div className="text-xs text-muted-foreground">
                                    {_t('reservationDetails.drop')} {s.dropoff_location}
                                  </div>
                                )}
                                {s.transfer_flight_number && (
                                  <div className="text-xs text-muted-foreground">✈ {s.transfer_flight_number}</div>
                                )}
                                {s.description && (
                                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.description}</p>
                                )}
                                {!s._isReturnLeg && s.return_leg?.enabled && (
                                  <div className="mt-2 pt-2 border-t border-orange-100">
                                    <span className="text-[11px] text-orange-600 dark:text-orange-300 font-semibold uppercase tracking-wide">
                                      {_t('reservationDetails.returnLeg')}
                                    </span>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {s.return_leg.date ? format(new Date(s.return_leg.date), 'MMM d, yyyy') : ''}
                                      {s.return_leg.pickup_time ? ` @ ${s.return_leg.pickup_time}` : ''}
                                      {s.return_leg.pickup_location
                                        ? ` — Pick up: ${s.return_leg.pickup_location}`
                                        : ''}
                                      {s.return_leg.dropoff_location ? ` → ${s.return_leg.dropoff_location}` : ''}
                                    </div>
                                  </div>
                                )}
                                {s.supplier_id && supplierMap[s.supplier_id] && (
                                  <div className="text-[11px] text-muted-foreground mt-1">
                                    {_t('reservationDetails.booked')} {supplierMap[s.supplier_id]}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic pl-9">{_t('reservationDetails.free')}</div>
                )}
              </div>
            );
          });
        })()}
      </div>

      {/* Emergency Contact */}
      {(trip.created_by_name || trip.created_by || trip.created_by_phone) && (
        <div className="mt-6 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-800 p-6">
          <h3 className="font-semibold text-red-900 dark:text-red-300 mb-3 flex items-center gap-2">
            <Phone className="w-5 h-5" />
            {_t('reservationDetails.emergency')}
          </h3>
          <div className="space-y-1 text-sm text-red-800 dark:text-red-300">
            {trip.created_by_name && <div className="font-semibold">{trip.created_by_name}</div>}
            {trip.created_by && <div>{_t('reservationDetails.your')}</div>}
            {trip.created_by_phone && (
              <div>
                <a href={`tel:${trip.created_by_phone}`} className="underline">
                  {trip.created_by_phone}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
