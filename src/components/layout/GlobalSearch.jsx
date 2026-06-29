import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserCircle, Users, Plane, FileText, CalendarCheck, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommandDialog, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from '@/components/ui/command';

const ICON_MAP = {
  UserCircle: UserCircle,
  Users: Users,
  Plane: Plane,
  FileText: FileText,
  CalendarCheck: CalendarCheck,
  Shield: Shield,
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const debounceRef = useRef(null);

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('marvelops_token');
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const grouped = results.reduce((acc, item) => {
    const group = item.type === 'User' ? 'Users' : item.type.replace(/([A-Z])/g, ' $1').trim() + 's';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  const handleSelect = (item) => {
    setOpen(false);
    navigate(item.url);
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-8 w-56 justify-start text-sm text-muted-foreground border-dashed"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-3.5 w-3.5" />
        <span>Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search clients, suppliers, trips..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            ) : query.trim().length >= 2 ? (
              'No results found.'
            ) : (
              'Type at least 2 characters to search.'
            )}
          </CommandEmpty>

          {Object.entries(grouped).map(([group, items]) => {
            const Icon = ICON_MAP[items[0]?.icon] || Search;
            return (
              <CommandGroup key={group} heading={group}>
                {items.map((item) => (
                  <CommandItem
                    key={`${item.type}-${item.id}`}
                    value={`${item.label} ${item.subtitle} ${item.type}`}
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium">{item.label}</span>
                      {item.subtitle && (
                        <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span>
                      )}
                    </div>
                    {item.badge && (
                      <span className="ml-auto shrink-0 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 text-[10px] font-medium uppercase">
                        {item.badge}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
