import { db } from '@/lib/DbContext';

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
  format,
  addDays,
  isWithinInterval,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  startOfWeek,
  endOfWeek,
} from 'date-fns';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';

import FlightTakeoffRounded from '@mui/icons-material/FlightTakeoffRounded';
import FlightLandRounded from '@mui/icons-material/FlightLandRounded';
import AssignmentRounded from '@mui/icons-material/AssignmentRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import PlaceRounded from '@mui/icons-material/PlaceRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import RateReviewRounded from '@mui/icons-material/RateReviewRounded';

export default function Dashboard() {
  const today = new Date();
  const nextWeek = addDays(today, 7);
  const next30Days = addDays(today, 30);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));

  const { data: trips = /** @type {any} */ ([]), isLoading: tripsLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['allTrips'],
      queryFn: () => db.entities.Trip.list('-start_date'),
    })
  );

  const isLoading = tripsLoading;

  const { upcomingArrivals, upcomingDepartures, pendingReservations, departingNext7 } = useMemo(() => {
    const upcomingArrivals = trips
      .filter((t) => {
        if (!t.start_date) return false;
        const startDate = parseISO(t.start_date);
        return isWithinInterval(startDate, { start: today, end: next30Days });
      })
      .sort((a, b) => +new Date(a.start_date) - +new Date(b.start_date));

    const upcomingDepartures = trips
      .filter((t) => {
        if (!t.end_date) return false;
        const endDate = parseISO(t.end_date);
        return isWithinInterval(endDate, { start: today, end: next30Days });
      })
      .sort((a, b) => +new Date(a.end_date) - +new Date(b.end_date));

    const pendingReservations = trips
      .filter((t) => (t.proposal_status || 'pending') === 'pending')
      .sort((a, b) => +new Date(a.created_date) - +new Date(b.created_date));

    const departingNext7 = trips
      .filter((t) => {
        if (!t.start_date) return false;
        const startDate = parseISO(t.start_date);
        return isWithinInterval(startDate, { start: today, end: nextWeek });
      })
      .sort((a, b) => +new Date(a.start_date) - +new Date(b.start_date));

    return { upcomingArrivals, upcomingDepartures, pendingReservations, departingNext7 };
  }, [trips]);

  const monthStart = currentMonth;
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getDayEvents = useCallback(
    (day) => {
      const arrivals = trips.filter((t) => t.start_date && isSameDay(parseISO(t.start_date), day));
      const departures = trips.filter((t) => t.end_date && isSameDay(parseISO(t.end_date), day));
      return { arrivals, departures };
    },
    [trips],
  );

  if (isLoading) {
    return (
      <Box sx={{ py: 4 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Welcome back! Here's what's happening with your travel business.
        </Typography>
      </Box>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%', borderLeft: '4px solid', borderColor: 'warning.main' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}
                >
                  <AssignmentRounded fontSize="small" sx={{ color: 'warning.main' }} />
                  Tasks To Do
                </Typography>
                <Chip
                  label={pendingReservations.length}
                  size="small"
                  color="warning"
                  sx={{ height: 22, fontWeight: 700 }}
                />
              </Box>
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {pendingReservations.length === 0 ? (
                  <Box
                    sx={{
                      py: 2,
                      textAlign: 'center',
                      color: 'success.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.5,
                    }}
                  >
                    <CheckCircleRounded fontSize="small" /> All caught up!
                  </Box>
                ) : (
                  pendingReservations.slice(0, 6).map((t) => (
                    <Box
                      key={t.id}
                      component={Link}
                      to={createPageUrl(`ReservationDetails?id=${t.id}`)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        borderRadius: '8px',
                        textDecoration: 'none',
                        color: 'inherit',
                        '&:hover': { bgcolor: 'warning.light' },
                        transition: 'all 0.15s',
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                          {t.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {t.client_name || '—'}
                        </Typography>
                      </Box>
                      <ArrowForwardRounded fontSize="small" sx={{ color: 'text.secondary', ml: 1, flexShrink: 0 }} />
                    </Box>
                  ))
                )}
              </Box>
              {pendingReservations.length > 6 && (
                <Box
                  component={Link}
                  to={createPageUrl('Reservations')}
                  sx={{
                    display: 'block',
                    mt: 1,
                    fontSize: '0.75rem',
                    color: 'warning.main',
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  +{pendingReservations.length - 6} more
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%', borderLeft: '4px solid', borderColor: 'primary.main' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}
                >
                  <FlightTakeoffRounded fontSize="small" sx={{ color: 'primary.main' }} />
                  Departing Soon
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Next 7 days
                </Typography>
              </Box>
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {departingNext7.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No departures this week
                  </Typography>
                ) : (
                  departingNext7.map((t) => (
                    <Box
                      key={t.id}
                      component={Link}
                      to={createPageUrl(`ReservationDetails?id=${t.id}`)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        borderRadius: '8px',
                        textDecoration: 'none',
                        color: 'inherit',
                        '&:hover': { bgcolor: 'primary.light' },
                        transition: 'all 0.15s',
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                          {t.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                        >
                          <PlaceRounded sx={{ fontSize: 12 }} /> {t.destination}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }} color="primary.main">
                          {format(parseISO(t.start_date), 'MMM d')}
                        </Typography>
                        {t.passengers?.length > 0 && (
                          <Typography variant="caption" sx={{ display: 'block' }} color="text.secondary">
                            {t.passengers.length} pax
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%', borderLeft: '4px solid', borderColor: 'primary.main' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography
                variant="subtitle2"
                sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 1.5 }}
              >
                <CheckCircleRounded fontSize="small" sx={{ color: 'primary.main' }} />
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {[
                  { label: 'New Reservation', to: 'CreateReservation', color: 'primary' },
                  { label: 'New Proposal', to: 'CreateProposal', color: 'success' },
                  { label: 'New Invoice', to: 'CreateInvoice', color: 'warning' },
                ].map((action) => (
                  <Box
                    key={action.to}
                    component={Link}
                    to={createPageUrl(action.to)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1,
                      borderRadius: '8px',
                      textDecoration: 'none',
                      color: 'inherit',
                      '&:hover': { bgcolor: `${action.color}.light` },
                      transition: 'all 0.15s',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {action.label}
                    </Typography>
                    <ArrowForwardRounded fontSize="small" sx={{ color: 'text.secondary' }} />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Trip Calendar */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarMonthRounded sx={{ color: 'primary.main' }} />
              Trip Calendar
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                size="small"
                onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                <ChevronLeft />
              </IconButton>
              <Typography variant="subtitle2" sx={{ minWidth: 150, textAlign: 'center' }}>
                {format(currentMonth, 'MMMM yyyy')}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                <ChevronRight />
              </IconButton>
              <Box
                component="button"
                onClick={() => setCurrentMonth(startOfMonth(today))}
                sx={{
                  border: 'none',
                  background: 'none',
                  color: 'primary.main',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Today
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Box
                key={day}
                sx={{ textAlign: 'center', py: 1, fontSize: '0.8125rem', fontWeight: 500, color: 'text.secondary' }}
              >
                {day}
              </Box>
            ))}
            {calendarDays.map((day) => {
              const events = getDayEvents(day);
              const isToday = isSameDay(day, today);
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const hasEvents = events.arrivals.length > 0 || events.departures.length > 0;

              return (
                <Box
                  key={day.toISOString()}
                  sx={{
                    minHeight: 64,
                    p: 0.75,
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: isToday ? 'primary.main' : 'grey.200',
                    bgcolor: isToday ? 'primary.light' : 'background.paper',
                    opacity: isCurrentMonth ? 1 : 0.4,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: isToday ? 700 : 400, color: isToday ? 'primary.main' : 'text.primary' }}
                  >
                    {format(day, 'd')}
                  </Typography>
                  {hasEvents && (
                    <Box sx={{ mt: 0.25, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      {events.arrivals.slice(0, 1).map((t) => (
                        <Box
                          key={t.id}
                          sx={{
                            fontSize: '0.625rem',
                            bgcolor: 'success.light',
                            color: 'success.dark',
                            borderRadius: '3px',
                            px: 0.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ↓ {t.name}
                        </Box>
                      ))}
                      {events.departures.slice(0, 1).map((t) => (
                        <Box
                          key={t.id}
                          sx={{
                            fontSize: '0.625rem',
                            bgcolor: 'error.light',
                            color: 'error.dark',
                            borderRadius: '3px',
                            px: 0.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ↑ {t.name}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>

          {/* Month Recap */}
          <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Confirmed Arrivals — {format(currentMonth, 'MMMM yyyy')}
            </Typography>
            {(() => {
              const confirmedArrivals = trips
                .filter((t) => {
                  if (!t.start_date) return false;
                  const start = parseISO(t.start_date);
                  return (
                    start >= monthStart &&
                    start <= monthEnd &&
                    (t.proposal_status === 'confirmed' || t.status === 'confirmed')
                  );
                })
                .sort((a, b) => +new Date(a.start_date) - +new Date(b.start_date));
              if (confirmedArrivals.length === 0) {
                return (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No confirmed arrivals this month
                  </Typography>
                );
              }
              return (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {confirmedArrivals.map((t) => (
                    <Box
                      key={t.id}
                      component={Link}
                      to={createPageUrl(`ReservationDetails?id=${t.id}`)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        borderRadius: '8px',
                        bgcolor: 'success.light',
                        border: '1px solid',
                        borderColor: 'success.main',
                        textDecoration: 'none',
                        color: 'inherit',
                        '&:hover': { boxShadow: 1 },
                        transition: 'all 0.15s',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                        <CheckCircleRounded sx={{ color: 'success.main', fontSize: 18, flexShrink: 0 }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                            {t.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t.destination || '—'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }} color="success.dark">
                          {format(parseISO(t.start_date), 'MMM d')}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block' }} color="text.secondary">
                          {t.passengers?.length || 0} pax
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
                    {confirmedArrivals.length} confirmed arrival{confirmedArrivals.length > 1 ? 's' : ''}
                  </Typography>
                </Box>
              );
            })()}
          </Box>
        </CardContent>
      </Card>

      {/* Arrivals & Departures */}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <FlightLandRounded sx={{ color: 'success.main' }} />
                Upcoming Arrivals
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {upcomingArrivals.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    No upcoming arrivals
                  </Typography>
                ) : (
                  upcomingArrivals.slice(0, 5).map((trip) => (
                    <Box
                      key={trip.id}
                      component={Link}
                      to={createPageUrl(`ReservationDetails?id=${trip.id}`)}
                      sx={{
                        p: 2,
                        borderRadius: '10px',
                        bgcolor: 'success.light',
                        border: '1px solid',
                        borderColor: 'success.main',
                        textDecoration: 'none',
                        color: 'inherit',
                        '&:hover': { boxShadow: 2 },
                        transition: 'all 0.15s',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {trip.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {trip.destination}
                          </Typography>
                        </Box>
                        <Chip
                          label={format(parseISO(trip.start_date), 'MMM d')}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <FlightTakeoffRounded sx={{ color: 'error.main', transform: 'rotate(-45deg)' }} />
                Upcoming Departures
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {upcomingDepartures.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    No upcoming departures
                  </Typography>
                ) : (
                  upcomingDepartures.slice(0, 5).map((trip) => (
                    <Box
                      key={trip.id}
                      component={Link}
                      to={createPageUrl(`ReservationDetails?id=${trip.id}`)}
                      sx={{
                        p: 2,
                        borderRadius: '10px',
                        bgcolor: 'error.light',
                        border: '1px solid',
                        borderColor: 'error.main',
                        textDecoration: 'none',
                        color: 'inherit',
                        '&:hover': { boxShadow: 2 },
                        transition: 'all 0.15s',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {trip.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {trip.destination}
                          </Typography>
                        </Box>
                        <Chip
                          label={format(parseISO(trip.end_date), 'MMM d')}
                          size="small"
                          color="error"
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Links */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
        {[
          { label: 'Reservations', to: 'Reservations', icon: <FlightTakeoffRounded />, color: 'primary' },
          { label: 'Proposals', to: 'Proposals', icon: <RateReviewRounded />, color: 'success' },
          { label: 'Invoices', to: 'Revenue', icon: <ReceiptLongRounded />, color: 'warning' },
        ].map((link) => (
          <Card
            key={link.to}
            component={Link}
            to={createPageUrl(link.to)}
            sx={{
              p: 2,
              textDecoration: 'none',
              color: 'inherit',
              cursor: 'pointer',
              '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' },
              transition: 'all 0.2s',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    bgcolor: `${link.color}.light`,
                    p: 1,
                    borderRadius: '8px',
                    display: 'flex',
                    color: `${link.color}.main`,
                  }}
                >
                  {link.icon}
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {link.label}
                </Typography>
              </Box>
              <ArrowForwardRounded sx={{ color: 'text.secondary' }} />
            </Box>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
