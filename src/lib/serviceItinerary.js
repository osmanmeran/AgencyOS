/** Groups a trip's services into a day-by-day itinerary, expanding multi-day
 * services across each date they span and splitting out return legs for
 * transfers. Services without a start_date are returned separately as
 * "unscheduled". Shared by the public itinerary share page and the client
 * portal's Itinerary tab so both stay derived from the same source of truth
 * (trip.services) instead of a separately maintained copy.
 */
export function groupServicesByDay(services) {
  const dayServices = {};
  const unscheduled = [];
  const sorted = [...services].sort((a, b) => {
    const aStart = a.start_date || '';
    const bStart = b.start_date || '';
    if (aStart < bStart) return -1;
    if (aStart > bStart) return 1;
    const aEnd = a.end_date || '';
    const bEnd = b.end_date || '';
    if (aEnd < bEnd) return -1;
    if (aEnd > bEnd) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  const pushReturnLeg = (s) => {
    const returnDate = s.return_leg.date.split('T')[0];
    if (!dayServices[returnDate]) dayServices[returnDate] = [];
    dayServices[returnDate].push({
      ...s,
      name: `${s.name} (Return)`,
      pickup_time: s.return_leg.pickup_time,
      pickup_location: s.return_leg.pickup_location,
      dropoff_location: s.return_leg.dropoff_location,
      transfer_flight_number: s.return_leg.flight_number,
      _isReturnLeg: true,
    });
  };

  sorted.forEach((s) => {
    const isTransferWithReturn =
      (s.category || '').toLowerCase().includes('transfer') && s.return_leg?.enabled && s.return_leg?.date;

    if (s.start_date && s.end_date) {
      const start = s.start_date.split('T')[0];
      const end = s.end_date.split('T')[0];
      const startDt = new Date(start);
      const endDt = new Date(end);
      for (let d = new Date(startDt); d <= endDt; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split('T')[0];
        if (!dayServices[key]) dayServices[key] = [];
        if (d.getTime() === startDt.getTime() || s.unit === 'flat_rate') {
          dayServices[key].push(s);
        }
      }
      if (isTransferWithReturn) pushReturnLeg(s);
    } else if (s.start_date && !s.end_date) {
      const key = s.start_date.split('T')[0];
      if (!dayServices[key]) dayServices[key] = [];
      dayServices[key].push(s);
      if (isTransferWithReturn) pushReturnLeg(s);
    } else {
      unscheduled.push(s);
    }
  });

  const sortedDays = Object.keys(dayServices).sort();
  return { sortedDays, dayServices, unscheduled };
}
