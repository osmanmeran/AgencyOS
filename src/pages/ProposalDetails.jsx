import { db } from '@/lib/DbContext';

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
import { ArrowLeft, Download, Send, Calendar, Users as UsersIcon, History, CheckCircle, XCircle, Edit, Trash2, Mail, Clock, AlertCircle, Loader2, Pencil, MapPin } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';
import ProposalEditModal from '@/components/proposals/ProposalEditModal';

const STATUS_COLORS = {
  delivered: 'bg-blue-100 text-blue-800',
  changed: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
};

const STATUS_LABELS = {
  delivered: 'Delivered',
  changed: 'Changed',
  approved: 'Approved',
  rejected: 'Rejected'
};

const BOOKING_STATUS_CONFIG = {
  not_requested: { label: 'Not Requested', color: 'bg-slate-100 text-slate-800', icon: AlertCircle },
  requested: { label: 'Requested', color: 'bg-blue-100 text-blue-800', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function ProposalDetails() {
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

  const { data: proposal, isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['proposal', proposalId],
    queryFn: () => db.entities.Proposal.get(proposalId),
    enabled: !!proposalId
  }));

  const { data: user } = /** @type {any} */ (useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me()
  }));

  const { data: settings } = /** @type {any} */ (useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => {
      const all = await db.entities.AppSettings.list();
      return all[0] || {};
    }
  }));

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['suppliers'],
    queryFn: () => db.entities.Supplier.list()
  }));

  const deleteMutation = /** @type {any} */ (useMutation({
    mutationFn: () => db.entities.Proposal.delete(proposalId),
    onSuccess: () => {
      showSuccess('Proposal deleted');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      navigate(createPageUrl('Proposals'));
    },
    onError: (error) => showError('Failed to delete proposal', error.message)
  }));

  const updateStatusMutation = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ { status, /** @type {any} */ description }) => {
      const changeEntry = {
        date: new Date().toISOString(),
        changed_by: user?.email || 'Unknown',
        previous_status: proposal.status,
        new_status: status,
        changes_description: description || '',
        previous_services: proposal.services,
        previous_total: proposal.total_cost
      };
      const updatedHistory = [...(proposal.change_history || []), changeEntry];
      return db.entities.Proposal.update(proposalId, {
        ...proposal,
        status,
        change_history: updatedHistory
      });
    },
    onSuccess: () => {
      showSuccess('Proposal status updated');
      queryClient.invalidateQueries({ queryKey: ['proposal', proposalId] });
      setChangeModalOpen(false);
      setChangeDescription('');
    },
    onError: (error) => showError('Failed to update status', error.message)
  }));

  const sendBookingMutation = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ { serviceIdx, /** @type {any} */ email, /** @type {any} */ note }) => {
      const service = proposal.services[serviceIdx];
      const emailBody = buildProposalBookingEmail(proposal, service, note);
      await db.integrations.Core.SendEmail({
        to: email,
        subject: `Booking Request: ${service.name} – ${proposal.title}`,
        body: emailBody
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
    onError: (error) => showError('Failed to send booking request', error.message)
  }));

  const saveResponseMutation = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ { serviceIdx, /** @type {any} */ responseNotes, /** @type {any} */ responseStatus }) => {
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
    onError: (error) => showError('Failed to save response', error.message)
  }));

  if (isLoading) {
    return <SkeletonCard />;
  }

  if (!proposal) {
    return <div className="text-center py-20">Proposal not found</div>;
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
    const supplier = suppliers.find(s => s.id === service.supplier_id);
    setSelectedSupplierId(service.supplier_id || '');
    setSupplierEmail(supplier?.email || '');
    setBookingModalOpen(true);
  };


  const proposalCurrencies = [...new Set((proposal.services || []).map(s => s.client_currency).filter(Boolean))];
  const proposalCurrencySymbol = ({ USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' }[proposalCurrencies[0] || 'USD'] || proposalCurrencies[0] || '$');

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex justify-between items-center print:hidden">
        <Link to={createPageUrl('Proposals')}>
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Proposals
          </Button>
        </Link>
        <div className="flex flex-wrap gap-2">
          {proposal.status === 'delivered' && (
            <>
              <Button onClick={() => handleStatusChange('approved')} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-2" />Approve
              </Button>
              <Button onClick={() => handleStatusChange('changed')} variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50">
                <Edit className="w-4 h-4 mr-2" />Request Changes
              </Button>
              <Button onClick={() => handleStatusChange('rejected')} variant="outline" className="border-red-500 text-red-600 hover:bg-red-50">
                <XCircle className="w-4 h-4 mr-2" />Reject
              </Button>
            </>
          )}
          {proposal.status === 'changed' && (
            <>
              <Button onClick={() => handleStatusChange('delivered')} variant="outline">
                <Send className="w-4 h-4 mr-2" />Re-deliver
              </Button>
              <Button onClick={() => handleStatusChange('approved')} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-2" />Approve
              </Button>
            </>
          )}
          <Button onClick={() => setEditModalOpen(true)} variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-50">
            <Pencil className="w-4 h-4 mr-2" />Edit Proposal
          </Button>
          {proposal.change_history?.length > 0 && (
            <Button onClick={() => setHistoryModalOpen(true)} variant="outline">
              <History className="w-4 h-4 mr-2" />History ({proposal.change_history.length})
            </Button>
          )}
          <Button onClick={handlePrint} variant="outline">
            <Download className="w-4 h-4 mr-2" />Print / PDF
          </Button>
          <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => { if (confirm('Delete this proposal permanently?')) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Company Header */}
      {(settings?.invoice_header?.company_name || settings?.logo_url) && (
        <div className="flex justify-between items-start mb-0 pb-6 print:flex">
          <div className="flex items-center gap-4">
            {(settings?.invoice_header?.logo_url || settings?.logo_url) && (
              <img src={settings.invoice_header.logo_url || settings.logo_url} alt="Logo" className="h-14 object-contain" />
            )}
            <div>
              {settings?.invoice_header?.company_name && (
                <div className="font-bold text-xl text-slate-900">{settings.invoice_header.company_name}</div>
              )}
              {settings?.invoice_header?.address_line1 && (
                <div className="text-sm text-slate-600">{settings.invoice_header.address_line1}</div>
              )}
              {settings?.invoice_header?.city && settings?.invoice_header?.country && (
                <div className="text-sm text-slate-600">{settings.invoice_header.city}, {settings.invoice_header.country}</div>
              )}
              {settings?.invoice_header?.email && (
                <div className="text-sm text-slate-600">{settings.invoice_header.email}</div>
              )}
              {settings?.invoice_header?.phone && (
                <div className="text-sm text-slate-600">{settings.invoice_header.phone}</div>
              )}
            </div>
          </div>
          <div className="text-right text-sm text-slate-500">
            <div className="font-medium text-slate-700">Prepared by</div>
            <div>{user?.name || user?.email || '—'}</div>
            {user?.email && <div className="text-xs text-slate-400">{user.email}</div>}
            <div className="mt-1 text-xs text-slate-400">{format(new Date(proposal.created_date || Date.now()), 'MMM d, yyyy')}</div>
          </div>
        </div>
      )}

      {/* Proposal Header */}
      <Card className="p-8 bg-white shadow-lg print:shadow-none print:border-0">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{proposal.title}</h1>
            <p className="text-slate-600">Prepared for: <span className="font-semibold">{proposal.client_name}</span></p>
            {proposal.client_email && <p className="text-slate-600">{proposal.client_email}</p>}
          </div>
          <Badge className={`${STATUS_COLORS[proposal.status] || 'bg-gray-100 text-gray-800'} print:hidden text-sm px-3 py-1`}>
            {STATUS_LABELS[proposal.status] || proposal.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-slate-200">
          {proposal.destination && (
            <div>
              <div className="text-sm text-slate-600 mb-1">Destination</div>
              <div className="font-semibold text-slate-900">{proposal.destination}</div>
            </div>
          )}
          {proposal.start_date && proposal.end_date && (
            <div>
              <div className="text-sm text-slate-600 mb-1 flex items-center gap-1"><Calendar className="w-4 h-4" />Travel Dates</div>
              <div className="font-semibold text-slate-900">{format(new Date(proposal.start_date), 'MMM d')} – {format(new Date(proposal.end_date), 'MMM d, yyyy')}</div>
            </div>
          )}
          {proposal.num_travelers > 0 && (
            <div>
              <div className="text-sm text-slate-600 mb-1 flex items-center gap-1"><UsersIcon className="w-4 h-4" />Travelers</div>
              <div className="font-semibold text-slate-900">{proposal.num_travelers} person{proposal.num_travelers > 1 ? 's' : ''}</div>
            </div>
          )}
        </div>
      </Card>

      {/* Services */}
      <Card className="p-8 bg-white shadow-lg print:shadow-none print:border-0">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Services Included</h2>
              {proposal.services && proposal.services.length > 0 ? (
          <div className="space-y-6">
            {proposal.services.map((service, index) => {
              const bsConfig = BOOKING_STATUS_CONFIG[service.booking_status || 'not_requested'];
              const BsIcon = bsConfig.icon;
              const sc = ({ USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' }[service.client_currency] || service.client_currency || '$');
              return (
                <div key={index} className="border border-slate-200 rounded-lg p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg text-slate-900">{service.name}</h3>
                        
                      </div>
                      {service.description && <p className="text-slate-600 text-sm mt-1">{service.description}</p>}
                      {service.location && (
                        <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{service.location}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <div className="text-sm text-slate-600">{sc}{(service.cost || 0).toFixed(2)} × {service.quantity || 1} <span className="text-xs text-slate-400">{service.client_currency || 'USD'}</span></div>
                      <div className="font-bold text-lg text-slate-900">{sc}{((service.cost || 0) * (service.quantity || 1)).toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Booking actions — only shown when approved */}
                  {proposal.status === 'approved' && (
                    <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <Badge className={`${bsConfig.color} flex items-center gap-1`}>
                          <BsIcon className="w-3 h-3" />{bsConfig.label}
                        </Badge>
                        <div className="flex flex-wrap gap-2">
                          {service.booking_status !== 'requested' && service.booking_status !== 'confirmed' && (
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openBookingModal(index)}>
                              <Send className="w-3.5 h-3.5 mr-1" />Send Booking Request
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Booking request info */}
                      {service.booking_status === 'requested' && service.booking_requested_email && (
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <Mail className="w-3 h-3" />Sent to {service.booking_requested_email}
                          {service.booking_requested_date && <> on {format(new Date(service.booking_requested_date), 'MMM d, yyyy HH:mm')}</>}
                        </div>
                      )}

                      {/* Supplier Response */}
                      <ResponseEditor
                        service={service}
                        _serviceIdx={index}
                        onSave={(responseNotes, responseStatus) => saveResponseMutation.mutate({ serviceIdx: index, responseNotes, responseStatus })}
                        loading={saveResponseMutation.isPending}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            <div className="pt-6 mt-6 border-t-2 border-slate-300">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span className="text-2xl font-bold text-slate-900">Total</span>
                <div className="text-4xl font-bold text-green-700 flex items-center gap-2">
                  {proposalCurrencySymbol}{(proposal.total_cost || 0).toFixed(2)}
                  {proposalCurrencies.length > 1 && <span className="text-sm text-slate-400 font-normal">({proposalCurrencies.join('/')})</span>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-600">No services added</p>
        )}
      </Card>

      {/* Notes */}
      {proposal.notes && (
        <Card className="p-8 bg-white shadow-lg print:shadow-none print:border-0">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Notes</h2>
          <p className="text-slate-700 whitespace-pre-wrap">{proposal.notes}</p>
        </Card>
      )}

      {/* Terms */}
      {proposal.terms_and_conditions && (
        <Card className="p-8 bg-slate-50 print:bg-white print:shadow-none print:border-0">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Terms & Conditions</h2>
          <p className="text-slate-700 text-sm whitespace-pre-wrap">{proposal.terms_and_conditions}</p>
        </Card>
      )}

      {/* Change History Modal */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="w-5 h-5" />Change History</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {proposal.change_history?.slice().reverse().map((entry, index) => (
              <div key={index} className="p-4 bg-slate-50 rounded-lg border">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_COLORS[entry.previous_status]}>{STATUS_LABELS[entry.previous_status]}</Badge>
                    <span className="text-slate-400">→</span>
                    <Badge className={STATUS_COLORS[entry.new_status]}>{STATUS_LABELS[entry.new_status]}</Badge>
                  </div>
                  <span className="text-sm text-slate-500">{format(new Date(entry.date), 'MMM d, yyyy HH:mm')}</span>
                </div>
                <div className="text-sm text-slate-600">Changed by: {entry.changed_by}</div>
                {entry.changes_description && <div className="mt-2 p-2 bg-white rounded border text-sm">{entry.changes_description}</div>}
                {entry.previous_total && <div className="mt-2 text-sm text-slate-500">Previous total: ${entry.previous_total.toFixed(2)}</div>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Changes Modal */}
      <Dialog open={changeModalOpen} onOpenChange={setChangeModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Changes</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Describe the requested changes</Label>
              <Textarea value={changeDescription} onChange={(e) => setChangeDescription(e.target.value)}
                placeholder="Please describe what changes are needed..." rows={4} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setChangeModalOpen(false)}>Cancel</Button>
              <Button onClick={() => updateStatusMutation.mutate({ status: 'changed', description: changeDescription })}
                className="bg-amber-600 hover:bg-amber-700">Submit Change Request</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Request Modal */}
      <Dialog open={bookingModalOpen} onOpenChange={setBookingModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail className="w-5 h-5" />Send Booking Request</DialogTitle></DialogHeader>
          {bookingServiceIdx !== null && (
            <div className="space-y-4 mt-4">
              <p className="text-sm text-slate-600">
                Send booking request for <strong>{proposal.services[bookingServiceIdx]?.name}</strong>
              </p>

              <div className="space-y-2">
                <Label>Supplier Email</Label>
                <div className="flex items-center gap-2 mb-2">
                  <input type="radio" id="be-existing" name="be-supplier" value="existing" checked={supplierChoice === 'existing'}
                    onChange={() => setSupplierChoice('existing')} />
                  <label htmlFor="be-existing" className="text-sm cursor-pointer">Existing Supplier</label>
                </div>
                {supplierChoice === 'existing' && (
                  <div className="space-y-2">
                    <Select value={selectedSupplierId} onValueChange={(val) => {
                      setSelectedSupplierId(val);
                      const s = suppliers.find(x => x.id === val);
                      setSupplierEmail(s?.email || '');
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {supplierEmail && <div className="text-xs text-slate-500 p-2 bg-slate-50 rounded">{supplierEmail}</div>}
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2 mt-2">
                  <input type="radio" id="be-manual" name="be-supplier" value="manual" checked={supplierChoice === 'manual'}
                    onChange={() => setSupplierChoice('manual')} />
                  <label htmlFor="be-manual" className="text-sm cursor-pointer">Manual Email</label>
                </div>
                {supplierChoice === 'manual' && (
                  <Input type="email" placeholder="Supplier email address" value={newSupplierEmail} onChange={(e) => setNewSupplierEmail(e.target.value)} />
                )}
              </div>

              <div className="space-y-2">
                <Label>Booking Note (optional)</Label>
                <Textarea value={bookingNote} onChange={(e) => setBookingNote(e.target.value)}
                  placeholder="Add specific requirements or details..." rows={3} />
              </div>

              {/* Preview */}
              {proposal.services[bookingServiceIdx] && (() => {
                const svc = proposal.services[bookingServiceIdx];
                const body = buildProposalBookingEmail(proposal, svc, bookingNote);
                return (
                  <div className="bg-slate-50 rounded-lg p-4 border max-h-48 overflow-y-auto">
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans">{body}</pre>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setBookingModalOpen(false)}>Cancel</Button>
                <Button className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    const email = supplierChoice === 'existing' ? supplierEmail : newSupplierEmail;
                    if (!email) return;
                    sendBookingMutation.mutate({ serviceIdx: bookingServiceIdx, email, note: bookingNote });
                  }}
                  disabled={sendBookingMutation.isPending || (!supplierEmail && !newSupplierEmail)}
                >
                  {sendBookingMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : <><Send className="w-4 h-4 mr-2" />Send Booking Request</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Proposal Modal */}
      <ProposalEditModal
        proposal={proposal}
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
      />
    </div>
  );
}

function ResponseEditor({ service, _serviceIdx, onSave, loading }) {
  const [editing, setEditing] = useState(false);
  const [responseNotes, setResponseNotes] = useState(service.booking_response_notes || '');
  const [responseStatus, setResponseStatus] = useState(service.booking_status || 'requested');

  if (!editing && !service.booking_response_notes) {
    return (
      <div className="flex items-center gap-2 pt-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="text-green-700 border-green-300 hover:bg-green-50">
          <CheckCircle className="w-3.5 h-3.5 mr-1" />Record Supplier Response
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2 border-t border-slate-100">
      {!editing && service.booking_response_notes && (
        <div className="bg-slate-50 rounded-lg p-3 border">
          <div className="flex items-center justify-between mb-2">
            <Badge className={BOOKING_STATUS_CONFIG[responseStatus]?.color || 'bg-slate-100 text-slate-800'}>
              {BOOKING_STATUS_CONFIG[responseStatus]?.label || responseStatus}
            </Badge>
            <span className="text-xs text-slate-400">
              {service.booking_response_date && format(new Date(service.booking_response_date), 'MMM d, yyyy HH:mm')}
            </span>
          </div>
          <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">{service.booking_response_notes}</pre>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(true); setResponseNotes(service.booking_response_notes); setResponseStatus(service.booking_status || 'requested'); }}
            className="mt-2 text-blue-600">Edit</Button>
        </div>
      )}
      {editing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-600">Response Status</Label>
            <Select value={responseStatus} onValueChange={setResponseStatus}>
              <SelectTrigger className="w-40 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="requested">Requested</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Label className="text-xs text-slate-600">Supplier Response (markdown supported)</Label>
          <Textarea value={responseNotes} onChange={(e) => setResponseNotes(e.target.value)}
            placeholder={`Paste supplier reply or confirmation details here...\n\nExample:\n**Confirmed**\n- Room: Deluxe Double\n- Rate: $150/night\n- Confirmation: CNF-2024-00123`}
            rows={4} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="bg-green-600 hover:bg-green-700"
              onClick={() => { onSave(responseNotes, responseStatus); setEditing(false); }}
              disabled={loading}
            >
              {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Saving...</> : 'Save Response'}
            </Button>
            {service.booking_response_notes && (
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildProposalBookingEmail(proposal, service, note) {
  return [
    'Hello,',
    '',
    'We would like to request a booking for the following service:',
    '',
    `SERVICE: ${service.name}`,
    `PROPOSAL: ${proposal.title}`,
    proposal.destination ? `DESTINATION: ${proposal.destination}` : '',
    proposal.start_date && proposal.end_date ? `DATES: ${format(new Date(proposal.start_date), 'MMM d')} – ${format(new Date(proposal.end_date), 'MMM d, yyyy')}` : '',
    `QUANTITY: ${service.quantity || 1}`,
    `UNIT PRICE: $${(service.cost || 0).toFixed(2)}`,
    `TOTAL: $${((service.cost || 0) * (service.quantity || 1)).toFixed(2)}`,
    service.description ? `DESCRIPTION: ${service.description}` : '',
    proposal.num_travelers ? `TRAVELERS: ${proposal.num_travelers}` : '',
    '',
    note ? `SPECIAL REQUESTS/NOTES:\n${note}\n` : '',
    'Please confirm the availability and send us the booking confirmation at your earliest convenience.',
    '',
    `Thank you,\n${proposal.client_name || 'Travel Agency'}`
  ].filter(Boolean).join('\n');
}
