import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Hash, Users, Star, BedDouble } from 'lucide-react';

const newPassenger = () => ({ id: `pax-${Date.now()}-${Math.random()}`, name: '', is_contact: false, room_with: '' });

export default function CreateTripModal({ open, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    destination: '',
    start_date: '',
    end_date: '',
    department: '',
    client_id: '',
    activities: [],
    notes: '',
    image_url: '',
  });
  const [activityInput, setActivityInput] = useState('');
  const [passengers, setPassengers] = useState([newPassenger()]);

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

  const departments = settings?.departments || [];

  const generateReferenceNumber = async (department) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const prefix = settings?.reference_format?.prefix || 'TRP';
    const deptCode = department ? department.slice(0, 3).toUpperCase() : 'GEN';

    const counters = await db.entities.ReferenceCounter.filter({
      department: department || 'general',
      year,
      month,
    });

    let counter = 1;
    if (counters.length > 0) {
      counter = (counters[0].counter || 0) + 1;
      await db.entities.ReferenceCounter.update(counters[0].id, { ...counters[0], counter });
    } else {
      await db.entities.ReferenceCounter.create({ department: department || 'general', year, month, counter: 1 });
    }

    return `${prefix}-${deptCode}-${String(year).slice(-2)}${String(month).padStart(2, '0')}-${String(counter).padStart(4, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const referenceNumber = await generateReferenceNumber(formData.department);
    const filledPassengers = passengers.filter((p) => p.name.trim());
    onSubmit({ ...formData, reference_number: referenceNumber, passengers: filledPassengers });

    // Reset
    setFormData({
      name: '',
      destination: '',
      start_date: '',
      end_date: '',
      department: '',
      client_id: '',
      activities: [],
      notes: '',
      image_url: '',
    });
    setPassengers([newPassenger()]);
    setActivityInput('');
  };

  const addActivity = () => {
    if (activityInput.trim()) {
      setFormData({ ...formData, activities: [...formData.activities, activityInput.trim()] });
      setActivityInput('');
    }
  };

  const removeActivity = (index) => {
    setFormData({ ...formData, activities: formData.activities.filter((_, i) => i !== index) });
  };

  const addPassenger = () => setPassengers((prev) => [...prev, newPassenger()]);

  const updatePassenger = (idx, field, value) => {
    setPassengers((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const setContact = (idx) => {
    setPassengers((prev) => prev.map((p, i) => ({ ...p, is_contact: i === idx })));
  };

  const removePassenger = (idx) => {
    setPassengers((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      // If removed was contact, clear contact
      if (prev[idx].is_contact && updated.length > 0) updated[0].is_contact = true;
      return updated;
    });
  };

  const filledPassengers = passengers.filter((p) => p.name.trim());
  const previewRef = formData.department
    ? `${settings?.reference_format?.prefix || 'TRP'}-${formData.department.slice(0, 3).toUpperCase()}-YYMM-XXXX`
    : `${settings?.reference_format?.prefix || 'TRP'}-GEN-YYMM-XXXX`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
            Plan New Trip
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Reference Number Preview */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg flex items-center gap-2">
            <Hash className="w-4 h-4 text-blue-600 dark:text-blue-300" />
            <span className="text-sm text-blue-700 dark:text-blue-300">Reference: </span>
            <span className="font-mono font-semibold text-blue-900 dark:text-blue-300">{previewRef}</span>
            <span className="text-xs text-blue-600 dark:text-blue-300 ml-auto">(auto-generated)</span>
          </div>

          {/* Trip Name & Destination */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Trip Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Summer Adventure"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Destination *</Label>
              <Input
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                placeholder="Bali, Indonesia"
                required
              />
            </div>
          </div>

          {/* Dates & Department */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>General</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Client - Required */}
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select
              value={formData.client_id}
              onValueChange={(v) => setFormData({ ...formData, client_id: v })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a client from database" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.email ? ` — ${c.email}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Passengers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-base font-semibold">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                Passengers ({passengers.filter((p) => p.name.trim()).length})
              </Label>
              <Button type="button" onClick={addPassenger} size="sm" variant="outline">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Passenger
              </Button>
            </div>

            <div className="space-y-2">
              {passengers.map((pax, idx) => (
                <div key={pax.id} className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted">
                  <div className="flex-1">
                    <Input
                      value={pax.name}
                      onChange={(e) => updatePassenger(idx, 'name', e.target.value)}
                      placeholder={`Passenger ${idx + 1} full name`}
                      className="bg-card"
                    />
                  </div>

                  {/* Room with */}
                  {filledPassengers.filter((p) => p.id !== pax.id && p.name.trim()).length > 0 && (
                    <div className="w-40">
                      <Select value={pax.room_with || ''} onValueChange={(v) => updatePassenger(idx, 'room_with', v)}>
                        <SelectTrigger className="bg-card h-9 text-xs">
                          <BedDouble className="w-3 h-3 mr-1 text-muted-foreground flex-shrink-0" />
                          <SelectValue placeholder="Rooms with..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>Single / TBD</SelectItem>
                          {filledPassengers
                            .filter((p) => p.id !== pax.id && p.name.trim())
                            .map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Contact toggle */}
                  <button
                    type="button"
                    onClick={() => setContact(idx)}
                    title={pax.is_contact ? 'Contact passenger' : 'Set as contact'}
                    className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${pax.is_contact ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300' : 'text-muted-foreground hover:text-amber-400'}`}
                  >
                    <Star className="w-4 h-4" fill={pax.is_contact ? 'currentColor' : 'none'} />
                  </button>

                  {passengers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePassenger(idx)}
                      className="text-muted-foreground hover:text-red-500 dark:hover:text-red-300 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {passengers.some((p) => p.name.trim()) && !passengers.some((p) => p.is_contact) && (
              <p className="text-xs text-amber-600 dark:text-amber-300 flex items-center gap-1">
                <Star className="w-3 h-3" /> Click the star icon to set a contact passenger
              </p>
            )}
            {passengers.some((p) => p.is_contact) && (
              <p className="text-xs text-green-600 dark:text-green-300 flex items-center gap-1">
                <Star className="w-3 h-3" fill="currentColor" />
                Contact: <strong>{passengers.find((p) => p.is_contact)?.name}</strong>
              </p>
            )}
          </div>

          {/* Activities */}
          <div className="space-y-2">
            <Label>Activities</Label>
            <div className="flex gap-2">
              <Input
                value={activityInput}
                onChange={(e) => setActivityInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addActivity())}
                placeholder="Add activity (e.g., Hiking, Beach)"
              />
              <Button type="button" onClick={addActivity} size="icon" variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {formData.activities.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.activities.map((activity, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                  >
                    {activity}
                    <button
                      type="button"
                      onClick={() => removeActivity(idx)}
                      className="hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <Label>Cover Image URL</Label>
            <Input
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              placeholder="https://images.unsplash.com/..."
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional details..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={!formData.client_id}>
              Create Trip
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
