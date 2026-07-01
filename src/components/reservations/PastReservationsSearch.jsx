import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Calendar, Plane, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { format, parseISO, isBefore } from 'date-fns';

export default function PastReservationsSearch() {
  const [filters, setFilters] = useState({
    reference: '',
    clientId: 'all',
    department: 'all',
    year: 'all',
    startDate: '',
    endDate: ''
  });

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['allTrips'],
    queryFn: () => db.entities.Trip.list('-created_date')
  }));

  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['clients'],
    queryFn: () => db.entities.Client.list()
  }));

  const { data: settings } = /** @type {any} */ (useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => {
      const all = await db.entities.AppSettings.list();
      return all[0] || { departments: [] };
    }
  }));

  const departments = settings?.departments || [];
  const years = [...new Set(trips.map(t => new Date(t.start_date).getFullYear()))].sort((a, b) => b - a);

  // Filter for past trips only
  const pastTrips = trips.filter(trip => {
    const endDate = parseISO(trip.end_date);
    return isBefore(endDate, new Date());
  });

  const filteredTrips = pastTrips.filter(trip => {
    if (filters.reference && !trip.reference_number?.toLowerCase().includes(filters.reference.toLowerCase()) && 
        !trip.name?.toLowerCase().includes(filters.reference.toLowerCase())) {
      return false;
    }
    if (filters.clientId !== 'all' && trip.client_id !== filters.clientId) {
      return false;
    }
    if (filters.department !== 'all' && trip.department !== filters.department) {
      return false;
    }
    if (filters.year !== 'all' && new Date(trip.start_date).getFullYear() !== parseInt(filters.year)) {
      return false;
    }
    if (filters.startDate && trip.start_date < filters.startDate) {
      return false;
    }
    if (filters.endDate && trip.start_date > filters.endDate) {
      return false;
    }
    return true;
  });

  const getClientName = (id) => clients.find(c => c.id === id)?.name || 'N/A';

  const clearFilters = () => {
    setFilters({
      reference: '',
      clientId: 'all',
      department: 'all',
      year: 'all',
      startDate: '',
      endDate: ''
    });
  };

  return (
    <Card className="p-6 bg-white">
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-5 h-5 text-slate-600" />
        <h3 className="font-bold text-slate-900">Search Past Reservations</h3>
      </div>
      
      {/* Always visible search box */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
        <div className="space-y-2 lg:col-span-2">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Reference or name..." 
              value={filters.reference}
              onChange={(e) => setFilters({ ...filters, reference: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Client</Label>
          <Select value={filters.clientId} onValueChange={(v) => setFilters({ ...filters, clientId: v })}>
            <SelectTrigger><SelectValue placeholder="All Clients" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Department</Label>
          <Select value={filters.department} onValueChange={(v) => setFilters({ ...filters, department: v })}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Year</Label>
          <Select value={filters.year} onValueChange={(v) => setFilters({ ...filters, year: v })}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button variant="outline" onClick={clearFilters} className="w-full">Clear</Button>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-3">
        <div className="text-sm text-slate-600">{filteredTrips.length} past reservations found</div>

        {filteredTrips.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            <Plane className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No past reservations found</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredTrips.slice(0, 20).map(trip => (
              <div key={trip.id} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <Plane className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{trip.name}</span>
                        {trip.reference_number && (
                          <Badge variant="outline" className="font-mono text-xs">{trip.reference_number}</Badge>
                        )}
                      </div>
                      <div className="text-sm text-slate-600">
                        {trip.destination} • {getClientName(trip.client_id)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {format(parseISO(trip.start_date), 'MMM d')} - {format(parseISO(trip.end_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <Link to={createPageUrl(`ReservationDetails?id=${trip.id}`)}>
                    <Button variant="ghost" size="sm">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}