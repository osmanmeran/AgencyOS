import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, FileText, Calendar, Edit, Eye } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = {
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  paid: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800'
};

export default function SupplierInvoices({ supplierId }) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [formData, setFormData] = useState({
    booking_request_id: '',
    trip_id: '',
    amount: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: ''
  });
  const [invoiceFile, setInvoiceFile] = useState(null);

  const { data: invoices = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['supplierInvoices', supplierId],
    queryFn: () => db.entities.SupplierInvoice.filter({ supplier_id: supplierId }, '-created_date'),
    enabled: !!supplierId
  }));

  const { data: bookings = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['supplierBookings', supplierId],
    queryFn: () => db.entities.BookingRequest.filter({ supplier_id: supplierId }),
    enabled: !!supplierId
  }));

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['trips'],
    queryFn: () => db.entities.Trip.list()
  }));

  const createMutation = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ data) => {
      let fileUrl = '';
      if (invoiceFile) {
        const { file_url } = await db.integrations.Core.UploadFile({ file: invoiceFile });
        fileUrl = file_url;
      }
      const invoiceNumber = `SINV-${Date.now().toString().slice(-8)}`;
      const createData = {
        supplier_id: supplierId,
        invoice_number: invoiceNumber,
        amount: parseFloat(data.amount),
        issue_date: data.issue_date,
        status: 'submitted'
      };
      if (data.trip_id) createData.trip_id = data.trip_id;
      if (data.booking_request_id) createData.booking_request_id = data.booking_request_id;
      if (data.due_date) createData.due_date = data.due_date;
      if (data.notes) createData.notes = data.notes;
      if (fileUrl) createData.file_url = fileUrl;
      return db.entities.SupplierInvoice.create(createData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierInvoices', supplierId] });
      closeModal();
    }
  }));

  const updateMutation = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ { id, /** @type {any} */ data }) => {
      let fileUrl = data.file_url || '';
      if (invoiceFile) {
        const { file_url } = await db.integrations.Core.UploadFile({ file: invoiceFile });
        fileUrl = file_url;
      }
      const updateData = {
        amount: parseFloat(data.amount),
        issue_date: data.issue_date
      };
      if (data.trip_id) updateData.trip_id = data.trip_id;
      if (data.booking_request_id) updateData.booking_request_id = data.booking_request_id;
      if (data.due_date) updateData.due_date = data.due_date;
      if (data.notes) updateData.notes = data.notes;
      if (fileUrl) updateData.file_url = fileUrl;
      return db.entities.SupplierInvoice.update(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierInvoices', supplierId] });
      closeModal();
    }
  }));

  const openModal = (invoice = null) => {
    if (invoice) {
      setSelectedInvoice(invoice);
      setFormData({
        booking_request_id: invoice.booking_request_id || '',
        trip_id: invoice.trip_id || '',
        amount: invoice.amount?.toString() || '',
        issue_date: invoice.issue_date || new Date().toISOString().split('T')[0],
        due_date: invoice.due_date || '',
        notes: invoice.notes || ''
      });
    } else {
      setSelectedInvoice(null);
      setFormData({
        booking_request_id: '',
        trip_id: '',
        amount: '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: '',
        notes: ''
      });
    }
    setInvoiceFile(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedInvoice(null);
    setInvoiceFile(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedInvoice) {
      updateMutation.mutate({ id: selectedInvoice.id, data: { ...selectedInvoice, ...formData } });
    } else {
      createMutation.mutate(formData);
    }
  };

  const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed');

  const getTrip = (id) => trips.find(t => t.id === id);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Submit Invoice
        </Button>
      </div>

      {invoices.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No invoices submitted</h3>
          <p className="text-slate-600">Submit invoices for your completed services</p>
        </Card>
      ) : (
        invoices.map(invoice => {
          const trip = getTrip(invoice.trip_id);
          return (
            <Card key={invoice.id} className="p-6 bg-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-slate-900">{invoice.invoice_number}</h3>
                    <Badge className={STATUS_COLORS[invoice.status]}>{invoice.status?.replace('_', ' ')}</Badge>
                  </div>
                  {trip && (
                    <p className="text-sm text-slate-500">Trip: {trip.reference_number || trip.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-green-700">${invoice.amount?.toFixed(2)}</div>
                  {invoice.status === 'submitted' && (
                    <Button variant="ghost" size="icon" onClick={() => openModal(invoice)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Issued: {format(new Date(invoice.issue_date), 'MMM d, yyyy')}</span>
                </div>
                {invoice.due_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>Due: {format(new Date(invoice.due_date), 'MMM d, yyyy')}</span>
                  </div>
                )}
                {invoice.file_url && (
                  <a href={invoice.file_url} target="_blank" rel="noopener noreferrer" 
                     className="text-blue-600 hover:underline flex items-center gap-1">
                    <Eye className="w-4 h-4" /> View Invoice
                  </a>
                )}
              </div>

              {invoice.notes && (
                <p className="text-slate-600 text-sm mt-3 pt-3 border-t">{invoice.notes}</p>
              )}
            </Card>
          );
        })
      )}

      {/* Create/Edit Invoice Modal */}
      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedInvoice ? 'Edit Invoice' : 'Submit Invoice'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Link to Trip</Label>
              <Select value={formData.trip_id} onValueChange={(v) => setFormData({ ...formData, trip_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select trip" /></SelectTrigger>
                <SelectContent>
                  {trips.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.reference_number ? `${t.reference_number} - ` : ''}{t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Related Booking (Optional)</Label>
              <Select value={formData.booking_request_id} onValueChange={(v) => setFormData({ ...formData, booking_request_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select booking" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {confirmedBookings.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.reference_number || b.id.slice(-6)} - {format(new Date(b.service_date), 'MMM d')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Issue Date *</Label>
                <Input 
                  type="date" 
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input 
                type="date" 
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Upload Invoice (PDF)</Label>
              <Input 
                type="file" 
                accept=".pdf"
                onChange={(e) => setInvoiceFile(e.target.files[0])}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {selectedInvoice ? 'Update Invoice' : 'Submit Invoice'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}