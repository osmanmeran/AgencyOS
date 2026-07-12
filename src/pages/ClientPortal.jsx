import { db } from '@/lib/DbContext';

import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonStats } from '@/components/ui/skeletons';
import {
  FileText,
  Plane,
  DollarSign,
  ArrowRight,
  Building2,
  Compass,
  Car,
  ArrowRightLeft,
  CalendarDays,
  MapPin,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, parseISO, isBefore, differenceInDays } from 'date-fns';
import { getActAsClientId, useActAsClientId } from '@/lib/actAsClient';
import { useT } from '@/lib/i18n/I18nContext';
import { sym } from '@/lib/formatters';
import { getCatalog } from '@/lib/b2bApi';
import { isLodgingCategory, locationOf } from '@/lib/hotelPricing';
import { useUpcomingTrip } from '@/hooks/useUpcomingTrip';
import HotelSearchBar from '@/components/hotelSearch/HotelSearchBar';
import CarRentalSearchBar, { SAME_AS_PICKUP } from '@/components/carRental/CarRentalSearchBar';
import TransferSearchBar from '@/components/transfer/TransferSearchBar';

// Hero category pills. Hotels, car rental, and transfers each have their own
// dedicated destination -> results -> confirm page (ClientHotelSearch.jsx,
// ClientCarRentalSearch.jsx, ClientTransferSearch.jsx — see handleHeroSearch
// and the hero render branch below) and a matching guided search bar whose
// fields map onto that page's own query params. Tours has no dedicated page
// yet, so it still routes into ClientQuoteBuilder's generic picker with the
// category pre-selected (the fallback "coming soon" CTA branch).
const CATEGORIES = [
  { key: 'hotels', icon: Building2, labelKey: 'clientPortal.categoryHotels' },
  { key: 'daily_tours', icon: Compass, labelKey: 'clientPortal.categoryDailyTours' },
  { key: 'multi_day_tours', icon: CalendarDays, labelKey: 'clientPortal.categoryMultiDayTours' },
  { key: 'transfers', icon: ArrowRightLeft, labelKey: 'clientPortal.categoryTransfers' },
  { key: 'car_rental', icon: Car, labelKey: 'clientPortal.categoryCarRental' },
];

/** Location label for a tour (daily: single location; multi-day: route). */
function tourLocationLabel(tour) {
  return tour.mode === 'multiday'
    ? [tour.startLocation, tour.endLocation].filter(Boolean).join(' → ')
    : tour.location || '';
}

/** Weekly departure dates for a multi-day tour, or a single date if not repeating. */
function getTourDepartureDates(tour) {
  if (tour.repeatWeekly && tour.repeatStart && tour.repeatEnd) {
    const dates = [];
    const cur = new Date(tour.repeatStart);
    const end = new Date(tour.repeatEnd);
    if (!Number.isNaN(cur.getTime()) && !Number.isNaN(end.getTime())) {
      while (cur <= end) {
        dates.push(
          `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
        );
        cur.setDate(cur.getDate() + 7);
      }
      if (dates.length) return dates;
    }
  }
  return tour.departureDate ? [tour.departureDate] : [];
}

/** Whether a tour can depart / operate on the given ISO date (empty date = always). */
function isTourAvailableOn(tour, dateStr) {
  if (!dateStr) return true;
  if (tour.mode !== 'multiday') return true; // daily tours run every day
  return getTourDepartureDates(tour).includes(dateStr);
}

const PROPOSAL_STATUS_BADGE = {
  sent: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  accepted: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  rejected: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
};

function StatTile({ icon: Icon, label, value, gradient, sub = undefined }) {
  return (
    <Card className={`p-4 bg-gradient-to-br ${gradient} text-white`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs opacity-90">{label}</span>
        <Icon className="w-4 h-4 opacity-80" />
      </div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-[11px] opacity-90 mt-0.5">{sub}</div>}
    </Card>
  );
}

export default function ClientPortal() {
  const { t } = useT();
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);
  const [client, setClient] = React.useState(null);
  const actAsClientId = useActAsClientId();

  const [activeCategory, setActiveCategory] = React.useState('hotels');
  const [destinationQuery, setDestinationQuery] = React.useState('');
  const [checkIn, setCheckIn] = React.useState('');
  const [checkOut, setCheckOut] = React.useState('');
  const [guests, setGuests] = React.useState(2);

  const [pickupLocation, setPickupLocation] = React.useState('');
  const [dropoffLocation, setDropoffLocation] = React.useState(SAME_AS_PICKUP);
  const [pickupDate, setPickupDate] = React.useState('');
  const [dropoffDate, setDropoffDate] = React.useState('');

  const [fromLocation, setFromLocation] = React.useState('');
  const [toLocation, setToLocation] = React.useState('');
  const [transferPassengers, setTransferPassengers] = React.useState(2);

  const [tourDate, setTourDate] = React.useState('');
  const [tourDestination, setTourDestination] = React.useState('');

  React.useEffect(() => {
    db.auth.me().then(async (currentUser) => {
      setUser(currentUser);
      // Staff viewing the portal "as" a client resolve that client instead of
      // their own (they have none). Prefer the authoritative client_id from
      // the JWT otherwise — email matching alone silently fails whenever the
      // portal login email differs from the CRM contact's email.
      let resolved = null;
      const asClientId = getActAsClientId();
      if (asClientId && currentUser.user_tier !== 'client') {
        resolved = await db.entities.Client.get(asClientId).catch(() => null);
      } else {
        if (currentUser.client_id) {
          resolved = await db.entities.Client.get(currentUser.client_id).catch(() => null);
        }
        if (!resolved && currentUser.email) {
          const clients = await db.entities.Client.filter({ email: currentUser.email });
          resolved = clients[0] || null;
        }
      }
      setClient(resolved);
    });
  }, [actAsClientId]);

  const { data: proposals = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['myProposals', client?.id],
      queryFn: () => db.entities.Proposal.filter({ client_id: client.id }),
      enabled: !!client,
    })
  );

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['myTrips', client?.id],
      queryFn: () => db.entities.Trip.filter({ client_id: client.id }),
      enabled: !!client,
    })
  );

  // Public tour catalog (descriptions + cover photos) — readable by all
  // authenticated users, including client-portal accounts.
  const { data: tours = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['portalTours'],
      queryFn: () => db.entities.GuidedTour.list(),
    })
  );

  const { data: payments = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['myPayments', client?.id],
      queryFn: () => db.entities.ClientPayment.filter({ client_id: client.id }),
      enabled: !!client,
    })
  );

  const { data: invoices = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['myInvoices', client?.id],
      queryFn: () => db.entities.Invoice.filter({ client_id: client.id }),
      enabled: !!client,
    })
  );

  // Same query key/fetcher ClientQuoteBuilder uses for its catalog, so
  // react-query shares the cached result if the client lands there next.
  const { data: catalog } = /** @type {any} */ (
    useQuery({
      queryKey: ['b2bCatalog'],
      queryFn: getCatalog,
      enabled: !!client,
    })
  );

  // Destination suggestions are restricted to locations that actually have
  // hotel inventory (not free text) — matches how the guided hotel search in
  // ClientQuoteBuilder's picker groups results by city/area.
  const hotelLocations = React.useMemo(() => {
    const items = catalog?.items || [];
    const locations = new Set();
    for (const item of items) {
      if (isLodgingCategory(item.category_name)) locations.add(locationOf(item));
    }
    return [...locations].sort((a, b) => a.localeCompare(b));
  }, [catalog]);

  const pendingInvoices = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled');
  const overdueInvoices = pendingInvoices.filter((i) => isBefore(parseISO(i.due_date), new Date()));

  // Soonest upcoming trip (today or later), for the "Continue planning" card.
  const upcomingTrip = useUpcomingTrip(client?.id);
  const daysUntilTrip = upcomingTrip ? differenceInDays(parseISO(upcomingTrip.start_date), new Date()) : null;

  // Tours catalog search: only relevant when a tour pill is active. Filters by
  // mode (daily vs multi-day), the selected date's availability, and an optional
  // destination/location query.
  const isTourSearchActive = activeCategory === 'daily_tours' || activeCategory === 'multi_day_tours';
  const visibleTours = React.useMemo(() => {
    if (!isTourSearchActive) return [];
    const wantedMode = activeCategory === 'daily_tours' ? 'daily' : 'multiday';
    const q = tourDestination.trim().toLowerCase();
    return tours.filter(
      (tour) =>
        tour.mode === wantedMode &&
        isTourAvailableOn(tour, tourDate) &&
        (!q || (tour.name || '').toLowerCase().includes(q) || tourLocationLabel(tour).toLowerCase().includes(q)),
    );
  }, [isTourSearchActive, activeCategory, tours, tourDate, tourDestination]);

  const goToQuoteBuilder = (categoryKey, opts = {}) => {
    const params = new URLSearchParams({ category: categoryKey });
    if (opts.destination) params.set('destination', opts.destination);
    if (opts.checkIn) params.set('checkin', opts.checkIn);
    if (opts.checkOut) params.set('checkout', opts.checkOut);
    if (opts.guests) params.set('guests', String(opts.guests));
    navigate(createPageUrl(`ClientQuoteBuilder?${params.toString()}`));
  };

  const activeCat = CATEGORIES.find((c) => c.key === activeCategory);
  const handleHeroSearch = () => {
    if (activeCategory === 'hotels') {
      // Hotels get a dedicated, Expedia-style results page instead of the
      // quote builder's dropdown-driven picker. Only hand off a destination
      // that matches real hotel inventory — free text the client typed but
      // never picked from the suggestions wouldn't match anything there.
      const matchedDestination = hotelLocations.find(
        (loc) => loc.toLowerCase() === destinationQuery.trim().toLowerCase(),
      );
      const params = new URLSearchParams();
      if (matchedDestination) params.set('destination', matchedDestination);
      if (checkIn) params.set('checkin', checkIn);
      if (checkOut) params.set('checkout', checkOut);
      if (guests) params.set('guests', String(guests));
      navigate(createPageUrl(`ClientHotelSearch?${params.toString()}`));
    } else if (activeCategory === 'car_rental') {
      const params = new URLSearchParams();
      if (pickupLocation) params.set('pickup', pickupLocation);
      if (dropoffLocation && dropoffLocation !== SAME_AS_PICKUP) params.set('dropoff', dropoffLocation);
      if (pickupDate) params.set('pickupdate', pickupDate);
      if (dropoffDate) params.set('dropoffdate', dropoffDate);
      navigate(createPageUrl(`ClientCarRentalSearch?${params.toString()}`));
    } else if (activeCategory === 'transfers') {
      const params = new URLSearchParams();
      if (fromLocation) params.set('from', fromLocation);
      if (toLocation) params.set('to', toLocation);
      if (transferPassengers) params.set('passengers', String(transferPassengers));
      navigate(createPageUrl(`ClientTransferSearch?${params.toString()}`));
    } else if (activeCategory === 'daily_tours' || activeCategory === 'multi_day_tours') {
      // Tours are searched in-place on the portal (date + destination filter
      // the catalog rendered below); no separate results page is needed.
      return;
    } else {
      goToQuoteBuilder(activeCategory);
    }
  };

  if (!user) {
    return <SkeletonStats />;
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <Card className="max-w-md mx-auto p-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">{t('clientPortal.welcomeSetupTitle')}</h2>
          <p className="text-muted-foreground">{t('clientPortal.welcomeSetupBody')}</p>
        </Card>
      </div>
    );
  }

  const currencySymbol = sym(client.preferred_currency || 'USD');
  const totalPaid = payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-1">{t('clientPortal.welcomeBack')}</p>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          {t('clientPortal.heroHeadline', { name: client.name })}
        </h1>
      </div>

      {/* Hero search card */}
      <Card className="p-6 md:p-8 bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-md space-y-5">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  active
                    ? 'bg-card text-primary'
                    : 'bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t(cat.labelKey)}
              </button>
            );
          })}
        </div>

        {activeCategory === 'hotels' ? (
          <HotelSearchBar
            hotelLocations={hotelLocations}
            destinationQuery={destinationQuery}
            onDestinationChange={setDestinationQuery}
            checkIn={checkIn}
            onCheckInChange={setCheckIn}
            checkOut={checkOut}
            onCheckOutChange={setCheckOut}
            guests={guests}
            onGuestsChange={setGuests}
            onSearch={handleHeroSearch}
          />
        ) : activeCategory === 'car_rental' ? (
          <CarRentalSearchBar
            pickupLocation={pickupLocation}
            onPickupLocationChange={setPickupLocation}
            dropoffLocation={dropoffLocation}
            onDropoffLocationChange={setDropoffLocation}
            pickupDate={pickupDate}
            onPickupDateChange={setPickupDate}
            dropoffDate={dropoffDate}
            onDropoffDateChange={setDropoffDate}
            onSearch={handleHeroSearch}
          />
        ) : activeCategory === 'transfers' ? (
          <TransferSearchBar
            fromLocation={fromLocation}
            onFromLocationChange={setFromLocation}
            toLocation={toLocation}
            onToLocationChange={setToLocation}
            passengers={transferPassengers}
            onPassengersChange={setTransferPassengers}
            onSearch={handleHeroSearch}
          />
        ) : activeCategory === 'daily_tours' || activeCategory === 'multi_day_tours' ? (
          <div className="bg-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-foreground/80 mb-1">{t('clientPortal.tourDate')}</label>
              <Input type="date" value={tourDate} onChange={(e) => setTourDate(e.target.value)} />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-foreground/80 mb-1">
                {t('clientPortal.tourDestination')}
              </label>
              <Input
                type="text"
                placeholder={t('clientPortal.tourDestinationPlaceholder')}
                value={tourDestination}
                onChange={(e) => setTourDestination(e.target.value)}
              />
            </div>
            <Button onClick={handleHeroSearch} className="shrink-0">
              {t('clientPortal.searchTours')}
            </Button>
          </div>
        ) : (
          <div className="bg-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-foreground/80">
              {t('clientPortal.comingSoonSearch', { category: t(activeCat.labelKey) })}
            </p>
            <Button onClick={handleHeroSearch} className="shrink-0">
              {t('clientPortal.startRequest')}
            </Button>
          </div>
        )}
      </Card>

      {/* Continue planning */}
      {upcomingTrip && (
        <Card className="p-5 bg-card shadow-md">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">{t('clientPortal.continuePlanning')}</h2>
          <Link to={createPageUrl(`ClientTripDetails?id=${upcomingTrip.id}`)} className="flex items-center gap-4 group">
            <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-primary/10 flex items-center justify-center">
              {upcomingTrip.image_url ? (
                <img src={upcomingTrip.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Plane className="w-7 h-7 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{upcomingTrip.name}</h3>
              <p className="text-sm text-muted-foreground">
                {format(parseISO(upcomingTrip.start_date), 'MMM d')} –{' '}
                {format(parseISO(upcomingTrip.end_date), 'MMM d, yyyy')}
              </p>
              <p className="text-sm font-medium text-primary mt-0.5">
                {daysUntilTrip === 0
                  ? t('clientPortal.departsToday')
                  : t('clientPortal.departsInDays', { count: daysUntilTrip })}
              </p>
            </div>
            <Button variant="outline" className="shrink-0 hidden sm:inline-flex">
              {t('clientPortal.viewItinerary')} <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </Card>
      )}

      {/* Condensed stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          icon={FileText}
          label={t('clientPortal.totalProposals')}
          value={proposals.length}
          gradient="from-blue-500 to-blue-600"
        />
        <StatTile
          icon={Plane}
          label={t('clientPortal.activeTrips')}
          value={trips.length}
          gradient="from-green-500 to-green-600"
        />
        <StatTile
          icon={DollarSign}
          label={t('clientPortal.totalPaid')}
          value={`${currencySymbol}${totalPaid.toFixed(2)}`}
          gradient="from-purple-500 to-purple-600"
        />
        <StatTile
          icon={DollarSign}
          label={t('clientPortal.amountOwed')}
          value={`${currencySymbol}${(client.total_owed || 0).toFixed(2)}`}
          gradient="from-orange-500 to-orange-600"
          sub={
            overdueInvoices.length > 0 ? t('clientPortal.overdueAmount', { count: overdueInvoices.length }) : undefined
          }
        />
      </div>

      {/* Recent proposals grid */}
      <Card className="p-6 bg-card shadow-md">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold text-foreground">{t('clientPortal.recentProposals')}</h2>
          <Link to={createPageUrl('ClientProposals')}>
            <span className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium">
              {t('clientPortal.viewAll')}
            </span>
          </Link>
        </div>

        {proposals.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t('clientPortal.noProposalsYet')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {proposals.slice(0, 3).map((proposal) => {
              const nights =
                proposal.start_date && proposal.end_date
                  ? differenceInDays(parseISO(proposal.end_date), parseISO(proposal.start_date))
                  : null;
              const subtitle =
                [
                  nights != null ? t('common.daysCount', { count: nights }) : null,
                  proposal.num_travelers
                    ? t(
                        proposal.num_travelers > 1
                          ? 'clientProposals.travelerPlural'
                          : 'clientProposals.travelerSingular',
                        { count: proposal.num_travelers },
                      )
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || proposal.destination;
              return (
                <Link key={proposal.id} to={createPageUrl(`ClientProposalDetails?id=${proposal.id}`)}>
                  <div className="border border-border rounded-xl overflow-hidden hover:shadow-lg hover:border-primary/40 transition-all h-full flex flex-col">
                    <div className="h-28 bg-primary/10 flex items-center justify-center">
                      <Plane className="w-8 h-8 text-primary" />
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-semibold text-foreground mb-1 truncate">{proposal.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{subtitle}</p>
                      <div className="mt-auto flex items-center justify-between">
                        <span className="font-bold text-green-700 dark:text-green-300">
                          {currencySymbol}
                          {(proposal.total_cost || 0).toFixed(2)}
                        </span>
                        <Badge className={PROPOSAL_STATUS_BADGE[proposal.status] || 'bg-muted text-foreground'}>
                          {proposal.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* Tour catalog search results — driven by the daily / multi-day tour
          pills and the date + destination filter in the hero. */}
      {isTourSearchActive && (
        <Card className="p-6 bg-card shadow-md">
          <div className="flex justify-between items-center mb-5 gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-foreground">
              {activeCategory === 'daily_tours' ? t('nav.dailyTours') : t('nav.multiDayTours')}
            </h2>
            {tourDate && <Badge variant="secondary">{t('clientPortal.availableOn', { date: tourDate })}</Badge>}
          </div>
          {visibleTours.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('clientPortal.noToursForDate')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {visibleTours.map((tour) => (
                <div key={tour.id} className="border border-border rounded-xl overflow-hidden flex flex-col">
                  {tour.coverImage ? (
                    <img src={tour.coverImage} alt={tour.name} className="w-full h-48 object-cover" />
                  ) : (
                    <div className="h-48 bg-primary/10 flex items-center justify-center">
                      <Compass className="w-10 h-10 text-primary" />
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg text-foreground">{tour.name}</h3>
                      <Badge variant="secondary">
                        {tour.mode === 'multiday' ? t('nav.multiDayTours') : t('nav.dailyTours')}
                      </Badge>
                    </div>
                    {tourLocationLabel(tour) && (
                      <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {tourLocationLabel(tour)}
                      </p>
                    )}
                    {tour.description && (
                      <p className="text-sm text-muted-foreground mb-3 whitespace-pre-line">{tour.description}</p>
                    )}
                    {tour.mode === 'multiday' &&
                      Array.isArray(tour.dayDescriptions) &&
                      tour.dayDescriptions.length > 0 && (
                        <div className="space-y-3 mt-auto">
                          {tour.dayDescriptions.map((day, i) => (
                            <div key={i} className="flex gap-3">
                              {day.image ? (
                                <img
                                  src={day.image}
                                  alt=""
                                  className="w-16 h-16 object-cover rounded-md border shrink-0"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-md border border-dashed flex items-center justify-center text-muted-foreground text-[10px] shrink-0">
                                  Day {i + 1}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground">
                                  {t('tours.day')} {i + 1}
                                </p>
                                {day.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-3">{day.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
