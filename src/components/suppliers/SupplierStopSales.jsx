import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarOff, Plus, Trash2, AlertTriangle, CalendarDays } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';

const fmt = (d) => format(parseISO(d), 'MMM d, yyyy');
const todayStr = () => new Date().toISOString().split('T')[0];

export default function SupplierStopSales({ supplierId }) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [range, setRange] = useState(/** @type {any} */ (undefined));
  const [reason, setReason] = useState('');

  const { data: stopSales = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierStopSales', supplierId],
      queryFn: () => db.entities.SupplierStopSale.filter({ supplier_id: supplierId }),
      enabled: !!supplierId,
    })
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['supplierStopSales', supplierId] });
    queryClient.invalidateQueries({ queryKey: ['allSupplierStopSales'] });
  };

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) =>
        db.entities.SupplierStopSale.create({ ...data, supplier_id: supplierId }),
      onSuccess: () => {
        showSuccess('Stop sale added — new bookings for these dates are now blocked');
        invalidate();
        closeModal();
      },
      onError: (error) => showError('Failed to add stop sale', error.message),
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.SupplierStopSale.delete(id),
      onSuccess: () => {
        showSuccess('Stop sale removed');
        invalidate();
      },
      onError: (error) => showError('Failed to remove stop sale', error.message),
    })
  );

  const closeModal = () => {
    setModalOpen(false);
    setRange(undefined);
    setReason('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!range?.from) {
      showError('Pick a start date (and optionally an end date) on the calendar');
      return;
    }
    createMutation.mutate({
      start_date: format(range.from, 'yyyy-MM-dd'),
      end_date: format(range.to || range.from, 'yyyy-MM-dd'),
      reason,
    });
  };

  const today = todayStr();
  const sorted = [...stopSales].sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
  const activeNow = sorted.filter((s) => s.start_date <= today && s.end_date >= today);
  const upcoming = sorted.filter((s) => s.start_date > today);
  const past = sorted.filter((s) => s.end_date < today);
  const ordered = [...activeNow, ...upcoming, ...past];

  return (
    <Card className="p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <CalendarOff className="w-5 h-5 text-red-500 dark:text-red-300" /> Stop Sales
        </h3>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Stop Sale
        </Button>
      </div>

      {activeNow.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-300 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-800 dark:text-red-300">
            <p className="font-semibold">This supplier is unavailable right now</p>
            <p className="mt-0.5">
              New reservations for the dates below are blocked in every booking channel, including the client portal.
            </p>
          </div>
        </div>
      )}

      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No stop sale periods. Add one to block new bookings for this supplier across a date range.
        </p>
      ) : (
        <div className="space-y-2">
          {ordered.map((s) => {
            const status = activeNow.includes(s) ? 'active' : upcoming.includes(s) ? 'upcoming' : 'ended';
            const statusStyle = {
              active: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
              upcoming: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
              ended: 'bg-muted text-muted-foreground',
            }[status];
            const statusLabel = { active: 'Active', upcoming: 'Upcoming', ended: 'Ended' }[status];
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Badge className={`text-xs flex-shrink-0 ${statusStyle}`}>{statusLabel}</Badge>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      {fmt(s.start_date)} – {fmt(s.end_date)}
                    </div>
                    {s.reason && <div className="text-xs text-muted-foreground truncate">{s.reason}</div>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={() => deleteMutation.mutate(s.id)}
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Stop Sale</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Date range *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start font-normal">
                    <CalendarDays className="w-4 h-4 mr-2" />
                    {range?.from
                      ? `${format(range.from, 'MMM d, yyyy')}${range.to ? ` – ${format(range.to, 'MMM d, yyyy')}` : ''}`
                      : 'Select dates on the calendar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={1} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Reason (internal note)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. fully booked, closed for maintenance..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding...' : 'Add Stop Sale'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
