const db = globalThis.__B44_DB__ || { auth: { isAuthenticated: async () => false, me: async () => null }, entities: new Proxy({}, { get: () => ({ filter: async () => [], list: async () => [], get: async () => null, create: async () => ({}), update: async () => ({}), delete: async () => ({}) }) }), integrations: { Core: { UploadFile: async () => ({ file_url: '' }) } } };

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, ChevronLeft, ChevronRight, Plane, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createPageUrl } from '../utils';

const STATUS_COLORS = {
  planning: 'bg-amber-100 text-amber-800 border-amber-300',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-green-100 text-green-800 border-green-300',
  completed: 'bg-slate-100 text-slate-600 border-slate-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const { data: trips = [] } = useQuery({
    queryKey: ['trips'],
    queryFn: () => db.entities.Trip.list(),
  });

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
    trips.forEach(trip => {
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
        <div className="bg-blue-100 p-2.5 rounded-xl">
          <Calendar className="w-6 h-6 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-sm text-slate-500">Trip schedule overview</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="bg-slate-50 px-2 py-1.5 text-center text-xs font-semibold text-slate-500">
                {d}
              </div>
            ))}
            {days.map(d => {
              const dateStr = format(d, 'yyyy-MM-dd');
              const events = eventsByDate[dateStr] || [];
              const isCurrent = isSameDay(d, new Date());
              const isSelected = selectedDate && isSameDay(d, selectedDate);
              const inMonth = isSameMonth(d, currentMonth);
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(selectedDate && isSameDay(d, selectedDate) ? null : d)}
                  className={`bg-white min-h-[80px] p-1.5 text-left transition-colors ${
                    !inMonth ? 'opacity-40' : ''
                  } ${
                    isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''
                  } hover:bg-blue-50`}
                >
                  <span className={`text-xs font-medium mb-1 block ${
                    isCurrent ? 'bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center' : 'text-slate-600'
                  }`}>
                    {format(d, 'd')}
                  </span>
                  {events.length > 0 && (
                    <div className="space-y-0.5">
                      {events.slice(0, 3).map(trip => (
                        <div key={trip.id} className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${STATUS_COLORS[trip.status] || 'bg-slate-100'}`}>
                          {trip.name}
                        </div>
                      ))}
                      {events.length > 3 && (
                        <span className="text-[10px] text-blue-600 font-medium">+{events.length - 3} more</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="bg-white p-4">
          <h3 className="font-semibold text-sm text-slate-500 uppercase tracking-wider mb-3">
            {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
          </h3>
          {selectedEvents.length === 0 && (
            <p className="text-sm text-slate-400 py-8 text-center">No trips on this date</p>
          )}
          <div className="space-y-2">
            {selectedEvents.map(trip => (
              <a key={trip.id} href={createPageUrl(`TripDetails?id=${trip.id}`)} className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-sm">{trip.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                  <span>{trip.destination}</span>
                  {trip.client_name && <><span>·</span><span>{trip.client_name}</span></>}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className={`text-[10px] ${STATUS_COLORS[trip.status] || ''}`}>
                    {trip.status?.replace('_', ' ')}
                  </Badge>
                  {trip.end_date && (
                    <span className="text-[10px] text-slate-400">
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
