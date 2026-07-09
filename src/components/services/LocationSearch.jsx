import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, MapPin } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export default function LocationSearch({
  value,
  onChange,
  onSelect = /** @type {(item: any) => void} */ (() => {}),
  placeholder,
}) {
  const { t } = useT();
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(value || null);