import { format, parseISO } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarDays } from 'lucide-react';

// A native <input type="date"> was invisible/unreliable across browsers (its
// calendar icon and popup follow the OS theme, not this app's, and its
// clickable area varies a lot by browser). Same Popover+Calendar pattern
// already used for date-range picking in SupplierStopSales.jsx, just
// single-date — a button trigger with its own calendar icon and a dropdown
// that always renders the same way regardless of browser/OS theme.
export function DateField({ label, value, onChange, minDate = undefined, placeholder }) {
  const selectedDate = value ? parseISO(value) : undefined;
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-start font-normal">
            <CalendarDays className="w-4 h-4 mr-2 shrink-0 text-muted-foreground" />
            <span className="truncate">{selectedDate ? format(selectedDate, 'MMM d, yyyy') : placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
            disabled={minDate ? { before: parseISO(minDate) } : undefined}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
