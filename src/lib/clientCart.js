// Lightweight client-side cart for the client portal. Services selected from
// the Hotel / Transfer / Car rental search pages and from the Guided Tour
// catalog are parked here (persisted to localStorage) and drained into the
// Request-a-Quote builder (ClientQuoteBuilder.jsx) when the client opens it.
//
// A cart item is just a builder "line" object (see ClientQuoteBuilder's
// newLine) optionally carrying `seedRooms` — a rooms/passengers snapshot taken
// from a hotel's rooming config so the builder can pre-fill occupancy when the
// client "starts with a hotel".

const CLIENT_CART_KEY = 'marvelops_client_cart';

let listeners = new Set();

function read() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CLIENT_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Returns whether the write actually landed — callers use this to warn the
// client instead of assuming success (private-mode Safari and a full quota
// both throw here silently otherwise, leaving the cart looking empty with no
// explanation).
function write(items) {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(CLIENT_CART_KEY, JSON.stringify(items));
  } catch {
    return false;
  }
  listeners.forEach((fn) => fn(items));
  return true;
}

export function getCart() {
  return read();
}

export function getCartCount() {
  return read().length;
}

/** @returns {boolean} Whether the item was actually persisted. */
export function addToCart(/** @type {any} */ item) {
  const items = read();
  // Merge if an identical service (same pricing_id or tour_id) is already
  // parked — most selections from the search pages are single-line, so this
  // keeps the cart from duplicating the same hotel twice.
  const key = item.tour_id ? `tour:${item.tour_id}` : `svc:${item.pricing_id}`;
  const idx = items.findIndex((it) => (it.tour_id ? `tour:${it.tour_id}` === key : `svc:${it.pricing_id}` === key));
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...item };
  } else {
    items.push(item);
  }
  return write(items);
}

export function removeFromCart(itemKey) {
  return write(read().filter((it) => it._key !== itemKey));
}

export function clearCart() {
  return write([]);
}

export function subscribeCart(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Builds a rooms/passengers snapshot from a hotel search's rooming config so
// the builder can pre-fill occupancy when the client "starts with a hotel".
let _ridCounter = 0;
function uid(prefix) {
  return `${prefix}-${Date.now()}-${(_ridCounter++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function newPax() {
  return {
    id: uid('pax'),
    name: '',
    age_category: 'adult',
    date_of_birth: '',
    passport_number: '',
    phone: '',
    email: '',
    is_contact: false,
  };
}
export function buildSeedRooms(roomCount, adultsPerRoom, childCount) {
  const rooms = [];
  const roomsN = Math.max(1, roomCount || 1);
  const adultsN = Math.max(1, adultsPerRoom || 1);
  const type = adultsN >= 4 ? 'quad' : adultsN === 3 ? 'triple' : adultsN === 1 ? 'single' : 'double';
  for (let r = 0; r < roomsN; r += 1) {
    const passengers = [];
    for (let a = 0; a < adultsN; a += 1) passengers.push(newPax());
    rooms.push({ id: uid('room'), type, passengers });
  }
  for (let c = 0; c < (childCount || 0); c += 1) {
    if (rooms[0]) rooms[0].passengers.push({ ...newPax(), age_category: 'children' });
  }
  return rooms;
}
