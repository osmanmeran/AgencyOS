import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, MapPin } from 'lucide-react';
import { groupServicesByDay } from '@/lib/serviceItinerary';
import { ServiceCard, DaySection } from '@/components/client-trip/ServiceItineraryCards';
import TripMap from '@/components/client-trip/TripMap';
import { useT } from '@/lib/i18n/I18nContext';

const FALLBACK_HERO = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop';

// The public link a client shares with passengers who have no account at
// all — unlike ClientItinerary.jsx (which reads via the authenticated
// db.entities.Trip.get), this fetches a single pre-sanitized payload from the
// unauthenticated /api/public/itinerary/:token endpoint (no pricing, no
// internal notes — see server/services/itineraryShare.js) so there's nothing
// here that requires a session.
export default function PublicItinerary() {
  const { t } = useT();
  const { token } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['publicItinerary', token],
    queryFn: async () => {
      const res = await fetch(`/api/public/itinerary/${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error('not found');
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const trip = data?.trip;
  const suppliers = data?.suppliers || [];
  const company = data?.company || {};
  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers]);

  const mapEvents = useMemo(
    () =>
      (trip?.services || [])
        .filter((s) => s.location)
        .map((s) => ({
          id: s._key || s.name,
          title: s.name,
          location: s.location,
          date: s.start_date,
          time: s.pickup_time,
        })),
    [trip?.services],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted text-center p-8">
        <MapPin className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">{t('clientItinerary.notFoundTitle')}</h1>
        <p className="text-muted-foreground mb-6">{t('clientItinerary.notFoundBody')}</p>
        <Link to="/" className="text-blue-600 dark:text-blue-300 hover:underline text-sm">
          {t('clientItinerary.goHome')}
        </Link>
      </div>
    );
  }

  const services = (trip.services || []).filter((s) => s.show_in_itinerary !== false);
  const { sortedDays, dayServices, unscheduled } = groupServicesByDay(services);

  return (
    <div className="min-h-screen bg-muted">
      <nav className="sticky top-0 z-20 bg-card/80 backdrop-blur-md border-b border-border no-print">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-foreground text-sm tracking-wide">{t('clientItinerary.navLabel')}</span>
          <button
            onClick={() => {
              const prev = document.title;
              document.title = trip.name || 'Itinerary';
              window.print();
              document.title = prev;
            }}
            className="text-xs text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-300 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors no-print"
          >
            {t('clientItinerary.printPdf')}
          </button>
        </div>
      </nav>

      {(company.logo_url || company.name) && (
        <div className="max-w-4xl mx-auto px-4 pt-6 flex items-center gap-3">
          {company.logo_url && (
            <img src={company.logo_url} alt={company.name || 'Logo'} className="h-28 w-auto object-contain" />
          )}
          {company.name && <span className="font-semibold text-foreground">{company.name}</span>}
        </div>
      )}

      <div className="relative h-72 md:h-80 overflow-hidden">
        <img
          src={trip.image_url || FALLBACK_HERO}
          alt={trip.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = /** @type {any} */ (e.target);
            target.onerror = null;
            target.src = FALLBACK_HERO;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="max-w-4xl mx-auto">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60 block mb-2">
              {t('clientItinerary.heroLabel')}
            </span>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 leading-tight">{trip.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-white/80">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-medium">{trip.destination || t('clientItinerary.destinationTbd')}</span>
              </div>
              {trip.start_date && trip.end_date && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {format(new Date(trip.start_date), 'MMM d')} – {format(new Date(trip.end_date), 'MMM d, yyyy')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {sortedDays.length === 0 && unscheduled.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">{t('clientItinerary.noServicesTitle')}</h2>
            <p className="text-muted-foreground">{t('clientItinerary.noServicesBody')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-10">
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <div className="text-xs text-muted-foreground mb-1">{t('clientItinerary.days')}</div>
                <div className="text-2xl font-bold text-foreground">{sortedDays.length}</div>
              </div>
              {trip.notes && (
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <div className="text-xs text-muted-foreground mb-1">{t('common.notes')}</div>
                  <div className="text-sm font-medium text-foreground line-clamp-2">{trip.notes}</div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                {t('clientItinerary.dayByDay')}
              </h2>
              {sortedDays.map((date, idx) => (
                <DaySection
                  key={date}
                  date={date}
                  services={dayServices[date]}
                  dayIndex={idx}
                  supplierMap={supplierMap}
                />
              ))}
            </div>

            {unscheduled.length > 0 && (
              <div className="mt-10">
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  {t('clientTripDetails.otherServices')}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">{t('clientItinerary.unscheduledHint')}</p>
                <div className="space-y-3">
                  {unscheduled.map((svc, idx) => (
                    <ServiceCard key={idx} service={svc} supplierMap={supplierMap} />
                  ))}
                </div>
              </div>
            )}

            {mapEvents.length > 0 && (
              <div className="mt-10">
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                  {t('clientItinerary.mapTitle')}
                </h2>
                <TripMap events={mapEvents} />
              </div>
            )}

            {trip.notes && (
              <div className="mt-10 bg-card rounded-xl border border-border p-6 shadow-sm">
                <h3 className="font-semibold text-foreground mb-2">{t('common.notes')}</h3>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap leading-relaxed">{trip.notes}</p>
              </div>
            )}

            {(trip.created_by_name || trip.created_by_phone) && (
              <div className="mt-10 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-800 p-6">
                <h3 className="font-semibold text-red-900 dark:text-red-300 mb-3">
                  {t('clientItinerary.emergencyContact')}
                </h3>
                <div className="space-y-1 text-sm text-red-800 dark:text-red-300">
                  {trip.created_by_name && <div className="font-semibold">{trip.created_by_name}</div>}
                  <div>{t('clientItinerary.yourTravelAgent')}</div>
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

            {trip.terms_and_conditions && (
              <div className="mt-4 bg-muted rounded-xl border border-border p-6">
                <h3 className="font-semibold text-foreground mb-2 text-sm">
                  {t('clientProposalDetails.termsAndConditions')}
                </h3>
                <p className="text-muted-foreground text-xs whitespace-pre-wrap leading-relaxed">
                  {trip.terms_and_conditions}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-border bg-card mt-10">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          {t('clientItinerary.footerGenerated')}
        </div>
      </div>
    </div>
  );
}
