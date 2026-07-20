import { db } from '@/lib/DbContext';
import { getCurrencySymbol, mixedCurrencyLabel } from '@/lib/formatters';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SkeletonCard } from '@/components/ui/skeletons';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Send,
  Calendar,
  Users as UsersIcon,
  History,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Mail,
  Clock,
  AlertCircle,
  Loader2,
  Pencil,
  MapPin,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';
import ProposalEditModal from '@/components/proposals/ProposalEditModal';
import { useT } from '@/lib/i18n/I18nContext';

const STATUS_COLORS = {
  delivered: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  changed: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
  approved: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  rejected: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
};

const STATUS_LABELS = {
  delivered: 'Delivered',
  changed: 'Changed',
  approved: 'Approved',
  rejected: 'Rejected',
};

const BOOKING_STATUS_CONFIG = {
  not_requested: { label: 'Not Requested', color: 'bg-muted text-foreground', icon: AlertCircle },
  requested: {
    label: 'Requested',
    color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
    icon: Clock,
  },
  confirmed: {
    label: 'Confirmed',
    color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
    icon: CheckCircle,
  },
  rejected: { label: 'Rejected', color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300', icon: XCircle },
};

export default function ProposalDetails() {
  const { t: _t } = useT();
  const [searchParams] = useSearchParams();
  const proposalId = searchParams.get('id');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeDescription, setChangeDescription] = useState('');
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingServiceIdx, setBookingServiceIdx] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [supplierChoice, setSupplierChoice] = useState('existing');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [bookingNote, setBookingNote] = useState('');

  const { data: proposal, isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['proposal', proposalId],
      queryFn: () => db.entities.Proposal.get(proposalId),
      enabled: !!proposalId,
    })
  );

  const { data: user } = /** @type {any} */ (
    useQuery({
      queryKey: ['currentUser'],
      queryFn: () => db.auth.me(),
    })
  );

  const { data: settings } = /** @type {any} */ (
    useQuery({
      queryKey: ['appSettings'],
      queryFn: async () => {
        const all = await db.entities.AppSettings.list();
        return all[0] || {};
      },
    })
  );

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['suppliers'],
      queryFn: () => db.entities.Supplier.list(),
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () => db.entities.Proposal.delete(proposalId),
      onSuccess: () => {
        showSuccess('Proposal deleted');
        queryClient.invalidateQueries({ queryKey: ['proposals'] });
        navigate(createPageUrl('Proposals'));
      },
      onError: (error) => showError('Failed to delete proposal', error.message),
    })
  );

  const updateStatusMutation = /** @type {any} */ (
    useMutation({
      mutationFn: async (/** @type {any} */ { status, /** @type {any} */ description }) => {
        const changeEntry = {
          date: new Date().toISOString(),
          changed_by: user?.email || 'Unknown',
          previous_status: proposal.status,
          new_status: status,
          changes_description: description || '',
          previous_services: proposal.services,
          previous_total: proposal.total_cost,
        };
        const updatedHistory = [...(proposal.change_history || []), changeEntry];
        return db.entities.Proposal.update(proposalId, {
          ...proposal,
          status,
          change_history: updatedHistory,
        });
      },
      onSuccess: () => {
        showSuccess('Proposal status updated');
        queryClient.invalidateQueries({ queryKey: ['proposal', proposalId] });
        setChangeModalOpen(false);
        setChangeDescription('');
      },
      onError: (error) => showError('Failed to update status', error.message),
    })
  );

  const sendBookingMutation = /** @type {any} */ (
    useMutation({
      mutationFn: async (/** @type {any} */ { serviceIdx, /** @type {any} */ email, /** @type {any} */ note }) => {
        const service = proposal.services[serviceIdx];
        const emailBody = buildProposalBookingEmail(proposal, service, note);
        await db.integrations.Core.SendEmail({
          to: email,
          subject: `Booking Request: ${service.name} – ${proposal.title}`,
          body: emailBody,
        });
        const updatedServices = [...proposal.services];
        updatedServices[serviceIdx] = {
          ...updatedServices[serviceIdx],
          booking_status: 'requested',
          booking_requested_email: email,
          booking_requested_date: new Date().toISOString(),
          booking_note: note,
        };
        return db.entities.Proposal.update(proposalId, { ...proposal, services: updatedServices });
      },
      onSuccess: () => {
        showSuccess('Booking request sent');
        queryClient.invalidateQueries({ queryKey: ['proposal', proposalId] });
        setBookingModalOpen(false);
        setSupplierEmail('');
        setNewSupplierEmail('');
        setBookingNote('');
        setBookingServiceIdx(null);
      },
      onError: (error) => showError('Failed to send booking request', error.message),
    })
  );

  const saveResponseMutation = /** @type {any} */ (
    useMutation({
      mutationFn: async (
        /** @type {any} */ { serviceIdx, /** @type {any} */ responseNotes, /** @type {any} */ responseStatus },
      ) => {
        const updatedServices = [...proposal.services];
        updatedServices[serviceIdx] = {
          ...updatedServices[serviceIdx],
          booking_response_notes: responseNotes,
          booking_response_date: new Date().toISOString(),
          booking_status: responseStatus || updatedServices[serviceIdx].booking_status || 'requested',
        };
        return db.entities.Proposal.update(proposalId, { ...proposal, services: updatedServices });
      },
      onSuccess: () => {
        showSuccess('Response saved');
        queryClient.invalidateQueries({ queryKey: ['proposal', proposalId] });
      },
      onError: (error) => showError('Failed to save response', error.message),
    })
  );

  if (isLoading) {
    return <SkeletonCard />;
  }

  if (!proposal) {
    return <div className="text-center py-20">{_t('proposalDetails.proposal')}</div>;
  }

  const handlePrint = () => window.print();

  const handleStatusChange = (status) => {
    if (status === 'changed') {
      setChangeModalOpen(true);
    } else {
      updateStatusMutation.mutate({ status });
    }
  };

  const openBookingModal = (idx) => {
    setBookingServiceIdx(idx);
    const service = proposal.services[idx];
    const supplier = suppliers.find((s) => s.id === service.supplier_id);
    setSelectedSupplierId(service.supplier_id || '');
    setSupplierEmail(supplier?.email || '');
    setBookingModalOpen(true);
  };

  const { symbol: proposalCurrencySymbol, currencies: proposalCurrencies } = mixedCurrencyLabel(
    proposal.services,
    'client_currency',
  );

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex justify-between items-center print:hidden">
        <Link to={createPageUrl('Proposals')}>
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {_t('proposalDetails.back')}
          </Button>
        </Link>
        <div className="flex flex-wrap gap-2">
          {proposal.status === 'delivered' && (
            <>
              <Button onClick={() => handleStatusChange('approved')} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                {_t('proposalDetails.approve')}
              </Button>
              <Button
                onClick={() => handleStatusChange('changed')}
                variant="outline"
                className="border-amber-500 text-amber-600 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              >
                <Edit className="w-4 h-4 mr-2" />
                {_t('proposalDetails.request')}
              </Button>
              <Button
                onClick={() => handleStatusChange('rejected')}
                variant="outline"
                className="border-red-500 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                <XCircle className="w-4 h-4 mr-2" />
                {_t('proposalDetails.reject')}
              </Button>
            </>
          )}
          {proposal.status === 'changed' && (
            <>
              <Button onClick={() => handleStatusChange('delivered')} variant="outline">
                <Send className="w-4 h-4 mr-2" />
                {_t('proposalDetails.re')}
              </Button>
              <Button onClick={() => handleStatusChange('approved')} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                {_t('proposalDetails.approve')}
              </Button>
            </>
          )}
          {proposal.status === 'approved' &&
            (proposal.trip_id ? (
              <Link to={createPageUrl(`ReservationDetails?id=${proposal.trip_id}`)}>
                <Button
                  variant="outline"
                  className="border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {_t('proposalDetails.view')}
                </Button>
              </Link>
            ) : (
              <Button
                onClick={() => navigate(createPageUrl(`CreateReservation?fromProposal=${proposalId}`))}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                {_t('proposalDetails.move')}
              </Button>
            ))}
          <Button
            onClick={() => setEditModalOpen(true)}
            variant="outline"
            className="border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
          >
            <Pencil className="w-4 h-4 mr-2" />
            {_t('proposalDetails.edit_2')}
          </Button>
          {proposal.change_history?.length > 0 && (
            <Button onClick={() => setHistoryModalOpen(true)} variant="outline">
              <History className="w-4 h-4 mr-2" />
              {_t('proposalDetails.history')}
              {proposal.change_history.length})
            </Button>
          )}
          <Button onClick={handlePrint} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            {_t('proposalDetails.print')}
          </Button>
          <Button
            variant="outline"
            className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
            onClick={() => {
              if (confirm('Delete this proposal permanently?')) deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Company Header */}
      {(settings?.invoice_header?.company_name || settings?.logo_url) && (
        <div className="flex justify-between items-start mb-0 pb-6 print:flex">
          <div className="flex items-center gap-4">
            {(settings?.invoice_header?.logo_url || settings?.logo_url) && (
              <img
                src={settings.invoice_header.logo_url || settings.logo_url}
                alt={_t('proposalDetails.logo')}
                className="h-14 object-contain"
              />
            )}
            <div>
              {settings?.invoice_header?.company_name && (
                <div className="font-bold text-xl text-foreground">{settings.invoice_header.company_name}</div>
              )}
              {settings?.invoice_header?.address_line1 && (
                <div className="text-sm text-muted-foreground">{settings.invoice_header.address_line1}</div>
              )}
              {settings?.invoice_header?.city && settings?.invoice_header?.country && (
                <div className="text-sm text-muted-foreground">
                  {settings.invoice_header.city}, {settings.invoice_header.country}
                </div>
              )}
              {settings?.invoice_header?.email && (
                <div className="text-sm text-muted-foreground">{settings.invoice_header.email}</div>
              )}
              {settings?.invoice_header?.phone && (
                <div className="text-sm text-muted-foreground">{settings.invoice_header.phone}</div>
              )}
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div className="font-medium text-foreground">{_t('proposalDetails.prepared')}</div>
            <div>{user?.name || user?.email || '—'}</div>
            {user?.email && <div className="text-xs text-muted-foreground">{user.email}</div>}
            <div className="mt-1 text-xs text-muted-foreground">
              {format(new Date(proposal.created_date || Date.now()), 'MMM d, yyyy')}
            </div>
          </div>
        </div>
      )}

      {/* Proposal Header */}
      <Card className="p-8 bg-card shadow-lg print:shadow-none print:border-0">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{proposal.title}</h1>
            <p className="text-muted-foreground">
              {_t('proposalDetails.preparedFor')} <span className="font-semibold">{proposal.client_name}</span>
            </p>
            {proposal.client_email && <p className="text-muted-foreground">{proposal.client_email}</p>}
          </div>
          <Badge
            className={`${STATUS_COLORS[proposal.status] || 'bg-muted text-foreground'} print:hidden text-sm px-3 py-1`}
          >
            {STATUS_LABELS[proposal.status] || proposal.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-border">
          {proposal.destination && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">{_t('proposalDetails.destination')}</div>
              <div className="font-semibold text-foreground">{proposal.destination}</div>
            </div>
          )}
          {proposal.start_date && proposal.end_date && (
            <div>
              <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {_t('proposalDetails.travel')}
              </div>
              <div className="font-semibold text-foreground">
                {format(new Date(proposal.start_date), 'MMM d')} – {format(new Date(proposal.end_date), 'MMM d, yyyy')}
              </div>
            </div>
          )}
          {proposal.num_travelers > 0 && (
            <div>
              <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                <UsersIcon className="w-4 h-4" />
                {_t('proposalDetails.travelers')}
              </div>
              <div className="font-semibold text-foreground">
                {proposal.num_travelers} {_t('proposalDetails.person')}
                {proposal.num_travelers > 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Services */}
      <Card className="p-8 bg-card shadow-lg print:shadow-none print:border-0">
        <h2 className="text-2xl font-bold text-foreground mb-6">{_t('proposalDetails.services')}</h2>
        {proposal.services && proposal.services.length > 0 ? (
          <div className="space-y-6">
            {proposal.services.map((service, index) => {
              const bsConfig = BOOKING_STATUS_CONFIG[service.booking_status || 'not_requested'];
              const BsIcon = bsConfig.icon;
              const sc = getCurrencySymbol(service.client_currency || 'USD');
              return (
                <div key={index} className="border border-border rounded-lg p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg text-foreground">{service.name}</h3>
                      </div>
                      {service.description && (
                        <p className="text-muted-foreground text-sm mt-1">{service.description}</p>
                      )}
                      {service.location && (
                        <p className="text-muted-foreground text-xs mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {service.location}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <div className="text-sm text-muted-foreground">
                        {sc}
                        {(service.cost || 0).toFixed(2)} × {service.quantity || 1}{' '}
                        <span className="text-xs text-muted-foreground">{service.client_currency || 'USD'}</span>
                      </div>
                      <div className="font-bold text-lg text-foreground">
                        {sc}
                        {((service.cost || 0) * (service.quantity || 1)).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Booking actions — only shown when approved */}
                  {proposal.status === 'approved' && (
                    <div className="border-t border-border pt-4 mt-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <Badge className={`${bsConfig.color} flex items-center gap-1`}>
                          <BsIcon className="w-3 h-3" />
                          {bsConfig.label}
                        </Badge>
                        <div className="flex flex-wrap gap-2">
                          {service.booking_status !== 'requested' && service.booking_status !== 'confirmed' && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700"
                              onClick={() => openBookingModal(index)}
                            >
                              <Send className="w-3.5 h-3.5 mr-1" />
                              {_t('proposalDetails.send')}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Booking request info */}
                      {service.booking_status === 'requested' && service.booking_requested_email && (
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <Mail className="w-3 h-3" />
                          {_t('proposalDetails.sent')} {service.booking_requested_email}
                          {service.booking_requested_date && (
                            <>
                              {' '}
                              {_t('proposalDetails.on')}{' '}
                              {format(new Date(service.booking_requested_date), 'MMM d, yyyy HH:mm')}
                            </>
                          )}
                        </div>
                      )}

                      {/* Supplier Response */}
                      <ResponseEditor
                        service={service}
                        _serviceIdx={index}
                        onSave={(responseNotes, responseStatus) =>
                          saveResponseMutation.mutate({ serviceIdx: index, responseNotes, responseStatus })
                        }
                        loading={saveResponseMutation.isPending}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            <div className="pt-6 mt-6 border-t-2 border-border">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span className="text-2xl font-bold text-foreground">{_t('proposalDetails.total')}</span>
                <div className="text-4xl font-bold text-green-700 dark:text-green-300 flex items-center gap-2">
                  {proposalCurrencySymbol}
                  {(proposal.total_cost || 0).toFixed(2)}
                  {proposalCurrencies.length > 1 && (
                    <span className="text-sm text-muted-foreground font-normal">({proposalCurrencies.join('/')})</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">{_t('proposalDetails.no')}</p>
        )}
      </Card>

      {/* Notes */}
      {proposal.notes && (
        <Card className="p-8 bg-card shadow-lg print:shadow-none print:border-0">
          <h2 className="text-2xl font-bold text-foreground mb-4">{_t('proposalDetails.notes')}</h2>
          <p className="text-foreground whitespace-pre-wrap">{proposal.notes}</p>
        </Card>
      )}

      {/* Terms */}
      {proposal.terms_and_conditions && (
        <Card className="p-8 bg-muted print:bg-card print:shadow-none print:border-0">
          <h2 className="text-xl font-bold text-foreground mb-4">{_t('proposalDetails.terms')}</h2>
          <p className="text-foreground text-sm whitespace-pre-wrap">{proposal.terms_and_conditions}</p>
        </Card>
      )}

      {/* Change History Modal */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              {_t('proposalDetails.change')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {proposal.change_history
              ?.slice()
              .reverse()
              .map((entry, index) => (
                <div key={index} className="p-4 bg-muted rounded-lg border">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_COLORS[entry.previous_status]}>
                        {STATUS_LABELS[entry.previous_status]}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge className={STATUS_COLORS[entry.new_status]}>{STATUS_LABELS[entry.new_status]}</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(entry.date), 'MMM d, yyyy HH:mm')}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {_t('proposalDetails.changed')} {entry.changed_by}
                  </div>
                  {entry.changes_description && (
                    <div className="mt-2 p-2 bg-card rounded border text-sm">{entry.changes_description}</div>
                  )}
                  {entry.previous_total && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      {_t('proposalDetails.previous')} {proposalCurrencySymbol}
                      {entry.previous_total.toFixed(2)}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Changes Modal */}
      <Dialog open={changeModalOpen} onOpenChange={setChangeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{_t('proposalDetails.request')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{_t('proposalDetails.describe')}</Label>
              <Textarea
                value={changeDescription}
                onChange={(e) => setChangeDescription(e.target.value)}
                placeholder={_t('proposalDetails.please')}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setChangeModalOpen(false)}>
                {_t('proposalDetails.cancel')}
              </Button>
              <Button
                onClick={() => updateStatusMutation.mutate({ status: 'changed', description: changeDescription })}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {_t('proposalDetails.submit')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Request Modal */}
      <Dialog open={bookingModalOpen} onOpenChange={setBookingModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {_t('proposalDetails.send')}
            </DialogTitle>
          </DialogHeader>
          {bookingServiceIdx !== null && (
            <div className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                {_t('proposalDetails.sendBooking')} <strong>{proposal.services[bookingServiceIdx]?.name}</strong>
              </p>

              <div className="space-y-2">
                <Label>{_t('proposalDetails.supplier')}</Label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="radio"
                    id="be-existing"
                    name="be-supplier"
                    value="existing"
                    checked={supplierChoice === 'existing'}
                    onChange={() => setSupplierChoice('existing')}
                  />
                  <label htmlFor="be-existing" className="text-sm cursor-pointer">
                    {_t('proposalDetails.existing')}
                  </label>
                </div>
                {supplierChoice === 'existing' && (
                  <div className="space-y-2">
                    <Select
                      value={selectedSupplierId}
                      onValueChange={(val) => {
                        setSelectedSupplierId(val);
                        const s = suppliers.find((x) => x.id === val);
                        setSupplierEmail(s?.email || '');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={_t('proposalDetails.select')} />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {supplierEmail && (
                      <div className="text-xs text-muted-foreground p-2 bg-muted rounded">{supplierEmail}</div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2 mt-2">
                  <input
                    type="radio"
                    id="be-manual"
                    name="be-supplier"
                    value="manual"
                    checked={supplierChoice === 'manual'}
                    onChange={() => setSupplierChoice('manual')}
                  />
                  <label htmlFor="be-manual" className="text-sm cursor-pointer">
                    {_t('proposalDetails.manual')}
                  </label>
                </div>
                {supplierChoice === 'manual' && (
                  <Input
                    type="email"
                    placeholder={_t('proposalDetails.supplierEmail')}
                    value={newSupplierEmail}
                    onChange={(e) => setNewSupplierEmail(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>{_t('proposalDetails.booking')}</Label>
                <Textarea
                  value={bookingNote}
                  onChange={(e) => setBookingNote(e.target.value)}
                  placeholder={_t('proposalDetails.add')}
                  rows={3}
                />
              </div>

              {/* Preview */}
              {proposal.services[bookingServiceIdx] &&
                (() => {
                  const svc = proposal.services[bookingServiceIdx];
                  const body = buildProposalBookingEmail(proposal, svc, bookingNote);
                  return (
                    <div className="bg-muted rounded-lg p-4 border max-h-48 overflow-y-auto">
                      <pre className="text-xs text-foreground whitespace-pre-wrap font-sans">{body}</pre>
                    </div>
                  );
                })()}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setBookingModalOpen(false)}>
                  {_t('proposalDetails.cancel')}
                </Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    const email = supplierChoice === 'existing' ? supplierEmail : newSupplierEmail;
                    if (!email) return;
                    sendBookingMutation.mutate({ serviceIdx: bookingServiceIdx, email, note: bookingNote });
                  }}
                  disabled={sendBookingMutation.isPending || (!supplierEmail && !newSupplierEmail)}
                >
                  {sendBookingMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {_t('proposalDetails.sending')}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {_t('proposalDetails.send')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Proposal Modal */}
      <ProposalEditModal proposal={proposal} open={editModalOpen} onClose={() => setEditModalOpen(false)} />
    </div>
  );
}

function ResponseEditor({ service, _serviceIdx, onSave, loading }) {
  const { t: _t } = useT();
  const [editing, setEditing] = useState(false);
  const [responseNotes, setResponseNotes] = useState(service.booking_response_notes || '');
  const [responseStatus, setResponseStatus] = useState(service.booking_status || 'requested');

  if (!editing && !service.booking_response_notes) {
    return (
      <div className="flex items-center gap-2 pt-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing(true)}
          className="text-green-700 dark:text-green-300 border-green-300 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/40"
        >
          <CheckCircle className="w-3.5 h-3.5 mr-1" />
          {_t('proposalDetails.record')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2 border-t border-border">
      {!editing && service.booking_response_notes && (
        <div className="bg-muted rounded-lg p-3 border">
          <div className="flex items-center justify-between mb-2">
            <Badge className={BOOKING_STATUS_CONFIG[responseStatus]?.color || 'bg-muted text-foreground'}>
              {BOOKING_STATUS_CONFIG[responseStatus]?.label || responseStatus}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {service.booking_response_date && format(new Date(service.booking_response_date), 'MMM d, yyyy HH:mm')}
            </span>
          </div>
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">{service.booking_response_notes}</pre>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(true);
              setResponseNotes(service.booking_response_notes);
              setResponseStatus(service.booking_status || 'requested');
            }}
            className="mt-2 text-blue-600 dark:text-blue-300"
          >
            {_t('proposalDetails.edit_2')}
          </Button>
        </div>
      )}
      {editing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">{_t('proposalDetails.response')}</Label>
            <Select value={responseStatus} onValueChange={setResponseStatus}>
              <SelectTrigger className="w-40 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="requested">{_t('proposalDetails.requested')}</SelectItem>
                <SelectItem value="confirmed">{_t('proposalDetails.confirmed')}</SelectItem>
                <SelectItem value="rejected">{_t('proposalDetails.rejected')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Label className="text-xs text-muted-foreground">{_t('proposalDetails.supplierResponse')}</Label>
          <Textarea
            value={responseNotes}
            onChange={(e) => setResponseNotes(e.target.value)}
            placeholder={`Paste supplier reply or confirmation details here...\n\nExample:\n**Confirmed**\n- Room: Deluxe Double\n- Rate: $150/night\n- Confirmation: CNF-2024-00123`}
            rows={4}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                onSave(responseNotes, responseStatus);
                setEditing(false);
              }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  {_t('proposalDetails.saving')}
                </>
              ) : (
                'Save Response'
              )}
            </Button>
            {service.booking_response_notes && (
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                {_t('proposalDetails.cancel')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildProposalBookingEmail(proposal, service, note) {
  const sc = getCurrencySymbol(service.client_currency || 'USD');
  return [
    'Hello,',
    '',
    'We would like to request a booking for the following service:',
    '',
    `SERVICE: ${service.name}`,
    `PROPOSAL: ${proposal.title}`,
    proposal.destination ? `DESTINATION: ${proposal.destination}` : '',
    proposal.start_date && proposal.end_date
      ? `DATES: ${format(new Date(proposal.start_date), 'MMM d')} – ${format(new Date(proposal.end_date), 'MMM d, yyyy')}`
      : '',
    `QUANTITY: ${service.quantity || 1}`,
    `UNIT PRICE: ${sc}${(service.cost || 0).toFixed(2)}`,
    `TOTAL: ${sc}${((service.cost || 0) * (service.quantity || 1)).toFixed(2)}`,
    service.description ? `DESCRIPTION: ${service.description}` : '',
    proposal.num_travelers ? `TRAVELERS: ${proposal.num_travelers}` : '',
    '',
    note ? `SPECIAL REQUESTS/NOTES:\n${note}\n` : '',
    'Please confirm the availability and send us the booking confirmation at your earliest convenience.',
    '',
    `Thank you,\n${proposal.client_name || 'Travel Agency'}`,
  ]
    .filter(Boolean)
    .join('\n');
}
