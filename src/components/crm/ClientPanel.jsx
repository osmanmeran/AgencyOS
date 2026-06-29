const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Mail, Phone, MapPin, Building, CreditCard, FileText, Plane,
  DollarSign, Star, Edit2, Check, X, ExternalLink, Clock, User, Send,
  MessageSquare, Calendar, CheckCircle2, Circle, Plus, ChevronRight,
  TrendingUp, TrendingDown, Globe
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { format } from 'date-fns';
import EmailComposer from './EmailComposer';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700 border-green-200',
  inactive: 'bg-gray-100 text-gray-600 border-gray-200',
  vip: 'bg-purple-100 text-purple-700 border-purple-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200'
};

const PROPOSAL_STATUS_COLORS = {
  delivered: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  changed: 'bg-yellow-100 text-yellow-700'
};

const INVOICE_STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600'
};

export default function ClientPanel({ client, onClientUpdated }) {
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [composerState, setComposerState] = useState({ open: false, proposal: null, invoice: null });
  const queryClient = useQueryClient();

  const { data: proposals = [] } = useQuery({
    queryKey: ['clientProposals', client.id],
    queryFn: () => db.entities.Proposal.filter({ client_id: client.id }, '-created_date')
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['clientInvoices', client.id],
    queryFn: () => db.entities.Invoice.filter({ client_id: client.id }, '-created_date')
  });

  const { data: trips = [] } = useQuery({
    queryKey: ['clientTrips', client.id],
    queryFn: () => db.entities.Trip.filter({ client_id: client.id }, '-created_date')
  });

  const { data: emailLogs = [] } = useQuery({
    queryKey: ['emailLogs', client.id],
    queryFn: () => db.entities.EmailLog.filter({ client_id: client.id }, '-created_date')
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['clientMessages', client.id],
    queryFn: () => db.entities.Message.filter({ client_id: client.id }, '-created_date')
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['clientTasks', client.id],
    queryFn: () => db.entities.ClientTask.filter({ client_id: client.id }, '-created_date')
  });

  const updateMutation = useMutation({
    mutationFn: (data) => db.entities.Client.update(client.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClientUpdated();
      setEditing(false);
    }
  });

  const taskMutation = useMutation({
    mutationFn: (data) => db.entities.ClientTask.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientTasks', client.id] })
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.ClientTask.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientTasks', client.id] })
  });

  const [newTaskTitle, setNewTaskTitle] = useState('');

  const startEdit = () => {
    setEditForm({ ...client });
    setEditing(true);
  };

  const set = (field, value) => setEditForm(prev => ({ ...prev, [field]: value }));

  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_amount || 0), 0);
  const totalOwed = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.amount_due || i.total_amount || 0), 0);

  const timeline = [
    ...messages.map(m => ({ type: 'message', date: m.created_date, item: m })),
    ...proposals.map(p => ({ type: 'proposal', date: p.created_date, item: p })),
    ...invoices.map(i => ({ type: 'invoice', date: i.created_date, item: i })),
    ...trips.map(t => ({ type: 'trip', date: t.created_date, item: t })),
    ...emailLogs.map(e => ({ type: 'email', date: e.created_date, item: e })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const pendingTasks = tasks.filter(t => t.status !== 'done');

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    taskMutation.mutate({ client_id: client.id, title: newTaskTitle.trim(), type: 'task', status: 'pending' });
    setNewTaskTitle('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${
              client.status === 'vip' ? 'bg-gradient-to-br from-purple-500 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-blue-600'
            }`}>
              <span className="text-white font-bold text-lg">
                {(client.name || '?').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">{client.name}</h2>
                {client.status === 'vip' && <Star className="w-4 h-4 text-purple-500 fill-purple-500" />}
                <Badge className={`text-[10px] font-medium border ${STATUS_COLORS[client.status]}`}>
                  {client.status === 'vip' ? 'VIP' : client.status || 'active'}
                </Badge>
              </div>
              {client.company && (
                <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <Building className="w-3 h-3" />{client.company}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={startEdit}>
              <Edit2 className="w-3 h-3 mr-1" />Edit
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs"
              onClick={() => setComposerState({ open: true, proposal: null, invoice: null })}>
              <Send className="w-3 h-3 mr-1" />Email
            </Button>
            <Link to={createPageUrl(`ClientDetails?id=${client.id}`)}>
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                <ExternalLink className="w-3 h-3 mr-1" />Full Profile
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick contact */}
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
          {client.email && (
            <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
              <Mail className="w-3 h-3" />{client.email}
            </a>
          )}
          {client.phone && (
            <a href={`tel:${client.phone}`} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
              <Phone className="w-3 h-3" />{client.phone}
            </a>
          )}
          {(client.city || client.country) && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />{[client.city, client.country].filter(Boolean).join(', ')}
            </span>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
            <div className="text-[10px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider">Proposals</div>
            <div className="font-bold text-slate-800 text-lg">{proposals.length}</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
            <div className="text-[10px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider">Trips</div>
            <div className="font-bold text-slate-800 text-lg">{trips.length}</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
            <div className="text-[10px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider">Paid</div>
            <div className="font-bold text-green-700 text-lg">${totalPaid.toFixed(0)}</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
            <div className="text-[10px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider">Outstanding</div>
            <div className="font-bold text-orange-600 text-lg">${totalOwed.toFixed(0)}</div>
          </div>
        </div>
      </div>

      <EmailComposer
        open={composerState.open}
        onClose={() => setComposerState({ open: false, proposal: null, invoice: null })}
        client={client}
        proposal={composerState.proposal}
        invoice={composerState.invoice}
      />

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="activity" className="h-full flex flex-col">
          <TabsList className="mx-4 mt-3 mb-0 bg-slate-100 p-0.5 gap-0">
            <TabsTrigger value="activity" className="text-xs data-[state=active]:bg-white">Activity</TabsTrigger>
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-white">Details</TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs data-[state=active]:bg-white">Tasks {pendingTasks.length > 0 && `(${pendingTasks.length})`}</TabsTrigger>
            <TabsTrigger value="proposals" className="text-xs data-[state=active]:bg-white">Proposals ({proposals.length})</TabsTrigger>
            <TabsTrigger value="invoices" className="text-xs data-[state=active]:bg-white">Invoices ({invoices.length})</TabsTrigger>
            <TabsTrigger value="trips" className="text-xs data-[state=active]:bg-white">Trips ({trips.length})</TabsTrigger>
          </TabsList>

          {/* ACTIVITY FEED (default tab — HubSpot style) */}
          <TabsContent value="activity" className="px-6 py-4 flex-1 overflow-y-auto">
            {timeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Clock className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">No activity yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {timeline.slice(0, 30).map((entry, idx) => {
                  const { type, date, item } = entry;
                  const isEmail = type === 'email';
                  const isProposal = type === 'proposal';
                  const isInvoice = type === 'invoice';
                  const isTrip = type === 'trip';
                  const isMessage = type === 'message';

                  let Icon, color, label, sublabel, href;
                  if (isEmail) {
                    Icon = Mail; color = 'bg-violet-100 text-violet-600';
                    label = 'Email sent';
                    sublabel = item.subject;
                  } else if (isMessage) {
                    Icon = MessageSquare; color = 'bg-cyan-100 text-cyan-600';
                    label = item.sender_type === 'client' ? 'Client message' : 'Agent message';
                    sublabel = item.content?.slice(0, 80);
                  } else if (isProposal) {
                    Icon = FileText; color = 'bg-blue-100 text-blue-600';
                    label = item.title; sublabel = `Proposal · ${item.status}`;
                    href = createPageUrl(`ProposalDetails?id=${item.id}`);
                  } else if (isInvoice) {
                    Icon = DollarSign; color = 'bg-green-100 text-green-600';
                    label = item.invoice_number; sublabel = `$${(item.total_amount || 0).toFixed(0)} · ${item.status}`;
                    href = createPageUrl(`InvoiceDetails?id=${item.id}`);
                  } else {
                    Icon = Plane; color = 'bg-orange-100 text-orange-600';
                    label = item.name; sublabel = item.destination || 'Trip';
                    href = createPageUrl(`TripDetails?id=${item.id}`);
                  }

                  const content = (
                    <div className="flex items-start gap-3 py-2.5 group hover:bg-slate-50 px-2 rounded-lg transition-colors -mx-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${color} mt-0.5`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800 text-sm">{label}</span>
                          <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">
                            {date ? format(new Date(date), 'MMM d, HH:mm') : ''}
                          </span>
                        </div>
                        {sublabel && <div className="text-xs text-slate-500 truncate mt-0.5">{sublabel}</div>}
                        {isMessage && item.content && (
                          <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.content}</div>
                        )}
                        {isEmail && item.to_email && (
                          <div className="text-[10px] text-slate-400 mt-0.5">To: {item.to_email}</div>
                        )}
                      </div>
                      {href && <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
                    </div>
                  );

                  return href ? (
                    <Link key={idx} to={href} className="block">{content}</Link>
                  ) : (
                    <div key={idx}>{content}</div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* OVERVIEW — Details */}
          <TabsContent value="overview" className="px-6 py-4 flex-1 overflow-y-auto space-y-6">
            {editing ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Edit Contact</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['name', 'Full Name', 'text'],
                    ['email', 'Email', 'email'],
                    ['phone', 'Phone', 'text'],
                    ['company', 'Company', 'text'],
                    ['address', 'Address', 'text'],
                    ['city', 'City', 'text'],
                    ['region', 'Region / State', 'text'],
                    ['country', 'Country', 'text'],
                    ['website', 'Website', 'text'],
                    ['passport_number', 'Passport', 'text'],
                    ['tax_id', 'Tax ID', 'text'],
                    ['date_of_birth', 'Date of Birth', 'date'],
                  ].map(([field, label, type]) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <Input type={type} value={editForm[field] || ''} onChange={e => set(field, e.target.value)} className="h-8 text-sm" />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select value={editForm.status || 'active'} onValueChange={v => set('status', v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={editForm.type || 'client'} onValueChange={v => set('type', v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Client</SelectItem>
                        <SelectItem value="supplier">Supplier</SelectItem>
                        <SelectItem value="representative">Representative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={editForm.notes || ''} onChange={e => set('notes', e.target.value)} rows={3} className="text-sm" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5 mr-1" />Cancel</Button>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => updateMutation.mutate(editForm)} disabled={updateMutation.isPending}>
                    <Check className="w-3.5 h-3.5 mr-1" />{updateMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Contact info grid */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                  {client.email && <Info icon={Mail} label="Email" value={client.email} href={`mailto:${client.email}`} />}
                  {client.phone && <Info icon={Phone} label="Phone" value={client.phone} href={`tel:${client.phone}`} />}
                  {(client.city || client.country) && <Info icon={MapPin} label="Location" value={[client.city, client.country].filter(Boolean).join(', ')} />}
                  {client.company && <Info icon={Building} label="Company" value={client.company} />}
                  {client.payment_method && <Info icon={CreditCard} label="Payment" value={client.payment_method.replace('_', ' ')} />}
                  {client.website && <Info icon={Globe} label="Website" value={client.website} href={client.website.startsWith('http') ? client.website : `https://${client.website}`} />}
                  {client.passport_number && <Info icon={FileText} label="Passport" value={client.passport_number} />}
                  {client.tax_id && <Info icon={FileText} label="Tax ID" value={client.tax_id} />}
                  {client.date_of_birth && <Info icon={Clock} label="Date of Birth" value={format(new Date(client.date_of_birth), 'MMM d, yyyy')} />}
                </div>
                {client.address && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Address</div>
                    <div className="text-sm text-slate-700">{client.address}</div>
                  </div>
                )}
                {client.notes && (
                  <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
                    <div className="text-[10px] font-semibold text-yellow-700 uppercase tracking-wider mb-1">Internal Notes</div>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{client.notes}</div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* TASKS */}
          <TabsContent value="tasks" className="px-6 py-4 flex-1 overflow-y-auto space-y-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add a task..."
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                className="h-8 text-sm flex-1"
                onKeyDown={e => e.key === 'Enter' && handleAddTask()}
              />
              <Button size="sm" className="h-8" onClick={handleAddTask} disabled={!newTaskTitle.trim()}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <CheckCircle2 className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">No tasks yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group">
                    <button
                      onClick={() => toggleTaskMutation.mutate({ id: task.id, data: { status: task.status === 'done' ? 'pending' : 'done' } })}
                      className="flex-shrink-0"
                    >
                      {task.status === 'done' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                      )}
                    </button>
                    <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                      {task.title}
                    </span>
                    {task.priority === 'high' && <Badge className="text-[9px] bg-red-100 text-red-700">High</Badge>}
                    {task.due_date && <span className="text-[10px] text-slate-400">{format(new Date(task.due_date), 'MMM d')}</span>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* PROPOSALS, INVOICES, TRIPS (same as before) */}
          <TabsContent value="proposals" className="px-6 py-4 space-y-3 flex-1 overflow-y-auto">
            {proposals.length === 0 ? <EmptyState icon={FileText} label="No proposals yet" /> : proposals.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all gap-2">
                <Link to={createPageUrl(`ProposalDetails?id=${p.id}`)} className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 text-sm">{p.title}</div>
                  <div className="text-xs text-slate-500">{p.destination} · {p.created_date ? format(new Date(p.created_date), 'MMM d, yyyy') : ''}</div>
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {p.total_cost > 0 && <span className="text-sm font-bold text-green-700">${p.total_cost.toFixed(0)}</span>}
                  <Badge className={`text-xs ${PROPOSAL_STATUS_COLORS[p.status]}`}>{p.status}</Badge>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                    onClick={() => setComposerState({ open: true, proposal: p, invoice: null })}>
                    <Send className="w-3 h-3" />Send
                  </Button>
                  <Link to={createPageUrl(`ProposalDetails?id=${p.id}`)}><ExternalLink className="w-3 h-3 text-slate-300" /></Link>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="invoices" className="px-6 py-4 space-y-3 flex-1 overflow-y-auto">
            {invoices.length === 0 ? <EmptyState icon={DollarSign} label="No invoices yet" /> : invoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all gap-2">
                <Link to={createPageUrl(`InvoiceDetails?id=${inv.id}`)} className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 text-sm">{inv.invoice_number}</div>
                  <div className="text-xs text-slate-500">Due {inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '—'}</div>
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold text-slate-800">${(inv.total_amount || 0).toFixed(0)}</span>
                  <Badge className={`text-xs ${INVOICE_STATUS_COLORS[inv.status]}`}>{inv.status}</Badge>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                    onClick={() => setComposerState({ open: true, proposal: null, invoice: inv })}>
                    <Send className="w-3 h-3" />Send
                  </Button>
                  <Link to={createPageUrl(`InvoiceDetails?id=${inv.id}`)}><ExternalLink className="w-3 h-3 text-slate-300" /></Link>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="trips" className="px-6 py-4 space-y-3 flex-1 overflow-y-auto">
            {trips.length === 0 ? <EmptyState icon={Plane} label="No trips yet" /> : trips.map(t => (
              <Link key={t.id} to={createPageUrl(`TripDetails?id=${t.id}`)}>
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 hover:border-blue-200 transition-all">
                  <div>
                    <div className="font-medium text-slate-800 text-sm">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.destination} · {t.start_date ? format(new Date(t.start_date), 'MMM d') : ''} – {t.end_date ? format(new Date(t.end_date), 'MMM d, yyyy') : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">{t.status}</Badge>
                    <ExternalLink className="w-3 h-3 text-slate-300" />
                  </div>
                </div>
              </Link>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value, href }) {
  const content = (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
      <div>
        <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{label}</div>
        <div className="text-sm text-slate-800 font-medium">{value || '—'}</div>
      </div>
    </div>
  );
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className="hover:bg-slate-50 rounded-lg p-1 -m-1 transition-colors">{content}</a>;
  return content;
}

function EmptyState({ icon: Icon, label }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <Icon className="w-10 h-10 mb-2 opacity-20" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
