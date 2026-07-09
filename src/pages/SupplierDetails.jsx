import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { SkeletonCard } from '@/components/ui/skeletons';
import { HOTEL_TYPE_OPTIONS, formatHotelType } from '@/lib/hotelTypes';
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  MapPin,
  Star,
  Edit,
  Send,
  CalendarDays,
  Search,
  ExternalLink,
  Check,
  Loader2,
  Store,
  CalendarOff,
  Plus,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import SupplierServices from '../components/suppliers/SupplierServices';
import { showSuccess, showError } from '@/lib/toast';
import SupplierPricingManager from '../components/suppliers/SupplierPricingManager';
import SupplierReviews from '../components/suppliers/SupplierReviews';
import SupplierStopSales from '../components/suppliers/SupplierStopSales';
import BookingEmailSender from '../components/booking/BookingEmailSender';
import SupplierBookingForm from '../components/suppliers/SupplierBookingForm';
import { usePermissions } from '../components/permissions/PermissionContext';
import { categoryIdsBySupplier, getSupplierCategoryIds } from '@/lib/supplierCategories';
import { isSupplierInStopSaleToday } from '@/lib/supplierStopSales';

export default function SupplierDetails() {
  const [searchParams] = useSearchParams();
  const supplierId = searchParams.get('id');
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [bookingEmailOpen, setBookingEmailOpen] = useState(false);
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [editForm, setEditForm] = useState(/** @type {any} */ ({}));
  const [webSearchOpen, setWebSearchOpen] = useState(false);
  const [webResults, setWebResults] = useState([]);
  const [webSearchLoading, setWebSearchLoading] = useState(false);
  const [webSearchError, setWebSearchError] = useState('');
  const [newLocation, setNewLocation] = useState('');

  const addLocation = () => {
    const loc = newLocation.trim();
    if (!loc) return;
    if ((editForm.car_rental_locations || []).includes(loc)) return;
    setEditForm({ ...editForm, car_rental_locations: [...(editForm.car_rental_locations || []), loc] });
    setNewLocation('');
  };

  const removeLocation = (idx) => {
    setEditForm({
      ...editForm,
      car_rental_locations: (editForm.car_rental_locations || []).filter((_, i) => i !== idx),
    });
  };

  const canModify = hasPermission('modify_suppliers');
  const canModifyBasic = hasPermission('modify_suppliers_basic');

  const { data: supplier, isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplier', supplierId],
      queryFn: () => db.entities.Supplier.get(supplierId),
      enabled: !!supplierId,
    })
  );

  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierCategories'],
      queryFn: () => db.entities.SupplierCategory.list(),
    })
  );

  const { data: subcategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierSubcategories', supplierId],
      queryFn: () => db.entities.SupplierSubcategory.filter({ supplier_id: supplierId }),
      enabled: !!supplierId,
    })
  );
  const supplierCategoryMap = categoryIdsBySupplier(subcategories);
  const selectedCategories = categories.filter((c) =>
    getSupplierCategoryIds(supplierCategoryMap, supplierId).includes(c.id),
  );

  const { data: stopSales = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierStopSales', supplierId],
      queryFn: () => db.entities.SupplierStopSale.filter({ supplier_id: supplierId }),
      enabled: !!supplierId,
    })
  );
  const inStopSaleToday = isSupplierInStopSaleToday(stopSales, supplierId);

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) =>
        db.entities.Supplier.update(supplierId, {
          name: data.name,
          contact_person: data.contact_person || '',
          email: data.email || '',
          phone: data.phone || '',
          website: data.website || '',
          address: data.address || '',
          city: data.city || '',
          area: data.area || '',
          pricing_info: data.pricing_info || '',
          notes: data.notes || '',
          rating: data.rating || supplier.rating,
          show_in_portal: !!data.show_in_portal,
          custom_fields: data.custom_fields || supplier.custom_fields || {},
          car_rental_terms: data.car_rental_terms || '',
          car_rental_locations: data.car_rental_locations || [],
        }),
      onSuccess: () => {
        showSuccess('Supplier updated');
        queryClient.invalidateQueries({ queryKey: ['supplier', supplierId] });
        setEditModalOpen(false);
      },
      onError: (error) => showError('Failed to update supplier', error.message),
    })
  );

  const openEditModal = () => {
    setEditForm({
      name: supplier.name || '',
      contact_person: supplier.contact_person || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      website: supplier.website || '',
      address: supplier.address || '',
      city: supplier.city || '',
      area: supplier.area || '',
      pricing_info: supplier.pricing_info || '',
      notes: supplier.notes || '',
      rating: supplier.rating || 5,
      show_in_portal: !!supplier.show_in_portal,
      car_rental_terms: supplier.car_rental_terms || '',
      car_rental_locations: supplier.car_rental_locations || [],
    });
    setEditModalOpen(true);
  };

  const handleWebSearch = async () => {
    setWebSearchLoading(true);
    setWebSearchError('');
    setWebResults([]);
    try {
      const res = await db.integrations.Core.SupplierWebSearch({
        name: supplier.name,
        city: supplier.city || '',
      });
      setWebResults(res.results || []);
      if (!res.results?.length) {
        setWebSearchError('No results found on the web for this supplier.');
      }
    } catch (err) {
      setWebSearchError('Search failed: ' + (err.message || 'Unknown error'));
    }
    setWebSearchLoading(false);
  };

  const applyWebResult = (result) => {
    setEditForm({
      name: result.name || supplier.name || '',
      contact_person: editForm.contact_person || supplier.contact_person || '',
      email: result.email || editForm.email || supplier.email || '',
      phone: result.phone || editForm.phone || supplier.phone || '',
      website: result.website || editForm.website || supplier.website || '',
      address: result.address || editForm.address || supplier.address || '',
      city: editForm.city || supplier.city || '',
      area: editForm.area || supplier.area || '',
      pricing_info: editForm.pricing_info || supplier.pricing_info || '',
      notes: result.description
        ? `[From web] ${result.description}\n\n${editForm.notes || supplier.notes || ''}`
        : editForm.notes || supplier.notes || '',
      rating: result.rating || editForm.rating || supplier.rating || 5,
      show_in_portal: editForm.show_in_portal ?? !!supplier.show_in_portal,
    });
    setEditModalOpen(true);
    setWebSearchOpen(false);
  };

  if (isLoading) {
    return <SkeletonCard />;
  }

  if (!supplier) {
    return <div className="text-center py-20">Supplier not found</div>;
  }

  return (
    <div className="space-y-6">
      <Link to={createPageUrl('Suppliers')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Suppliers
        </Button>
      </Link>

      <Card className="p-8 bg-card shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-foreground">{supplier.name}</h1>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setBookingFormOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <CalendarDays className="w-4 h-4 mr-2" /> New Booking
                </Button>
                {hasPermission('send_booking_requests') && (
                  <Button onClick={() => setBookingEmailOpen(true)} variant="outline">
                    <Send className="w-4 h-4 mr-2" /> Send Booking Email
                  </Button>
                )}
                {(canModify || canModifyBasic) && (
                  <Button onClick={openEditModal} variant="outline">
                    <Edit className="w-4 h-4 mr-2" /> Edit
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setWebSearchOpen(true);
                    handleWebSearch();
                  }}
                  variant="outline"
                  className="border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                >
                  <Search className="w-4 h-4 mr-2" /> Search Web
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {selectedCategories.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  No category yet — add a subcategory below to place this supplier in one
                </span>
              )}
              {selectedCategories.map((category) => (
                <span
                  key={category.id}
                  className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold"
                  style={{
                    backgroundColor: `${category.color}20`,
                    color: category.color,
                  }}
                >
                  {category.name}
                </span>
              ))}
              {supplier.show_in_portal && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  <Store className="w-3.5 h-3.5" /> In client portal
                </span>
              )}
              {inStopSaleToday && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                  <CalendarOff className="w-3.5 h-3.5" /> In stop sales
                </span>
              )}
            </div>

            {supplier.rating && (
              <div className="flex items-center gap-1 mb-4">
                {typeof supplier.rating === 'number' ? (
                  <>
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${
                          i < supplier.rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'
                        }`}
                      />
                    ))}
                  </>
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground">
                    {formatHotelType(supplier.rating)}
                  </span>
                )}
              </div>
            )}

            <div className="space-y-3 text-foreground">
              {supplier.city && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {supplier.city}
                    {supplier.area ? ` — ${supplier.area}` : ''}
                  </span>
                </div>
              )}
              {supplier.contact_person && (
                <div>
                  <span className="font-medium">Contact Person:</span> {supplier.contact_person}
                </div>
              )}

              {supplier.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${supplier.email}`} className="hover:text-blue-600 dark:hover:text-blue-300">
                    {supplier.email}
                  </a>
                </div>
              )}

              {supplier.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${supplier.phone}`} className="hover:text-blue-600 dark:hover:text-blue-300">
                    {supplier.phone}
                  </a>
                </div>
              )}

              {supplier.website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 dark:hover:text-blue-300"
                  >
                    {supplier.website}
                  </a>
                </div>
              )}

              {supplier.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {supplier.address}
                </div>
              )}
            </div>

            {supplier.pricing_info && (
              <Card className="mt-6 p-4 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800">
                <h3 className="font-semibold text-green-900 dark:text-green-300 mb-2">Pricing Information</h3>
                <p className="text-foreground text-sm whitespace-pre-wrap">{supplier.pricing_info}</p>
              </Card>
            )}

            {supplier.notes && (
              <Card className="mt-4 p-4 bg-muted">
                <h3 className="font-semibold text-foreground mb-2">Notes</h3>
                <p className="text-foreground text-sm whitespace-pre-wrap">{supplier.notes}</p>
              </Card>
            )}
          </div>
        </div>
      </Card>

      {inStopSaleToday && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3">
          <CalendarOff className="w-5 h-5 text-red-600 dark:text-red-300 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-800 dark:text-red-300">
            <p className="font-semibold">This supplier is currently in stop sales</p>
            <p className="mt-0.5">
              It's unavailable for the dates below — new reservations, bookings and client quotes for those dates are
              blocked everywhere. See the Stop Sales section for details.
            </p>
          </div>
        </div>
      )}

      <SupplierStopSales supplierId={supplierId} />

      <SupplierPricingManager supplierId={supplierId} />

      <SupplierServices supplierId={supplierId} />

      <SupplierReviews supplierId={supplierId} />

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate(editForm);
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
                <Label>Contact Person</Label>
                <Input
                  value={editForm.contact_person}
                  onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
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
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={editForm.website}
                  onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Area / Region</Label>
                <Input value={editForm.area} onChange={(e) => setEditForm({ ...editForm, area: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Rating</Label>
                <select
                  value={editForm.rating}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      rating: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                >
                  {HOTEL_TYPE_OPTIONS.map((opt) => (
                    <option key={String(opt.value)} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <Label className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-blue-600 dark:text-blue-300" /> Show in client portal
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  When on, this supplier appears in the client travel shop (only its approved services are shown).
                </p>
              </div>
              <Switch
                checked={!!editForm.show_in_portal}
                onCheckedChange={(v) => setEditForm({ ...editForm, show_in_portal: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>Pricing Information</Label>
              <Textarea
                value={editForm.pricing_info}
                onChange={(e) => setEditForm({ ...editForm, pricing_info: e.target.value })}
                rows={3}
              />
            </div>
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Car Rental Settings</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Available Pickup / Drop-off Locations</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                        placeholder="Add a location (e.g. Antalya Airport, Istanbul)"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addLocation();
                          }
                        }}
                      />
                    </div>
                    <Button type="button" variant="outline" onClick={addLocation} size="sm" className="mt-0">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {editForm.car_rental_locations?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editForm.car_rental_locations.map((loc, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300"
                        >
                          {loc}
                          <button
                            type="button"
                            onClick={() => removeLocation(idx)}
                            className="hover:text-red-600 dark:hover:text-red-300"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Locations where the client can pick up and drop off the rental car.
                  </p>
                </div>
              </div>
              <div className="space-y-2 mt-3">
                <Label>Terms & Conditions</Label>
                <Textarea
                  value={editForm.car_rental_terms}
                  onChange={(e) => setEditForm({ ...editForm, car_rental_terms: e.target.value })}
                  rows={4}
                  placeholder="e.g. Minimum driver age 21, valid driver's license required, fuel policy, mileage limits, cancellation policy..."
                />
                <p className="text-xs text-muted-foreground">
                  These terms will be shown to the client when booking a car rental.
                </p>
              </div>
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
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Supplier Booking Form */}
      <SupplierBookingForm
        open={bookingFormOpen}
        onClose={() => setBookingFormOpen(false)}
        supplier={supplier}
        categoryName={selectedCategories.map((c) => c.name).join(', ')}
        onCreated={() => {}}
      />

      {/* Booking Email Sender */}
      <BookingEmailSender
        open={bookingEmailOpen}
        onClose={() => setBookingEmailOpen(false)}
        booking={{
          reference_number: 'NEW',
          service_date: new Date().toISOString().split('T')[0],
          num_guests: 1,
          service_details: '',
        }}
        supplier={supplier}
        trip={null}
        client={null}
      />

      {/* Search Web Dialog */}
      <Dialog open={webSearchOpen} onOpenChange={setWebSearchOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-600 dark:text-purple-300" />
              Web Results for "{supplier.name}"
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {webSearchLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600 dark:text-purple-300 mr-3" />
                <span className="text-muted-foreground">Searching the web...</span>
              </div>
            )}
            {webSearchError && !webSearchLoading && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-sm">
                {webSearchError}
              </div>
            )}
            {!webSearchLoading &&
              webResults.map((result, idx) => (
                <div
                  key={idx}
                  className="border border-border rounded-xl p-5 hover:border-purple-300 dark:hover:border-purple-800 transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-foreground">{result.name}</h3>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">{result.source}</span>
                    </div>
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 flex-shrink-0 ml-4"
                      onClick={() => applyWebResult(result)}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Apply Data
                    </Button>
                  </div>
                  {result.address && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      {result.address}
                    </div>
                  )}
                  {result.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      {result.phone}
                    </div>
                  )}
                  {result.website && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      <a
                        href={result.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-300 hover:underline truncate"
                      >
                        {result.website} <ExternalLink className="w-3 h-3 inline" />
                      </a>
                    </div>
                  )}
                  {result.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      {result.email}
                    </div>
                  )}
                  {result.rating > 0 && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                      <Star className="w-3.5 h-3.5 text-yellow-500 dark:text-yellow-300 fill-yellow-500" />
                      {result.rating}/5
                    </div>
                  )}
                  {result.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{result.description}</p>
                  )}
                </div>
              ))}
            {!webSearchLoading && !webSearchError && webResults.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p>No results found. Try searching with a different name or city.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
