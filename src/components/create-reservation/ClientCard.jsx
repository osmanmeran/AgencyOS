import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Check, Search } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

export default function ClientCard({
  formData,
  setFormData,
  clientSearch,
  setClientSearch,
  clientDropdownOpen,
  setClientDropdownOpen,
  filteredClients,
}) {
  const { t: _t } = useT();
  return (
    <Card className="p-6 bg-card shadow-md">
      <h2 className="text-lg font-bold text-foreground mb-4">{_t('createReservation.client')}</h2>
      <Popover open={clientDropdownOpen} onOpenChange={setClientDropdownOpen}>
        <PopoverTrigger asChild>
          <button
            role="combobox"
            aria-expanded={clientDropdownOpen}
            className="w-full flex items-center justify-between px-3 py-2 text-sm border border-border rounded-lg bg-card hover:bg-muted text-left"
          >
            {formData.client_id ? (
              <span className="font-medium">
                {formData.client_name}
                {formData.client_email ? ` · ${formData.client_email}` : ''}
              </span>
            ) : (
              <span className="text-muted-foreground">{_t('createReservation.selectClient')}</span>
            )}
            <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput
              placeholder={_t('createReservation.search')}
              value={clientSearch}
              onValueChange={setClientSearch}
            />
            <CommandList>
              <CommandEmpty>{_t('createReservation.no')}</CommandEmpty>
              <CommandGroup>
                {filteredClients.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.name} ${c.email || ''} ${c.company || ''}`}
                    onSelect={() => {
                      setFormData({
                        ...formData,
                        client_id: c.id,
                        client_name: c.name || '',
                        client_email: c.email || '',
                      });
                      setClientSearch('');
                      setClientDropdownOpen(false);
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${formData.client_id === c.id ? 'opacity-100' : 'opacity-0'}`} />
                    <div>
                      <span className="font-medium">{c.name}</span>
                      {c.email && <span className="text-muted-foreground ml-1">— {c.email}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </Card>
  );
}
