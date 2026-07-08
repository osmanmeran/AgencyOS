import { db } from '@/lib/DbContext';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, ChevronLeft, ChevronRight, Plane } from 'lucide-react';
import { createPageUrl } from '../utils';
import { useT } from '@/lib/i18n/I18nContext';

const STATUS_COLORS = {
  planning:
    'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  confirmed: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
  in_progress:
    'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-300 dark:border-green-800',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800',
};

export default function CalendarView() {
  const { t } = useT();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['trips'],
      queryFn: () => db.entities.Trip.list(),
    })
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const days = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const eventsByDate = useMemo(() => {
    const map = {};
    trips.forEach((trip) => {
      if (!trip.start_date) return;
      const d = trip.start_date.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(trip);
    });
    return map;
  }, [trips]);

  const selectedEvents = selectedDate ? eventsByDate[format(selectedDate, 'yyyy-MM-dd')] || [] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-blue-100 dark:bg-blue-900/40 p-2.5 rounded-xl">
          <Calendar className="w-6 h-6 text-blue-700 dark:text-blue-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('calendarView.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('calendarView.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
            {t('dashboard.weekdays').map((d) => (
              <div key={d} className="bg-muted px-2 py-1.5 text-center text-xs font-semibold text-muted-foreground">
                {d}
              </div>
            ))}
            {days.map((d) => {
              const dateStr = format(d, 'yyyy-MM-dd');
              const events = eventsByDate[dateStr] || [];
              const isCurrent = isSameDay(d, new Date());
              const isSelected = selectedDate && isSameDay(d, selectedDate);
              const inMonth = isSameMonth(d, currentMonth);
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(selectedDate && isSameDay(d, selectedDate) ? null : d)}
                  className={`bg-card min-h-[80px] p-1.5 text-left transition-colors ${!inMonth ? 'opacity-40' : ''} ${
                    isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''
                  } hover:bg-blue-50 dark:hover:bg-blue-950/40`}
                >
                  <span
                    className={`text-xs font-medium mb-1 block ${
                      isCurrent
                        ? 'bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {format(d, 'd')}
                  </span>
                  {events.length > 0 && (
                    <div className="space-y-0.5">
                      {events.slice(0, 3).map((trip) => (
                        <div
                          key={trip.id}
                          className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${STATUS_COLORS[trip.status] || 'bg-muted'}`}
                        >
                          {trip.name}
                        </div>
                      ))}
                      {events.length > 3 && (
                        <span className="text-[10px] text-blue-600 dark:text-blue-300 font-medium">
                          {t('dashboard.moreCount', { count: events.length - 3 })}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="bg-card p-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
            {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : t('calendarView.selectDate')}
          </h3>
          {selectedEvents.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('calendarView.noTripsOnDate')}</p>
          )}
          <div className="space-y-2">
            {selectedEvents.map((trip) => (
              <a
                key={trip.id}
                href={createPageUrl(`ReservationDetails?id=${trip.id}`)}
                className="block p-3 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{trip.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  <span>{trip.destination}</span>
                  {trip.client_name && (
                    <>
                      <span>·</span>
                      <span>{trip.client_name}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className={`text-[10px] ${STATUS_COLORS[trip.status] || ''}`}>
                    {trip.status === 'confirmed'
                      ? t('common.confirmed')
                      : trip.status === 'cancelled'
                        ? t('common.cancelled')
                        : t(`tripStatus.${trip.status}`)}
                  </Badge>
                  {trip.end_date && (
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d')}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
