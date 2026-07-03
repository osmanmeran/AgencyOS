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
  ArrowLeft, Calendar, Users, DollarSign, CheckCircle, XCircle,
  Clock, Send, Printer, Trash2, Star, History, Edit, Plus,
  Building, ArrowRightLeft, User, Coffee, Plane, Map, Zap, AlertCircle, FileText, BookOpen, Loader2, Share2, Check, Phone
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { format, addDays } from 'date-fns';
import ServiceBookingManager from '../components/reservations/ServiceBookingManager';
import ServiceLineEditor from '../components/services/ServiceLineEditor';
import TripCostSummary from '../components/reservations/TripCostSummary';
import { applyMarkup } from '@/lib/pricing';

const currSymbol = (cur) => ({ USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' }[cur] || cur);

const PROPOSAL_STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'bg-amber-100 text-amber-800',  icon: Clock },
  sent:      { label: 'Sent',      color: 'bg-blue-100 text-blue-800',    icon: Send },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-800',  icon: CheckCircle },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-800',      icon: XCircle },
};

const SERVICE_TYPE_CONFIG = {
  lodging: { label: 'Lodging', icon: Building, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  transfers: { label: 'Transfers', icon: ArrowRightLeft, color: 'bg-green-100 text-green-700 border-green-200' },
  guides: { label: 'Guides', icon: User, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  restaurants: { label: 'Restaurants', icon: Coffee, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  transportation: { label: 'Transportation', icon: Plane, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  guided_tours: { label: 'Guided Tours', icon: Map, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  extra_activities: { label: 'Extra Activities', icon: Zap, color: 'bg-pink-100 text-pink-700 border-pink-200' },
};

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
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [targetMarginPct, setTargetMarginPct] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  const [showItinerary, setShowItinerary] = useState(false);

  const { data: trip, isLoading, error: tripError } = /** @type {any} */ (useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => db.entities.Trip.get(tripId),
    enabled: !!tripId
  }));

  const { data: user } = /** @type {any} */ (useQuery({ queryKey: ['me'], queryFn: () => db.auth.me() }));
  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({ queryKey: ['suppliers'], queryFn: () => db.entities.Supplier.list() }));
  const { data: appSettings } = /** @type {any} */ (useQuery({ 
    queryKey: ['appSettings'], 
    queryFn: async () => {
      const settings = await db.entities.AppSettings.list();
      return settings[0];
    }
  }));

  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['categories'],
    queryFn: () => db.entities.SupplierCategory.list()
  }));

  const { data: linkedInvoices = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['invoicesForTrip', tripId],
    queryFn: async () => {
      const all = await db.entities.Invoice.list();
      return all.filter(inv => inv.trip_id === tripId);
    },
    enabled: !!tripId
  }));

  const changeEntry = (action, description) => ({
    date: new Date().toISOString(),
    changed_by: user?.email || 'unknown',
    changed_by_name: user?.name || user?.email || 'Unknown',
    action,
    description
  });

  const updateMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ data) => db.entities.Trip.update(tripId, data),
    onSuccess: () => {
      showSuccess('Reservation updated');
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
    },
    onError: (error) => showError('Failed to update reservation', error.message)
  }));

  const deleteMutation = /** @type {any} */ (useMutation({
    mutationFn: () => db.entities.Trip.delete(tripId),
    onSuccess: () => {
      showSuccess('Reservation deleted');
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      navigate(createPageUrl('Reservations'));
    },
    onError: (error) => showError('Failed to delete reservation', error.message)
  }));

  const createTemplateMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ data) => db.entities.ServiceTemplate.create(data),
    onSuccess: () => { showSuccess('Template created'); setTemplateSaveOpen(false); setTemplateName(''); setTemplateDesc(''); },
    onError: (error) => showError('Failed to create template', error.message)
  }));

  const sendEmailMutation = /** @type {any} */ (useMutation({
    mutationFn: async () => {
      await db.integrations.Core.SendEmail({
        to: sendEmailTo,
        subject: `Your Travel Reservation: ${trip.name}`,
        body: buildEmailBody(trip, appSettings)
      });
      const history = [...(trip.change_history || []), changeEntry('email_sent', `Proposal sent to ${sendEmailTo}`)];
      return db.entities.Trip.update(tripId, { proposal_status: 'sent', change_history: history });
    },
    onSuccess: () => { showSuccess('Email sent'); queryClient.invalidateQueries({ queryKey: ['trip', tripId] }); setSendEmailOpen(false); },
    onError: (error) => showError('Failed to send email', error.message)
  }));

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
    const markupPct = targetMarginPct / (100 - targetMarginPct) * 100;
    const updatedServices = (trip.services || []).map(s => {
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
      change_history: history
    });
    setAddingNewService(false);
  };

  const confirmStatusChange = async () => {
    const history = [...(trip.change_history || []), changeEntry(
      'status_change',
      `Status changed from ${trip.proposal_status} to ${pendingStatus}${statusNote ? ': ' + statusNote : ''}`
    )];

    if (pendingStatus === 'confirmed') {
//       const amount = trip.total_cost || 0;
      const issueDate = new Date().toISOString().split('T')[0];
      const dueDate = addDays(new Date(), 14).toISOString().split('T')[0];
      const invNumber = `INV-${trip.reference_number || trip.id?.slice(0, 6)?.toUpperCase() || 'RES'}-FULL-${Date.now().toString().slice(-4)}`;

      const effQty = (s) => {
        const qty = parseInt(s.quantity) || 1;
        if (s.unit === 'per_night' || s.unit === 'per_day') {
          if (s.start_date && s.end_date) {
            const days = Math.max(1, Math.round((+(new Date(s.end_date)) - +(new Date(s.start_date))) / 86400000));
            return qty * days;
          }
          return qty;
        }
        return qty;
      };
      const lineItems = (trip.services || []).map(s => ({
        description: `${s.name}${s.category ? ` (${s.category})` : ''}`,
        quantity: effQty(s),
        unit_price: parseFloat(s.selling_price) || 0,
        amount: effQty(s) * (parseFloat(s.selling_price) || 0),
      }));

      const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);

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
        notes: `Auto-generated on confirmation of reservation ${trip.reference_number || trip.name}.${appSettings?.default_invoice_notes ? '\n\n' + appSettings.default_invoice_notes : ''}`,
        payment_terms: appSettings?.default_payment_terms || 'Due within 30 days',
      });

      history.push(changeEntry('invoice_created', `Invoice ${invNumber} auto-generated for full amount (${trip.selling_currency || 'USD'}${subtotal.toFixed(2)})`));
    }

    updateMutation.mutate({ proposal_status: pendingStatus, change_history: history });
    setNoteModalOpen(false);
  };

  if (isLoading) return <SkeletonCard />;
  if (tripError) return <div className="text-center py-20 text-red-600">Error: {tripError.message}</div>;
  if (!trip) return <div className="text-center py-20">Reservation not found</div>;

  const sc = currSymbol(trip.selling_currency || 'USD');
  const statusConf = PROPOSAL_STATUS_CONFIG[trip.proposal_status] || PROPOSAL_STATUS_CONFIG.pending;
  const StatusIcon = statusConf.icon;
//   const contactPassenger = trip.passengers?.find(p => p.is_contact);
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 print:hidden">
        <Link to={createPageUrl('Reservations')}>
          <Button variant="ghost" className="gap-2"><ArrowLeft className="w-4 h-4" />Back</Button>
        </Link>
        <div className="flex flex-wrap gap-2">
          {/* Status actions */}
          {trip.proposal_status !== 'confirmed' && (
            <Button onClick={() => changeStatus('confirmed')} className="bg-green-600 hover:bg-green-700" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirm
            </Button>
          )}
          {trip.proposal_status !== 'rejected' && (
            <Button onClick={() => changeStatus('rejected')} variant="outline" className="border-red-400 text-red-600 hover:bg-red-50" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
              Reject
            </Button>
          )}
          {trip.proposal_status !== 'pending' && (
            <Button onClick={() => changeStatus('pending')} variant="outline" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Clock className="w-4 h-4 mr-2" />}
              Set Pending
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => setShowItinerary(!showItinerary)}
            className={showItinerary ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600' : ''}
          >
            <Map className="w-4 h-4 mr-2" />{showItinerary ? 'Hide Itinerary' : 'Itinerary Recap'}
          </Button>
          <Link to={`/client-itinerary?id=${trip.id}`} target="_blank">
            <Button variant="outline">
              <Map className="w-4 h-4 mr-2" />View Itinerary
            </Button>
          </Link>
          <Button onClick={() => setSendEmailOpen(true)} variant="outline" disabled={!trip.client_email}>
            <Send className="w-4 h-4 mr-2" />Send to Client
          </Button>

          {linkedInvoices.length > 0 ? (
            linkedInvoices.map(inv => (
              <Link key={inv.id} to={createPageUrl(`InvoiceDetails?id=${inv.id}`)}>
                <Button variant="outline" className="border-green-300 text-green-600 hover:bg-green-50">
                  <FileText className="w-4 h-4 mr-2" />Invoice {inv.invoice_number}
                </Button>
              </Link>
            ))
          ) : (
            <Link to={createPageUrl(`CreateInvoice?tripId=${tripId}`)}>
              <Button variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-50">
                <FileText className="w-4 h-4 mr-2" />Invoice
              </Button>
            </Link>
          )}

          {trip.change_history?.length > 0 && (
            <Button onClick={() => setHistoryOpen(true)} variant="outline">
              <History className="w-4 h-4 mr-2" />History ({trip.change_history.length})
            </Button>
          )}
          <Link to={createPageUrl(`CreateReservation?id=${tripId}`)}>
            <Button variant="outline">
              <Edit className="w-4 h-4 mr-2" />Edit
            </Button>
          </Link>
          <Button onClick={() => window.print()} variant="outline">
            <Printer className="w-4 h-4 mr-2" />Print
          </Button>
          {trip.services?.length > 0 && (
            <Button onClick={() => setTemplateSaveOpen(true)} variant="outline" className="border-purple-300 text-purple-600 hover:bg-purple-50">
              <BookOpen className="w-4 h-4 mr-2" />Save as Template
            </Button>
          )}
          <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => { if (confirm('Delete this reservation permanently?')) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Main Info */}
      <Card className="p-8 bg-white shadow-lg print:shadow-none">
        <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-3xl font-bold text-slate-900">{trip.name}</h1>
              {trip.reference_number && <span className="font-mono text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded">{trip.reference_number}</span>}
            </div>
            <p className="text-slate-500">{trip.destination}</p>
            {trip.service_types?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {trip.service_types.map(key => {
                  const cfg = SERVICE_TYPE_CONFIG[key];
                  if (!cfg) return null;
                  const Icon = cfg.icon;
                  return (
                    <Badge key={key} variant="outline" className={`${cfg.color} flex items-center gap-1 text-xs`}>
                      <Icon className="w-3 h-3" />{cfg.label}
                    </Badge>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2 mt-3">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">{trip.passengers?.length || 0} passenger{trip.passengers?.length !== 1 ? 's' : ''}</span>
              {trip.passengers?.length > 0 && (() => {
                const rooms = {};
                for (const p of trip.passengers) {
                  const key = p.room_id || 'unassigned';
                  if (!rooms[key]) rooms[key] = { type: p.room_type || 'unassigned', occupants: [] };
                  rooms[key].occupants.push(p);
                }
                const roomList = Object.values(rooms);
                return roomList.map(r => {
                  const label = r.type.charAt(0).toUpperCase() + r.type.slice(1);
                  return <Badge key={r.id} variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">1×{label}</Badge>;
                });
              })()}
            </div>
          </div>
          <Badge className={`${statusConf.color} text-sm px-3 py-1 flex items-center gap-1.5 print:hidden`}>
            <StatusIcon className="w-4 h-4" />{statusConf.label}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6 border-t border-slate-200">
          <div>
            <div className="text-sm text-slate-500 mb-1 flex items-center gap-1"><Calendar className="w-4 h-4" />Travel Dates</div>
            <div className="font-semibold">{format(new Date(trip.start_date), 'MMM d')} – {format(new Date(trip.end_date), 'MMM d, yyyy')}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1">Client</div>
            <div className="font-semibold">{trip.client_name || '—'}</div>
            {trip.client_email && <div className="text-sm text-slate-500">{trip.client_email}</div>}
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1">Author</div>
            <div className="font-semibold">{trip.created_by_name || trip.created_by || '—'}</div>
            {trip.created_date && <div className="text-sm text-slate-500">{format(new Date(trip.created_date), 'MMM d, yyyy HH:mm')}</div>}
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1 flex items-center gap-1"><Users className="w-4 h-4" />Passengers</div>
            <div className="font-semibold">{trip.passengers?.length || 0}</div>
            {trip.passengers?.length > 0 && (() => {
              const rooms = {};
              for (const p of trip.passengers) {
                const key = p.room_id || 'unassigned';
                if (!rooms[key]) rooms[key] = { type: p.room_type || 'unassigned', occupants: [] };
                rooms[key].occupants.push(p);
              }
              const roomList = Object.values(rooms);
              return <div className="text-sm text-slate-500 space-y-0.5 mt-1">
                {roomList.map(r => {
                  const label = r.type.charAt(0).toUpperCase() + r.type.slice(1);
                  return <div key={r.id}>1 × {label}</div>;
                })}
              </div>;
            })()}
          </div>
        </div>
      </Card>

      {/* Passengers / Rooms */}
      {trip.passengers?.length > 0 && (
        <Card className="p-6 bg-white shadow-lg print:shadow-none">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />Passengers ({trip.passengers.length})
          </h2>
          {(() => {
            const rooms = {};
            const roomOrder = [];
            trip.passengers.forEach(p => {
              const rid = p.room_id || p.id;
              if (!rooms[rid]) {
                rooms[rid] = { id: rid, type: p.room_type || 'single', passengers: [] };
                roomOrder.push(rid);
              }
              rooms[rid].passengers.push(p);
            });
            const roomTypeLabels = { single: 'Single', double: 'Double', triple: 'Triple', quad: 'Quadruple' };
            const roomTypeColors = { single: 'bg-gray-100 text-gray-700', double: 'bg-blue-100 text-blue-700', triple: 'bg-amber-100 text-amber-700', quad: 'bg-purple-100 text-purple-700' };
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roomOrder.map((rid, ri) => {
                  const room = rooms[rid];
                  const cap = { single: 1, double: 2, triple: 3, quad: 4 }[room.type] || 2;
                  const full = room.passengers.length >= cap;
                  return (
                    <div key={rid} className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
                        <span className="font-semibold text-slate-700 text-sm">Room {ri + 1}</span>
                        <div className="flex items-center gap-2">
                          <Badge className={(roomTypeColors[room.type] || 'bg-gray-100 text-gray-700') + ' text-xs'}>{roomTypeLabels[room.type] || room.type}</Badge>
                          <span className={`text-xs font-medium ${full ? 'text-red-600' : 'text-green-600'}`}>
                            {room.passengers.length}/{cap}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        {room.passengers.map((pax) => (
                          <div key={pax.id} className="flex items-center gap-2 px-3 py-2 bg-white rounded-md border border-slate-100">
                            <span className="font-medium text-slate-900 flex-1 text-sm">{pax.name}</span>
                            {pax.is_contact && (
                              <Badge className="bg-amber-100 text-amber-700 flex items-center gap-1 text-xs">
                                <Star className="w-3 h-3" fill="currentColor" />Contact
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
      {trip.passengers?.length > 0 && trip.services?.length > 0 && (() => {
        const OCCUPANCY_CAPACITY = { Single: 1, Double: 2, Triple: 3, Quadruple: 4, Twin: 2, 'Twin/Double': 2 };
        const lodgingServices = trip.services.filter(s => {
          const cat = (s.category || '').toLowerCase();
          return (cat.includes('hotel') || cat.includes('lodging') || cat.includes('accommodation')) && s.room_occupancy;
        });
        if (!lodgingServices.length) return null;
        const paxCount = trip.passengers.length;
        const issues = lodgingServices.map(s => {
          const cap = OCCUPANCY_CAPACITY[s.room_occupancy] || 2;
          const qty = parseInt(s.quantity) || 1;
          const totalCap = cap * qty;
          return { name: s.name, occupancy: s.room_occupancy, capacity: cap, quantity: qty, totalCap, ok: totalCap >= paxCount };
        });
        const allOk = issues.every(i => i.ok);
        if (allOk) return null;
        return (
          <Card className="p-4 bg-amber-50 border-2 border-amber-300 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-800 text-sm">Occupancy Mismatch</p>
                <p className="text-xs text-amber-700 mt-1">
                  {paxCount} passenger{paxCount !== 1 ? 's' : ''} assigned, but some lodging services don't have enough room capacity:
                </p>
                <ul className="text-xs text-amber-700 mt-1 space-y-0.5 list-disc list-inside">
                  {issues.filter(i => !i.ok).map((i, idx) => (
                    <li key={idx}>
                      <strong>{i.name}</strong> — {i.occupancy} × {i.quantity} = {i.totalCap} pax capacity (needs {paxCount})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Itinerary Recap */}
      {showItinerary && trip.start_date && trip.end_date && trip.services?.length > 0 && (
        <Card className="bg-white shadow-lg print:shadow-none overflow-hidden">
          {/* Cover Image */}
          <div className="relative h-48 md:h-56 overflow-hidden">
            <img
              src={trip.image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop'}
              alt={trip.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <Map className="w-6 h-6 text-white" />
                  <h2 className="text-xl font-bold text-white">Itinerary Recap</h2>
                </div>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleShareItinerary}
                  sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  {shareCopied ? <Check size={16} style={{ marginRight: 3, color: '#4ade80' }} /> : <Share2 size={16} style={{ marginRight: 3 }} />}
                  {shareCopied ? 'Link Copied!' : 'Share'}
                </Button>
              </div>
            </div>
          </div>

          <div className="p-6">
          {(() => {
            const start = new Date(trip.start_date);
            const end = new Date(trip.end_date);
            const days = [];
            const cur = new Date(start);
            let dayNum = 1;

            while (cur <= end) {
              const key = format(cur, 'yyyy-MM-dd');
              const allServices = (trip.services || []).filter(s => {
                if (s.show_in_itinerary === false) return false;
                if (!s.start_date) return false;
                const sStart = new Date(s.start_date.split('T')[0]);
                const sEnd = s.end_date ? new Date(s.end_date.split('T')[0]) : sStart;
                return cur >= sStart && cur <= sEnd;
              });

              const dayServices = [];
              allServices.forEach(s => {
                const isTransferWithReturn = (s.category || '').toLowerCase().includes('transfer') && s.return_leg?.enabled && s.return_leg?.date;
                const returnDate = isTransferWithReturn ? s.return_leg.date.split('T')[0] : null;

                if (returnDate === key) {
                  dayServices.push({
                    _returnLegOf: s,
                    name: `${s.name} (Return)`,
                    category: s.category,
                    pickup_time: s.return_leg.pickup_time,
                    pickup_location: s.return_leg.pickup_location,
                    dropoff_location: s.return_leg.dropoff_location,
                    transfer_flight_number: s.return_leg.flight_number,
                    location: s.location,
                    description: null,
                    supplier_id: s.supplier_id,
                    _isReturnLeg: true,
                  });
                } else if (!isTransferWithReturn || key === format(new Date(s.start_date.split('T')[0]), 'yyyy-MM-dd')) {
                  dayServices.push({ ...s, _isReturnLeg: false });
                }
              });

              dayServices.sort((a, b) => {
                const aTime = a.pickup_time || ''; const bTime = b.pickup_time || '';
                if (aTime < bTime) return -1; if (aTime > bTime) return 1;
                return (a.name || '').localeCompare(b.name || '');
              });

              days.push({ key, date: new Date(cur), dayNum, services: dayServices });
              cur.setDate(cur.getDate() + 1);
              dayNum++;
            }
            const totalDays = days.length;

            return days.map(({ key, date, dayNum, services }) => {
              let badge = null;
              if (dayNum === 1 && totalDays > 1) badge = 'Arrival';
              else if (dayNum === totalDays && totalDays > 1) badge = 'Departure';

              return (
                <div key={key} className="mb-7 last:mb-0">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shrink-0">
                      {dayNum}
                    </div>
                    <div className="font-bold text-slate-900">Day {dayNum}<span className="font-normal text-slate-500 ml-2">{format(date, 'EEEE, MMM d, yyyy')}</span></div>
                    {badge && <Badge className={badge === 'Arrival' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>{badge}</Badge>}
                  </div>

                  {services.length > 0 ? (
                    <div className="relative pl-9 space-y-4">
                      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-200" />
                          {services.map((s, idx) => {
                        const cfg = SERVICE_TYPE_CONFIG[s.category];
                        const Icon = cfg?.icon || Map;
                        const iconBg = cfg?.color?.split(' ')[0] || 'bg-slate-100';
                        const iconColor = cfg?.color?.split(' ')[1] || 'text-slate-700';
                          return (
                          <div key={idx} className="relative">
                            <div className={`absolute -left-9 top-1 w-[30px] h-[30px] rounded-full flex items-center justify-center ${iconBg} ${iconColor}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                              <div className="flex items-start gap-2">
                                {s.pickup_time && (
                                  <span className="text-xs font-mono font-bold text-blue-600 whitespace-nowrap mt-0.5 min-w-[3rem]">{s.pickup_time}</span>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                                    {s.name}
                                    {s._isReturnLeg && (
                                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Return</span>
                                    )}
                                  </div>
                                  {s.location && <div className="text-xs text-slate-500 mt-0.5">📍 {s.location}</div>}
                                  {s.pickup_location && <div className="text-xs text-slate-600 mt-1">Pick up: {s.pickup_location}</div>}
                                  {s.dropoff_location && <div className="text-xs text-slate-600">Drop off: {s.dropoff_location}</div>}
                                  {s.transfer_flight_number && <div className="text-xs text-slate-600">✈ {s.transfer_flight_number}</div>}
                                  {s.description && <p className="text-xs text-slate-600 mt-1 leading-relaxed">{s.description}</p>}
                                  {!s._isReturnLeg && s.return_leg?.enabled && (
                                    <div className="mt-2 pt-2 border-t border-orange-100">
                                      <span className="text-[11px] text-orange-600 font-semibold uppercase tracking-wide">Return Leg</span>
                                      <div className="text-xs text-slate-600 mt-0.5">
                                        {s.return_leg.date ? format(new Date(s.return_leg.date), 'MMM d, yyyy') : ''}
                                        {s.return_leg.pickup_time ? ` @ ${s.return_leg.pickup_time}` : ''}
                                        {s.return_leg.pickup_location ? ` — Pick up: ${s.return_leg.pickup_location}` : ''}
                                        {s.return_leg.dropoff_location ? ` → ${s.return_leg.dropoff_location}` : ''}
                                      </div>
                                    </div>
                                  )}
                                  {s.supplier_id && supplierMap[s.supplier_id] && (
                                    <div className="text-[11px] text-slate-400 mt-1">Booked via: {supplierMap[s.supplier_id]}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400 italic pl-9">Free day / No scheduled activities</div>
                  )}
                </div>
              );
            });
          })()}
          </div>

          {/* Emergency Contact */}
          {(trip.created_by_name || trip.created_by || trip.created_by_phone) && (
            <div className="mt-6 bg-red-50 rounded-xl border border-red-200 p-6">
              <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Emergency Contact
              </h3>
              <div className="space-y-1 text-sm text-red-800">
                {trip.created_by_name && <div className="font-semibold">{trip.created_by_name}</div>}
                {trip.created_by && <div>Your Travel Agent</div>}
                {trip.created_by_phone && (
                  <div>
                    <a href={`tel:${trip.created_by_phone}`} className="underline">{trip.created_by_phone}</a>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Services */}
      <Card className="p-8 bg-white shadow-lg print:shadow-none">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">Services Included</h2>
          {trip.proposal_status !== 'confirmed' && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setAddingNewService(true)}
            >
              <Plus className="w-4 h-4 mr-2" />Add Service
            </Button>
          )}
        </div>

        {addingNewService && (
          <div className="mb-6">
            <ServiceLineEditor
              service={{}}
              services={trip.services}
              categories={categories}
              _passengerCount={trip.passengers?.length || 1}
              onUpdate={handleAddService}
              onRemove={() => setAddingNewService(false)}
              onDuplicate={() => {}}
              onChange={() => {}}
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="outline" onClick={() => setAddingNewService(false)}>Cancel</Button>
            </div>
          </div>
        )}

          {trip.services?.length > 0 ? (
          <div className="space-y-5">
            {(() => {
              const sortedServices = (trip.services || []).slice().sort((a, b) => {
                const aStart = a.start_date || ''; const bStart = b.start_date || '';
                if (aStart < bStart) return -1; if (aStart > bStart) return 1;
                const aEnd = a.end_date || ''; const bEnd = b.end_date || '';
                if (aEnd < bEnd) return -1; if (aEnd > bEnd) return 1;
                return (a.name || '').localeCompare(b.name || '');
              });

              const dayToServices = {};
              const dayOrder = [];
              const shownServiceKeys = new Set();
              if (trip.start_date && trip.end_date) {
                const start = new Date(trip.start_date);
                const end = new Date(trip.end_date);
                const cur = new Date(start);
                while (cur <= end) {
                  const key = format(cur, 'yyyy-MM-dd');
                  dayOrder.push(key);
                  const active = sortedServices.filter(s => {
                    if (!s.start_date) return false;
                    const sStart = new Date(s.start_date.split('T')[0]);
                    const sEnd = s.end_date ? new Date(s.end_date.split('T')[0]) : sStart;
                    return cur >= sStart && cur <= sEnd;
                  });
                  if (active.length > 0) {
                    dayToServices[key] = active;
                    active.forEach(s => shownServiceKeys.add(s._key || s));
                  }
                  cur.setDate(cur.getDate() + 1);
                }
              }

              const unscheduled = sortedServices.filter(s => !s.start_date || !shownServiceKeys.has(s._key || s));

              const fullServiceCard = (service, originalIdx) => {
                if (editingServiceIdx === originalIdx) {
                  return (
                    <div key={originalIdx}>
                      <ServiceLineEditor
                        service={service}
                        services={trip.services}
                        categories={categories}
                        _passengerCount={trip.passengers?.length || 1}
                        onUpdate={handleServiceUpdate}
                        onRemove={() => {
                          const updatedServices = trip.services.filter((_, i) => i !== originalIdx);
                          updateMutation.mutate({ services: updatedServices });
                          setEditingServiceIdx(null);
                        }}
                        onDuplicate={() => {}}
                        onChange={() => {}}
                      />
                      <div className="flex justify-end gap-2 mt-3">
                        <Button variant="outline" onClick={() => setEditingServiceIdx(null)}>Cancel</Button>
                      </div>
                    </div>
                  );
                }
                const supplierName = service.supplier_id ? (supplierMap[service.supplier_id] || '—') : null;
                const scSupplier = ({ USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' }[service.supplier_currency] || service.supplier_currency);
                const scClient = ({ USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' }[service.client_currency] || service.client_currency);
                const serviceEffQty = (s) => {
                  const qty = parseInt(s.quantity) || 1;
                  if (s.unit === 'per_night' || s.unit === 'per_day') {
                    if (s.start_date && s.end_date) {
                      const days = Math.max(1, Math.round((+(new Date(s.end_date)) - +(new Date(s.start_date))) / 86400000));
                      return qty * days;
                    }
                    return qty;
                  }
                  return qty;
                };
                const lineAcq = (parseFloat(service.acquiring_price) || 0) * serviceEffQty(service);
                const lineSell = (parseFloat(service.selling_price) || 0) * serviceEffQty(service);
                return (
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 relative">
                    {trip.proposal_status !== 'confirmed' && (
                      <Button size="sm" variant="outline" onClick={() => setEditingServiceIdx(originalIdx)} className="absolute top-3 right-3 print:hidden">
                        <Edit className="w-3.5 h-3.5 mr-1" />Edit
                      </Button>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <h3 className="font-bold text-lg text-slate-900">{service.name}</h3>
                      {service.location && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{service.location}</span>}
                      {service.category && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">{service.category}</span>}
                      {supplierName && <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">{supplierName}</span>}
                      {service.booking_source && (
                        <span className={`text-xs px-2 py-1 rounded ${service.booking_source === 'direct' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {service.booking_source === 'direct' ? 'Direct' : 'Via Supplier'}
                        </span>
                      )}
                    </div>
                    {service.start_date && service.end_date && (
                      <div className="text-sm text-slate-600 mb-3">
                        <span className="font-medium">Dates:</span> {format(new Date(service.start_date), 'MMM d')} – {format(new Date(service.end_date), 'MMM d, yyyy')}
                      </div>
                    )}
                    {service.pickup_location && (
                      <div className="text-sm text-slate-600 mb-2 space-y-1">
                        <div><span className="font-medium">Pick up:</span> {service.pickup_location}{service.pickup_time ? ` @ ${service.pickup_time}` : ''}</div>
                        <div><span className="font-medium">Drop off:</span> {service.dropoff_location || '—'}</div>
                        {service.transfer_flight_number && <div><span className="font-medium">Flight:</span> {service.transfer_flight_number}</div>}
                        {service.return_leg?.enabled && (
                          <div className="mt-2 pt-2 border-t border-orange-200">
                            <div className="font-medium text-orange-700 text-xs uppercase tracking-wide mb-1">Return Leg</div>
                            <div><span className="font-medium">Date:</span> {format(new Date(service.return_leg.date), 'MMM d, yyyy')}{service.return_leg.pickup_time ? ` @ ${service.return_leg.pickup_time}` : ''}</div>
                            <div><span className="font-medium">Pick up:</span> {service.return_leg.pickup_location}</div>
                            <div><span className="font-medium">Drop off:</span> {service.return_leg.dropoff_location}</div>
                            {service.return_leg.flight_number && <div><span className="font-medium">Flight:</span> {service.return_leg.flight_number}</div>}
                          </div>
                        )}
                      </div>
                    )}
                    {service.description && <p className="text-slate-600 text-sm mb-3">{service.description}</p>}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="bg-white p-2 rounded border">
                        <div className="text-xs text-slate-500">Unit Type</div>
                        <div className="font-semibold text-slate-900">{service.unit?.replace('_', ' ') || 'per_person'}</div>
                      </div>
                      <div className="bg-white p-2 rounded border">
                        <div className="text-xs text-slate-500">Qty</div>
                        <div className="font-semibold text-slate-900">{service.quantity || 1}</div>
                      </div>
                      <div className="bg-amber-50 p-2 rounded border border-amber-200">
                        <div className="text-xs text-slate-500">Supplier Cost</div>
                        <div className="font-semibold text-amber-900">{scSupplier}{(parseFloat(service.acquiring_price) || 0).toFixed(2)} <span className="text-xs font-normal text-slate-500">× {serviceEffQty(service)}</span></div>
                        <div className="text-xs text-slate-500 mt-0.5">Total: {scSupplier}{lineAcq.toFixed(2)}</div>
                      </div>
                      <div className="bg-green-50 p-2 rounded border border-green-200">
                        <div className="text-xs text-slate-500">Client Price</div>
                        <div className="font-semibold text-green-900">{scClient}{(parseFloat(service.selling_price) || 0).toFixed(2)} <span className="text-xs font-normal text-slate-500">× {serviceEffQty(service)}</span></div>
                        <div className="text-xs text-slate-500 mt-0.5">Total: {scClient}{lineSell.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-xs text-slate-600">Total (Client)</span>
                      <span className="font-bold text-lg text-green-700">{scClient}{lineSell.toFixed(2)}</span>
                    </div>
                  </div>
                );
              };

              const renderDayService = (service, originalIdx, dayKey) => {
                if (editingServiceIdx === originalIdx) {
                  return (
                    <div key={originalIdx}>
                      <ServiceLineEditor
                        service={service}
                        services={trip.services}
                        categories={categories}
                        _passengerCount={trip.passengers?.length || 1}
                        onUpdate={handleServiceUpdate}
                        onRemove={() => {
                          const updatedServices = trip.services.filter((_, i) => i !== originalIdx);
                          updateMutation.mutate({ services: updatedServices });
                          setEditingServiceIdx(null);
                        }}
                        onDuplicate={() => {}}
                        onChange={() => {}}
                      />
                      <div className="flex justify-end gap-2 mt-3">
                        <Button variant="outline" onClick={() => setEditingServiceIdx(null)}>Cancel</Button>
                      </div>
                    </div>
                  );
                }

                const isStartDay = service.start_date && format(new Date(service.start_date.split('T')[0]), 'yyyy-MM-dd') === dayKey;

                if (isStartDay) {
                  return <div key={originalIdx}>{fullServiceCard(service, originalIdx)}</div>;
                }

                return (
                  <div key={originalIdx} className="border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-blue-500 font-medium uppercase shrink-0">Continuing</span>
                        <span className="font-semibold text-slate-900 truncate">{service.name}</span>
                        {service.category && <Badge variant="outline" className="text-xs shrink-0">{service.category}</Badge>}
                      </div>
                      {service.selling_price > 0 && (
                        <span className="text-sm text-green-600 font-semibold shrink-0">
                          {sc}{(parseFloat(service.selling_price) || 0).toFixed(2)}
                          {service.unit === 'per_night' && '/night'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              };

              return (
                <>
                  {dayOrder.filter(key => dayToServices[key]).map(key => {
                    const date = new Date(key + 'T00:00:00');
                    const dayNum = dayOrder.indexOf(key) + 1;
                    return (
                      <div key={key}>
                        <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-blue-200">
                          <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                            {dayNum}
                          </div>
                          <div>
                            <div className="font-bold text-lg text-slate-900">Day {dayNum}</div>
                            <div className="text-sm text-slate-500">{format(date, 'EEEE, MMM d, yyyy')}</div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {dayToServices[key].map(service => renderDayService(service, trip.services.indexOf(service), key))}
                        </div>
                      </div>
                    );
                  })}

                  {unscheduled.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-slate-200">
                        <div className="bg-slate-400 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                          ∞
                        </div>
                        <div className="font-bold text-lg text-slate-500">Unscheduled Services</div>
                      </div>
                      <div className="space-y-4">
                        {unscheduled.map(service => (
                          <div key={trip.services.indexOf(service)}>
                            {fullServiceCard(service, trip.services.indexOf(service))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-6 mt-4 border-t-2 border-slate-300">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <span className="text-2xl font-bold text-slate-900">Total</span>
                      <div className="text-4xl font-bold text-green-700">{sc}{(trip.total_cost || 0).toFixed(2)}</div>
                    </div>
                  </div>

                  {trip.proposal_status !== 'confirmed' && (
                    <div className="mt-4 flex items-center gap-3 flex-wrap bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" />Target Margin
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number" min="0" max="99" step="0.5"
                          value={targetMarginPct}
                          onChange={e => setTargetMarginPct(parseFloat(e.target.value) || 0)}
                          className="w-20 h-7 text-sm text-center px-1"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                      <Button
                        size="sm" variant="outline"
                        onClick={handleApplyTotalMargin}
                        disabled={targetMarginPct <= 0 || targetMarginPct >= 100 || updateMutation.isPending}
                        className="text-xs h-7"
                      >
                        Apply
                      </Button>
                      <span className="text-xs text-slate-400 ml-auto">
                        = {targetMarginPct > 0 && targetMarginPct < 100 ? (targetMarginPct / (100 - targetMarginPct) * 100).toFixed(1) : '0'}% markup on cost
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <p className="text-slate-500">No services added yet.</p>
        )}
      </Card>

      {/* Cost Summary */}
      <TripCostSummary trip={trip} />

      {/* Notes & Terms */}
      {trip.notes && (
        <Card className="p-6 bg-white shadow-lg print:shadow-none">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Notes</h2>
          <p className="text-slate-700 whitespace-pre-wrap">{trip.notes}</p>
        </Card>
      )}
      {trip.terms_and_conditions && (
        <Card className="p-6 bg-slate-50 print:bg-white print:shadow-none">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Terms & Conditions</h2>
          <p className="text-slate-600 text-sm whitespace-pre-wrap">{trip.terms_and_conditions}</p>
        </Card>
      )}
      {trip.internal_notes && (
        <Card className="p-6 bg-amber-50 border-l-4 border-amber-400 print:shadow-none">
          <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            Internal Notes
          </h2>
          <p className="text-slate-700 whitespace-pre-wrap text-sm">{trip.internal_notes}</p>
        </Card>
      )}

      {/* Status Change Modal */}
      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingStatus === 'confirmed' ? 'Confirm Reservation' : pendingStatus === 'rejected' ? 'Reject Reservation' : 'Set as Pending'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea value={statusNote} onChange={e => setStatusNote(e.target.value)} placeholder="Add a note about this status change..." rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNoteModalOpen(false)}>Cancel</Button>
              <Button onClick={confirmStatusChange} disabled={updateMutation.isPending}
                className={pendingStatus === 'confirmed' ? 'bg-green-600 hover:bg-green-700' : pendingStatus === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''}>
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {updateMutation.isPending ? 'Saving...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Email Modal */}
      <Dialog open={sendEmailOpen} onOpenChange={(open) => { setSendEmailOpen(open); if (open) setSendEmailTo(trip.client_email || ''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Reservation to Client</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-600">An email with the full reservation details will be sent to:</p>
            <Input type="email" value={sendEmailTo} onChange={e => setSendEmailTo(e.target.value)} placeholder="client@example.com" className="text-sm" />
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-blue-700 font-medium mb-1">
                <Send className="w-3.5 h-3.5" />Email includes itinerary link
              </div>
              <p className="text-xs text-slate-500">
                The email will contain a link to a mobile-friendly itinerary page where your client can view all services day by day.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/client-itinerary?id=${trip.id}`);
                setSendEmailOpen(false);
              }}>
                Copy Link
              </Button>
              <Button variant="outline" onClick={() => setSendEmailOpen(false)}>Cancel</Button>
              <Button onClick={() => sendEmailMutation.mutate()} className="bg-blue-600 hover:bg-blue-700" disabled={sendEmailMutation.isPending || !sendEmailTo}>
                <Send className="w-4 h-4 mr-2" />{sendEmailMutation.isPending ? 'Sending...' : 'Send Email'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="w-5 h-5" />Change History</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-4">
            {trip.change_history?.slice().reverse().map((entry, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {entry.action === 'created' && <Badge className="bg-green-100 text-green-800">Created</Badge>}
                  {entry.action === 'status_change' && <Badge className="bg-blue-100 text-blue-800">Status</Badge>}
                  {entry.action === 'service_added' && <Badge className="bg-purple-100 text-purple-800">Service Added</Badge>}
                  {entry.action === 'service_updated' && <Badge className="bg-amber-100 text-amber-800">Service Updated</Badge>}
                  {entry.action === 'email_sent' && <Badge className="bg-indigo-100 text-indigo-800">Email Sent</Badge>}
                  {entry.action === 'invoice_created' && <Badge className="bg-green-100 text-green-800">Invoice Created</Badge>}
                  {!['created','status_change','service_added','service_updated','email_sent','invoice_created'].includes(entry.action) && <Badge variant="outline">{entry.action}</Badge>}
                  <span className="text-xs text-slate-400 ml-auto">{format(new Date(entry.date), 'MMM d, yyyy HH:mm')}</span>
                </div>
                <p className="text-sm text-slate-700">{entry.description}</p>
                <div className="text-xs text-slate-500 mt-1">By {entry.changed_by_name || entry.changed_by}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Save as Template Dialog */}
      <Dialog open={templateSaveOpen} onOpenChange={setTemplateSaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5" />Save as Template</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-600">Save the services from this reservation as a reusable template.</p>
            <div className="space-y-2">
              <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name (e.g. Istanbul Classic)" />
              <Textarea value={templateDesc} onChange={e => setTemplateDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTemplateSaveOpen(false)}>Cancel</Button>
              <Button
                className="bg-purple-600 hover:bg-purple-700"
                disabled={!templateName || createTemplateMutation.isPending}
                onClick={() => {
                  const svcs = (trip.services || []).map(s => {
                    const { _key, ...rest } = s;
                    return rest;
                  });
                  createTemplateMutation.mutate({
                    name: templateName,
                    description: templateDesc,
                    category: 'package',
                    services: svcs
                  });
                }}
              >
                {createTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildEmailBody(trip, appSettings) {
  const sc = currSymbol(trip.selling_currency || 'USD');
  const itineraryUrl = `${window.location.origin}/client-itinerary?id=${trip.id}`;
  const companyName = appSettings?.invoice_header?.company_name || appSettings?.app_name || 'Marvel Tour';
  const companyAddress = [appSettings?.invoice_header?.address_line1, appSettings?.invoice_header?.city, appSettings?.invoice_header?.country].filter(Boolean).join(' · ');
  const companyPhone = appSettings?.invoice_header?.phone || '';
  const logoUrl = appSettings?.logo_url || '';
  const footerText = appSettings?.invoice_footer || '';

  const serviceRows = (trip.services || []).map(s => {
    const qty = parseInt(s.quantity) || 1;
    const price = ((parseFloat(s.selling_price) || 0) * qty).toFixed(2);
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;">${s.name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;text-align:center;">x${qty}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;text-align:right;font-weight:600;">${sc}${price}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:620px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px 40px;text-align:center;">
    ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="height:48px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;">` : ''}
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.3px;">${companyName}</h1>
    ${companyAddress ? `<p style="color:#94a3b8;margin:6px 0 0;font-size:13px;">${companyAddress}</p>` : ''}
    ${companyPhone ? `<p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">${companyPhone}</p>` : ''}
  </div>

  <!-- Title bar -->
  <div style="background:#f0f9ff;border-bottom:1px solid #bae6fd;padding:16px 40px;text-align:center;">
    <p style="margin:0;color:#0369a1;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Travel Reservation Confirmation</p>
  </div>

  <!-- Body -->
  <div style="padding:36px 40px;">
    <p style="color:#1e293b;font-size:16px;margin:0 0 24px;">Dear <strong>${trip.client_name || 'Valued Client'}</strong>,</p>
    <p style="color:#475569;font-size:14px;margin:0 0 28px;line-height:1.6;">Please find your travel reservation details below. We look forward to making your journey unforgettable.</p>

    <!-- Trip Info -->
    <div style="background:#f8fafc;border-radius:12px;padding:20px 24px;margin-bottom:28px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;width:140px;">Reservation</td>
          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${trip.name || '—'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Reference</td>
          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${trip.reference_number || 'Pending'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Destination</td>
          <td style="padding:6px 0;color:#1e293b;font-size:13px;">${trip.destination || '—'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Dates</td>
          <td style="padding:6px 0;color:#1e293b;font-size:13px;">${trip.start_date || ''} → ${trip.end_date || ''}</td>
        </tr>
      </table>
    </div>

    ${serviceRows ? `
    <!-- Services -->
    <h3 style="color:#1e293b;font-size:14px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">Services Included</h3>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:28px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">Service</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">Price</th>
        </tr>
      </thead>
      <tbody>${serviceRows}</tbody>
      <tfoot>
        <tr style="background:#1a1a2e;">
          <td colspan="2" style="padding:12px;color:#94a3b8;font-size:13px;font-weight:600;">TOTAL</td>
          <td style="padding:12px;color:#ffffff;font-size:16px;font-weight:700;text-align:right;">${sc}${(trip.total_cost || 0).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>` : ''}

    ${trip.notes ? `<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px;"><p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;"><strong>Notes:</strong> ${trip.notes}</p></div>` : ''}

    <!-- CTA Button -->
    <div style="text-align:center;margin:32px 0;">
      <a href="${itineraryUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:-0.2px;">View Full Itinerary Online →</a>
    </div>

    ${trip.terms_and_conditions ? `
    <div style="border-top:1px solid #e2e8f0;padding-top:20px;margin-top:8px;">
      <h4 style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Terms & Conditions</h4>
      <p style="color:#94a3b8;font-size:12px;line-height:1.7;margin:0;">${trip.terms_and_conditions}</p>
    </div>` : ''}
  </div>

  <!-- Footer -->
  <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
    ${footerText ? `<p style="color:#94a3b8;font-size:12px;margin:0 0 6px;">${footerText}</p>` : ''}
    <p style="color:#cbd5e1;font-size:11px;margin:0;">${companyName} · ${new Date().toLocaleDateString('it-IT')}</p>
  </div>

</div>
</body>
</html>`;
}