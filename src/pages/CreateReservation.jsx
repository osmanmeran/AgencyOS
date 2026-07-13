import { db } from '@/lib/DbContext';
import { getCurrencySymbol } from '@/lib/formatters';
import { DEFAULT_CURRENCIES } from '@/lib/currencies';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SkeletonCard } from '@/components/ui/skeletons';
import {
  ArrowLeft,
  Plus,
  Trash2,
  TrendingUp,
  RefreshCw,
  ArrowRightLeft,
  BookOpen,
  Users,
  Star,
  Hash,
  Building,
  User,
  Coffee,
  Plane,
  Map,
  Zap,
  Loader2,
  Check,
  Search,
  ClipboardCheck,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { showSuccess, showError } from '@/lib/toast';
import { generateReferenceNumber } from '@/lib/referenceNumber';
import { createPageUrl } from '../utils';
import ServiceLibraryPanel from '../components/proposals/ServiceLibraryPanel';
import ServiceLineEditor from '../components/services/ServiceLineEditor';
import PassengerFieldsRow from '../components/passengers/PassengerFieldsRow';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { applyMarkup } from '@/lib/pricing';
import { categoryIdsBySupplier, getSupplierCategoryIds, createSupplierWithCategory } from '@/lib/supplierCategories';

const CURRENCIES = DEFAULT_CURRENCIES;
const currSymbol = (cur) => getCurrencySymbol(cur);

const newPassenger = () => ({
  id: `pax-${Date.now()}-${Math.random()}`,
  name: '',
  is_contact: false,
  client_id: '',
  age_category: 'adult',
  phone: '',
  email: '',
  date_of_birth: '',
  numero_pratica: '',
});

const newRoom = () => ({
  id: `room-${Date.now()}-${Math.random()}`,
  type: 'double',
  passengers: [newPassenger(), newPassenger()],
});

const autoGenerateRooms = (count) => {
  if (count <= 0) return [newRoom()];
  const rooms = [];
  let remaining = count;
  while (remaining > 0) {
    let type = 'single';
    if (remaining >= 2) {
      type = 'double';
      remaining -= 2;
    } else {
      type = 'single';
      remaining -= 1;
    }
    const passengers = Array.from({ length: type === 'double' ? 2 : 1 }, () => newPassenger());
    rooms.push({ id: `room-${Date.now()}-${Math.random()}-${rooms.length}`, type, passengers });
  }
  return rooms;
};

const emptyService = () => ({
  _key: `svc-${Date.now()}-${Math.random()}`,
  supplier_id: '',
  name: '',
  description: '',
  category: '',
  location: '',
  acquiring_price: '',
  selling_price: '',
  quantity: 1,
  unit: 'per_person',
  supplier_currency: 'USD',
  client_currency: 'USD',
});

const sortByDate = (a, b) => {
  const aStart = a.start_date || '';
  const bStart = b.start_date || '';
  if (aStart < bStart) return -1;
  if (aStart > bStart) return 1;
  const aEnd = a.end_date || '';
  const bEnd = b.end_date || '';
  if (aEnd < bEnd) return -1;
  if (aEnd > bEnd) return 1;
  return (a.name || '').localeCompare(b.name || '');
};

const SERVICE_TYPES = [
  { key: 'lodging', label: 'Lodging' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'guides', label: 'Guides' },
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'transportation', label: 'Transportation' },
  { key: 'guided_tours', label: 'Guided Tours' },
  { key: 'extra_activities', label: 'Extra Activities' },
];

const SERVICE_TYPE_ICONS = {
  lodging: Building,
  transfers: ArrowRightLeft,
  guides: User,
  restaurants: Coffee,
  transportation: Plane,
  guided_tours: Map,
  extra_activities: Zap,
};

export default function CreateReservation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const isEditing = !!editId;
  const fromQuoteId = searchParams.get('fromQuote');
  const isFromQuote = !!fromQuoteId && !isEditing;
  const fromProposalId = searchParams.get('fromProposal');
  const isFromProposal = !!fromProposalId && !isEditing && !isFromQuote;
  const prefillAppliedRef = useRef(false);

  const [formData, setFormData] = useState({
    name: '',
    destination: '',
    start_date: '',
    end_date: '',
    department: '',
    client_id: '',
    client_name: '',
    client_email: '',
    notes: '',
    terms_and_conditions:
      'Payment terms: 50% deposit required upon booking confirmation, balance due 30 days prior to departure.\nCancellation policy: Cancellations made more than 60 days before departure receive 80% refund, 30-60 days receive 50% refund, less than 30 days no refund.',
    image_url: '',
    internal_notes: '',
  });
  const [serviceTypes, setServiceTypes] = useState([]);
  const [passengerCount, setPassengerCount] = useState(2);
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [rooms, setRooms] = useState(() => [newRoom()]);
  const [services, setServices] = useState([emptyService()]);
  const [markupPct, setMarkupPct] = useState(0);
  const [acquiringCurrency, setAcquiringCurrency] = useState('USD');
  const [sellingCurrency, setSellingCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [loadingRate, setLoadingRate] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const [_addProviderForIndex, setAddProviderForIndex] = useState(null);
  const [newProvider, setNewProvider] = useState({ name: '', email: '', phone: '', city: '' });

  const { data: settings } = /** @type {any} */ (
    useQuery({
      queryKey: ['appSettings'],
      queryFn: async () => {
        const all = await db.entities.AppSettings.list();
        return all[0] || { departments: [] };
      },
    })
  );
  const { refetch: refetchSuppliers } = /** @type {any} */ (
    useQuery({
      queryKey: ['suppliers'],
      queryFn: () => db.entities.Supplier.list(),
    })
  );
  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierCategories'],
      queryFn: () => db.entities.SupplierCategory.list(),
    })
  );
  const { data: allSupplierSubcategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['allSupplierSubcategories'],
      queryFn: () => db.entities.SupplierSubcategory.list(),
    })
  );
  const supplierCategoryMap = categoryIdsBySupplier(allSupplierSubcategories);
  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clients'],
      queryFn: () => db.entities.Client.list(),
    })
  );
  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q),
    );
  }, [clients, clientSearch]);
  const { data: currentUser } = /** @type {any} */ (useQuery({ queryKey: ['me'], queryFn: () => db.auth.me() }));

  useEffect(() => {
    // Skip prefill flows: their source record decides the currencies, and this
    // effect could fire after the prefill and clobber them.
    if (currentUser?.default_currency && !isEditing && !isFromQuote && !isFromProposal) {
      setAcquiringCurrency(currentUser.default_currency);
      setSellingCurrency(currentUser.default_currency);
    }
  }, [currentUser, isEditing, isFromQuote, isFromProposal]);

  const { data: editTrip, isLoading: editingLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['trip', editId],
      queryFn: () => db.entities.Trip.get(editId),
      enabled: isEditing,
    })
  );

  const { data: sourceQuote, isLoading: quoteLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['quoteRequest', fromQuoteId],
      queryFn: () => db.entities.QuoteRequest.get(fromQuoteId),
      enabled: isFromQuote,
    })
  );

  const { data: sourceProposal, isLoading: proposalLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['proposal', fromProposalId],
      queryFn: () => db.entities.Proposal.get(fromProposalId),
      enabled: isFromProposal,
    })
  );

  const { data: quotePricingLookup } = /** @type {any} */ (
    useQuery({
      queryKey: ['quotePricingLookup', fromQuoteId],
      queryFn: async () => {
        const pricingIds = [...new Set((sourceQuote.items || []).map((i) => i.pricing_id).filter(Boolean))];
        const supplierIds = [...new Set((sourceQuote.items || []).map((i) => i.supplier_id).filter(Boolean))];
        const [pricingRows, supplierRows] = await Promise.all([
          Promise.all(pricingIds.map((id) => db.entities.SupplierPricing.get(id).catch(() => null))),
          Promise.all(supplierIds.map((id) => db.entities.Supplier.get(id).catch(() => null))),
        ]);
        const pricingById = Object.fromEntries(pricingRows.filter(Boolean).map((p) => [p.id, p]));
        const supplierById = Object.fromEntries(supplierRows.filter(Boolean).map((s) => [s.id, s]));
        return { pricingById, supplierById };
      },
      enabled: isFromQuote && !!sourceQuote,
    })
  );

  // Prefill the blank form from a QuoteRequest's structured data (passengers,
  // items) once its supporting lookups (SupplierPricing/Supplier, for cost
  // fields never exposed to the client) have loaded. Guarded to run once so
  // later edits aren't clobbered by query refetches.
  useEffect(() => {
    if (!isFromQuote || isEditing || prefillAppliedRef.current) return;
    if (!sourceQuote || !quotePricingLookup) return;
    prefillAppliedRef.current = true;

    const { pricingById, supplierById } = quotePricingLookup;
    const quoteCurrency = sourceQuote.currency || 'USD';
    let missingPricing = false;

    const prefilledServices = (sourceQuote.items || []).map((item) => {
      const pricing = pricingById[item.pricing_id];
      const supplier = supplierById[item.supplier_id];
      if (!pricing) missingPricing = true;
      const categoryName = supplier
        ? categories.find((c) => c.id === getSupplierCategoryIds(supplierCategoryMap, supplier.id)?.[0])?.name || ''
        : '';
      const location = supplier ? supplier.city || supplier.area || '' : '';
      return {
        _key: `svc-${Date.now()}-${Math.random()}`,
        supplier_id: item.supplier_id || '',
        name: item.service_name || '',
        description: '',
        category: categoryName,
        location,
        start_date: item.start_date || '',
        end_date: item.end_date || '',
        unit: item.unit || 'per_person',
        quantity: item.quantity || 1,
        room_type: item.room_type || '',
        pickup_location: item.pickup_location || '',
        dropoff_location: item.dropoff_location || '',
        flight_number: item.flight_number || '',
        acquiring_price: pricing ? parseFloat(pricing.base_price) || 0 : 0,
        supplier_currency: pricing?.currency || quoteCurrency,
        base_selling_price: item.unit_price || 0,
        selling_price: item.unit_price || 0,
        client_currency: quoteCurrency,
        pricing_id: item.pricing_id || '',
      };
    });

    if (missingPricing) {
      showError(
        'Some pricing data could not be found',
        'Fill in the affected service costs manually before creating the reservation.',
      );
    }

    const client = clients.find((c) => c.id === sourceQuote.client_id);
    setFormData((prev) => ({
      ...prev,
      name: sourceQuote.title || prev.name,
      destination: sourceQuote.destination || prev.destination,
      start_date: sourceQuote.start_date || prev.start_date,
      end_date: sourceQuote.end_date || prev.end_date,
      client_id: sourceQuote.client_id || prev.client_id,
      client_name: sourceQuote.client_name || client?.name || prev.client_name,
      client_email: client?.email || prev.client_email,
      notes: sourceQuote.notes || prev.notes,
    }));
    setRooms(passengersToRooms(sourceQuote.passengers || []));
    setPassengerCount(sourceQuote.passengers?.length || 2);
    setServices(prefilledServices.length > 0 ? prefilledServices : [emptyService()]);
    setMarkupPct(0);
    setAcquiringCurrency(quoteCurrency);
    setSellingCurrency(quoteCurrency);
    setExchangeRate(1);
  }, [isFromQuote, isEditing, sourceQuote, quotePricingLookup, categories, clients]);

  // Prefill the blank form from an approved Proposal. Proposal services store
  // the marked-up unit price in `cost` and the pre-markup price in
  // `base_selling_price`, so carrying base prices + markup_percentage over
  // reproduces the proposal totals. Guarded to run once so later edits aren't
  // clobbered by query refetches.
  useEffect(() => {
    if (!isFromProposal || isEditing || prefillAppliedRef.current) return;
    if (!sourceProposal) return;
    prefillAppliedRef.current = true;

    const prefilledServices = (sourceProposal.services || []).map((s) => {
      const basePrice = parseFloat(s.base_selling_price ?? s.cost) || 0;
      return {
        ...emptyService(),
        _key: `svc-${Date.now()}-${Math.random()}`,
        supplier_id: s.supplier_id || '',
        name: s.name || '',
        description: s.description || '',
        location: s.location || '',
        quantity: s.quantity || 1,
        acquiring_price: s.acquiring_price || 0,
        base_selling_price: basePrice,
        selling_price: basePrice,
        supplier_currency: s.supplier_currency || 'USD',
        client_currency: s.client_currency || 'USD',
        pricing_id: s.pricing_id || '',
      };
    });

    const client = clients.find((c) => c.id === sourceProposal.client_id);
    setFormData((prev) => ({
      ...prev,
      name: sourceProposal.title || prev.name,
      destination: sourceProposal.destination || prev.destination,
      start_date: sourceProposal.start_date || prev.start_date,
      end_date: sourceProposal.end_date || prev.end_date,
      client_id: sourceProposal.client_id || prev.client_id,
      client_name: sourceProposal.client_name || client?.name || prev.client_name,
      client_email: sourceProposal.client_email || client?.email || prev.client_email,
      notes: sourceProposal.notes || prev.notes,
      terms_and_conditions: sourceProposal.terms_and_conditions || prev.terms_and_conditions,
    }));
    const paxCount = sourceProposal.num_travelers || 2;
    setPassengerCount(paxCount);
    setRooms(autoGenerateRooms(paxCount));
    setServices(prefilledServices.length > 0 ? prefilledServices : [emptyService()]);
    setMarkupPct(sourceProposal.markup_percentage || 0);
    setAcquiringCurrency(prefilledServices[0]?.supplier_currency || 'USD');
    setSellingCurrency(prefilledServices[0]?.client_currency || 'USD');
    setExchangeRate(1);
  }, [isFromProposal, isEditing, sourceProposal, clients]);

  const isDirty = useDirtyState(
    {
      formData,
      serviceTypes,
      passengerCount,
      rooms,
      services,
      markupPct,
      acquiringCurrency,
      sellingCurrency,
      exchangeRate,
    },
    editTrip?.id,
  );
  useUnsavedChangesGuard(isDirty);

  const departments = settings?.departments || [];

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.Trip.create(data),
      onSuccess: (/** @type {any} */ created) => {
        showSuccess('Reservation created');
        queryClient.invalidateQueries({ queryKey: ['trips'] });
        if (isFromQuote) {
          db.entities.QuoteRequest.update(fromQuoteId, { converted_trip_id: created.id })
            .then(() => queryClient.invalidateQueries({ queryKey: ['allQuoteRequests'] }))
            .catch((err) => showError('Reservation created, but failed to link the quote request', err.message));
        }
        if (isFromProposal) {
          db.entities.Proposal.update(fromProposalId, { trip_id: created.id })
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ['proposals'] });
              queryClient.invalidateQueries({ queryKey: ['proposal', fromProposalId] });
            })
            .catch((err) => showError('Reservation created, but failed to link the proposal', err.message));
        }
        navigate(createPageUrl(`ReservationDetails?id=${created.id}`));
      },
      onError: (error) => showError('Failed to create reservation', error.message),
    })
  );

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.Trip.update(editId, data),
      onSuccess: () => {
        showSuccess('Reservation updated');
        queryClient.invalidateQueries({ queryKey: ['trips'] });
        queryClient.invalidateQueries({ queryKey: ['trip', editId] });
        navigate(createPageUrl(`ReservationDetails?id=${editId}`));
      },
      onError: (error) => showError('Failed to update reservation', error.message),
    })
  );

  const createSupplierMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) =>
        createSupplierWithCategory(db, data, categories[0]?.id, categories[0]?.name),
      onSuccess: async (_created) => {
        showSuccess('Supplier created');
        await refetchSuppliers();
        queryClient.invalidateQueries({ queryKey: ['allSupplierSubcategories'] });
        setAddProviderOpen(false);
        setNewProvider({ name: '', email: '', phone: '', city: '' });
        setAddProviderForIndex(null);
      },
      onError: (error) => showError('Failed to create supplier', error.message),
    })
  );

  // Exchange rate
  const fetchExchangeRate = async () => {
    if (acquiringCurrency === sellingCurrency) {
      setExchangeRate(1);
      return;
    }
    setLoadingRate(true);
    try {
      const res = await db.integrations.Core.GetExchangeRate(acquiringCurrency, sellingCurrency);
      setExchangeRate(res.rate || 1);
    } catch {
      setExchangeRate(1);
    }
    setLoadingRate(false);
  };

  // Services
  const addService = () => setServices((prev) => [...prev, emptyService()].sort(sortByDate));
  const addServiceFromLibrary = useCallback(
    (serviceData) => {
      const sellPrice = serviceData.selling_price ?? serviceData.acquiring_price ?? 0;
      const convertedSelling = acquiringCurrency !== sellingCurrency ? sellPrice * exchangeRate : sellPrice;
      const namedPax = rooms.reduce((sum, r) => sum + r.passengers.filter((p) => p.name.trim()).length, 0);
      setServices((prev) =>
        [
          ...prev,
          {
            ...emptyService(),
            ...serviceData,
            selling_price: parseFloat(convertedSelling.toFixed(2)),
            quantity: namedPax || 1,
          },
        ].sort(sortByDate),
      );
    },
    [acquiringCurrency, sellingCurrency, exchangeRate, rooms],
  );

  const removeService = (key) => setServices((prev) => prev.filter((s) => s._key !== key));
  const duplicateService = (key) => {
    setServices((prev) => {
      const idx = prev.findIndex((s) => s._key === key);
      if (idx === -1) return prev;
      const original = prev[idx];
      const copy = { ...JSON.parse(JSON.stringify(original)), _key: `svc-${Date.now()}-${Math.random()}` };
      const result = [...prev];
      result.splice(idx + 1, 0, copy);
      return result.sort(sortByDate);
    });
  };
  //   const acqToSell = (price) => { const p = parseFloat(price) || 0; return acquiringCurrency === sellingCurrency ? p : p * exchangeRate; };

  const passengersToRooms = (passengers) => {
    if (!passengers?.length) return [newRoom()];
    const roomMap = {};
    const roomOrder = [];
    for (const p of passengers) {
      const rid = p.room_id || `r-${Math.random()}`;
      if (!roomMap[rid]) {
        roomMap[rid] = { id: rid, type: p.room_type || 'double', passengers: [] };
        roomOrder.push(rid);
      }
      roomMap[rid].passengers.push({ ...p });
    }
    return roomOrder.map((rid) => roomMap[rid]);
  };

  useEffect(() => {
    if (!editTrip) return;
    setFormData({
      name: editTrip.name || '',
      destination: editTrip.destination || '',
      start_date: editTrip.start_date || '',
      end_date: editTrip.end_date || '',
      department: editTrip.department || '',
      client_id: editTrip.client_id || '',
      client_name: editTrip.client_name || '',
      client_email: editTrip.client_email || '',
      notes: editTrip.notes || '',
      terms_and_conditions: editTrip.terms_and_conditions || '',
      image_url: editTrip.image_url || '',
      internal_notes: editTrip.internal_notes || '',
    });
    setServiceTypes(editTrip.service_types || []);
    const loadedPax = editTrip.passengers?.length || 2;
    setPassengerCount(loadedPax);
    setRooms(passengersToRooms(editTrip.passengers || []));
    const loadedServices = editTrip.services || [];
    setServices(
      loadedServices.length > 0
        ? loadedServices.map((s) => ({ ...s, _key: s._key || `svc-${Date.now()}-${Math.random()}` })).sort(sortByDate)
        : [emptyService()],
    );
    setAcquiringCurrency(editTrip.acquiring_currency || 'USD');
    setSellingCurrency(editTrip.selling_currency || 'USD');
    setExchangeRate(editTrip.exchange_rate || 1);
    setMarkupPct(editTrip.markup_percentage || 0);
  }, [editTrip]);

  // Totals — match ServiceLineEditor's calcQuantity logic
  const serviceQty = (s) => {
    const qty = s.quantity || 1;
    if (s.unit === 'per_night' || s.unit === 'per_day') {
      if (s.start_date && s.end_date) {
        const days = Math.max(1, Math.round((+new Date(s.end_date) - +new Date(s.start_date)) / 86400000));
        return qty * days;
      }
      return qty;
    }
    return qty;
  };
  const withMarkup = (price) => applyMarkup(price, markupPct);

  // Per-currency totals
  const acquiringByCurrency = services.reduce((acc, s) => {
    const cur = s.supplier_currency || 'USD';
    acc[cur] = (acc[cur] || 0) + (parseFloat(s.acquiring_price) || 0) * serviceQty(s);
    return acc;
  }, {});
  const sellingByCurrency = services.reduce((acc, s) => {
    const cur = s.client_currency || 'USD';
    const basePrice = parseFloat(s.base_selling_price ?? s.selling_price) || 0;
    acc[cur] = (acc[cur] || 0) + withMarkup(basePrice) * serviceQty(s);
    return acc;
  }, {});
  const totalSellingAll = Object.values(sellingByCurrency).reduce((s, v) => s + v, 0);
  const finalTotal = totalSellingAll;
  const totalAcquiringAll = Object.values(acquiringByCurrency).reduce((s, v) => s + v, 0);
  const margin = totalSellingAll > 0 ? ((totalSellingAll - totalAcquiringAll) / totalSellingAll) * 100 : 0;
  const currenciesMixed = Object.keys(sellingByCurrency).length > 1 || Object.keys(acquiringByCurrency).length > 1;

  // Rooms / Passengers
  const addRoom = () => {
    setRooms((prev) => {
      const cap = 2;
      const passengers = Array.from({ length: cap }, () => newPassenger());
      return [...prev, { id: `room-${Date.now()}-${Math.random()}`, type: 'double', passengers }];
    });
  };
  const removeRoom = (roomId) => {
    setRooms((prev) => {
      const updated = prev.filter((r) => r.id !== roomId);
      if (updated.length === 0) {
        const cap = 2;
        const passengers = Array.from({ length: cap }, () => newPassenger());
        return [{ id: `room-${Date.now()}-${Math.random()}`, type: 'double', passengers }];
      }
      return updated;
    });
  };
  const setRoomOccupancy = (roomId, count) => {
    const typeMap = { 1: 'single', 2: 'double', 3: 'triple', 4: 'quad' };
    const type = typeMap[count] || 'double';
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId) return r;
        const current = r.passengers;
        let passengers;
        if (count > current.length) {
          passengers = [...current, ...Array.from({ length: count - current.length }, () => newPassenger())];
        } else if (count < current.length) {
          const kept = current.slice(0, count);
          if (current.find((p) => p.is_contact) && !kept.find((p) => p.is_contact))
            kept[kept.length - 1].is_contact = true;
          passengers = kept;
        } else {
          passengers = current;
        }
        return { ...r, type, passengers };
      }),
    );
  };
  const updatePassenger = (roomId, paxId, updated) =>
    setRooms((prev) =>
      prev.map((r) => ({
        ...r,
        passengers: r.passengers.map((p) => (p.id === paxId ? updated : p)),
      })),
    );
  const setContactInRoom = (roomId, paxId) =>
    setRooms((prev) =>
      prev.map((r) => ({
        ...r,
        passengers: r.passengers.map((p) => ({ ...p, is_contact: p.id === paxId })),
      })),
    );

  const allPassengers = rooms.flatMap((r) =>
    r.passengers.map((p) => ({
      ...p,
      room_id: r.id,
      room_type: r.type,
    })),
  );
  const derivedPax = rooms.reduce((sum, r) => sum + r.passengers.length, 0);
  const slotsValid = derivedPax === passengerCount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const selectedClient = clients.find((c) => c.id === formData.client_id);
    const cleanServices = services.map((s) => ({
      _key: s._key,
      supplier_id: s.supplier_id,
      name: s.name,
      description: s.description,
      category: s.category,
      location: s.location,
      start_date: s.start_date,
      end_date: s.end_date,
      unit: s.unit,
      quantity: s.quantity || 1,
      acquiring_price: parseFloat(s.acquiring_price) || 0,
      base_selling_price: parseFloat(s.base_selling_price ?? s.selling_price) || 0,
      selling_price: withMarkup(parseFloat(s.base_selling_price ?? s.selling_price) || 0),
      supplier_currency: s.supplier_currency || 'USD',
      client_currency: s.client_currency || 'USD',
      hotel_treatment: s.hotel_treatment,
      room_type: s.room_type,
      room_occupancy: s.room_occupancy,
      pickup_location: s.pickup_location,
      dropoff_location: s.dropoff_location,
      departure_airport: s.departure_airport,
      arrival_airport: s.arrival_airport,
      flight_number: s.flight_number,
      transfer_type: s.transfer_type,
      service_date: s.service_date,
      departure_time: s.departure_time,
      pickup_time: s.pickup_time,
      transfer_flight_number: s.transfer_flight_number,
      return_leg: s.return_leg?.enabled ? s.return_leg : undefined,
      pricing_id: s.pricing_id,
      subcategory_id: s.subcategory_id,
      car_capacity: s.car_capacity,
      booking_source: s.booking_source || 'direct',
      show_in_itinerary: s.show_in_itinerary,
    }));
    const baseData = {
      ...formData,
      client_name: selectedClient?.name || formData.client_name,
      client_email: selectedClient?.email || formData.client_email,
      service_types: serviceTypes,
      passengers: allPassengers,
      services: cleanServices,
      acquiring_currency: acquiringCurrency,
      selling_currency: sellingCurrency,
      exchange_rate: exchangeRate,
      markup_percentage: markupPct,
      total_cost: finalTotal,
    };

    if (isEditing) {
      updateMutation.mutate({
        ...editTrip,
        ...baseData,
        change_history: [
          ...(editTrip.change_history || []),
          {
            date: new Date().toISOString(),
            changed_by: currentUser?.email || 'unknown',
            changed_by_name: currentUser?.name || currentUser?.email || 'Unknown',
            action: 'updated',
            description: 'Reservation updated',
          },
        ],
      });
    } else {
      const referenceNumber = await generateReferenceNumber(formData.department, settings);
      createMutation.mutate({
        ...baseData,
        reference_number: referenceNumber,
        proposal_status: 'pending',
        status: 'planning',
        quote_request_id: isFromQuote ? fromQuoteId : undefined,
        proposal_id: isFromProposal ? fromProposalId : undefined,
        created_by: currentUser?.email || 'unknown',
        created_by_name: currentUser?.name || currentUser?.email || 'Unknown',
        created_by_phone: currentUser?.phone || '',
        created_date: new Date().toISOString(),
        change_history: [
          {
            date: new Date().toISOString(),
            changed_by: currentUser?.email || 'unknown',
            changed_by_name: currentUser?.name || currentUser?.email || 'Unknown',
            action: 'created',
            description: 'Reservation created',
          },
        ],
      });
    }
  };

  const previewRef = isEditing
    ? editTrip?.reference_number || '—'
    : formData.department
      ? `${settings?.reference_format?.prefix || 'TRP'}-${formData.department.slice(0, 3).toUpperCase()}-YYMM-XXXX`
      : `${settings?.reference_format?.prefix || 'TRP'}-GEN-YYMM-XXXX`;

  if (isEditing && editingLoading) return <SkeletonCard />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Link to={createPageUrl('Reservations')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Reservations
        </Button>
      </Link>

      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{isEditing ? 'Edit Reservation' : 'New Reservation'}</h1>
          <p className="text-muted-foreground mt-1">
            {isEditing
              ? 'Update reservation details, services, and pricing'
              : 'Fill in details, add services, then send to client or confirm directly'}
          </p>
        </div>
        <Button
          type="button"
          variant={showLibrary ? 'default' : 'outline'}
          onClick={() => setShowLibrary((v) => !v)}
          className={showLibrary ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          <BookOpen className="w-4 h-4 mr-2" />
          {showLibrary ? 'Hide Library' : 'Service Library'}
        </Button>
      </div>

      <div className="flex gap-6">
        {showLibrary && (
          <div className="w-72 flex-shrink-0">
            <ServiceLibraryPanel
              numTravelers={passengerCount}
              acquiringCurrency={acquiringCurrency}
              _sellingCurrency={sellingCurrency}
              onAddService={addServiceFromLibrary}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Reference preview */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg flex items-center gap-2">
              <Hash className="w-4 h-4 text-blue-600 dark:text-blue-300" />
              <span className="text-sm text-blue-700 dark:text-blue-300">Reference:</span>
              <span className="font-mono font-semibold text-blue-900 dark:text-blue-300">{previewRef}</span>
              <span className="text-xs text-blue-500 dark:text-blue-300 ml-auto">
                {isEditing ? '(existing reference)' : '(auto-generated on save)'}
              </span>
            </div>

            {isFromQuote && sourceQuote && (
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-purple-600 dark:text-purple-300 flex-shrink-0" />
                <span className="text-sm text-purple-800 dark:text-purple-300">
                  Prefilled from Quote Request <strong>&ldquo;{sourceQuote.title}&rdquo;</strong> — review services and
                  passenger details before creating.
                </span>
              </div>
            )}
            {isFromQuote && (quoteLoading || !quotePricingLookup) && (
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading quote request data…
              </div>
            )}

            {isFromProposal && sourceProposal && (
              <div className="p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-green-600 dark:text-green-300 flex-shrink-0" />
                <span className="text-sm text-green-800 dark:text-green-300">
                  Prefilled from Proposal <strong>&ldquo;{sourceProposal.title}&rdquo;</strong> — review services and
                  passenger details before creating. The proposal will be linked to this reservation.
                </span>
              </div>
            )}
            {isFromProposal && proposalLoading && (
              <div className="p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading proposal data…
              </div>
            )}

            {/* Basic Info */}
            <Card className="p-6 bg-card shadow-md">
              <h2 className="text-lg font-bold text-foreground mb-4">Reservation Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reservation Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Summer Adventure 2025"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Destination *</Label>
                  <Input
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    placeholder="Bali, Indonesia"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={formData.department}
                    onValueChange={(v) => setFormData({ ...formData, department: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>General</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cover Image URL</Label>
                  <Input
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </Card>

            {/* Client */}
            <Card className="p-6 bg-card shadow-md">
              <h2 className="text-lg font-bold text-foreground mb-4">Client *</h2>
              <Popover open={clientDropdownOpen} onOpenChange={setClientDropdownOpen}>
                <PopoverTrigger asChild>
                  <button
                    role="combobox"
                    aria-expanded={clientDropdownOpen}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm border border-border rounded-lg bg-card hover:bg-muted text-left"
                  >
                    {formData.client_id ? (
                      <span className="font-medium">
                        {formData.client_name}
                        {formData.client_email ? ` · ${formData.client_email}` : ''}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Select client from database</span>
                    )}
                    <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search clients..."
                      value={clientSearch}
                      onValueChange={setClientSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No clients found</CommandEmpty>
                      <CommandGroup>
                        {filteredClients.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.name} ${c.email || ''} ${c.company || ''}`}
                            onSelect={() => {
                              setFormData({
                                ...formData,
                                client_id: c.id,
                                client_name: c.name || '',
                                client_email: c.email || '',
                              });
                              setClientSearch('');
                              setClientDropdownOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${formData.client_id === c.id ? 'opacity-100' : 'opacity-0'}`}
                            />
                            <div>
                              <span className="font-medium">{c.name}</span>
                              {c.email && <span className="text-muted-foreground ml-1">— {c.email}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Card>

            {/* Service Types */}
            <Card className="p-6 bg-card shadow-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-600 dark:text-purple-300" />
                  Service Types
                </h2>
                <span className="text-sm text-muted-foreground">{serviceTypes.length} selected</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {SERVICE_TYPES.map((st) => {
                  const Icon = SERVICE_TYPE_ICONS[st.key];
                  const selected = serviceTypes.includes(st.key);
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() =>
                        setServiceTypes((prev) =>
                          prev.includes(st.key) ? prev.filter((k) => k !== st.key) : [...prev, st.key],
                        )
                      }
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                        selected
                          ? 'border-purple-400 bg-purple-50 dark:bg-purple-950/40 shadow-sm'
                          : 'border-border bg-card hover:border-border'
                      }`}
                    >
                      <div
                        className={`p-2 rounded-lg ${selected ? 'bg-purple-200 text-purple-700 dark:text-purple-300' : 'bg-muted text-muted-foreground'}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span
                        className={`font-medium text-sm ${selected ? 'text-purple-900 dark:text-purple-300' : 'text-foreground'}`}
                      >
                        {st.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Passenger Count + Rooms */}
            <Card className="p-6 bg-card shadow-md">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                  Rooms & Passengers
                </h2>
                <div className="flex items-center flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">Rooms</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          if (rooms.length <= 1) return;
                          setRooms((prev) => prev.slice(0, -1));
                        }}
                      >
                        −
                      </Button>
                      <span className="w-10 text-center font-bold text-lg text-foreground">{rooms.length}</span>
                      <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={addRoom}>
                        +
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">Passengers</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          const next = Math.max(1, passengerCount - 1);
                          setPassengerCount(next);
                          setRooms(autoGenerateRooms(next));
                        }}
                      >
                        −
                      </Button>
                      <span className="w-10 text-center font-bold text-lg text-foreground">{passengerCount}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          const next = passengerCount + 1;
                          setPassengerCount(next);
                          setRooms(autoGenerateRooms(next));
                        }}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {passengerCount > 0 && (
                <div
                  className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
                    slotsValid
                      ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {slotsValid
                    ? `✓ ${passengerCount} passenger${passengerCount !== 1 ? 's' : ''} — ${rooms.length} room${rooms.length !== 1 ? 's' : ''}`
                    : `⚠ ${derivedPax} slot${derivedPax !== 1 ? 's' : ''} across ${rooms.length} room${rooms.length !== 1 ? 's' : ''} — passenger count set to ${passengerCount}. Adjust rooms or occupancy to match.`}
                </div>
              )}

              <div className="space-y-4">
                {rooms.map((room, ri) => {
                  const roomTotalSlots = room.passengers.length;
                  return (
                    <div key={room.id} className="border border-border rounded-lg bg-muted overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-foreground text-sm">Room {ri + 1}</span>
                          <Select
                            value={String(roomTotalSlots)}
                            onValueChange={(v) => setRoomOccupancy(room.id, parseInt(v))}
                          >
                            <SelectTrigger className="w-36 h-8 text-xs bg-card">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4].map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n} Person{n > 1 ? 's' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeRoom(room.id)}
                            className="h-7 text-red-500 dark:text-red-300 hover:text-red-700 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        {room.passengers.map((pax) => (
                          <PassengerFieldsRow
                            key={pax.id}
                            passenger={pax}
                            onChange={(updated) => updatePassenger(room.id, pax.id, updated)}
                            showContact
                            onSetContact={() => setContactInRoom(room.id, pax.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {rooms.some((r) => r.passengers.some((p) => p.is_contact)) && (
                <p className="text-xs text-green-600 dark:text-green-300 mt-3 flex items-center gap-1">
                  <Star className="w-3 h-3" fill="currentColor" />
                  Contact: <strong>{rooms.flatMap((r) => r.passengers).find((p) => p.is_contact)?.name}</strong>
                </p>
              )}
            </Card>

            {/* Currency Settings */}
            <Card className="p-5 bg-card shadow-md border-l-4 border-blue-500">
              <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                Currency Settings
              </h2>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label>
                    Acquiring Currency <span className="text-red-500 dark:text-red-300 text-xs">(what you pay)</span>
                  </Label>
                  <Select
                    value={acquiringCurrency}
                    onValueChange={(v) => {
                      setAcquiringCurrency(v);
                      setExchangeRate(1);
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ArrowRightLeft className="w-5 h-5 text-muted-foreground mb-1" />
                <div className="space-y-2">
                  <Label>
                    Selling Currency{' '}
                    <span className="text-green-600 dark:text-green-300 text-xs">(what client pays)</span>
                  </Label>
                  <Select
                    value={sellingCurrency}
                    onValueChange={(v) => {
                      setSellingCurrency(v);
                      setExchangeRate(1);
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {acquiringCurrency !== sellingCurrency && (
                  <>
                    <div className="space-y-2">
                      <Label>Exchange Rate</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                        className="w-32"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={fetchExchangeRate}
                      disabled={loadingRate}
                      className="gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingRate ? 'animate-spin' : ''}`} />
                      {loadingRate ? 'Fetching...' : 'Live Rate'}
                    </Button>
                  </>
                )}
              </div>
            </Card>

            {/* Services */}
            <Card className="p-6 bg-card shadow-md">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Services & Pricing</h2>
                  <p className="text-sm text-muted-foreground">
                    Acq. in <strong>{acquiringCurrency}</strong> · Sell in <strong>{sellingCurrency}</strong>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={addService} variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Service
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {services.map((service) => {
                  const mergeSvc = (updated) =>
                    setServices((prev) => prev.map((s) => (s._key === service._key ? { ...s, ...updated } : s)));
                  return (
                    <ServiceLineEditor
                      key={service._key}
                      service={service}
                      services={services}
                      categories={categories}
                      _passengerCount={passengerCount}
                      onUpdate={mergeSvc}
                      onChange={mergeSvc}
                      onRemove={() => removeService(service._key)}
                      onDuplicate={() => duplicateService(service._key)}
                    />
                  );
                })}
              </div>

              {/* Cost Summary */}
              {services.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="flex justify-end">
                    <div className="w-96 space-y-3">
                      {Object.entries(acquiringByCurrency).map(([cur, total]) => (
                        <div key={`acq-${cur}`} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Cost ({cur})</span>
                          <span className="font-semibold text-red-600 dark:text-red-300">
                            {currSymbol(cur)}
                            {total.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {Object.entries(sellingByCurrency).map(([cur, total]) => (
                        <div key={`sell-${cur}`} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Selling ({cur})</span>
                          <span className="font-semibold text-green-700 dark:text-green-300">
                            {currSymbol(cur)}
                            {total.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {!currenciesMixed && (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-orange-500 dark:text-orange-300" />
                              <span className="font-medium">Markup</span>
                              <Input
                                type="number"
                                min="0"
                                max="200"
                                step="0.5"
                                value={markupPct}
                                onChange={(e) => setMarkupPct(parseFloat(e.target.value) || 0)}
                                className="w-16 h-7 text-xs text-center px-1"
                              />
                              <span className="text-muted-foreground text-xs">%</span>
                            </div>
                            <span className="text-xs text-muted-foreground">Applied to each line</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Gross Margin</span>
                            <span
                              className={`font-semibold ${margin >= 0 ? 'text-blue-600 dark:text-blue-300' : 'text-red-600 dark:text-red-300'}`}
                            >
                              {margin.toFixed(1)}%
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <div>
                              <div className="text-lg font-bold text-foreground">Total</div>
                              <div className="text-xs text-muted-foreground">Client price ({sellingCurrency})</div>
                            </div>
                            <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                              {currSymbol(sellingCurrency)}
                              {finalTotal.toFixed(2)}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Notes & Terms */}
            <Card className="p-6 bg-card shadow-md">
              <h2 className="text-lg font-bold text-foreground mb-4">Notes & Terms</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Special notes for the client..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Terms & Conditions</Label>
                  <Textarea
                    value={formData.terms_and_conditions}
                    onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    Internal Notes (staff only)
                  </Label>
                  <Textarea
                    value={formData.internal_notes}
                    onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                    rows={3}
                    placeholder="Notes visible only to internal users..."
                    className="border-amber-200 dark:border-amber-800 focus-visible:ring-amber-400"
                  />
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-3 pb-8">
              <Link to={createPageUrl('Reservations')}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  !formData.client_id ||
                  (isFromQuote && (quoteLoading || !quotePricingLookup)) ||
                  (isFromProposal && proposalLoading)
                }
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : isEditing ? (
                  'Save Changes'
                ) : (
                  'Create Reservation'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Add Provider Dialog */}
      <Dialog open={addProviderOpen} onOpenChange={setAddProviderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Provider</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createSupplierMutation.mutate(newProvider);
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-2">
              <Label>Provider Name *</Label>
              <Input
                value={newProvider.name}
                onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                placeholder="e.g. Sunset Tours"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={newProvider.city}
                  onChange={(e) => setNewProvider({ ...newProvider, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={newProvider.phone}
                  onChange={(e) => setNewProvider({ ...newProvider, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newProvider.email}
                onChange={(e) => setNewProvider({ ...newProvider, email: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddProviderOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={createSupplierMutation.isPending}
              >
                {createSupplierMutation.isPending ? 'Adding...' : 'Add Provider'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
