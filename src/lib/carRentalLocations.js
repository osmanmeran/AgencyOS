// Car rental pickup/drop-off locations — the same fixed airport picklist
// used for transfer pricing/search (src/lib/airportLocations.js), so pickup
// vs drop-off comparisons, which drive the drop-off surcharge, are always
// exact string matches instead of depending on staff typing the same
// location name identically every time.
// Staff assign the subset a given supplier actually operates at
// (SupplierDetails.jsx); clients then only see locations that are both in
// this list AND assigned to at least one available car rental supplier.
export { AIRPORT_LOCATIONS as CAR_RENTAL_LOCATIONS } from './airportLocations';
