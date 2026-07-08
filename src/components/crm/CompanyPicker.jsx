import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Building, Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

/**
 * Select the Company a contact belongs to, or create a new one inline.
 *
 * @param {{ value?: string, companyName?: string, onChange: (v: { company_id: string, company: string }) => void }} props
 *   `value` is the selected company_id, `companyName` the denormalized name.
 *   `onChange` reports both the id and the canonical name so callers keep the
 *   denormalized `company` field in sync.
 */
export default function CompanyPicker({ value, companyName, onChange }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data: companies = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['companies'],
      queryFn: () => db.entities.Company.list('name'),
    })
  );

  const selected = companies.find((c) => c.id === value);
  const label = selected?.name || companyName || '';

  const q = query.trim().toLowerCase();
  const filtered = q ? companies.filter((c) => c.name?.toLowerCase().includes(q)) : companies;
  const exactExists = companies.some((c) => c.name?.trim().toLowerCase() === q);

  const select = (company) => {
    onChange({ company_id: company.id, company: company.name });
    setOpen(false);
    setQuery('');
  };

  const clear = () => {
    onChange({ company_id: '', company: '' });
    setOpen(false);
    setQuery('');
  };

  const createAndSelect = async () => {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const company = await db.entities.Company.create({ name, status: 'active' });
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      select(company);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-8 text-sm justify-between font-normal flex-1 min-w-0"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <Building className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className={`truncate ${label ? 'text-foreground' : 'text-muted-foreground'}`}>
                {label || t('companyPicker.noCompany')}
              </span>
            </span>
            <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[240px]" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={t('companyPicker.searchPlaceholder')} value={query} onValueChange={setQuery} />
            <CommandList>
              {filtered.length === 0 && !query && <CommandEmpty>{t('companyPicker.noCompaniesYet')}</CommandEmpty>}
              <CommandGroup>
                {filtered.map((company) => (
                  <CommandItem key={company.id} value={company.id} onSelect={() => select(company)}>
                    <Check className={`w-3.5 h-3.5 mr-2 ${value === company.id ? 'opacity-100' : 'opacity-0'}`} />
                    <Building className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                    <span className="truncate">{company.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {query.trim() && !exactExists && (
                <CommandGroup>
                  <CommandItem value={`__create__${query}`} onSelect={createAndSelect} disabled={creating}>
                    <Plus className="w-3.5 h-3.5 mr-2 text-blue-500 dark:text-blue-300" />
                    <span>
                      {creating ? t('companyPicker.creating') : t('companyPicker.createLabel', { name: query.trim() })}
                    </span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {label && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-muted-foreground"
          onClick={clear}
          title={t('companyPicker.clearTitle')}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
