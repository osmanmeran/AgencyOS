const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { parseISO, isBefore, isAfter } from 'date-fns';

const CURRENCIES = { USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' };

export default function CreateInvoice() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preselectedTripId = searchParams.get('tripId');
  
  const [formData, setFormData] = useState({
    invoice_number: `INV-${Date.now()}`,
    client_id: '',
    proposal_id: '',
    trip_id: preselectedTripId || '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    line_items: [],
    tax_rate: 0,
    currency: 'USD',
    notes: '',
    payment_terms: 'Due within 30 days',
    status: 'draft'
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => db.entities.Client.list()
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => db.entities.Proposal.list()
  });

  const { data: trips = [] } = useQuery({
    queryKey: ['trips'],
    queryFn: () => db.entities.Trip.list()
  });

  const { data: appSettings } = useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => {
      const all = await db.entities.AppSettings.list();
      return all[0];
    }
  });

  // Init defaults from app settings on mount
  useEffect(() => {
    if (appSettings) {
      setFormData(prev => ({
        ...prev,
        payment_terms: appSettings.default_payment_terms || prev.payment_terms,
        notes: appSettings.default_invoice_notes || prev.notes
      }));
    }
  }, [appSettings]);

  // Filter for approved/confirmed and ongoing reservations only
  const today = new Date();
  const eligibleReservations = trips.filter(trip => {
    const endDate = parseISO(trip.end_date);
    const isOngoing = !isBefore(endDate, today);
    const isApproved = trip.status === 'confirmed' || trip.status === 'in_progress' || trip.proposal_status === 'confirmed';
    return isOngoing && isApproved;
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const invoice = await db.entities.Invoice.create(data);
      
      // Update client balance
      const client = clients.find(c => c.id === data.client_id);
      if (client) {
        await db.entities.Client.update(client.id, {
          ...client,
          total_owed: (client.total_owed || 0) + data.total_amount
        });
      }
      
      return invoice;
    },
    onSuccess: (invoice) => {
      showSuccess('Invoice created');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      navigate(createPageUrl(`InvoiceDetails?id=${invoice.id}`));
    },
    onError: (error) => showError('Failed to create invoice', error.message)
  });

  const addLineItem = () => {
    setFormData({
      ...formData,
      line_items: [
        ...formData.line_items,
        { description: '', quantity: 1, unit_price: 0, amount: 0 }
      ]
    });
  };

  const updateLineItem = (index, field, value) => {
    const items = [...formData.line_items];
    items[index][field] = value;
    
    if (field === 'quantity' || field === 'unit_price') {
      items[index].amount = items[index].quantity * items[index].unit_price;
    }
    
    setFormData({ ...formData, line_items: items });
  };

  const removeLineItem = (index) => {
    setFormData({
      ...formData,
      line_items: formData.line_items.filter((_, i) => i !== index)
    });
  };

  const loadFromProposal = (proposalId) => {
    const proposal = proposals.find(p => p.id === proposalId);
    if (proposal && proposal.services) {
      const lineItems = proposal.services.map(service => ({
        description: service.name + (service.description ? ` - ${service.description}` : ''),
        quantity: service.quantity || 1,
        unit_price: service.cost || 0,
        amount: (service.quantity || 1) * (service.cost || 0)
      }));
      
      setFormData({
        ...formData,
        proposal_id: proposalId,
        client_id: proposal.client_id || formData.client_id,
        trip_id: proposal.trip_id || formData.trip_id,
        line_items: lineItems
      });
    }
  };

  const effQty = (svc) => {
    const qty = parseInt(svc.quantity) || 1;
    if (svc.unit === 'per_night' || svc.unit === 'per_day') {
      if (svc.start_date && svc.end_date) {
        const days = Math.max(1, Math.round((new Date(svc.end_date) - new Date(svc.start_date)) / 86400000));
        return qty * days;
      }
      return qty;
    }
    return qty;
  };

  const handleReservationSelect = (tripId) => {
    const trip = trips.find(t => t.id === tripId);
    const lineItems = (trip?.services || []).map(s => ({
      description: `${s.name}${s.category ? ` (${s.category})` : ''}`,
      quantity: effQty(s),
      unit_price: parseFloat(s.selling_price) || 0,
      amount: effQty(s) * (parseFloat(s.selling_price) || 0)
    }));
    setFormData({ 
      ...formData, 
      trip_id: tripId,
      client_id: trip?.client_id || formData.client_id,
      line_items: lineItems,
      currency: trip?.selling_currency || 'USD'
    });
  };

  const subtotal = formData.line_items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = subtotal * (formData.tax_rate / 100);
  const totalAmount = subtotal + taxAmount;
  const cs = CURRENCIES[formData.currency || 'USD'] || '$';

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      amount_due: totalAmount,
      amount_paid: 0,
      currency: formData.currency || 'USD'
    });
  };

  return (
    <div className="space-y-6">
      <Link to={createPageUrl('Revenue')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Revenue
        </Button>
      </Link>

      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Create Invoice</h1>
        <p className="text-slate-600">Generate a new invoice for a client</p>
      </div>

      {eligibleReservations.length === 0 && (
        <Card className="p-6 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">No eligible reservations</h3>
              <p className="text-amber-700 text-sm mt-1">
                Invoices can only be created for ongoing and approved reservations. 
                Please confirm a reservation first before creating an invoice.
              </p>
            </div>
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 bg-white shadow-md">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Invoice Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Invoice Number *</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="trip">Reservation * (must be approved & ongoing)</Label>
              <Select value={formData.trip_id} onValueChange={handleReservationSelect} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select reservation" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleReservations.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.reference_number ? `${t.reference_number} - ` : ''}{t.name} ({t.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Only approved and ongoing reservations are shown</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={formData.currency || 'USD'} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(CURRENCIES).map(cur => (
                    <SelectItem key={cur} value={cur}>{CURRENCIES[cur]} {cur}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="proposal">Link to Proposal (Optional)</Label>
              <Select value={formData.proposal_id} onValueChange={loadFromProposal}>
                <SelectTrigger>
                  <SelectValue placeholder="Select proposal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {proposals.filter(p => p.status === 'approved').map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="issue_date">Issue Date *</Label>
              <Input
                id="issue_date"
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date *</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-900">Line Items</h2>
            <Button type="button" onClick={addLineItem} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>

          <div className="space-y-4">
            {formData.line_items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-start p-4 bg-slate-50 rounded-lg">
                <div className="col-span-5">
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    value={item.unit_price}
                    onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2 flex items-center">
                  <div className="font-bold">{cs}{item.amount.toFixed(2)}</div>
                </div>
                <div className="col-span-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeLineItem(index)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}

            {formData.line_items.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                No line items. Click "Add Item" to add invoice items.
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="max-w-sm ml-auto space-y-3">
              <div className="flex justify-between text-lg">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-semibold">{cs}{subtotal.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Tax Rate (%):</span>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                  className="w-24 text-right"
                />
              </div>
              
              <div className="flex justify-between text-lg">
                <span className="text-slate-600">Tax Amount:</span>
                <span className="font-semibold">{cs}{taxAmount.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between text-2xl font-bold border-t-2 pt-3">
                <span>Total:</span>
                <span className="text-green-700">{cs}{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white shadow-md">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Additional Information</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Input
                id="payment_terms"
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Additional notes or terms..."
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Link to={createPageUrl('Revenue')}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button 
            type="submit" 
            className="bg-blue-600 hover:bg-blue-700" 
            disabled={createMutation.isLoading || !formData.client_id || !formData.trip_id || formData.line_items.length === 0 || eligibleReservations.length === 0}
          >
            {createMutation.isLoading ? 'Creating...' : 'Create Invoice'}
          </Button>
        </div>
      </form>
    </div>
  );
}