import { db } from '@/lib/DbContext';

import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SkeletonStats } from '@/components/ui/skeletons';
import {
  FileText,
  Plane,
  DollarSign,
  ArrowRight,
  MapPin,
  Users,
  Search,
  Building2,
  Compass,
  Car,
  ArrowRightLeft,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, parseISO, isBefore, differenceInDays } from 'date-fns';
import { getActAsClientId, useActAsClientId } from '@/lib/actAsClient';
import { useT } from '@/lib/i18n/I18nContext';
import { sym } from '@/lib/formatters';
import { getCatalog } from '@/lib/b2bApi';
import { isLodgingCategory, locationOf } from '@/lib/hotelPricing';

// Hero category pills. Only "hotels" has a guided search flow (destination ->
// dates -> rooms -> matched results, built in ClientQuoteBuilder.jsx's service
// picker); the others route into that same picker with the category
// pre-selected via a URL param, which is the "reasonably easy" middle ground
// called for in the redesign doc rather than a full guided flow per category.
const CATEGORIES = [
  { key: 'hotels', icon: Building2, labelKey: 'clientPortal.categoryHotels', guided: true },
  { key: 'tours', icon: Compass, labelKey: 'clientPortal.categoryTours', guided: false },
  { key: 'transfers', icon: ArrowRightLeft, labelKey: 'clientPortal.categoryTransfers', guided: false },
  { key: 'car_rental', icon: Car, labelKey: 'clientPortal.categoryCarRental', guided: false },
];

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
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [checkIn, setCheckIn] = React.useState('');
  const [checkOut, setCheckOut] = React.useState('');
  const [guests, setGuests] = React.useState(2);

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
  const filteredLocations = React.useMemo(() => {
    const q = destinationQuery.trim().toLowerCase();
    const matches = q ? hotelLocations.filter((loc) => loc.toLowerCase().includes(q)) : hotelLocations;
    return matches.slice(0, 8);
  }, [hotelLocations, destinationQuery]);

  const pendingInvoices = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled');
  const overdueInvoices = pendingInvoices.filter((i) => isBefore(parseISO(i.due_date), new Date()));

  // Soonest upcoming trip (today or later), for the "Continue planning" card.
  const upcomingTrip = React.useMemo(() => {
    const candidates = trips
      .filter((trip) => trip.status !== 'cancelled' && trip.start_date)
      .filter((trip) => differenceInDays(parseISO(trip.start_date), new Date()) >= 0)
      .sort((a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime());
    return candidates[0] || null;
  }, [trips]);
  const daysUntilTrip = upcomingTrip ? differenceInDays(parseISO(upcomingTrip.start_date), new Date()) : null;

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
    if (activeCat?.guided) {
      // Only hand off a destination that matches real hotel inventory —
      // free text the client typed but never picked from the suggestions
      // wouldn't match anything in the picker's location list anyway.
      const matchedDestination = hotelLocations.find(
        (loc) => loc.toLowerCase() === destinationQuery.trim().toLowerCase(),
      );
      goToQuoteBuilder(activeCategory, { destination: matchedDestination || '', checkIn, checkOut, guests });
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

        {activeCat?.guided ? (
          <div className="bg-card text-foreground rounded-xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4 space-y-1 relative">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {t('clientPortal.searchDestinationPlaceholder')}
              </Label>
              <Input
                value={destinationQuery}
                onChange={(e) => {
                  setDestinationQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setShowSuggestions(false)}
                placeholder={t('clientPortal.searchDestinationPlaceholder')}
                autoComplete="off"
              />
              {showSuggestions && filteredLocations.length > 0 && (
                <div className="absolute z-20 top-full mt-1 w-full bg-popover text-popover-foreground border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {filteredLocations.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setDestinationQuery(loc);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">{t('clientPortal.searchCheckIn')}</Label>
              <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">{t('clientPortal.searchCheckOut')}</Label>
              <Input
                type="date"
                value={checkOut}
                min={checkIn || undefined}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {t('clientPortal.searchGuests')}
              </Label>
              <Input
                type="number"
                min={1}
                value={guests}
                onChange={(e) => setGuests(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div className="md:col-span-2">
              <Button className="w-full" onClick={handleHeroSearch}>
                <Search className="w-4 h-4 mr-1.5" /> {t('clientPortal.searchButton')}
              </Button>
            </div>
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

      {/* Quick category tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => goToQuoteBuilder(cat.key)}
              className="flex flex-col items-center gap-2 p-5 bg-card border border-border rounded-xl hover:shadow-md hover:border-primary/40 transition-all"
            >
              <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-foreground">{t(cat.labelKey)}</span>
            </button>
          );
        })}
      </div>

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
    </div>
  );
}
