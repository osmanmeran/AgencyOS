import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Calendar, MapPin, Building, ArrowRightLeft, User, Coffee, Plane,
  Map, Zap, Sun, Share2, Check
} from 'lucide-react';

// const currSymbol = (cur) => ({ USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' }[cur] || (cur || '$'));

const CATEGORY_MAP = {
  lodging:        { label: 'Lodging',        icon: Building,       color: 'bg-blue-500',      bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200' },
  transfers:      { label: 'Transfer',       icon: ArrowRightLeft, color: 'bg-green-500',     bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200' },
  guides:         { label: 'Guide',          icon: User,           color: 'bg-amber-500',     bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200' },
  restaurants:    { label: 'Restaurant',     icon: Coffee,         color: 'bg-orange-500',    bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200' },
  transportation: { label: 'Transport',      icon: Plane,          color: 'bg-indigo-500',    bg: 'bg-indigo-50',  text: 'text-indigo-700', border: 'border-indigo-200' },
  guided_tours:   { label: 'Guided Tour',    icon: Map,            color: 'bg-purple-500',    bg: 'bg-purple-50',  text: 'text-purple-700', border: 'border-purple-200' },
  extra_activities: { label: 'Activity',     icon: Zap,            color: 'bg-pink-500',      bg: 'bg-pink-50',    text: 'text-pink-700',   border: 'border-pink-200' },
};

const detectCategory = (cat) => {
  const key = (cat || '').toLowerCase()
    .replace(/[\s_-]+/g, '_')
    .replace(/^hotel$|^lodging$|^accommodation$|^resort$/, 'lodging')
    .replace(/^transfer/, 'transfers')
    .replace(/^tour$|^guide$|^excursion$|^activity$/, 'guided_tours');
  return CATEGORY_MAP[key] || { label: cat || 'Service', icon: Sun, color: 'bg-slate-500', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
};

/* effQty removed (unused) */

function ServiceCard({ service }) {
  const cfg = detectCategory(service.category);
  const Icon = cfg.icon;
  const hasTimes = service.pickup_time || service.transfer_flight_number || (!service._isReturnLeg && service.return_leg?.enabled);

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${cfg.color} text-white`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold text-slate-900">{service.name}</h4>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                  {cfg.label}
                </span>
                {service._isReturnLeg && (
                  <span className="inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Return</span>
                )}
              </div>
            </div>
          </div>

          {service.location && (
            <div className="flex items-center gap-1 text-slate-500 text-sm mt-2">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{service.location}</span>
            </div>
          )}

          {service.pickup_location && (
            <div className="mt-2 space-y-0.5 text-sm text-slate-600">
              <div className="flex items-center gap-1">
                <span className="font-medium text-slate-500">Pick up:</span>
                <span>{service.pickup_location}</span>
                {service.pickup_time && <span className="text-slate-400">@ {service.pickup_time}</span>}
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium text-slate-500">Drop off:</span>
                <span>{service.dropoff_location || '—'}</span>
              </div>
              {service.transfer_flight_number && (
                <div className="flex items-center gap-1">
                  <span className="font-medium text-slate-500">Flight:</span>
                  <span>{service.transfer_flight_number}</span>
                </div>
              )}
              {!service._isReturnLeg && service.return_leg?.enabled && (
                <div className="mt-1.5 pt-1.5 border-t border-orange-200">
                  <div className="text-xs font-medium text-orange-600">Return Leg</div>
                  <div><span className="font-medium text-slate-500">Date:</span> {format(new Date(service.return_leg.date), 'MMM d, yyyy')}{service.return_leg.pickup_time ? ` @ ${service.return_leg.pickup_time}` : ''}</div>
                </div>
              )}
            </div>
          )}

          {hasTimes && service.start_date && service.end_date && !service.pickup_location && (
            <div className="flex items-center gap-1 text-slate-500 text-sm mt-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>{format(new Date(service.start_date), 'MMM d')} – {format(new Date(service.end_date), 'MMM d, yyyy')}</span>
            </div>
          )}

          {service.description && (
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">{service.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DaySection({ date, services, dayIndex }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex flex-col items-center bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl px-5 py-2.5 shadow-md min-w-[90px]">
          <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">Day {dayIndex + 1}</span>
          <span className="text-sm font-bold">{format(new Date(date), 'EEE, MMM d')}</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
      </div>
      <div className="space-y-3 ml-1">
        {services.map((svc, idx) => (
          <ServiceCard key={idx} service={svc} />
        ))}
      </div>
    </div>
  );
}

export default function ClientItinerary() {
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get('id');
  const [shareCopied, setShareCopied] = useState(false);

  const { data: trip, isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => db.entities.Trip.get(tripId),
    enabled: !!tripId
  }));

  const { data: settings } = /** @type {any} */ (useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => {
      const all = await db.entities.AppSettings.list();
      return all[0] || {};
    }
  }));
  const companyLogoUrl = settings?.invoice_header?.logo_url || settings?.logo_url || '';
  const companyName = settings?.invoice_header?.company_name || settings?.app_name || '';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center p-8">
        <MapPin className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-2xl font-bold text-slate-700 mb-2">Itinerary Not Found</h1>
        <p className="text-slate-500 mb-6">This itinerary could not be found or is no longer available.</p>
        <Link to="/" className="text-blue-600 hover:underline text-sm">Go to homepage</Link>
      </div>
    );
  }

  const services = (trip.services || []).filter(s => s.show_in_itinerary !== false);

  const dayServices = {};
  const unscheduled = [];
  const sorted = [...services].sort((a, b) => {
    const aStart = a.start_date || ''; const bStart = b.start_date || '';
    if (aStart < bStart) return -1; if (aStart > bStart) return 1;
    const aEnd = a.end_date || ''; const bEnd = b.end_date || '';
    if (aEnd < bEnd) return -1; if (aEnd > bEnd) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  sorted.forEach(s => {
    const isTransferWithReturn = (s.category || '').toLowerCase().includes('transfer') && s.return_leg?.enabled && s.return_leg?.date;
    if (s.start_date && s.end_date) {
      const start = s.start_date.split('T')[0];
      const end = s.end_date.split('T')[0];
      const startDt = new Date(start);
      const endDt = new Date(end);
      for (let d = new Date(startDt); d <= endDt; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split('T')[0];
        if (!dayServices[key]) dayServices[key] = [];
        if (d.getTime() === startDt.getTime() || s.unit === 'flat_rate') {
          dayServices[key].push(s);
        }
      }
      if (isTransferWithReturn) {
        const returnDate = s.return_leg.date.split('T')[0];
        if (!dayServices[returnDate]) dayServices[returnDate] = [];
        dayServices[returnDate].push({
          ...s,
          name: `${s.name} (Return)`,
          pickup_time: s.return_leg.pickup_time,
          pickup_location: s.return_leg.pickup_location,
          dropoff_location: s.return_leg.dropoff_location,
          transfer_flight_number: s.return_leg.flight_number,
          _isReturnLeg: true,
        });
      }
    } else if (s.start_date && !s.end_date) {
      const key = s.start_date.split('T')[0];
      if (!dayServices[key]) dayServices[key] = [];
      dayServices[key].push(s);
      if (isTransferWithReturn) {
        const returnDate = s.return_leg.date.split('T')[0];
        if (!dayServices[returnDate]) dayServices[returnDate] = [];
        dayServices[returnDate].push({
          ...s,
          name: `${s.name} (Return)`,
          pickup_time: s.return_leg.pickup_time,
          pickup_location: s.return_leg.pickup_location,
          dropoff_location: s.return_leg.dropoff_location,
          transfer_flight_number: s.return_leg.flight_number,
          _isReturnLeg: true,
        });
      }
    } else {
      unscheduled.push(s);
    }
  });

  const sortedDays = Object.keys(dayServices).sort();

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
    <div className="min-h-screen bg-slate-50">
      {/* Nav bar */}
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 no-print">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-slate-800 text-sm tracking-wide">ITINERARY</span>
          <div className="flex items-center gap-2 no-print">
            <button onClick={handleShare} className="text-xs text-slate-600 hover:text-slate-800 font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5">
              {shareCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Share2 className="w-3.5 h-3.5" />}
              {shareCopied ? 'Copied!' : 'Share'}
            </button>
            <button onClick={() => { const prev = document.title; document.title = trip?.name || 'Itinerary'; window.print(); document.title = prev; }} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
              Print / PDF
            </button>
          </div>
        </div>
      </nav>

      {/* Agency branding — kept outside <nav> (which is hidden on print) so
          it still appears when this itinerary is printed or saved as PDF. */}
      {(companyLogoUrl || companyName) && (
        <div className="max-w-4xl mx-auto px-4 pt-6 flex items-center gap-3">
          {companyLogoUrl && <img src={companyLogoUrl} alt={companyName || 'Logo'} className="h-10 object-contain" />}
          {companyName && <span className="font-semibold text-slate-700">{companyName}</span>}
        </div>
      )}

      {/* Hero */}
      <div className="relative h-72 md:h-80 overflow-hidden">
        <img
          src={trip.image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop'}
          alt={trip.name}
          className="w-full h-full object-cover"
          onError={(e) => { const t = /** @type {any} */ (e.target); t.onerror = null; t.src = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">Your Travel Itinerary</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 leading-tight">{trip.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-white/80">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-medium">{trip.destination || 'Destination TBD'}</span>
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
            <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h2 className="text-xl font-semibold text-slate-600 mb-2">No Services Added</h2>
            <p className="text-slate-400">Your itinerary is empty. Services will appear here once added.</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 mb-10">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="text-xs text-slate-500 mb-1">Days</div>
                <div className="text-2xl font-bold text-slate-900">{sortedDays.length}</div>
              </div>
              {trip.notes && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs text-slate-500 mb-1">Notes</div>
                  <div className="text-sm font-medium text-slate-900 line-clamp-2">{trip.notes}</div>
                </div>
              )}
            </div>

            {/* Day-by-day itinerary */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Your Trip Day by Day
              </h2>

              {sortedDays.map((date, idx) => (
                <DaySection key={date} date={date} services={dayServices[date]} dayIndex={idx} />
              ))}
            </div>

            {/* Unscheduled services */}
            {unscheduled.length > 0 && (
              <div className="mt-10">
                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Other Services
                </h2>
                <p className="text-sm text-slate-500 mb-4">These services are not tied to a specific date:</p>
                <div className="space-y-3">
                  {unscheduled.map((svc, idx) => (
                    <ServiceCard key={idx} service={svc} />
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {trip.notes && (
              <div className="mt-10 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-2">Notes</h3>
                <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">{trip.notes}</p>
              </div>
            )}

            {/* Emergency Contact */}
            {(trip.created_by || trip.created_by_phone) && (
              <div className="mt-10 bg-red-50 rounded-xl border border-red-200 p-6">
                <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  Emergency Contact
                </h3>
                <div className="space-y-1 text-sm text-red-800">
                  {trip.created_by_name && trip.created_by_name !== 'Unknown' && (
                    <div className="font-semibold">{trip.created_by_name}</div>
                  )}
                  <div>Your Travel Agent</div>
                  {trip.created_by_phone && (
                    <div>
                      <a href={`tel:${trip.created_by_phone}`} className="underline">{trip.created_by_phone}</a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Terms */}
            {trip.terms_and_conditions && (
              <div className="mt-4 bg-slate-50 rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-2 text-sm">Terms & Conditions</h3>
                <p className="text-slate-500 text-xs whitespace-pre-wrap leading-relaxed">{trip.terms_and_conditions}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-white mt-10">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-slate-400">
          Generated automatically from reservation data.
        </div>
      </div>
    </div>
  );
}
