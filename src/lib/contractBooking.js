// Resolves a TourContract (fixed itinerary + pax-based pricing tiers) plus a
// departure date / participant count / selected client extras into a Trip
// payload shaped exactly like the one CreateReservation.jsx produces, so the
// rest of the app (ReservationDetails, invoices, reports) needs no changes
// to understand a contract-generated booking.

const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + (Number(days) || 0));
  return d.toISOString().slice(0, 10);
};

// Mirrors serviceQty()/calcQuantity() in CreateReservation.jsx and
// ServiceLineEditor.jsx: per_night/per_day lines multiply by the date range.
const computeQty = (s) => {
  const qty = Number(s.quantity) || 1;
  if ((s.unit === 'per_night' || s.unit === 'per_day') && s.start_date && s.end_date) {
    const days = Math.max(1, Math.round((+new Date(s.end_date) - +new Date(s.start_date)) / 86400000));
    return qty * days;
  }
  return qty;
};

/**
 * Finds the contract's private-tour pricing tier for `numParticipants`.
 * Supports both legacy exact `pax` matches and new `min_pax`/`max_pax`
 * ranges (an empty/omitted `max_pax` means "unlimited"). Returns null if
 * no tier covers the participant count.
 */
export function findPricingTier(contract, numParticipants) {
  const pax = Math.round(Number(numParticipants) || 0);
  const tiers = contract?.pricing_tiers || [];

  const exact = tiers.find((t) => t.pax != null && t.pax !== '' && Math.round(Number(t.pax)) === pax);
  if (exact) return exact;

  const range = tiers.find((t) => {
    const min = Number(t.min_pax);
    if (!min && min !== 0) return false;
    const max = t.max_pax != null && t.max_pax !== '' ? Number(t.max_pax) : Infinity;
    return pax >= min && pax <= max;
  });
  return range || null;
}

/** Builds a blank passenger row for index `i` (the first passenger defaults to the trip contact). */
export const emptyPassenger = (i) => ({
  id: `pax-${Date.now()}-${i}`,
  name: '',
  is_contact: i === 0,
  client_id: '',
  age_category: 'adult',
  phone: '',
  email: '',
  date_of_birth: '',
  numero_pratica: '',
});

// Pads/truncates whatever passenger rows the user actually filled in
// (fields are optional — see PassengerFieldsRow) to exactly `pax` entries,
// since pax is the sole source of truth for pricing and never derived
// from how many rows happen to be filled in.
function resolvePassengers(passengers, pax) {
  const provided = Array.isArray(passengers) ? passengers : [];
  const result = provided.slice(0, pax);
  for (let i = result.length; i < pax; i++) result.push(emptyPassenger(i));
  if (!result.some((p) => p.is_contact)) result[0].is_contact = true;
  return result;
}

/**
 * Resolves a TourContract plus a chosen departure date / participant count /
 * selected client extras into a Trip payload shaped exactly like
 * CreateReservation.jsx produces, so the rest of the app (ReservationDetails,
 * invoices, reports) needs no changes to understand a contract-generated booking.
 * @returns {object} `{ ok: false, missingTier, availablePax }` when no pricing
 *   tier matches the participant count, otherwise
 *   `{ ok: true, tier, services, tripBase, totals }`.
 */
export function buildTripFromContract({
  contract,
  client,
  departureDate,
  numParticipants,
  selectedExtraKeys = [],
  passengers,
}) {
  const pax = Math.max(1, Math.round(Number(numParticipants) || 0));
  const tourType = contract?.tour_type || 'private';

  let tier = null;
  let availablePax = [];

  if (tourType === 'group') {
    const groupPrice = Number(contract?.group_price);
    if (groupPrice && !isNaN(groupPrice)) {
      tier = { price_per_person: groupPrice, currency: contract?.group_currency || 'EUR' };
    } else {
      return { ok: false, missingTier: true, availablePax, isGroupMissingPrice: true };
    }
  } else {
    tier = findPricingTier(contract, pax);
    if (!tier) {
      availablePax = [
        ...new Set(
          (contract?.pricing_tiers || []).map((t) => {
            if (t.pax != null && t.pax !== '') return Math.round(Number(t.pax));
            const min = t.min_pax != null && t.min_pax !== '' ? Number(t.min_pax) : '?';
            const max = t.max_pax != null && t.max_pax !== '' ? Number(t.max_pax) : '∞';
            return `${min}-${max}`;
          }),
        ),
      ].sort((a, b) => {
        const na = parseInt(String(a));
        const nb = parseInt(String(b));
        return (isNaN(na) ? -1 : na) - (isNaN(nb) ? -1 : nb);
      });
      return { ok: false, missingTier: true, availablePax };
    }
  }

  const itinerary = contract.itinerary || [];

  // Resolve absolute dates + capacity-based quantity for each fixed line.
  const resolvedItinerary = itinerary.map((item) => {
    const start_date = departureDate ? addDays(departureDate, item.day_offset_start || 0) : '';
    const end_date = departureDate ? addDays(departureDate, item.day_offset_end ?? item.day_offset_start ?? 0) : '';
    const isCarUnit = item.unit === 'per_car' && Number(item.car_capacity) > 0;
    const quantity = isCarUnit ? Math.ceil(pax / Number(item.car_capacity)) : Number(item.quantity) || 1;
    return { ...item, start_date, end_date, quantity };
  });

  const packageTotal = Number(tier.price_per_person) * pax;
  const currency = tier.currency || 'EUR';

  const totalAcquiring = resolvedItinerary.reduce(
    (sum, s) => sum + (Number(s.acquiring_price) || 0) * computeQty(s),
    0,
  );

  // The client is quoted one fixed package price, not itemized per service —
  // but Trip.total_cost / invoices / reports all sum services[].selling_price
  // × qty, so we distribute the package price across lines proportionally to
  // their real cost share (falling back to an even split with no cost data).
  // That keeps a single source of truth instead of teaching every other page
  // about a separate "package price" concept.
  const services = resolvedItinerary.map((item, idx) => {
    const qty = computeQty(item);
    const costShare =
      totalAcquiring > 0 ? ((Number(item.acquiring_price) || 0) * qty) / totalAcquiring : 1 / resolvedItinerary.length;
    const lineTotal = packageTotal * costShare;
    const sellingPerUnit = qty > 0 ? lineTotal / qty : 0;

    return {
      _key: `contract-${item._key || idx}-${Date.now()}`,
      supplier_id: item.supplier_id,
      name: item.name,
      description: item.description || '',
      category: item.category,
      location: item.location || '',
      start_date: item.start_date,
      end_date: item.end_date,
      unit: item.unit,
      quantity: item.quantity,
      acquiring_price: Number(item.acquiring_price) || 0,
      base_selling_price: sellingPerUnit,
      selling_price: sellingPerUnit,
      supplier_currency: item.supplier_currency || currency,
      client_currency: currency,
      hotel_treatment: item.hotel_treatment,
      room_type: item.room_type,
      room_occupancy: item.room_occupancy,
      pickup_location: item.pickup_location,
      dropoff_location: item.dropoff_location,
      transfer_type: item.transfer_type,
      service_date: item.transfer_type ? item.start_date : undefined,
      pricing_id: item.pricing_id,
      subcategory_id: item.subcategory_id,
      car_capacity: item.car_capacity,
      booking_source: 'direct',
      show_in_itinerary: item.show_in_itinerary !== false,
    };
  });

  const clientExtras = client?.fixed_extras || [];
  const selectedExtras = clientExtras.filter((e) => selectedExtraKeys.includes(e._key));
  const extraServices = selectedExtras.map((extra, idx) => ({
    _key: `extra-${extra._key || idx}-${Date.now()}`,
    supplier_id: extra.supplier_id,
    name: extra.name,
    description: extra.description || '',
    category: 'Extra',
    location: '',
    start_date: departureDate,
    end_date: departureDate,
    unit: extra.unit || 'per_person',
    quantity: Number(extra.quantity) || 1,
    acquiring_price: Number(extra.acquiring_price) || 0,
    base_selling_price: Number(extra.selling_price) || 0,
    selling_price: Number(extra.selling_price) || 0,
    supplier_currency: extra.currency || currency,
    client_currency: extra.currency || currency,
    booking_source: 'direct',
    show_in_itinerary: true,
  }));

  const allServices = [...services, ...extraServices];
  const totalAcquiringCost = allServices.reduce((sum, s) => sum + (Number(s.acquiring_price) || 0) * computeQty(s), 0);
  const totalSellingPrice = allServices.reduce((sum, s) => sum + (Number(s.selling_price) || 0) * computeQty(s), 0);

  const lastOffset = itinerary.reduce(
    (max, item) => Math.max(max, item.day_offset_end ?? item.day_offset_start ?? 0),
    0,
  );
  const endDate = departureDate ? addDays(departureDate, lastOffset) : '';

  const tripBase = {
    name: `${contract.name} — ${departureDate}`,
    destination: contract.destination || '',
    start_date: departureDate,
    end_date: endDate,
    department: '',
    client_id: client?.id || contract.client_id,
    client_name: client?.name || contract.client_name || '',
    client_email: client?.email || '',
    notes: '',
    terms_and_conditions: contract.terms_and_conditions || '',
    internal_notes: '',
    service_types: [],
    passengers: resolvePassengers(passengers, pax),
    services: allServices,
    acquiring_currency: services[0]?.supplier_currency || currency,
    selling_currency: currency,
    exchange_rate: 1,
    markup_percentage: 0,
    total_cost: totalSellingPrice,
    source_contract_id: contract.id,
    source_contract_name: contract.name,
  };

  return {
    ok: true,
    missingTier: false,
    tier,
    services: allServices,
    tripBase,
    totals: {
      acquiringCost: totalAcquiringCost,
      sellingPrice: totalSellingPrice,
      currency,
      marginPct: totalSellingPrice > 0 ? ((totalSellingPrice - totalAcquiringCost) / totalSellingPrice) * 100 : 0,
    },
  };
}
