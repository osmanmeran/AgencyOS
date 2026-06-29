const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, Mail, Phone, Building, MapPin, CreditCard, FileText, 
  DollarSign, Plus, Upload, Download, Plane, Star, Edit, Globe, XCircle, RotateCcw
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { SkeletonCard } from '@/components/ui/skeletons';
import { usePermissions } from '../components/permissions/PermissionContext';
import { showSuccess, showError } from '@/lib/toast';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';
import ClientProfile from '../components/clients/ClientProfile';
import ClientTasksPanel from '../components/clients/ClientTasksPanel';

const STATUS_COLORS = {
active: 'bg-green-100 text-green-800',
inactive: 'bg-gray-100 text-gray-800',
vip: 'bg-purple-100 text-purple-800',
cancelled: 'bg-red-100 text-red-800'
};

const PAYMENT_STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-orange-100 text-orange-800'
};

export default function ClientDetails() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('id');
  const { hasPermission } = usePermissions();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'credit_card',
    transaction_id: '',
    status: 'completed',
    notes: ''
  });
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => db.entities.Client.get(clientId),
    enabled: !!clientId
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['clientPayments', clientId],
    queryFn: () => db.entities.ClientPayment.filter({ client_id: clientId }, '-payment_date'),
    enabled: !!clientId
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ['clientProposals', clientId],
    queryFn: () => db.entities.Proposal.filter({ client_id: clientId }),
    enabled: !!clientId
  });

  const { data: trips = [] } = useQuery({
    queryKey: ['clientTrips', clientId],
    queryFn: () => db.entities.Trip.filter({ client_id: clientId }),
    enabled: !!clientId
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['clientInvoices', clientId],
    queryFn: () => db.entities.Invoice.filter({ client_id: clientId }),
    enabled: !!clientId
  });

  const addPaymentMutation = useMutation({
    mutationFn: (data) => db.entities.ClientPayment.create({ ...data, client_id: clientId }),
    onSuccess: async (payment) => {
      showSuccess('Payment added');
      const newTotal = (client.total_paid || 0) + payment.amount;
      await db.entities.Client.update(clientId, {
        ...client,
        total_paid: newTotal
      });
      queryClient.invalidateQueries({ queryKey: ['clientPayments', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setPaymentModalOpen(false);
      setPaymentFormData({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'credit_card',
        transaction_id: '',
        status: 'completed',
        notes: ''
      });
    },
    onError: (error) => showError('Failed to add payment', error.message)
  });

  const handleFileUpload = async (e, paymentId) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingReceipt(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      const payment = payments.find(p => p.id === paymentId);
      await db.entities.ClientPayment.update(paymentId, {
        ...payment,
        receipt_url: file_url
      });
      queryClient.invalidateQueries({ queryKey: ['clientPayments', clientId] });
    } finally {
      setUploadingReceipt(false);
    }
  };

  const updateClientMutation = useMutation({
    mutationFn: (data) => {
      return db.entities.Client.update(clientId, data);
    },
    onSuccess: () => {
      showSuccess('Client updated');
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setEditModalOpen(false);
    },
    onError: (error) => showError('Failed to update client', error.message)
  });

  const cancelClientMutation = useMutation({
    mutationFn: () => db.entities.Client.update(clientId, { status: 'cancelled' }),
    onSuccess: () => {
      showSuccess('Client cancelled');
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setCancelDialogOpen(false);
    },
    onError: (error) => showError('Failed to cancel client', error.message)
  });

  const reactivateClientMutation = useMutation({
    mutationFn: () => db.entities.Client.update(clientId, { status: 'active' }),
    onSuccess: () => {
      showSuccess('Client reactivated');
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
    },
    onError: (error) => showError('Failed to reactivate client', error.message)
  });

  const openEditModal = () => {
    setEditForm({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      company: client.company || '',
      address: client.address || '',
      city: client.city || '',
      country: client.country || '',
      passport_number: client.passport_number || '',
      date_of_birth: client.date_of_birth || '',
      invoice_address: client.invoice_address || '',
      tax_id: client.tax_id || '',
      payment_method: client.payment_method || 'credit_card',
      status: client.status || 'active',
      notes: client.notes || '',
      website: client.website || '',
      logo_url: client.logo_url || '',
    });
    setEditModalOpen(true);
  };

  const totalPaid = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  if (isLoading) {
    return <SkeletonCard />;
  }

  if (!client) {
    return <div className="text-center py-20">Client not found</div>;
  }

  return (
    <div className="space-y-6">
      <Link to={createPageUrl('Clients')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </Button>
      </Link>

      {/* Client Header */}
      <Card className="p-8 bg-white shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-3xl font-bold text-blue-600">
                {client.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                {client.name}
                {client.status === 'vip' && <Star className="w-6 h-6 text-purple-600 fill-purple-600" />}
              </h1>
              {client.company && (
                <p className="text-lg text-slate-600 mb-2">{client.company}</p>
              )}
              <Badge className={STATUS_COLORS[client.status]}>
                {client.status}
              </Badge>
            </div>
          </div>
          {hasPermission('modify_clients') && (
            <div className="flex gap-2">
              <Button onClick={openEditModal} variant="outline">
                <Edit className="w-4 h-4 mr-2" /> Edit Client
              </Button>
              {client.status === 'cancelled' ? (
                <Button onClick={() => reactivateClientMutation.mutate()} variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">
                  <RotateCcw className="w-4 h-4 mr-2" /> Reactivate
                </Button>
              ) : (
                <Button onClick={() => setCancelDialogOpen(true)} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
                  <XCircle className="w-4 h-4 mr-2" /> Cancel Client
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            {client.email && (
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="w-4 h-4 text-slate-500" />
                <a href={`mailto:${client.email}`} className="hover:text-blue-600">
                  {client.email}
                </a>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="w-4 h-4 text-slate-500" />
                <a href={`tel:${client.phone}`} className="hover:text-blue-600">
                  {client.phone}
                </a>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {client.address && (
              <div className="flex items-start gap-2 text-slate-700">
                <MapPin className="w-4 h-4 text-slate-500 mt-1" />
                <div>
                  <div>{client.address}</div>
                  {client.city && client.country && (
                    <div className="text-sm">{client.city}, {client.country}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {client.website && (
              <div className="flex items-center gap-2 text-slate-700">
                <Globe className="w-4 h-4 text-slate-500" />
                <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 truncate">{client.website}</a>
              </div>
            )}
            {client.payment_method && (
              <div className="flex items-center gap-2 text-slate-700">
                <CreditCard className="w-4 h-4 text-slate-500" />
                <span className="capitalize">{client.payment_method.replace('_', ' ')}</span>
              </div>
            )}
            {client.passport_number && (
              <div className="flex items-center gap-2 text-slate-700">
                <FileText className="w-4 h-4 text-slate-500" />
                Passport: {client.passport_number}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Total Paid</div>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">${totalPaid.toFixed(2)}</div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Total Owed</div>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">${(client.total_owed || 0).toFixed(2)}</div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Proposals</div>
            <FileText className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{proposals.length}</div>
        </Card>
      </div>

      <Tabs defaultValue="payments" className="space-y-6">
        <TabsList className="bg-white border border-slate-200 p-1 flex-wrap h-auto">
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="trips">Trips</TabsTrigger>
          <TabsTrigger value="profile">Profile & Business</TabsTrigger>
          <TabsTrigger value="tasks">Tasks & Reminders</TabsTrigger>
        </TabsList>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setPaymentModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Payment
            </Button>
          </div>

          {payments.length === 0 ? (
            <Card className="p-12 text-center bg-white">
              <p className="text-slate-600">No payments recorded</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {payments.map(payment => (
                <Card key={payment.id} className="p-6 bg-white hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-2xl font-bold text-green-700">
                          ${payment.amount.toFixed(2)}
                        </div>
                        <Badge className={PAYMENT_STATUS_COLORS[payment.status]}>
                          {payment.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <div>Date: {format(new Date(payment.payment_date), 'MMM d, yyyy')}</div>
                        <div className="capitalize">Method: {payment.payment_method.replace('_', ' ')}</div>
                        {payment.transaction_id && <div>Transaction: {payment.transaction_id}</div>}
                        {payment.notes && <div className="mt-2 text-slate-700">{payment.notes}</div>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {payment.receipt_url ? (
                        <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Receipt
                          </Button>
                        </a>
                      ) : (
                        <div>
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => handleFileUpload(e, payment.id)}
                            className="hidden"
                            id={`upload-${payment.id}`}
                            disabled={uploadingReceipt}
                          />
                          <label htmlFor={`upload-${payment.id}`}>
                            <Button size="sm" variant="outline" disabled={uploadingReceipt} asChild>
                              <span className="cursor-pointer">
                                <Upload className="w-4 h-4 mr-2" />
                                {uploadingReceipt ? 'Uploading...' : 'Upload Receipt'}
                              </span>
                            </Button>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          {invoices.length === 0 ? (
            <Card className="p-12 text-center bg-white">
              <p className="text-slate-600">No invoices for this client</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {invoices.map(invoice => (
                <Link key={invoice.id} to={createPageUrl(`InvoiceDetails?id=${invoice.id}`)}>
                  <Card className="p-6 bg-white hover:shadow-xl transition-shadow cursor-pointer">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-slate-900 mb-1">{invoice.invoice_number}</h3>
                        <div className="text-sm text-slate-600">
                          <div>Issued: {format(new Date(invoice.issue_date), 'MMM d, yyyy')}</div>
                          <div>Due: {format(new Date(invoice.due_date), 'MMM d, yyyy')}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                          {invoice.status}
                        </Badge>
                        <div className="font-bold text-green-700 mt-2">${invoice.total_amount.toFixed(2)}</div>
                        {invoice.amount_due > 0 && (
                          <div className="text-sm text-orange-600">Due: ${invoice.amount_due.toFixed(2)}</div>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Proposals Tab */}
        <TabsContent value="proposals">
          {proposals.length === 0 ? (
            <Card className="p-12 text-center bg-white">
              <p className="text-slate-600">No proposals for this client</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {proposals.map(proposal => (
                <Link key={proposal.id} to={createPageUrl(`ProposalDetails?id=${proposal.id}`)}>
                  <Card className="p-6 bg-white hover:shadow-xl transition-shadow cursor-pointer">
                    <h3 className="font-bold text-lg text-slate-900 mb-2">{proposal.title}</h3>
                    <div className="text-sm text-slate-600 mb-3">
                      {proposal.destination && <div>Destination: {proposal.destination}</div>}
                    </div>
                    <div className="flex justify-between items-center">
                      <Badge className={proposal.status === 'accepted' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                        {proposal.status}
                      </Badge>
                      <div className="font-bold text-green-700">${(proposal.total_cost || 0).toFixed(2)}</div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Trips Tab */}
        <TabsContent value="trips">
          {trips.length === 0 ? (
            <Card className="p-12 text-center bg-white">
              <p className="text-slate-600">No trips allocated to this client</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {trips.map(trip => (
                <Link key={trip.id} to={createPageUrl(`TripDetails?id=${trip.id}`)}>
                  <Card className="p-6 bg-white hover:shadow-xl transition-shadow cursor-pointer">
                    <div className="flex items-center gap-3 mb-3">
                      <Plane className="w-5 h-5 text-blue-600" />
                      <h3 className="font-bold text-lg text-slate-900">{trip.name}</h3>
                    </div>
                    <div className="text-sm text-slate-600">
                      <div>{trip.destination}</div>
                      <div className="mt-2">
                        {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <ClientProfile client={client} clientId={clientId} />
        </TabsContent>

        {/* Tasks & Reminders Tab */}
        <TabsContent value="tasks">
          <ClientTasksPanel clientId={clientId} />
        </TabsContent>
      </Tabs>

      {/* Edit Client Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateClientMutation.mutate(editForm); }} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Passport Number</Label>
                <Input value={editForm.passport_number} onChange={(e) => setEditForm({ ...editForm, passport_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input type="date" value={editForm.date_of_birth} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tax ID</Label>
                <Input value={editForm.tax_id} onChange={(e) => setEditForm({ ...editForm, tax_id: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={editForm.payment_method} onValueChange={(v) => setEditForm({ ...editForm, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Invoice Address</Label>
              <Textarea value={editForm.invoice_address} onChange={(e) => setEditForm({ ...editForm, invoice_address: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            addPaymentMutation.mutate({
              ...paymentFormData,
              amount: parseFloat(paymentFormData.amount)
            });
          }} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={paymentFormData.amount}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date *</Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentFormData.payment_date}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select value={paymentFormData.payment_method} onValueChange={(v) => setPaymentFormData({ ...paymentFormData, payment_method: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transaction_id">Transaction ID</Label>
              <Input
                id="transaction_id"
                value={paymentFormData.transaction_id}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, transaction_id: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={paymentFormData.notes}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setPaymentModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Add Payment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* Cancel Client Confirmation */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark <strong>{client?.name}</strong> as cancelled. They will no longer appear as active in the system. You can reactivate them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Client</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelClientMutation.mutate()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Cancel Client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}