import { db } from '@/lib/DbContext';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Search, UserPlus, X } from 'lucide-react';
import NewClientForm from '@/components/crm/NewClientForm';

// Search-existing-or-create-new-inline picker for linking a passenger to a
// real Client record. Mirrors the Popover+Command client search already
// used in CreateReservation.jsx/TourContractForm.jsx, and reuses
// NewClientForm as-is for the "create new" fallback instead of duplicating
// a client-creation form.
export default function ClientLinkPicker({ clientId, clientName, onSelect, onClear }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['clients'],
    queryFn: () => db.entities.Client.list(),
  }));

  const filtered = useMemo(() => {
    if (!search) return clients.slice(0, 50);
    const q = search.toLowerCase();
    return clients.filter(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q));
  }, [clients, search]);

  const handleCreated = (newClient) => {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    setCreateOpen(false);
    setOpen(false);
    onSelect(newClient);
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              role="combobox"
              className="flex-1 min-w-0 flex items-center justify-between px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white hover:bg-slate-50 text-left"
            >
              {clientId
                ? <span className="font-medium truncate">{clientName}</span>
                : <span className="text-slate-400">Link existing client…</span>}
              <Search className="ml-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search by name, email or company…" value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty>No client found</CommandEmpty>
                <CommandGroup>
                  {filtered.map(c => (
                    <CommandItem
                      key={c.id}
                      value={`${c.name} ${c.email || ''} ${c.company || ''}`}
                      onSelect={() => { onSelect(c); setSearch(''); setOpen(false); }}
                    >
                      <Check className={`mr-2 h-4 w-4 ${clientId === c.id ? 'opacity-100' : 'opacity-0'}`} />
                      <div className="truncate">
                        <span className="font-medium">{c.name}</span>
                        {c.email && <span className="text-slate-400 ml-1">— {c.email}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup>
                  <CommandItem onSelect={() => { setOpen(false); setCreateOpen(true); }} className="text-blue-600">
                    <UserPlus className="mr-2 h-4 w-4" />+ Create new client
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {clientId && onClear && (
          <button type="button" onClick={onClear} className="p-1.5 text-slate-400 hover:text-red-500" title="Unlink client">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Client</DialogTitle></DialogHeader>
          <NewClientForm onCreated={handleCreated} onCancel={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
