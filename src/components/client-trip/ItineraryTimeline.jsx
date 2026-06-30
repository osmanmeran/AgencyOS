import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Plane, Hotel, Activity, Car, Utensils, Camera } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const CATEGORY_CONFIG = {
  flight: { icon: Plane, color: 'bg-sky-100 text-sky-700', label: 'Flight' },
  hotel: { icon: Hotel, color: 'bg-amber-100 text-amber-700', label: 'Hotel' },
  transfer: { icon: Car, color: 'bg-slate-100 text-slate-700', label: 'Transfer' },
  activity: { icon: Activity, color: 'bg-green-100 text-green-700', label: 'Activity' },
  restaurant: { icon: Utensils, color: 'bg-rose-100 text-rose-700', label: 'Dining' },
  sightseeing: { icon: Camera, color: 'bg-purple-100 text-purple-700', label: 'Sightseeing' },
};

function detectCategory(title = '', description = '') {
  const text = (title + ' ' + description).toLowerCase();
  if (text.includes('flight') || text.includes('airport') || text.includes('fly')) return 'flight';
  if (text.includes('hotel') || text.includes('check-in') || text.includes('checkout') || text.includes('resort')) return 'hotel';
  if (text.includes('transfer') || text.includes('taxi') || text.includes('pickup') || text.includes('dropoff')) return 'transfer';
  if (text.includes('lunch') || text.includes('dinner') || text.includes('restaurant') || text.includes('breakfast')) return 'restaurant';
  if (text.includes('tour') || text.includes('sightseeing') || text.includes('visit') || text.includes('museum')) return 'sightseeing';
  return 'activity';
}

function EventCard({ event }) {
  const category = detectCategory(event.title, event.description);
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.activity;
  const Icon = config.icon;

  return (
    <div className="flex gap-4 group">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${config.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="w-px flex-1 bg-slate-200 mt-2" />
      </div>

      <Card className="flex-1 p-4 mb-4 bg-white shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {event.time && (
                <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" />
                  {event.time}
                </span>
              )}
              <Badge className={`text-xs ${config.color}`}>{config.label}</Badge>
            </div>
            <h4 className="font-semibold text-slate-900 text-base mb-1">{event.title}</h4>
            {event.location && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-slate-500 text-sm hover:text-blue-600 transition-colors mb-2"
                onClick={e => e.stopPropagation()}
              >
                <MapPin className="w-3 h-3" />
                {event.location}
              </a>
            )}
            {event.description && (
              <p className="text-slate-600 text-sm leading-relaxed">{event.description}</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ItineraryTimeline({ events = [] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <Activity className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>No itinerary events scheduled yet.</p>
      </div>
    );
  }

  const grouped = events.reduce((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  return (
    <div className="space-y-8">
      {sortedDates.map((date, dayIndex) => (
        <div key={date}>
          {/* Day Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex flex-col items-center bg-blue-600 text-white rounded-xl px-4 py-2 shadow-md min-w-[80px]">
              <span className="text-xs font-medium opacity-80">Day {dayIndex + 1}</span>
              <span className="text-sm font-bold">{format(parseISO(date), 'EEE, MMM d')}</span>
            </div>
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">{grouped[date].length} event{grouped[date].length > 1 ? 's' : ''}</span>
          </div>

          {/* Events */}
          <div className="ml-2">
            {grouped[date].map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}