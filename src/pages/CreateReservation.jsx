import { db } from '@/lib/DbContext';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { SkeletonCard } from '@/components/ui/skeletons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { showSuccess, showError } from '@/lib/toast';
import { generateReferenceNumber } from '@/lib/referenceNumber';
import { createPageUrl } from '@/utils';
import ServiceLibraryPanel from '@/components/proposals/ServiceLibraryPanel';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { applyMarkup } from '@/lib/pricing';
import { categoryIdsBySupplier, getSupplierCategoryIds, createSupplierWithCategory } from '@/lib/supplierCategories';

import {
  newPassenger,
  newRoom,
  autoGenerateRooms,
  emptyService,
  sortByDate,
} from '@/components/create-reservation/helpers';
import PageHeader from '@/components/create-reservation/PageHeader';
import ReferencePreview from '@/components/create-reservation/ReferencePreview';
import PrefillBanners from '@/components/create-reservation/PrefillBanners';
import BasicInfoCard from '@/components/create-reservation/BasicInfoCard';
import ClientCard from '@/components/create-reservation/ClientCard';
import ServiceTypesCard from '@/components/create-reservation/ServiceTypesCard';
import RoomsPassengersCard from '@/components/create-reservation/RoomsPassengersCard';
import CurrencySettingsCard from '@/components/create-reservation/CurrencySettingsCard';
import ServicesCard from '@/components/create-reservation/ServicesCard';
import NotesTermsCard from '@/components/create-reservation/NotesTermsCard';
import SubmitActions from '@/components/create-reservation/SubmitActions';
import AddProviderDialog from '@/components/create-reservation/AddProviderDialog';

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
      <PageHeader isEditing={isEditing} showLibrary={showLibrary} setShowLibrary={setShowLibrary} />

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
            <ReferencePreview previewRef={previewRef} isEditing={isEditing} />

            <PrefillBanners
              isFromQuote={isFromQuote}
              sourceQuote={sourceQuote}
              quoteLoading={quoteLoading}
              quotePricingLookup={quotePricingLookup}
              isFromProposal={isFromProposal}
              sourceProposal={sourceProposal}
              proposalLoading={proposalLoading}
            />

            <BasicInfoCard formData={formData} setFormData={setFormData} departments={departments} />

            <ClientCard
              formData={formData}
              setFormData={setFormData}
              clientSearch={clientSearch}
              setClientSearch={setClientSearch}
              clientDropdownOpen={clientDropdownOpen}
              setClientDropdownOpen={setClientDropdownOpen}
              filteredClients={filteredClients}
            />

            <ServiceTypesCard serviceTypes={serviceTypes} setServiceTypes={setServiceTypes} />

            <RoomsPassengersCard
              rooms={rooms}
              passengerCount={passengerCount}
              setPassengerCount={setPassengerCount}
              setRooms={setRooms}
              removeRoom={removeRoom}
              setRoomOccupancy={setRoomOccupancy}
              updatePassenger={updatePassenger}
              setContactInRoom={setContactInRoom}
              derivedPax={derivedPax}
              slotsValid={slotsValid}
            />

            <CurrencySettingsCard
              acquiringCurrency={acquiringCurrency}
              setAcquiringCurrency={setAcquiringCurrency}
              sellingCurrency={sellingCurrency}
              setSellingCurrency={setSellingCurrency}
              exchangeRate={exchangeRate}
              setExchangeRate={setExchangeRate}
              fetchExchangeRate={fetchExchangeRate}
              loadingRate={loadingRate}
            />

            <ServicesCard
              services={services}
              setServices={setServices}
              categories={categories}
              passengerCount={passengerCount}
              addService={addService}
              removeService={removeService}
              duplicateService={duplicateService}
              acquiringByCurrency={acquiringByCurrency}
              sellingByCurrency={sellingByCurrency}
              currenciesMixed={currenciesMixed}
              markupPct={markupPct}
              setMarkupPct={setMarkupPct}
              margin={margin}
              finalTotal={finalTotal}
              acquiringCurrency={acquiringCurrency}
              sellingCurrency={sellingCurrency}
            />

            <NotesTermsCard formData={formData} setFormData={setFormData} />

            <SubmitActions
              isEditing={isEditing}
              isFromQuote={isFromQuote}
              quoteLoading={quoteLoading}
              quotePricingLookup={quotePricingLookup}
              isFromProposal={isFromProposal}
              proposalLoading={proposalLoading}
              createPending={createMutation.isPending}
              updatePending={updateMutation.isPending}
            />
          </form>
        </div>
      </div>

      <AddProviderDialog
        open={addProviderOpen}
        onOpenChange={setAddProviderOpen}
        newProvider={newProvider}
        setNewProvider={setNewProvider}
        createSupplierMutation={createSupplierMutation}
      />
    </div>
  );
}
