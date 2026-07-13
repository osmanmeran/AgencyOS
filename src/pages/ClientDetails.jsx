import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  DollarSign,
  Plus,
  Upload,
  Download,
  Plane,
  Star,
  Edit,
  Globe,
  XCircle,
  RotateCcw,
  Eye,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SkeletonCard } from '@/components/ui/skeletons';
import { usePermissions } from '../components/permissions/PermissionContext';
import { showSuccess, showError } from '@/lib/toast';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { setActAsClientId } from '@/lib/actAsClient';
import { format } from 'date-fns';
import ClientProfile from '../components/clients/ClientProfile';
import ClientTasksPanel from '../components/clients/ClientTasksPanel';
import LocationSearch from '@/components/services/LocationSearch';
import { getCurrencySymbol, mixedCurrencyLabel } from '@/lib/formatters';

const STATUS_COLORS = {
  active: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  inactive: 'bg-muted text-foreground',
  vip: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300',
  cancelled: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
};

const PAYMENT_STATUS_COLORS = {
  pending: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300',
  completed: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  failed: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
  refunded: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300',
};

export default function ClientDetails() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('id');
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();

  // Open the client portal scoped to this client so staff can see exactly what
  // the client sees (read-only). The selection is remembered by actAsClient.js
  // and surfaced as a banner in the portal, with an Exit back to admin.
  const viewPortalAsClient = () => {
    setActAsClientId(clientId);
    navigate(createPageUrl('ClientPortal'));
  };
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [editForm, setEditForm] = useState(/** @type {any} */ ({}));
  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'credit_card',
    transaction_id: '',
    status: 'completed',
    notes: '',
  });
  const [tempPassword, setTempPassword] = useState(/** @type {any} */ (null));
  const queryClient = useQueryClient();

  const { data: portalStatus, isLoading: portalLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientPortal', clientId],
      queryFn: () => db.auth.getClientPortal(clientId),
      enabled: !!clientId && hasPermission('grant_client_portal'),
    })
  );

  const grantPortalMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () => db.auth.grantClientPortal(clientId),
      onSuccess: (/** @type {any} */ res) => {
        showSuccess('Client Portal access granted');
        if (res.tempPassword) setTempPassword(res.tempPassword);
        queryClient.invalidateQueries({ queryKey: ['clientPortal', clientId] });
        queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      },
      onError: (error) => showError('Failed to grant access', error.message),
    })
  );

  const revokePortalMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () => db.auth.revokeClientPortal(clientId),
      onSuccess: () => {
        showSuccess('Client Portal access revoked');
        queryClient.invalidateQueries({ queryKey: ['clientPortal', clientId] });
        queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      },
      onError: (error) => showError('Failed to revoke access', error.message),
    })
  );

  const { data: client, isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['client', clientId],
      queryFn: () => db.entities.Client.get(clientId),
      enabled: !!clientId,
    })
  );

  const { data: payments = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientPayments', clientId],
      queryFn: () => db.entities.ClientPayment.filter({ client_id: clientId }, '-payment_date'),
      enabled: !!clientId,
    })
  );

  const { data: proposals = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientProposals', clientId],
      queryFn: () => db.entities.Proposal.filter({ client_id: clientId }),
      enabled: !!clientId,
    })
  );

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientTrips', clientId],
      queryFn: () => db.entities.Trip.filter({ client_id: clientId }),
      enabled: !!clientId,
    })
  );

  const { data: invoices = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientInvoices', clientId],
      queryFn: () => db.entities.Invoice.filter({ client_id: clientId }),
      enabled: !!clientId,
    })
  );

  const addPaymentMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) =>
        db.entities.ClientPayment.create({
          ...data,
          client_id: clientId,
          currency: client.preferred_currency || 'USD',
        }),
      onSuccess: async (/** @type {any} */ payment) => {
        showSuccess('Payment added');
        const newTotal = (client.total_paid || 0) + payment.amount;
        await db.entities.Client.update(clientId, {
          ...client,
          total_paid: newTotal,
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
          notes: '',
        });
      },
      onError: (error) => showError('Failed to add payment', error.message),
    })
  );

  const handleFileUpload = async (e, paymentId) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingReceipt(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      const payment = payments.find((p) => p.id === paymentId);
      await db.entities.ClientPayment.update(paymentId, {
        ...payment,
        receipt_url: file_url,
      });
      queryClient.invalidateQueries({ queryKey: ['clientPayments', clientId] });
    } finally {
      setUploadingReceipt(false);
    }
  };

  const updateClientMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => {
        return db.entities.Client.update(clientId, data);
      },
      onSuccess: () => {
        showSuccess('Client updated');
        queryClient.invalidateQueries({ queryKey: ['client', clientId] });
        setEditModalOpen(false);
      },
      onError: (error) => showError('Failed to update client', error.message),
    })
  );

  const cancelClientMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () => db.entities.Client.update(clientId, { status: 'cancelled' }),
      onSuccess: () => {
        showSuccess('Client cancelled');
        queryClient.invalidateQueries({ queryKey: ['client', clientId] });
        setCancelDialogOpen(false);
      },
      onError: (error) => showError('Failed to cancel client', error.message),
    })
  );

  const reactivateClientMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () => db.entities.Client.update(clientId, { status: 'active' }),
      onSuccess: () => {
        showSuccess('Client reactivated');
        queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      },
      onError: (error) => showError('Failed to reactivate client', error.message),
    })
  );

  const openEditModal = () => {
    setEditForm({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      phone_secondary: client.phone_secondary || '',
      age_category: client.age_category || 'adult',
      company: client.company || '',
      address: client.address || '',
      city: client.city || '',
      country: client.country || '',
      passport_number: client.passport_number || '',
      date_of_birth: client.date_of_birth || '',
      invoice_address: client.invoice_address || '',
      tax_id: client.tax_id || '',
      payment_method: client.payment_method || 'credit_card',
      preferred_currency: client.preferred_currency || 'USD',
      default_markup: client.default_markup ?? 0,
      status: client.status || 'active',
      notes: client.notes || '',
      website: client.website || '',
      logo_url: client.logo_url || '',
    });
    setEditModalOpen(true);
  };

  const totalPaid = payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
  const clientCs = getCurrencySymbol(client?.preferred_currency || 'USD');

  if (isLoading) {
    return <SkeletonCard />;
  }

  if (!client) {
    return <div className="text-center py-20">Client not found</div>;
  }

  return (
    <div className="space-y-6">
      <Link to={createPageUrl('ClientCRM')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </Button>
      </Link>

      {/* Client Header */}
      <Card className="p-8 bg-card shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <span className="text-3xl font-bold text-blue-600 dark:text-blue-300">
                {client.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
                {client.name}
                {client.status === 'vip' && (
                  <Star className="w-6 h-6 text-purple-600 dark:text-purple-300 fill-purple-600" />
                )}
              </h1>
              {client.company && <p className="text-lg text-muted-foreground mb-2">{client.company}</p>}
              <Badge className={STATUS_COLORS[client.status]}>{client.status}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={viewPortalAsClient}
              variant="outline"
              className="border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            >
              <Eye className="w-4 h-4 mr-2" /> View portal as client
            </Button>
            {hasPermission('modify_clients') && (
              <>
                <Button onClick={openEditModal} variant="outline">
                  <Edit className="w-4 h-4 mr-2" /> Edit Client
                </Button>
                {client.status === 'cancelled' ? (
                  <Button
                    onClick={() => reactivateClientMutation.mutate()}
                    variant="outline"
                    className="border-green-300 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950/40"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" /> Reactivate
                  </Button>
                ) : (
                  <Button
                    onClick={() => setCancelDialogOpen(true)}
                    variant="outline"
                    className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Cancel Client
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            {client.email && (
              <div className="flex items-center gap-2 text-foreground">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a href={`mailto:${client.email}`} className="hover:text-blue-600 dark:hover:text-blue-300">
                  {client.email}
                </a>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2 text-foreground">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <div>
                  <a href={`tel:${client.phone}`} className="hover:text-blue-600 dark:hover:text-blue-300">
                    {client.phone}
                  </a>
                  <span className="ml-1 text-xs text-muted-foreground">(principale)</span>
                </div>
              </div>
            )}
            {client.phone_secondary && (
              <div className="flex items-center gap-2 text-foreground">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <a href={`tel:${client.phone_secondary}`} className="hover:text-blue-600 dark:hover:text-blue-300">
                  {client.phone_secondary}
                </a>
              </div>
            )}
            {client.age_category && (
              <div className="flex items-center gap-2 text-foreground">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                  {{ adult: 'Adult', children: 'Children (3–11.99 years)', infant: 'Infant (0–2.99 years)' }[
                    client.age_category
                  ] || client.age_category}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {client.address && (
              <div className="flex items-start gap-2 text-foreground">
                <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                <div>
                  <div>{client.address}</div>
                  {client.city && client.country && (
                    <div className="text-sm">
                      {client.city}, {client.country}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {client.website && (
              <div className="flex items-center gap-2 text-foreground">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <a
                  href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 dark:hover:text-blue-300 truncate"
                >
                  {client.website}
                </a>
              </div>
            )}
            {client.payment_method && (
              <div className="flex items-center gap-2 text-foreground">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <span className="capitalize">{client.payment_method.replace('_', ' ')}</span>
              </div>
            )}
            {client.passport_number && (
              <div className="flex items-center gap-2 text-foreground">
                <FileText className="w-4 h-4 text-muted-foreground" />
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
          <div className="text-3xl font-bold">
            {clientCs}
            {totalPaid.toFixed(2)}
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Total Owed</div>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">
            {clientCs}
            {(client.total_owed || 0).toFixed(2)}
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Proposals</div>
            <FileText className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{proposals.length}</div>
        </Card>
      </div>

      {hasPermission('grant_client_portal') && (
        <Card className="p-6 bg-card shadow-md">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Client Portal Access</h3>
              <p className="text-sm text-muted-foreground">
                {portalStatus?.account?.is_active
                  ? `Portal login active for ${client.email}`
                  : portalStatus?.account?.exists
                    ? 'Portal login created but inactive'
                    : 'No portal login created yet'}
                {portalStatus?.company ? ` · Company: ${portalStatus.company.name}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={
                  portalStatus?.portal_access
                    ? 'text-green-600 dark:text-green-400 font-medium'
                    : 'text-muted-foreground'
                }
              >
                {portalStatus?.portal_access ? 'Enabled' : 'Disabled'}
              </span>
              <Switch
                checked={!!portalStatus?.portal_access}
                disabled={portalLoading || grantPortalMutation.isPending || revokePortalMutation.isPending}
                onCheckedChange={(/** @type {boolean} */ enabled) =>
                  enabled ? grantPortalMutation.mutate() : revokePortalMutation.mutate()
                }
              />
            </div>
          </div>
          {!client.email && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              Add an email address to this client before granting portal access.
            </p>
          )}
        </Card>
      )}

      <Tabs defaultValue="payments" className="space-y-6">
        <TabsList className="bg-card border border-border p-1 flex-wrap h-auto">
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
            <Card className="p-12 text-center bg-card">
              <p className="text-muted-foreground">No payments recorded</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => (
                <Card key={payment.id} className="p-6 bg-card hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                          {getCurrencySymbol(payment.currency || client.preferred_currency || 'USD')}
                          {payment.amount.toFixed(2)}
                        </div>
                        <Badge className={PAYMENT_STATUS_COLORS[payment.status]}>{payment.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Date: {format(new Date(payment.payment_date), 'MMM d, yyyy')}</div>
                        <div className="capitalize">Method: {payment.payment_method.replace('_', ' ')}</div>
                        {payment.transaction_id && <div>Transaction: {payment.transaction_id}</div>}
                        {payment.notes && <div className="mt-2 text-foreground">{payment.notes}</div>}
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
            <Card className="p-12 text-center bg-card">
              <p className="text-muted-foreground">No invoices for this client</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <Link key={invoice.id} to={createPageUrl(`InvoiceDetails?id=${invoice.id}`)}>
                  <Card className="p-6 bg-card hover:shadow-xl transition-shadow cursor-pointer">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-foreground mb-1">{invoice.invoice_number}</h3>
                        <div className="text-sm text-muted-foreground">
                          <div>Issued: {format(new Date(invoice.issue_date), 'MMM d, yyyy')}</div>
                          <div>Due: {format(new Date(invoice.due_date), 'MMM d, yyyy')}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          className={
                            invoice.status === 'paid'
                              ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
                              : 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300'
                          }
                        >
                          {invoice.status}
                        </Badge>
                        <div className="font-bold text-green-700 dark:text-green-300 mt-2">
                          {getCurrencySymbol(invoice.currency || 'USD')}
                          {invoice.total_amount.toFixed(2)}
                        </div>
                        {invoice.amount_due > 0 && (
                          <div className="text-sm text-orange-600 dark:text-orange-300">
                            Due: {getCurrencySymbol(invoice.currency || 'USD')}
                            {invoice.amount_due.toFixed(2)}
                          </div>
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
            <Card className="p-12 text-center bg-card">
              <p className="text-muted-foreground">No proposals for this client</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {proposals.map((proposal) => (
                <Link key={proposal.id} to={createPageUrl(`ProposalDetails?id=${proposal.id}`)}>
                  <Card className="p-6 bg-card hover:shadow-xl transition-shadow cursor-pointer">
                    <h3 className="font-bold text-lg text-foreground mb-2">{proposal.title}</h3>
                    <div className="text-sm text-muted-foreground mb-3">
                      {proposal.destination && <div>Destination: {proposal.destination}</div>}
                    </div>
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <Badge
                        className={
                          proposal.status === 'accepted'
                            ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
                            : 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300'
                        }
                      >
                        {proposal.status}
                      </Badge>
                      <div className="font-bold text-green-700 dark:text-green-300">
                        {mixedCurrencyLabel(proposal.services, 'client_currency').label}
                        {(proposal.total_cost || 0).toFixed(2)}
                      </div>
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
            <Card className="p-12 text-center bg-card">
              <p className="text-muted-foreground">No trips allocated to this client</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {trips.map((trip) => (
                <Link key={trip.id} to={createPageUrl(`ReservationDetails?id=${trip.id}`)}>
                  <Card className="p-6 bg-card hover:shadow-xl transition-shadow cursor-pointer">
                    <div className="flex items-center gap-3 mb-3">
                      <Plane className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                      <h3 className="font-bold text-lg text-foreground">{trip.name}</h3>
                    </div>
                    <div className="text-sm text-muted-foreground">
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateClientMutation.mutate(editForm);
            }}
            className="space-y-4 mt-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Age Category</Label>
                <Select
                  value={editForm.age_category}
                  onValueChange={(v) => setEditForm({ ...editForm, age_category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adult">Adult</SelectItem>
                    <SelectItem value="children">Children (3–11.99 years)</SelectItem>
                    <SelectItem value="infant">Infant (0–2.99 years)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Primary Contact *</Label>
                <Input
                  type="tel"
                  placeholder="+1 555 000 0000"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Secondary Contact</Label>
                <Input
                  type="tel"
                  placeholder="+1 555 000 0000"
                  value={editForm.phone_secondary || ''}
                  onChange={(e) => setEditForm({ ...editForm, phone_secondary: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <LocationSearch
                  value={editForm.address}
                  onChange={(v) => setEditForm({ ...editForm, address: v })}
                  onSelect={(item) =>
                    setEditForm((prev) => ({
                      ...prev,
                      address: item.label,
                      city: prev.city || item.city,
                      country: prev.country || item.country,
                    }))
                  }
                  placeholder="Search address (OpenStreetMap)..."
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={editForm.country}
                  onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Passport Number</Label>
                <Input
                  value={editForm.passport_number}
                  onChange={(e) => setEditForm({ ...editForm, passport_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={editForm.date_of_birth}
                  onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tax ID</Label>
                <Input value={editForm.tax_id} onChange={(e) => setEditForm({ ...editForm, tax_id: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                <Select
                  value={editForm.payment_method}
                  onValueChange={(v) => setEditForm({ ...editForm, payment_method: v })}
                >
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
                <Label>Portal Currency</Label>
                <Select
                  value={editForm.preferred_currency || 'USD'}
                  onValueChange={(v) => setEditForm({ ...editForm, preferred_currency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['USD', 'EUR', 'GBP', 'TRY', 'AED', 'SAR', 'EGP', 'MAD', 'JPY', 'CHF', 'CAD', 'AUD'].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Currency the client sees B2B prices in (auto-converted).
                </p>
              </div>
              <div className="space-y-2">
                <Label>Default Markup %</Label>
                <Input
                  type="number"
                  min="0"
                  max="200"
                  step="0.5"
                  value={editForm.default_markup ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, default_markup: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">Applied to supplier pricing for this client's quotes.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Invoice Address</Label>
              <Textarea
                value={editForm.invoice_address}
                onChange={(e) => setEditForm({ ...editForm, invoice_address: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addPaymentMutation.mutate({
                ...paymentFormData,
                amount: parseFloat(paymentFormData.amount),
              });
            }}
            className="space-y-4 mt-4"
          >
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
              <Select
                value={paymentFormData.payment_method}
                onValueChange={(v) => setPaymentFormData({ ...paymentFormData, payment_method: v })}
              >
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
              <Button type="submit">Add Payment</Button>
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
              This will mark <strong>{client?.name}</strong> as cancelled. They will no longer appear as active in the
              system. You can reactivate them at any time.
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

      <Dialog open={!!tempPassword} onOpenChange={(/** @type {boolean} */ o) => !o && setTempPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client Portal login created</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              A Client Portal account was created for <strong>{client?.email}</strong>. Share this temporary password
              with the client — they can change it after logging in.
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={tempPassword || ''} className="font-mono" />
              <Button
                type="button"
                variant="outline"
                onClick={() => navigator.clipboard?.writeText(tempPassword || '')}
              >
                Copy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
