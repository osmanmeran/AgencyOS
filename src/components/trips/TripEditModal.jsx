import { db } from '@/lib/DbContext';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarClock, Save } from 'lucide-react';
import { addDays, format } from 'date-fns';

export default function TripEditModal({ open, onClose, trip }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(/** @type {any} */ ({}));
  const [moveDays, setMoveDays] = useState(0);

  const { data: settings } = /** @type {any} */ (
    useQuery({
      queryKey: ['appSettings'],
      queryFn: async () => {
        const all = await db.entities.AppSettings.list();
        return all[0] || { departments: [] };
      },
    })
  );

  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clients'],
      queryFn: () => db.entities.Client.list(),
    })
  );

  useEffect(() => {
    if (trip) {
      setFormData({
        name: trip.name || '',
        destination: trip.destination || '',
        start_date: trip.start_date || '',
        end_date: trip.end_date || '',
        department: trip.department || '',
        category: trip.category || '',
        client_id: trip.client_id || '',
        notes: trip.notes || '',
        image_url: trip.image_url || '',
      });
    }
  }, [trip]);

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.Trip.update(trip.id, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['trips'] });
        onClose();
      },
    })
  );

  const handleMoveDates = () => {
    if (moveDays !== 0) {
      const newStart = addDays(new Date(formData.start_date), moveDays);
      const newEnd = addDays(new Date(formData.end_date), moveDays);
      setFormData({
        ...formData,
        start_date: format(newStart, 'yyyy-MM-dd'),
        end_date: format(newEnd, 'yyyy-MM-dd'),
      });
      setMoveDays(0);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate({ ...trip, ...formData });
  };

  const departments = settings?.departments || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Trip</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="dates">Move Dates</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Trip Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Destination *</Label>
                  <Input
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={formData.department}
                    onValueChange={(v) => setFormData({ ...formData, department: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </TabsContent>

            <TabsContent value="dates" className="space-y-4 pt-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarClock className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                  <h4 className="font-semibold">Move All Dates</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Shift all trip dates forward or backward by a number of days.
                </p>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    value={moveDays}
                    onChange={(e) => setMoveDays(parseInt(e.target.value) || 0)}
                    className="w-32"
                    placeholder="Days"
                  />
                  <Button type="button" variant="outline" onClick={handleMoveDates}>
                    Apply Shift
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Positive = move forward, Negative = move backward</p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
                <div>
                  <Label className="text-sm text-muted-foreground">Current Start</Label>
                  <div className="font-semibold">{formData.start_date}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Current End</Label>
                  <div className="font-semibold">{formData.end_date}</div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
