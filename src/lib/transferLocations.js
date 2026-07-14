// Transfer origin/destination picklist. Transfers reuse the airport picklist
// but also need a generic non-airport leg (e.g. hotel to port, or "other"),
// so this extends AIRPORT_LOCATIONS with that option. Car rental keeps using
// AIRPORT_LOCATIONS directly (see carRentalLocations.js) — only transfers get
// the extra destination.
import { AIRPORT_LOCATIONS } from './airportLocations';

export const TRANSFER_LOCATIONS = [...AIRPORT_LOCATIONS, 'Hotel/port/other'];
