import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, Loader2 } from 'lucide-react';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export default function LocationSearch({ value, onChange, placeholder }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const search = (q) => {
    if (!q || q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    fetch(`${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`, {
      headers: { 'User-Agent': 'MarvelopsTravelPro/1.0' }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSuggestions(data.map(p => ({
            label: p.display_name,
            value: p.display_name,
            lat: p.lat,
            lon: p.lon,
            type: p.type,
            city: p.address?.city || p.address?.town || p.address?.village || '',
            country: p.address?.country || '',
          })));
          setOpen(true);
        }
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  };

  const handleInput = (val) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 400);
    onChange(val);
  };

  const select = (item) => {
    setQuery(item.label);
    setOpen(false);
    onChange(item.label);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch(
          `${NOMINATIM_URL}?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&addressdetails=1&limit=1`,
          { headers: { 'User-Agent': 'MarvelopsTravelPro/1.0' } }
        )
          .then(r => r.json())
          .then(data => {
            if (Array.isArray(data) && data.length > 0) {
              const label = data[0].display_name;
              setQuery(label);
              onChange(label);
            }
          })
          .catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex gap-1">
        <div className="relative flex-1">
          <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={query}
            onChange={e => handleInput(e.target.value)}
            placeholder={placeholder || 'Search location...'}
            className="h-9 text-sm pl-8 pr-8"
          />
          {loading && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
          )}
        </div>
        <button
          type="button"
          onClick={useCurrentLocation}
          title="Use current location"
          className="h-9 w-9 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500"
        >
          <Navigation className="w-4 h-4" />
        </button>
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => select(item)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-100 last:border-0"
            >
              <div className="font-medium text-slate-800 truncate">{item.label.split(',')[0]}</div>
              <div className="text-xs text-slate-500 truncate">{item.label}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
