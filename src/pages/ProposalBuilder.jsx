import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Trash2, GripVertical, Search, FileDown, ChevronDown, ChevronRight,
  User, Users, Clock, DollarSign, ArrowLeft, Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';

const UNIT_LABELS = {
  per_person: 'Per Person',
  per_group: 'Per Group',
  per_hour: 'Per Hour',
  per_day: 'Per Day',
  flat_rate: 'Flat Rate'
};

const UNIT_ICONS = {
  per_person: User,
  per_group: Users,
  per_hour: Clock,
  per_day: Clock,
  flat_rate: DollarSign
};

function calcLineTotal(item, markupPct = 0) {
  const price = Math.ceil(((parseFloat(item.unit_price) || 0) * (1 + markupPct / 100)) * 10) / 10;
  const qty = parseFloat(item.quantity) || 1;
  switch (item.price_unit) {
    case 'per_person': return price * qty;
    case 'per_group': return price;
    case 'per_hour': return price * qty;
    case 'per_day': return price * qty;
    case 'flat_rate': return price;
    default: return price * qty;
  }
}

export default function ProposalBuilder() {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [numTravelers, setNumTravelers] = useState(1);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [markupPct, setMarkupPct] = useState(0);
  const [selectedItems, setSelectedItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [expandedCategories, setExpandedCategories] = useState(/** @type {any} */ ({}));
  const [isPreviewing, setIsPreviewing] = useState(false);

  const { data: services = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['serviceTemplates'],
    queryFn: () => db.entities.ServiceTemplate.list()
  }));

  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['serviceCategories'],
    queryFn: () => db.entities.ServiceCategory.list()
  }));

  const { data: appSettings } = /** @type {any} */ (useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => { const all = await db.entities.AppSettings.list(); return all[0] || {}; }
  }));

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || 'Uncategorized';
//   const getCategoryColor = (id) => categories.find(c => c.id === id)?.color || '#6366f1';

  const filteredServices = services.filter(s => {
    const matchSearch = searchTerm === '' ||
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = selectedCategoryFilter === 'all' || s.category_id === selectedCategoryFilter;
    return matchSearch && matchCat && s.is_active !== false;
  });

  const groupedServices = filteredServices.reduce((acc, svc) => {
    const catId = svc.category_id || 'uncategorized';
    if (!acc[catId]) acc[catId] = [];
    acc[catId].push(svc);
    return acc;
  }, {});

  const addService = (service) => {
    const newItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      service_id: service.id,
      name: service.name,
      description: service.description || '',
      unit_price: service.base_price || 0,
      price_unit: service.price_unit || 'per_person',
      quantity: numTravelers,
      currency: service.currency || 'USD',
    };
    setSelectedItems(prev => [...prev, newItem]);
  };

  const removeItem = (id) => setSelectedItems(prev => prev.filter(i => i.id !== id));

  const updateItem = (id, field, value) => {
    setSelectedItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(selectedItems);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setSelectedItems(items);
  };

  const total = selectedItems.reduce((sum, item) => sum + calcLineTotal(item, markupPct), 0);

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handlePrint = () => {
    setIsPreviewing(true);
    setTimeout(() => window.print(), 300);
    window.addEventListener('afterprint', () => setIsPreviewing(false), { once: true });
  };

  const company = appSettings?.invoice_header || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center print:hidden">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl('Proposals')}>
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Proposal Builder</h1>
            <p className="text-slate-500 text-sm">Drag services from the library to build a proposal</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIsPreviewing(!isPreviewing)}>
            <Eye className="w-4 h-4 mr-2" />
            {isPreviewing ? 'Edit' : 'Preview'}
          </Button>
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
            <FileDown className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className={`flex gap-6 ${isPreviewing ? 'flex-col' : ''}`}>
        {/* LEFT: Service Library Panel */}
        {!isPreviewing && (
          <div className="w-80 flex-shrink-0 space-y-3 print:hidden">
            <Card className="p-4 bg-white shadow-sm sticky top-20">
              <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                Service Library
              </h2>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search services..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>

              <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                <SelectTrigger className="text-sm mb-3">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {Object.keys(groupedServices).length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">No services found</p>
                )}
                {Object.entries(groupedServices).map(([catId, svcs]) => {
//                   const catColor = getCategoryColor(catId);
                  const catName = getCategoryName(catId);
                  const isOpen = expandedCategories[catId] !== false;
                  return (
                    <div key={catId}>
                      <button
                        onClick={() => toggleCategory(catId)}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{catName}</span>
                        {isOpen ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                      </button>
                      {isOpen && (
                        <div className="space-y-1 ml-1">
                          {svcs.map(svc => (
                            <div
                              key={svc.id}
                              className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all cursor-pointer group"
                              onClick={() => addService(svc)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-800 truncate">{svc.name}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                  <span className="font-semibold text-green-700">${svc.base_price?.toFixed(2)}</span>
                                  <span>· {UNIT_LABELS[svc.price_unit] || svc.price_unit}</span>
                                </div>
                              </div>
                              <Button size="icon" variant="ghost" className="w-6 h-6 opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2">
                                <Plus className="w-3 h-3 text-blue-600" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* RIGHT: Proposal Document */}
        <div className="flex-1 min-w-0">
          <Card className="bg-white shadow-sm p-8 print:shadow-none print:border-0 print:p-0">

            {/* Company Header (print) */}
            {(company.company_name || company.logo_url) && (
              <div className="flex justify-between items-start mb-6 pb-6 border-b print:flex">
                <div className="flex items-center gap-4">
                  {company.logo_url && <img src={company.logo_url} alt="Logo" className="h-14 object-contain" />}
                  <div>
                    {company.company_name && <div className="font-bold text-xl text-slate-900">{company.company_name}</div>}
                    {company.address_line1 && <div className="text-sm text-slate-600">{company.address_line1}</div>}
                    {company.email && <div className="text-sm text-slate-600">{company.email}</div>}
                    {company.phone && <div className="text-sm text-slate-600">{company.phone}</div>}
                  </div>
                </div>
                <div className="text-right text-sm text-slate-500">
                  <div>Date: {format(new Date(), 'MMM d, yyyy')}</div>
                </div>
              </div>
            )}

            {/* Proposal Title */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-slate-900 mb-1">Travel Proposal</h1>
              <div className="h-1 w-16 bg-blue-600 rounded-full" />
            </div>

            {/* Client & Trip Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Client Information</h2>
                {isPreviewing ? (
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900 text-lg">{clientName || 'Client Name'}</div>
                    {clientEmail && <div className="text-slate-600 text-sm">{clientEmail}</div>}
                  </div>
                ) : (
                  <div className="space-y-2 print:hidden">
                    <Input placeholder="Client Name *" value={clientName} onChange={e => setClientName(e.target.value)} />
                    <Input placeholder="Client Email" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Trip Details</h2>
                {isPreviewing ? (
                  <div className="space-y-1 text-sm">
                    {destination && <div><span className="font-medium">Destination:</span> {destination}</div>}
                    {startDate && endDate && <div><span className="font-medium">Dates:</span> {format(new Date(startDate), 'MMM d')} – {format(new Date(endDate), 'MMM d, yyyy')}</div>}
                    <div><span className="font-medium">Travelers:</span> {numTravelers}</div>
                  </div>
                ) : (
                  <div className="space-y-2 print:hidden">
                    <Input placeholder="Destination" value={destination} onChange={e => setDestination(e.target.value)} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                      <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-slate-500 whitespace-nowrap">Travelers:</Label>
                      <Input
                        type="number" min={1} value={numTravelers}
                        onChange={e => setNumTravelers(parseInt(e.target.value) || 1)}
                        className="w-24"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator className="mb-8" />

            {/* Services Section */}
            <div className="mb-8">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Included Services</h2>

              {selectedItems.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center print:hidden">
                  <div className="text-slate-400 text-sm">
                    {isPreviewing
                      ? 'No services added yet.'
                      : 'Click on services in the library panel to add them here, then drag to reorder.'}
                  </div>
                </div>
              ) : (
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="proposal-items">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                        {/* Table header */}
                        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 print:grid">
                          <div className="col-span-5">Service</div>
                          <div className="col-span-2 text-center">Unit</div>
                          <div className="col-span-2 text-center">Qty</div>
                          <div className="col-span-2 text-right">Unit Price</div>
                          <div className="col-span-1 text-right">Total</div>
                        </div>
                        <Separator />

                        {selectedItems.map((item, index) => {
                          const lineTotal = calcLineTotal(item, markupPct);
                          const UnitIcon = UNIT_ICONS[item.price_unit] || DollarSign;
                          return (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(provided, snapshot) => {
                                const p = /** @type {any} */ (provided);
                                return (
                                <div
                                  ref={p.innerRef}
                                  {...p.draggableProps}
                                  className={`grid grid-cols-12 gap-2 items-start p-3 rounded-xl border transition-all ${
                                    snapshot.isDragging ? 'shadow-lg border-blue-300 bg-blue-50' : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'
                                  } print:grid print:border-slate-200 print:bg-white`}
                                >
                                  {/* Drag handle */}
                                  <div className="col-span-5 flex items-start gap-2">
                                    <div {...p.dragHandleProps} className="mt-1 print:hidden cursor-grab">
                                      <GripVertical className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      {isPreviewing ? (
                                        <>
                                          <div className="font-semibold text-slate-800 text-sm">{item.name}</div>
                                          {item.description && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</div>}
                                        </>
                                      ) : (
                                        <>
                                          <Input
                                            value={item.name}
                                            onChange={e => updateItem(item.id, 'name', e.target.value)}
                                            className="font-semibold text-sm h-7 px-2 print:border-0 print:font-semibold"
                                          />
                                          <Textarea
                                            value={item.description}
                                            onChange={e => updateItem(item.id, 'description', e.target.value)}
                                            placeholder="Description (optional)"
                                            className="text-xs mt-1 min-h-[36px] resize-none px-2 py-1 print:hidden"
                                            rows={1}
                                          />
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <div className="col-span-2 flex items-center justify-center">
                                    {isPreviewing ? (
                                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                                        <UnitIcon className="w-3 h-3" />
                                        {UNIT_LABELS[item.price_unit] || item.price_unit}
                                      </Badge>
                                    ) : (
                                      <Select value={item.price_unit} onValueChange={v => updateItem(item.id, 'price_unit', v)}>
                                        <SelectTrigger className="h-7 text-xs px-2">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {Object.entries(UNIT_LABELS).map(([k, v]) => (
                                            <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>

                                  <div className="col-span-2 flex items-center justify-center">
                                    {isPreviewing ? (
                                      <span className="text-sm text-slate-700">{['per_group', 'flat_rate'].includes(item.price_unit) ? '—' : item.quantity}</span>
                                    ) : (
                                      <Input
                                        type="number" min={1}
                                        value={item.quantity}
                                        onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 1)}
                                        className="h-7 text-xs text-center px-1"
                                        disabled={['per_group', 'flat_rate'].includes(item.price_unit)}
                                      />
                                    )}
                                  </div>

                                  <div className="col-span-2 flex items-center justify-end">
                                    {isPreviewing ? (
                                      <span className="text-sm text-slate-700">${parseFloat(item.unit_price).toFixed(2)}</span>
                                    ) : (
                                      <Input
                                        type="number" step="0.01" min={0}
                                        value={item.unit_price}
                                        onChange={e => updateItem(item.id, 'unit_price', e.target.value)}
                                        className="h-7 text-xs text-right px-2"
                                      />
                                    )}
                                  </div>

                                  <div className="col-span-1 flex items-center justify-end gap-1">
                                    <span className="font-bold text-green-700 text-sm">${lineTotal.toFixed(2)}</span>
                                    {!isPreviewing && (
                                      <Button
                                        variant="ghost" size="icon"
                                        className="w-6 h-6 text-red-400 hover:text-red-600 hover:bg-red-50 print:hidden"
                                        onClick={() => removeItem(item.id)}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            }}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>

            {/* Totals */}
            {selectedItems.length > 0 && (
              <div className="flex justify-end mb-8">
                <div className="w-72 space-y-2">
                  <div className="flex justify-between items-center text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <span>Markup</span>
                      {!isPreviewing && (
                        <Input
                          type="number" min={0} max={100} step={0.5}
                          value={markupPct}
                          onChange={e => setMarkupPct(parseFloat(e.target.value) || 0)}
                          className="w-16 h-6 text-xs text-center px-1 print:hidden"
                        />
                      )}
                      <span>%</span>
                    </div>
                    <span className="text-xs text-slate-400">Applied to each line</span>
                  </div>

                  <Separator />
                  <div className="flex justify-between text-lg font-bold text-slate-900">
                    <span>Total</span>
                    <span className="text-green-700">${total.toFixed(2)}</span>
                  </div>
                  {numTravelers > 1 && (
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Per person ({numTravelers} travelers)</span>
                      <span>${(total / numTravelers).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes & Terms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-200">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Notes</h3>
                {isPreviewing ? (
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{notes || '—'}</p>
                ) : (
                  <Textarea
                    placeholder="Additional notes, inclusions, special requests..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={4}
                    className="text-sm print:hidden"
                  />
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Terms & Conditions</h3>
                {isPreviewing ? (
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{terms || '—'}</p>
                ) : (
                  <Textarea
                    placeholder="Payment terms, cancellation policy..."
                    value={terms}
                    onChange={e => setTerms(e.target.value)}
                    rows={4}
                    className="text-sm print:hidden"
                  />
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
              {company.company_name && <span>{company.company_name} · </span>}
              {company.email && <span>{company.email} · </span>}
              {company.phone && <span>{company.phone}</span>}
            </div>
          </Card>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:shadow-none, .print\\:shadow-none * { visibility: visible; }
          .print\\:shadow-none { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}