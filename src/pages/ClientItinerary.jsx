import { db } from '@/lib/DbContext';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, MapPin, Share2, Check, Zap } from 'lucide-react';
import { groupServicesByDay } from '@/lib/serviceItinerary';
import { ServiceCard, DaySection } from '@/components/client-trip/ServiceItineraryCards';
import { useT } from '@/lib/i18n/I18nContext';

export default function ClientItinerary() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get('id');
  const [shareCopied, setShareCopied] = useState(false);

  const { data: trip, isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['trip', tripId],
      queryFn: () => db.entities.Trip.get(tripId),
      enabled: !!tripId,
    })
  );

  const { data: settings } = /** @type {any} */ (
    useQuery({
      queryKey: ['appSettings'],
      queryFn: async () => {
        const all = await db.entities.AppSettings.list();
        return all[0] || {};
      },
    })
  );
  const companyLogoUrl = settings?.invoice_header?.logo_url || settings?.logo_url || '';
  const companyName = settings?.invoice_header?.company_name || settings?.app_name || '';

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['suppliers'],
      queryFn: () => db.entities.Supplier.list(),
    })
  );
  const supplierMap = useMemo(() => Object.fromEntries((suppliers || []).map((s) => [s.id, s])), [suppliers]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!trip) {
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

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.name || 'Itinerary', url });
      } catch (e) {
        if (e.name !== 'AbortError') {
          navigator.clipboard.writeText(url);
          setShareCopied(true);
          setTimeout(() => setShareCopied(false), 2000);
        }
      }
    } else {
      navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-muted">
      {/* Nav bar */}
      <nav className="sticky top-0 z-20 bg-card/80 backdrop-blur-md border-b border-border no-print">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-foreground text-sm tracking-wide">{t('clientItinerary.navLabel')}</span>
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={handleShare}
              className="text-xs text-muted-foreground hover:text-foreground font-medium px-3 py-1.5 rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5"
            >
              {shareCopied ? (
                <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-300" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              {shareCopied ? t('clientItinerary.copied') : t('clientItinerary.share')}
            </button>
            <button
              onClick={() => {
                const prev = document.title;
                document.title = trip?.name || 'Itinerary';
                window.print();
                document.title = prev;
              }}
              className="text-xs text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-300 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
            >
              {t('clientItinerary.printPdf')}
            </button>
          </div>
        </div>
      </nav>

      {/* Agency branding — kept outside <nav> (which is hidden on print) so
          it still appears when this itinerary is printed or saved as PDF. */}
      {(companyLogoUrl || companyName) && (
        <div className="max-w-4xl mx-auto px-4 pt-6 flex items-center gap-3">
          {companyLogoUrl && (
            <img src={companyLogoUrl} alt={companyName || 'Logo'} className="h-28 w-auto object-contain" />
          )}
          {companyName && <span className="font-semibold text-foreground">{companyName}</span>}
        </div>
      )}

      {/* Hero */}
      <div className="relative h-72 md:h-80 overflow-hidden">
        <img
          src={
            trip.image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop'
          }
          alt={trip.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            const t = /** @type {any} */ (e.target);
            t.onerror = null;
            t.src = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">
                {t('clientItinerary.heroLabel')}
              </span>
            </div>
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

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {sortedDays.length === 0 && unscheduled.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">{t('clientItinerary.noServicesTitle')}</h2>
            <p className="text-muted-foreground">{t('clientItinerary.noServicesBody')}</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
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

            {/* Day-by-day itinerary */}
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

            {/* Unscheduled services */}
            {unscheduled.length > 0 && (
              <div className="mt-10">
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500 dark:text-amber-300" />
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

            {/* Notes */}
            {trip.notes && (
              <div className="mt-10 bg-card rounded-xl border border-border p-6 shadow-sm">
                <h3 className="font-semibold text-foreground mb-2">{t('common.notes')}</h3>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap leading-relaxed">{trip.notes}</p>
              </div>
            )}

            {/* Emergency Contact */}
            {(trip.created_by || trip.created_by_phone) && (
              <div className="mt-10 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-800 p-6">
                <h3 className="font-semibold text-red-900 dark:text-red-300 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  {t('clientItinerary.emergencyContact')}
                </h3>
                <div className="space-y-1 text-sm text-red-800 dark:text-red-300">
                  {trip.created_by_name && trip.created_by_name !== 'Unknown' && (
                    <div className="font-semibold">{trip.created_by_name}</div>
                  )}
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

            {/* Terms */}
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

      {/* Footer */}
      <div className="border-t border-border bg-card mt-10">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          {t('clientItinerary.footerGenerated')}
        </div>
      </div>
    </div>
  );
}
