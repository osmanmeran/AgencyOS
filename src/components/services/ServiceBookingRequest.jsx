import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Loader2 } from 'lucide-react';

export default function ServiceBookingRequest({ open, onClose, service, tripId, supplierId }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    supplier_id: supplierId || '',
    service_date: '',
    num_guests: 1,
    service_details: '',
    total_cost: service?.base_price || 0
  });
  const [sending, setSending] = useState(false);

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['suppliers'],
    queryFn: () => db.entities.Supplier.list()
  }));

  const { data: settings } = /** @type {any} */ (useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => {
      const all = await db.entities.AppSettings.list();
      return all[0] || {};
    }
  }));

  // Get supplier contacts from service template
  const serviceSuppliers = service?.supplier_ids?.map(id => suppliers.find(s => s.id === id)).filter(Boolean) || [];
  const supplierContact = service?.supplier_contacts?.find(c => c.supplier_id === formData.supplier_id);

  const generateReferenceNumber = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const prefix = settings?.reference_format?.prefix || 'BK';
    
    // Get or create counter
    const counters = await db.entities.ReferenceCounter.filter({
      department: 'booking',
      year: year,
      month: month
    });

    let counter = 1;
    if (counters.length > 0) {
      counter = (counters[0].counter || 0) + 1;
      await db.entities.ReferenceCounter.update(counters[0].id, { ...counters[0], counter });
    } else {
      await db.entities.ReferenceCounter.create({ department: 'booking', year, month, counter: 1 });
    }

    return `${prefix}-${year}${String(month).padStart(2, '0')}-${String(counter).padStart(4, '0')}`;
  };

  const createBookingMutation = /** @type {any} */ (useMutation({
    mutationFn: async () => {
      setSending(true);
      const referenceNumber = await generateReferenceNumber();
      
      const booking = await db.entities.BookingRequest.create({
        reference_number: referenceNumber,
        trip_id: tripId,
        supplier_id: formData.supplier_id,
        service_id: service?.id,
        service_date: formData.service_date,
        service_details: `${service?.name}\n\n${formData.service_details}`,
        num_guests: parseInt(String(formData.num_guests)),
        total_cost: parseFloat(formData.total_cost),
        status: 'pending'
      });

      // Send email to supplier if contact available
      if (supplierContact?.contact_email) {
        await db.integrations.Core.SendEmail({
          to: supplierContact.contact_email,
          subject: `Booking Request - ${referenceNumber}`,
          body: `
Dear ${supplierContact.contact_name || 'Partner'},

We have a new booking request:

Reference: ${referenceNumber}
Service: ${service?.name}
Date: ${formData.service_date}
Guests: ${formData.num_guests}

Details:
${formData.service_details}

Please confirm availability at your earliest convenience.

Best regards,
TravelPro Team
          `
        });
      }

      return booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingRequests'] });
      setSending(false);
      onClose();
    },
    onError: () => setSending(false)
  }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Booking Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="font-semibold text-blue-900">{service?.name}</div>
            <div className="text-sm text-blue-700">{service?.description}</div>
          </div>

          <div className="space-y-2">
            <Label>Select Supplier *</Label>
            <Select value={formData.supplier_id} onValueChange={(v) => setFormData({ ...formData, supplier_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choose supplier" /></SelectTrigger>
              <SelectContent>
                {serviceSuppliers.length > 0 ? (
                  serviceSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                ) : (
                  suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
            {supplierContact && (
              <div className="text-xs text-slate-600 mt-1">
                Contact: {supplierContact.contact_name} ({supplierContact.contact_email})
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Service Date *</Label>
              <Input 
                type="date"
                value={formData.service_date}
                onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Number of Guests *</Label>
              <Input 
                type="number"
                min="1"
                value={formData.num_guests}
                onChange={(e) => setFormData({ ...formData, num_guests: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Estimated Cost</Label>
            <Input 
              type="number"
              step="0.01"
              value={formData.total_cost}
              onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Additional Details</Label>
            <Textarea 
              value={formData.service_details}
              onChange={(e) => setFormData({ ...formData, service_details: e.target.value })}
              placeholder="Special requests, timing preferences, etc."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button 
              onClick={() => createBookingMutation.mutate()}
              disabled={!formData.supplier_id || !formData.service_date || sending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Send Request</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}