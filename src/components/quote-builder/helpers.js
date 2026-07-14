import { getCurrencySymbol } from '@/lib/formatters';
import { isLodgingCategory, nightsBetween } from '@/lib/hotelPricing';

const sym = (cur) => getCurrencySymbol(cur);

const AGE_CATEGORIES = [
  { value: 'adult', label: 'Adult' },
  { value: 'children', label: 'Child (3–11)' },
  { value: 'infant', label: 'Infant (0–2)' },
];

const NIGHT_UNITS = ['per_night', 'per_day'];
const FIXED_UNITS = ['per_group', 'flat_rate'];

// The in-progress cart (lines / rooms / contact) is persisted so the client
// can jump between the search pages and the builder without losing work.
const QUOTE_DRAFT_KEY = 'marvelops_quote_draft';
function loadQuoteDraft() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(QUOTE_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveQuoteDraft(draft) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(QUOTE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

const isCarRentalCategory = (name) => {
  const c = (name || '').toLowerCase();
  return c.includes('rent a car') || c.includes('rental') || c.includes('car rental');
};

// The client portal home's hero search hands off here via ?category=...
// (plus destination/checkin/checkout/guests for the hotels flow). Category
// names are whatever suppliers were entered under, so matching a hero pill to
// one is fuzzy keyword matching — same approach ServiceLineCard already uses
// below to detect lodging/transfer/car-rental categories for its own per-line
// fields, reused here to auto-select a category in the picker.
const CATEGORY_HINT_MATCHERS = {
  hotels: isLodgingCategory,
  tours: (name) => {
    const c = (name || '').toLowerCase();
    return c.includes('tour') || c.includes('guide') || c.includes('excursion') || c.includes('activity');
  },
  transfers: (name) => (name || '').toLowerCase().includes('transfer'),
  car_rental: (name) => {
    const c = (name || '').toLowerCase();
    return c.includes('rent a car') || c.includes('rental') || c.includes('car rental');
  },
};

function readHeroSearchParams() {
  if (typeof window === 'undefined') return null;
  const sp = new URLSearchParams(window.location.search);
  const category = sp.get('category');
  if (!category) return null;
  return {
    categoryHint: category,
    destination: sp.get('destination') || '',
    checkin: sp.get('checkin') || '',
    checkout: sp.get('checkout') || '',
    guests: parseInt(sp.get('guests') || '', 10) || undefined,
  };
}
const HOTEL_TREATMENTS = [
  'Room Only',
  'Bed & Breakfast',
  'Half Board',
  'Full Board',
  'All Inclusive',
  'Ultra All Inclusive',
];
// Maps a catalog item's meal_treatment code (RO/BB/HB/FB/AI/UAI) to the label
// used in the Meal Plan select above, so picking a room from the guided
// hotel picker pre-fills it correctly.
const MEAL_CODE_TO_LABEL = {
  RO: 'Room Only',
  BB: 'Bed & Breakfast',
  HB: 'Half Board',
  FB: 'Full Board',
  AI: 'All Inclusive',
  UAI: 'Ultra All Inclusive',
};
const TRANSFER_TYPES = [
  'Airport Pickup',
  'Airport Drop-off',
  'Point to Point',
  'Hotel to Hotel',
  'Port Transfer',
  'City Transfer',
];

const CAR_CATEGORY_LABELS = {
  economy: 'Economy',
  compact: 'Compact',
  intermediate: 'Intermediate',
  standard: 'Standard',
  fullsize: 'Full Size',
  premium: 'Premium',
  luxury: 'Luxury',
  suv: 'SUV',
  minivan: 'Minivan',
  convertible: 'Convertible',
};

const rid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const newPassenger = () => ({
  id: rid('pax'),
  name: '',
  age_category: 'adult',
  date_of_birth: '',
  passport_number: '',
  phone: '',
  email: '',
  is_contact: false,
});
const newRoom = () => ({ id: rid('room'), type: 'double', passengers: [newPassenger(), newPassenger()] });
const newDestination = () => ({ id: rid('dest'), label: '', lat: null, lon: null });
const newLine = () => ({
  _key: rid('line'),
  pricing_id: '',
  service_name: '',
  unit: '',
  min_quantity: 1,
  quantity: 1,
  children_count: 0,
  supplier_id: '',
  start_date: '',
  end_date: '',
  room_type: '',
  hotel_treatment: '',
  pickup_location: '',
  dropoff_location: '',
  flight_number: '',
  transfer_type: '',
  car_category: '',
  car_drop_off_surcharge: 0,
  car_insurance: false,
  service_date: '',
  service_time: '',
  duration: '',
  details: '',
});

function lineQty(line) {
  let qty = Math.max(1, line.quantity || 1);
  if (NIGHT_UNITS.includes(line.unit)) {
    const n = nightsBetween(line.start_date, line.end_date);
    if (n > 0) qty *= n;
  }
  return qty;
}

// carRentalDays is the pickup->dropoff night count, computed by the caller
// from line.start_date/end_date (nightsBetween) — never a manually-typed
// number — so the total always tracks the actual date range selected. Pass
// null for non-car-rental lines; 0 means "car rental but no valid date range
// yet," which prices as 0 rather than silently assuming 1 day.
function lineTotal(line, unitPrice, surcharges = {}, carRentalDays = null) {
  if (!unitPrice) return 0;
  let total;
  if (FIXED_UNITS.includes(line.unit)) {
    total = unitPrice;
  } else if (carRentalDays != null) {
    // Car rental: daily_rate * days + drop-off surcharge + insurance surcharge
    if (carRentalDays <= 0) return 0;
    total = unitPrice * carRentalDays * (line.quantity || 1);
    if (line.car_insurance) {
      total += carRentalDays * (surcharges.insuranceSurcharge || 0);
    }
    if (line.car_drop_off_surcharge) {
      total += line.car_drop_off_surcharge;
    }
    return total;
  } else {
    total = unitPrice * lineQty(line);
  }
  if (line.children_count > 0 && surcharges.childUnitPrice) {
    total += line.children_count * surcharges.childUnitPrice * nightsBetween(line.start_date, line.end_date);
  }
  return total;
}

export {
  sym,
  AGE_CATEGORIES,
  NIGHT_UNITS,
  FIXED_UNITS,
  QUOTE_DRAFT_KEY,
  loadQuoteDraft,
  saveQuoteDraft,
  isCarRentalCategory,
  CATEGORY_HINT_MATCHERS,
  readHeroSearchParams,
  HOTEL_TREATMENTS,
  MEAL_CODE_TO_LABEL,
  TRANSFER_TYPES,
  CAR_CATEGORY_LABELS,
  rid,
  newPassenger,
  newRoom,
  newDestination,
  newLine,
  lineQty,
  lineTotal,
};
