import { MapPin, Calendar, Users, Star, Plane, ArrowRight, Clock, BedDouble } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const ROOM_LABELS = { single: 'Single', double: 'Double', twin: 'Twin', triple: 'Triple', quad: 'Quad', family: 'Family' };

function fmt(d) {
  if (!d) return '';
  try { return format(parseISO(d), 'MMM d, yyyy'); } catch { return d; }
}

// Trip context captured by the reservation-style quote builder: destination,
// dates and passengers grouped by room. Renders nothing if the quote predates
// the builder (no destination / dates / passengers).
export function QuoteTripInfo({ quote }) {
  const hasTrip = quote.destination || quote.start_date || quote.end_date;
  const passengers = Array.isArray(quote.passengers) ? quote.passengers : [];
  if (!hasTrip && passengers.length === 0) return null;

  // Group passengers by room, preserving first-seen order.
  const rooms = [];
  const byId = {};
  for (const p of passengers) {
    const key = p.room_id || '_';
    if (!byId[key]) { byId[key] = { type: p.room_type, passengers: [] }; rooms.push(key); }
    byId[key].passengers.push(p);
  }

  return (
    <div className="space-y-4">
      {hasTrip && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {quote.destination && (
            <span className="flex items-center gap-1.5 text-slate-700">
              <MapPin className="w-4 h-4 text-slate-400" />{quote.destination}
            </span>
          )}
          {(quote.start_date || quote.end_date) && (
            <span className="flex items-center gap-1.5 text-slate-700">
              <Calendar className="w-4 h-4 text-slate-400" />
              {fmt(quote.start_date)}{quote.end_date ? ` – ${fmt(quote.end_date)}` : ''}
            </span>
          )}
          {passengers.length > 0 && (
            <span className="flex items-center gap-1.5 text-slate-700">
              <Users className="w-4 h-4 text-slate-400" />{passengers.length} passenger{passengers.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {rooms.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rooms.map((key, ri) => {
            const room = byId[key];
            return (
              <div key={key} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Room {ri + 1}{room.type ? ` · ${ROOM_LABELS[room.type] || room.type}` : ''}
                </div>
                <ul className="space-y-1">
                  {room.passengers.map((p, pi) => (
                    <li key={pi} className="text-sm text-slate-700 flex items-center gap-1.5">
                      {p.is_contact && <Star className="w-3 h-3 text-green-500" fill="currentColor" />}
                      <span className={p.is_contact ? 'font-medium' : ''}>{p.name || <span className="text-slate-400 italic">Unnamed</span>}</span>
                      {p.age_category && p.age_category !== 'adult' && <span className="text-xs text-slate-400">({p.age_category})</span>}
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
  const bits = [];
  if (item.start_date || item.end_date) {
    bits.push({ icon: Calendar, text: `${fmt(item.start_date)}${item.end_date ? ` – ${fmt(item.end_date)}` : ''}${item.nights ? ` · ${item.nights} night${item.nights !== 1 ? 's' : ''}` : ''}` });
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
              <span key={i} className="flex items-center gap-1 text-xs text-slate-500">
                <Icon className="w-3 h-3 text-slate-400" />{b.text}
              </span>
            );
          })}
        </div>
      )}
      {item.details && <p className="text-xs text-slate-500 italic">“{item.details}”</p>}
    </div>
  );
}
