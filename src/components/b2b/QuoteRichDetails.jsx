import { MapPin, Calendar, Users, Star, Plane, ArrowRight, Clock, BedDouble, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useT } from '@/lib/i18n/I18nContext';

const ROOM_LABEL_KEYS = {
  single: 'quoteRichDetails.roomSingle',
  double: 'quoteRichDetails.roomDouble',
  twin: 'quoteRichDetails.roomTwin',
  triple: 'quoteRichDetails.roomTriple',
  quad: 'quoteRichDetails.roomQuad',
  family: 'quoteRichDetails.roomFamily',
};

function fmt(d) {
  if (!d) return '';
  try {
    return format(parseISO(d), 'MMM d, yyyy');
  } catch {
    return d;
  }
}

// Builds a Google Maps link for one or more quote destinations: a direct pin
// for a single stop, or a multi-stop route for several. Falls back to a text
// search when a stop has no stored coordinates.
function destinationMapUrl(quote) {
  const stops = Array.isArray(quote.destinations) ? quote.destinations.filter((d) => d.label) : [];
  const stopQuery = (d) => (d.lat != null && d.lon != null ? `${d.lat},${d.lon}` : encodeURIComponent(d.label));
  if (stops.length > 1) return `https://www.google.com/maps/dir/${stops.map(stopQuery).join('/')}`;
  if (stops.length === 1) return `https://maps.google.com/?q=${stopQuery(stops[0])}`;
  return `https://maps.google.com/?q=${encodeURIComponent(quote.destination)}`;
}

// Trip context captured by the reservation-style quote builder: destination,
// dates and passengers grouped by room. Renders nothing if the quote predates
// the builder (no destination / dates / passengers).
export function QuoteTripInfo({ quote }) {
  const { t } = useT();
  const hasTrip = quote.destination || quote.start_date || quote.end_date;
  const passengers = Array.isArray(quote.passengers) ? quote.passengers : [];
  if (!hasTrip && passengers.length === 0) return null;

  // Group passengers by room, preserving first-seen order.
  const rooms = [];
  const byId = {};
  for (const p of passengers) {
    const key = p.room_id || '_';
    if (!byId[key]) {
      byId[key] = { type: p.room_type, passengers: [] };
      rooms.push(key);
    }
    byId[key].passengers.push(p);
  }

  return (
    <div className="space-y-4">
      {hasTrip && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {quote.destination && (
            <span className="flex items-center gap-1.5 text-foreground">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              {quote.destination}
              <a
                href={destinationMapUrl(quote)}
                target="_blank"
                rel="noopener noreferrer"
                title={t('quoteRichDetails.viewOnMap')}
                className="text-muted-foreground hover:text-blue-600 dark:hover:text-blue-300"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </span>
          )}
          {(quote.start_date || quote.end_date) && (
            <span className="flex items-center gap-1.5 text-foreground">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              {fmt(quote.start_date)}
              {quote.end_date ? ` – ${fmt(quote.end_date)}` : ''}
            </span>
          )}
          {passengers.length > 0 && (
            <span className="flex items-center gap-1.5 text-foreground">
              <Users className="w-4 h-4 text-muted-foreground" />
              {t(passengers.length === 1 ? 'quoteRichDetails.passengerSingular' : 'quoteRichDetails.passengerPlural', {
                count: passengers.length,
              })}
            </span>
          )}
        </div>
      )}

      {rooms.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rooms.map((key, ri) => {
            const room = byId[key];
            return (
              <div key={key} className="border border-border rounded-lg p-3 bg-muted">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {t('quoteRichDetails.roomNumber', { n: ri + 1 })}
                  {room.type
                    ? ` · ${room.type && ROOM_LABEL_KEYS[room.type] ? t(ROOM_LABEL_KEYS[room.type]) : room.type}`
                    : ''}
                </div>
                <ul className="space-y-1">
                  {room.passengers.map((p, pi) => (
                    <li key={pi} className="text-sm text-foreground flex items-center gap-1.5">
                      {p.is_contact && (
                        <Star className="w-3 h-3 text-green-500 dark:text-green-300" fill="currentColor" />
                      )}
                      <span className={p.is_contact ? 'font-medium' : ''}>
                        {p.name || (
                          <span className="text-muted-foreground italic">{t('quoteRichDetails.unnamed')}</span>
                        )}
                      </span>
                      {p.age_category && p.age_category !== 'adult' && (
                        <span className="text-xs text-muted-foreground">({p.age_category})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Per-line trip details (nights, room type, transfer logistics, free notes).
// Renders nothing when the line carries none of them.
export function QuoteLineExtras({ item }) {
  const { t } = useT();
  const bits = [];
  if (item.start_date || item.end_date) {
    const nightsText = item.nights
      ? ` · ${t(item.nights === 1 ? 'quoteRichDetails.nightSingular' : 'quoteRichDetails.nightPlural', { count: item.nights })}`
      : '';
    bits.push({
      icon: Calendar,
      text: `${fmt(item.start_date)}${item.end_date ? ` – ${fmt(item.end_date)}` : ''}${nightsText}`,
    });
  }
  if (item.room_type) bits.push({ icon: BedDouble, text: item.room_type });
  if (item.pickup_location || item.dropoff_location) {
    bits.push({ icon: ArrowRight, text: `${item.pickup_location || '?'} → ${item.dropoff_location || '?'}` });
  }
  if (item.flight_number) bits.push({ icon: Plane, text: item.flight_number });
  if (item.service_time) bits.push({ icon: Clock, text: item.service_time });

  if (bits.length === 0 && !item.details) return null;

  return (
    <div className="mt-1.5 space-y-1">
      {bits.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {bits.map((b, i) => {
            const Icon = b.icon;
            return (
              <span key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                <Icon className="w-3 h-3 text-muted-foreground" />
                {b.text}
              </span>
            );
          })}
        </div>
      )}
      {item.details && <p className="text-xs text-muted-foreground italic">“{item.details}”</p>}
    </div>
  );
}
