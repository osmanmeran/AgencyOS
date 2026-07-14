import { db } from '@/lib/DbContext';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SkeletonCard } from '@/components/ui/skeletons';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Printer,
  Trash2,
  Star,
  History,
  Edit,
  Map,
  FileText,
  Loader2,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { format, addDays } from 'date-fns';
import ServiceBookingManager from '../components/reservations/ServiceBookingManager';
import TripCostSummary from '../components/reservations/TripCostSummary';
import { applyMarkup } from '@/lib/pricing';
import {
  currSymbol,
  PROPOSAL_STATUS_CONFIG,
  SERVICE_TYPE_CONFIG,
  buildEmailBody,
} from '@/components/reservation-details/helpers';
import HistoryModal from '@/components/reservation-details/HistoryModal';
import OccupancyValidation from '@/components/reservation-details/OccupancyValidation';
import ItineraryRecap from '@/components/reservation-details/ItineraryRecap';
import ServicesSection from '@/components/reservation-details/ServicesSection';
import NotesAndTerms from '@/components/reservation-details/NotesAndTerms';

export default function ReservationDetails() {
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [statusNote, setStatusNote] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  const [sendEmailTo, setSendEmailTo] = useState('');
  const [editingServiceIdx, setEditingServiceIdx] = useState(null);
  const [addingNewService, setAddingNewService] = useState(false);
  const [targetMarginPct, setTargetMarginPct] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  const [showItinerary, setShowItinerary] = useState(false);

  const {
    data: trip,
    isLoading,
    error: tripError,
  } = /** @type {any} */ (
    useQuery({
      queryKey: ['trip', tripId],
      queryFn: () => db.entities.Trip.get(tripId),
      enabled: !!tripId,
    })
  );

  const { data: user } = /** @type {any} */ (useQuery({ queryKey: ['me'], queryFn: () => db.auth.me() }));
  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({ queryKey: ['suppliers'], queryFn: () => db.entities.Supplier.list() })
  );
  const { data: appSettings } = /** @type {any} */ (
    useQuery({
      queryKey: ['appSettings'],
      queryFn: async () => {
        const settings = await db.entities.AppSettings.list();
        return settings[0];
      },
    })
  );

  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['categories'],
      queryFn: () => db.entities.SupplierCategory.list(),
    })
  );

  const { data: linkedInvoices = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['invoicesForTrip', tripId],
      queryFn: async () => {
        const all = await db.entities.Invoice.list();
        return all.filter((inv) => inv.trip_id === tripId);
      },
      enabled: !!tripId,
    })
  );

  const changeEntry = (action, description) => ({
    date: new Date().toISOString(),
    changed_by: user?.email || 'unknown',
    changed_by_name: user?.name || user?.email || 'Unknown',
    action,
    description,
  });

  const updateMutation = /** @type {any} */ (
    useMutation({
      // created_by_name/created_by_phone are captured once when the reservation
      // is first saved and never touched again — if that staff member's phone
      // was blank at the time (or they add one to their profile later), the
      // itinerary's "Emergency Contact" stays permanently blank/stale. Refresh
      // both from whoever is currently saving, on every edit, so the itinerary
      // always shows a reachable contact instead of a frozen snapshot.
      mutationFn: (/** @type {any} */ data) =>
        db.entities.Trip.update(tripId, {
          ...data,
          created_by_name: user?.name || user?.email || trip?.created_by_name || '',
          created_by_phone: user?.phone || trip?.created_by_phone || '',
        }),
      onSuccess: () => {
        showSuccess('Reservation updated');
        queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      },
      onError: (error) => showError('Failed to update reservation', error.message),
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () => db.entities.Trip.delete(tripId),
      onSuccess: () => {
        showSuccess('Reservation deleted');
        queryClient.invalidateQueries({ queryKey: ['trips'] });
        navigate(createPageUrl('Reservations'));
      },
      onError: (error) => showError('Failed to delete reservation', error.message),
    })
  );

  const sendEmailMutation = /** @type {any} */ (
    useMutation({
      mutationFn: async () => {
        await db.integrations.Core.SendEmail({
          to: sendEmailTo,
          subject: `Your Travel Reservation: ${trip.name}`,
          body: buildEmailBody(trip, appSettings),
        });
        const history = [...(trip.change_history || []), changeEntry('email_sent', `Proposal sent to ${sendEmailTo}`)];
        return db.entities.Trip.update(tripId, { proposal_status: 'sent', change_history: history });
      },
      onSuccess: () => {
        showSuccess('Email sent');
        queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
        setSendEmailOpen(false);
      },
      onError: (error) => showError('Failed to send email', error.message),
    })
  );

  const changeStatus = (status) => {
    setPendingStatus(status);
    setStatusNote('');
    setNoteModalOpen(true);
  };

  const handleShareItinerary = async () => {
    const url = `${window.location.origin}/client-itinerary?id=${trip.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.name || 'Itinerary', url });
      } catch (e) {
        if (e.name !== 'AbortError') {
          navigator.clipboard.writeText(url);
          setShareCopied(true);
          setTimeout(() => setShareCopied(false), 2000);
        }
      }
    } else {
      navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const handleServiceUpdate = (updatedService) => {
    const updatedServices = [...trip.services];
    updatedServices[editingServiceIdx] = updatedService;

    const newProposalStatus = trip.proposal_status === 'confirmed' ? 'sent' : trip.proposal_status;

    updateMutation.mutate({
      services: updatedServices,
      proposal_status: newProposalStatus,
    });
    setEditingServiceIdx(null);
  };

  const handleApplyTotalMargin = () => {
    if (targetMarginPct <= 0 || targetMarginPct >= 100) return;
    const markupPct = (targetMarginPct / (100 - targetMarginPct)) * 100;
    const updatedServices = (trip.services || []).map((s) => {
      const base = parseFloat(s.acquiring_price) || 0;
      const newSelling = applyMarkup(base, markupPct);
      return { ...s, base_selling_price: base, selling_price: newSelling };
    });
    updateMutation.mutate({
      services: updatedServices,
      markup_percentage: Math.round(markupPct * 10) / 10,
    });
  };

  const handleAddService = (newService) => {
    const updatedServices = [...(trip.services || []), newService];
    const history = [...(trip.change_history || []), changeEntry('service_added', `Service added: ${newService.name}`)];
    updateMutation.mutate({
      services: updatedServices,
      change_history: history,
    });
    setAddingNewService(false);
  };

  const confirmStatusChange = async () => {
    const history = [
      ...(trip.change_history || []),
      changeEntry(
        'status_change',
        `Status changed from ${trip.proposal_status} to ${pendingStatus}${statusNote ? ': ' + statusNote : ''}`,
      ),
    ];

    if (pendingStatus === 'confirmed') {
      const issueDate = new Date().toISOString().split('T')[0];
      const dueDate = addDays(new Date(), 14).toISOString().split('T')[0];

      const effQty = (s) => {
        const qty = parseInt(s.quantity) || 1;
        if (s.unit === 'per_night' || s.unit === 'per_day') {
          if (s.start_date && s.end_date) {
            const days = Math.max(1, Math.round((+new Date(s.end_date) - +new Date(s.start_date)) / 86400000));
            return qty * days;
          }
          return qty;
        }
        return qty;
      };
      const lineItems = (trip.services || []).map((s) => ({
        description: `${s.name}${s.category ? ` (${s.category})` : ''}`,
        quantity: effQty(s),
        unit_price: parseFloat(s.selling_price) || 0,
        amount: effQty(s) * (parseFloat(s.selling_price) || 0),
      }));

      const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
      const notes = `Auto-generated on confirmation of reservation ${trip.reference_number || trip.name}.${appSettings?.default_invoice_notes ? '\n\n' + appSettings.default_invoice_notes : ''}`;

      // Re-confirming after an edit (e.g. status was reset to pending to
      // change services, then confirmed again) used to create a brand new
      // "full" invoice every time, leaving a stale copy of the old amount
      // behind. Overwrite the existing one in place instead, so only one
      // "full" invoice ever exists for this trip. An invoice that already
      // has a payment recorded is left alone and a fresh one is issued
      // instead — never silently overwrite payment history. A cancelled
      // invoice (voided manually, e.g. a stale duplicate from before this fix
      // existed) is left untouched too — never revived by reusing it here,
      // and never a candidate for the duplicate cleanup below either.
      const [existingFull, ...staleDuplicates] = linkedInvoices.filter(
        (inv) => inv.milestone_key === 'full' && inv.status !== 'cancelled' && (inv.amount_paid || 0) === 0,
      );

      try {
        if (existingFull) {
          await db.entities.Invoice.update(existingFull.id, {
            issue_date: issueDate,
            due_date: dueDate,
            line_items: lineItems,
            subtotal,
            total_amount: subtotal,
            amount_due: subtotal,
            currency: trip.selling_currency || 'USD',
            notes,
          });
          history.push(
            changeEntry(
              'invoice_created',
              `Invoice ${existingFull.invoice_number} updated for full amount (${currSymbol(trip.selling_currency || 'USD')}${subtotal.toFixed(2)})`,
            ),
          );
        } else {
          const invNumber = `INV-${trip.reference_number || trip.id?.slice(0, 6)?.toUpperCase() || 'RES'}-FULL-${Date.now().toString().slice(-4)}`;
          await db.entities.Invoice.create({
            invoice_number: invNumber,
            client_id: trip.client_id,
            trip_id: trip.id,
            issue_date: issueDate,
            due_date: dueDate,
            line_items: lineItems,
            subtotal,
            tax_rate: 0,
            tax_amount: 0,
            total_amount: subtotal,
            amount_paid: 0,
            amount_due: subtotal,
            status: 'draft',
            currency: trip.selling_currency || 'USD',
            milestone_key: 'full',
            notes,
            payment_terms: appSettings?.default_payment_terms || 'Due within 30 days',
          });
          history.push(
            changeEntry(
              'invoice_created',
              `Invoice ${invNumber} auto-generated for full amount (${currSymbol(trip.selling_currency || 'USD')}${subtotal.toFixed(2)})`,
            ),
          );
        }

        // Best-effort: also clear out any OTHER stale unpaid "full" invoices
        // for this trip (leftovers from before invoices were superseded in
        // place, or any other edge case). Silently skipped per-invoice if the
        // current user lacks delete_invoices (e.g. manager tier) — leaving a
        // harmless extra draft behind is better than blocking the confirm.
        for (const dup of staleDuplicates) {
          try {
            await db.entities.Invoice.delete(dup.id);
          } catch {
            /* insufficient permission, or already gone */
          }
        }

        queryClient.invalidateQueries({ queryKey: ['invoicesForTrip', tripId] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['allInvoices'] });
        queryClient.invalidateQueries({ queryKey: ['allInvoicesMulti'] });
        queryClient.invalidateQueries({ queryKey: ['clientInvoices'] });
      } catch (err) {
        showError('Reservation confirmed, but the invoice could not be updated', err.message);
      }
    }

    updateMutation.mutate({ proposal_status: pendingStatus, change_history: history });
    setNoteModalOpen(false);
  };

  if (isLoading) return <SkeletonCard />;
  if (tripError)
    return <div className="text-center py-20 text-red-600 dark:text-red-300">Error: {tripError.message}</div>;
  if (!trip) return <div className="text-center py-20">Reservation not found</div>;

  const sc = currSymbol(trip.selling_currency || 'USD');
  const statusConf = PROPOSAL_STATUS_CONFIG[trip.proposal_status] || PROPOSAL_STATUS_CONFIG.pending;
  const StatusIcon = statusConf.icon;

  const supplierMap = Object.fromEntries(suppliers.map((s) => [s.id, s.name]));
  const invoiceHeader = appSettings?.invoice_header || {};
  const companyLogoUrl = invoiceHeader.logo_url || appSettings?.logo_url || '';
  const companyName = invoiceHeader.company_name || appSettings?.app_name || '';
  // Cancelled invoices (e.g. a stale duplicate voided instead of deleted) are
  // kept for the audit trail but shouldn't clutter the reservation's primary
  // action buttons — only the current, active invoice(s) belong there.
  const activeInvoices = linkedInvoices.filter((inv) => inv.status !== 'cancelled');

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 print:hidden">
        <Link to={createPageUrl('Reservations')}>
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
        <div className="flex flex-wrap gap-2">
          {/* Status actions */}
          {trip.proposal_status !== 'confirmed' && (
            <Button
              onClick={() => changeStatus('confirmed')}
              className="bg-green-600 hover:bg-green-700"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Confirm
            </Button>
          )}
          {trip.proposal_status !== 'rejected' && (
            <Button
              onClick={() => changeStatus('rejected')}
              variant="outline"
              className="border-red-400 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Reject
            </Button>
          )}
          {trip.proposal_status !== 'pending' && (
            <Button onClick={() => changeStatus('pending')} variant="outline" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              Set Pending
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => setShowItinerary(!showItinerary)}
            className={showItinerary ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600' : ''}
          >
            <Map className="w-4 h-4 mr-2" />
            {showItinerary ? 'Hide Itinerary' : 'Itinerary Recap'}
          </Button>
          <Link to={`/client-itinerary?id=${trip.id}`} target="_blank">
            <Button variant="outline">
              <Map className="w-4 h-4 mr-2" />
              View Itinerary
            </Button>
          </Link>
          <Button onClick={() => setSendEmailOpen(true)} variant="outline" disabled={!trip.client_email}>
            <Send className="w-4 h-4 mr-2" />
            Send to Client
          </Button>

          {activeInvoices.length > 0 ? (
            activeInvoices.map((inv) => (
              <Link key={inv.id} to={createPageUrl(`InvoiceDetails?id=${inv.id}`)}>
                <Button
                  variant="outline"
                  className="border-green-300 dark:border-green-800 text-green-600 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950/40"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Invoice {inv.invoice_number}
                </Button>
              </Link>
            ))
          ) : (
            <Link to={createPageUrl(`CreateInvoice?tripId=${tripId}`)}>
              <Button
                variant="outline"
                className="border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              >
                <FileText className="w-4 h-4 mr-2" />
                Invoice
              </Button>
            </Link>
          )}

          {trip.change_history?.length > 0 && (
            <Button onClick={() => setHistoryOpen(true)} variant="outline">
              <History className="w-4 h-4 mr-2" />
              History ({trip.change_history.length})
            </Button>
          )}
          <Link to={createPageUrl(`CreateReservation?id=${tripId}`)}>
            <Button variant="outline">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button onClick={() => window.print()} variant="outline">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button
            variant="outline"
            className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
            onClick={() => {
              if (confirm('Delete this reservation permanently?')) deleteMutation.mutate();
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

      {/* Main Info */}
      <Card className="p-8 bg-card shadow-lg print:shadow-none">
        <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-3xl font-bold text-foreground">{trip.name}</h1>
              {trip.reference_number && (
                <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                  {trip.reference_number}
                </span>
              )}
            </div>
            <p className="text-muted-foreground">{trip.destination}</p>
            {trip.proposal_id && (
              <Link
                to={createPageUrl(`ProposalDetails?id=${trip.proposal_id}`)}
                className="inline-flex items-center gap-1 mt-1 text-xs text-purple-600 dark:text-purple-300 hover:underline print:hidden"
              >
                <FileText className="w-3 h-3" />
                Created from proposal
              </Link>
            )}
            {trip.service_types?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {trip.service_types.map((key) => {
                  const cfg = SERVICE_TYPE_CONFIG[key];
                  if (!cfg) return null;
                  const Icon = cfg.icon;
                  return (
                    <Badge key={key} variant="outline" className={`${cfg.color} flex items-center gap-1 text-xs`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </Badge>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2 mt-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                {trip.passengers?.length || 0} passenger{trip.passengers?.length !== 1 ? 's' : ''}
              </span>
              {trip.passengers?.length > 0 &&
                (() => {
                  const rooms = {};
                  for (const p of trip.passengers) {
                    const key = p.room_id || 'unassigned';
                    if (!rooms[key]) rooms[key] = { type: p.room_type || 'unassigned', occupants: [] };
                    rooms[key].occupants.push(p);
                  }
                  const roomList = Object.values(rooms);
                  return roomList.map((r) => {
                    const label = r.type.charAt(0).toUpperCase() + r.type.slice(1);
                    return (
                      <Badge
                        key={r.id}
                        variant="outline"
                        className="text-xs bg-muted text-muted-foreground border-border"
                      >
                        1×{label}
                      </Badge>
                    );
                  });
                })()}
            </div>
          </div>
          <Badge className={`${statusConf.color} text-sm px-3 py-1 flex items-center gap-1.5 print:hidden`}>
            <StatusIcon className="w-4 h-4" />
            {statusConf.label}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6 border-t border-border">
          <div>
            <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Travel Dates
            </div>
            <div className="font-semibold">
              {format(new Date(trip.start_date), 'MMM d')} – {format(new Date(trip.end_date), 'MMM d, yyyy')}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Client</div>
            <div className="font-semibold">{trip.client_name || '—'}</div>
            {trip.client_email && <div className="text-sm text-muted-foreground">{trip.client_email}</div>}
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Author</div>
            <div className="font-semibold">{trip.created_by_name || trip.created_by || '—'}</div>
            {trip.created_date && (
              <div className="text-sm text-muted-foreground">
                {format(new Date(trip.created_date), 'MMM d, yyyy HH:mm')}
              </div>
            )}
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
              <Users className="w-4 h-4" />
              Passengers
            </div>
            <div className="font-semibold">{trip.passengers?.length || 0}</div>
            {trip.passengers?.length > 0 &&
              (() => {
                const rooms = {};
                for (const p of trip.passengers) {
                  const key = p.room_id || 'unassigned';
                  if (!rooms[key]) rooms[key] = { type: p.room_type || 'unassigned', occupants: [] };
                  rooms[key].occupants.push(p);
                }
                const roomList = Object.values(rooms);
                return (
                  <div className="text-sm text-muted-foreground space-y-0.5 mt-1">
                    {roomList.map((r) => {
                      const label = r.type.charAt(0).toUpperCase() + r.type.slice(1);
                      return <div key={r.id}>1 × {label}</div>;
                    })}
                  </div>
                );
              })()}
          </div>
        </div>
      </Card>

      {/* Passengers / Rooms */}
      {trip.passengers?.length > 0 && (
        <Card className="p-6 bg-card shadow-lg print:shadow-none">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            Passengers ({trip.passengers.length})
          </h2>
          {(() => {
            const rooms = {};
            const roomOrder = [];
            trip.passengers.forEach((p) => {
              const rid = p.room_id || p.id;
              if (!rooms[rid]) {
                rooms[rid] = { id: rid, type: p.room_type || 'single', passengers: [] };
                roomOrder.push(rid);
              }
              rooms[rid].passengers.push(p);
            });
            const roomTypeLabels = { single: 'Single', double: 'Double', triple: 'Triple', quad: 'Quadruple' };
            const roomTypeColors = {
              single: 'bg-muted text-foreground',
              double: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
              triple: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
              quad: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
            };
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roomOrder.map((rid, ri) => {
                  const room = rooms[rid];
                  const cap = { single: 1, double: 2, triple: 3, quad: 4 }[room.type] || 2;
                  const full = room.passengers.length >= cap;
                  return (
                    <div key={rid} className="border border-border rounded-lg bg-muted overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
                        <span className="font-semibold text-foreground text-sm">Room {ri + 1}</span>
                        <div className="flex items-center gap-2">
                          <Badge className={(roomTypeColors[room.type] || 'bg-muted text-foreground') + ' text-xs'}>
                            {roomTypeLabels[room.type] || room.type}
                          </Badge>
                          <span
                            className={`text-xs font-medium ${full ? 'text-red-600 dark:text-red-300' : 'text-green-600 dark:text-green-300'}`}
                          >
                            {room.passengers.length}/{cap}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        {room.passengers.map((pax) => (
                          <div
                            key={pax.id}
                            className="flex items-center gap-2 px-3 py-2 bg-card rounded-md border border-border"
                          >
                            <span className="font-medium text-foreground flex-1 text-sm">{pax.name}</span>
                            {pax.is_contact && (
                              <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center gap-1 text-xs">
                                <Star className="w-3 h-3" fill="currentColor" />
                                Contact
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Card>
      )}

      {/* Booking Management (only show if confirmed) */}
      {trip.proposal_status === 'confirmed' && (
        <ServiceBookingManager trip={trip} user={user} suppliers={suppliers} appSettings={appSettings} />
      )}

      {/* Lodging occupancy validation */}
      <OccupancyValidation trip={trip} />

      {/* Itinerary Recap */}
      {showItinerary && trip.start_date && trip.end_date && trip.services?.length > 0 && (
        <ItineraryRecap
          trip={trip}
          companyLogoUrl={companyLogoUrl}
          companyName={companyName}
          handleShareItinerary={handleShareItinerary}
          shareCopied={shareCopied}
          supplierMap={supplierMap}
        />
      )}

      {/* Services */}
      <ServicesSection
        trip={trip}
        categories={categories}
        supplierMap={supplierMap}
        sc={sc}
        editingServiceIdx={editingServiceIdx}
        setEditingServiceIdx={setEditingServiceIdx}
        updateMutation={updateMutation}
        handleServiceUpdate={handleServiceUpdate}
        handleAddService={handleAddService}
        setAddingNewService={setAddingNewService}
        addingNewService={addingNewService}
        targetMarginPct={targetMarginPct}
        setTargetMarginPct={setTargetMarginPct}
        handleApplyTotalMargin={handleApplyTotalMargin}
      />

      {/* Cost Summary */}
      <TripCostSummary trip={trip} />

      {/* Notes & Terms */}
      <NotesAndTerms trip={trip} />

      {/* Status Change Modal */}
      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingStatus === 'confirmed'
                ? 'Confirm Reservation'
                : pendingStatus === 'rejected'
                  ? 'Reject Reservation'
                  : 'Set as Pending'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Add a note about this status change..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNoteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={confirmStatusChange}
                disabled={updateMutation.isPending}
                className={
                  pendingStatus === 'confirmed'
                    ? 'bg-green-600 hover:bg-green-700'
                    : pendingStatus === 'rejected'
                      ? 'bg-red-600 hover:bg-red-700'
                      : ''
                }
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {updateMutation.isPending ? 'Saving...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Email Modal */}
      <Dialog
        open={sendEmailOpen}
        onOpenChange={(open) => {
          setSendEmailOpen(open);
          if (open) setSendEmailTo(trip.client_email || '');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Reservation to Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">An email with the full reservation details will be sent to:</p>
            <Input
              type="email"
              value={sendEmailTo}
              onChange={(e) => setSendEmailTo(e.target.value)}
              placeholder="client@example.com"
              className="text-sm"
            />
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
                <Send className="w-3.5 h-3.5" />
                Email includes itinerary link
              </div>
              <p className="text-xs text-muted-foreground">
                The email will contain a link to a mobile-friendly itinerary page where your client can view all
                services day by day.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/client-itinerary?id=${trip.id}`);
                  setSendEmailOpen(false);
                }}
              >
                Copy Link
              </Button>
              <Button variant="outline" onClick={() => setSendEmailOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => sendEmailMutation.mutate()}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={sendEmailMutation.isPending || !sendEmailTo}
              >
                <Send className="w-4 h-4 mr-2" />
                {sendEmailMutation.isPending ? 'Sending...' : 'Send Email'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <HistoryModal historyOpen={historyOpen} setHistoryOpen={setHistoryOpen} trip={trip} />
    </div>
  );
}
