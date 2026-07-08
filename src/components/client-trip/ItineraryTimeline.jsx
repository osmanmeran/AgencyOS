import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Plane, Hotel, Activity, Car, Utensils, Camera } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useT } from '@/lib/i18n/I18nContext';

const CATEGORY_ICONS = {
  flight: { icon: Plane, color: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300' },
  hotel: { icon: Hotel, color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  transfer: { icon: Car, color: 'bg-muted text-foreground' },
  activity: {
    icon: Activity,
    color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  },
  restaurant: {
    icon: Utensils,
    color: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  },
  sightseeing: {
    icon: Camera,
    color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  },
};

function detectCategory(title = '', description = '') {
  const text = (title + ' ' + description).toLowerCase();
  if (text.includes('flight') || text.includes('airport') || text.includes('fly')) return 'flight';
  if (text.includes('hotel') || text.includes('check-in') || text.includes('checkout') || text.includes('resort'))
    return 'hotel';
  if (text.includes('transfer') || text.includes('taxi') || text.includes('pickup') || text.includes('dropoff'))
    return 'transfer';
  if (text.includes('lunch') || text.includes('dinner') || text.includes('restaurant') || text.includes('breakfast'))
    return 'restaurant';
  if (text.includes('tour') || text.includes('sightseeing') || text.includes('visit') || text.includes('museum'))
    return 'sightseeing';
  return 'activity';
}

const CATEGORY_LABEL_KEYS = {
  flight: 'itineraryTimeline.flight',
  hotel: 'itineraryTimeline.hotel',
  transfer: 'itineraryTimeline.transfer',
  activity: 'itineraryTimeline.activity',
  restaurant: 'itineraryTimeline.dining',
  sightseeing: 'itineraryTimeline.sightseeing',
};

function EventCard({ event }) {
  const { t } = useT();
  const category = detectCategory(event.title, event.description);
  const config = CATEGORY_ICONS[category] || CATEGORY_ICONS.activity;
  const Icon = config.icon;

  return (
    <div className="flex gap-4 group">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${config.color}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="w-px flex-1 bg-muted mt-2" />
      </div>

      <Card className="flex-1 p-4 mb-4 bg-card shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {event.time && (
                <span className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" />
                  {event.time}
                </span>
              )}
              <Badge className={`text-xs ${config.color}`}>
                {t(CATEGORY_LABEL_KEYS[category] || CATEGORY_LABEL_KEYS.activity)}
              </Badge>
            </div>
            <h4 className="font-semibold text-foreground text-base mb-1">{event.title}</h4>
            {event.location && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-muted-foreground text-sm hover:text-blue-600 dark:hover:text-blue-300 transition-colors mb-2"
                onClick={(e) => e.stopPropagation()}
              >
                <MapPin className="w-3 h-3" />
                {event.location}
              </a>
            )}
            {event.description && <p className="text-muted-foreground text-sm leading-relaxed">{event.description}</p>}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ItineraryTimeline({ events = [] }) {
  const { t } = useT();
  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Activity className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
        <p>{t('itineraryTimeline.noEvents')}</p>
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
              <span className="text-xs font-medium opacity-80">{t('itineraryTimeline.day', { n: dayIndex + 1 })}</span>
              <span className="text-sm font-bold">{format(parseISO(date), 'EEE, MMM d')}</span>
            </div>
            <div className="flex-1 h-px bg-muted" />
            <span className="text-xs text-muted-foreground">
              {t(grouped[date].length === 1 ? 'itineraryTimeline.eventSingular' : 'itineraryTimeline.eventPlural', {
                count: grouped[date].length,
              })}
            </span>
          </div>

          {/* Events */}
          <div className="ml-2">
            {grouped[date].map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
