import React, { useEffect, useState } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export default function TripMap({ events = [] }) {
  const [MapComponents, setMapComponents] = useState(null);
  const [L, setL] = useState(null);

  useEffect(() => {
    Promise.all([
      import('react-leaflet'),
      import('leaflet')
    ]).then(([rl, leaflet]) => {
      delete leaflet.default.Icon.Default.prototype._getIconUrl;
      leaflet.default.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      setMapComponents(rl);
      setL(leaflet.default);
    });
  }, []);

  const eventsWithLocations = events.filter(e => e.location);

  if (eventsWithLocations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
        <MapPin className="w-10 h-10 mb-3 text-slate-300" />
        <p className="text-sm">No locations to display on map</p>
        <p className="text-xs mt-1">Add locations to your itinerary events to see them here</p>
      </div>
    );
  }

  if (!MapComponents || !L) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 rounded-xl">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, Polyline } = MapComponents;

  // Build numbered custom icons
  const createNumberedIcon = (num) => L.divIcon({
    html: `<div style="
      background:#2563eb;color:#fff;width:28px;height:28px;
      border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff;
    ">
      <span style="transform:rotate(45deg);font-size:11px;font-weight:700">${num}</span>
    </div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });

  // Use placeholder coords via geocode-style approach — we geocode by building a query string
  // Since we can't do real geocoding, show the map centered on the first location name + list all
  // We'll use OpenStreetMap Nominatim-style: just embed individual maps via iframe for each,
  // but render a unified Leaflet map using the location names as search query labels.
  // Since Leaflet needs lat/lng, we'll show a Google Maps embed for the full route + pin list below.

  const routeQuery = eventsWithLocations.map(e => encodeURIComponent(e.location)).join('/');
  const firstLocation = encodeURIComponent(eventsWithLocations[0].location);

  return (
    <div className="space-y-4">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          <span><strong>{eventsWithLocations.length}</strong> stop{eventsWithLocations.length !== 1 ? 's' : ''} on your trip route</span>
        </p>
        <a
          href={`https://www.google.com/maps/dir/${eventsWithLocations.map(e => encodeURIComponent(e.location)).join('/')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open full route in Google Maps
        </a>
      </div>

      {/* Interactive map via Google Maps embed showing the route */}
      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <iframe
          title="Trip Route Map"
          width="100%"
          height="420"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={
            eventsWithLocations.length === 1
              ? `https://maps.google.com/maps?q=${firstLocation}&output=embed&z=12`
              : `https://www.google.com/maps/embed/v1/directions?key=AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY&origin=${encodeURIComponent(eventsWithLocations[0].location)}&destination=${encodeURIComponent(eventsWithLocations[eventsWithLocations.length - 1].location)}${eventsWithLocations.length > 2 ? `&waypoints=${eventsWithLocations.slice(1, -1).map(e => encodeURIComponent(e.location)).join('|')}` : ''}&mode=driving`
          }
        />
      </div>

      {/* Numbered stop list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {eventsWithLocations.map((event, i) => (
          <a
            key={event.id}
            href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 text-sm truncate">{event.title}</div>
              <div className="text-xs text-slate-500 truncate">{event.location}</div>
              {event.date && (
                <div className="text-xs text-slate-400 mt-0.5">
                  {format(new Date(event.date), 'MMM d')}
                  {event.time ? ` · ${event.time}` : ''}
                </div>
              )}
            </div>
            <MapPin className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0 mt-0.5" />
          </a>
        ))}
      </div>
    </div>
  );
}