import React from 'react';
import { Input } from '@/components/ui/input';

// Restricts a text field to a known set of real values (not free text) — a
// location can only ever be handed off if it matches one of the supplier-
// backed options in `locations`. Used for the hotel destination search and
// (identically shaped) the transfer destination search.
export function LocationCombobox({ value, onChange, locations, placeholder, className = '' }) {
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const filtered = React.useMemo(() => {
    const q = value.trim().toLowerCase();
    const matches = q ? locations.filter((loc) => loc.toLowerCase().includes(q)) : locations;
    return matches.slice(0, 8);
  }, [locations, value]);

  return (
    <div className={`relative ${className}`}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setShowSuggestions(false)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-popover text-popover-foreground border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filtered.map((loc) => (
            <button
              key={loc}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(loc);
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
  );
}
