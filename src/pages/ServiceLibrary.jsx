const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Search, MapPin, Clock, Link as LinkIcon, 
  FileText, Trash2, Edit, ExternalLink, Map, Users, Send
} from 'lucide-react';
import ServiceBookingRequest from '../components/services/ServiceBookingRequest';
import { usePermissions } from '../components/permissions/PermissionContext';
import { showSuccess, showError } from '@/lib/toast';

const UNIT_LABELS = {
  per_person: 'Per Person',
  per_group: 'Per Group',
  per_hour: 'Per Hour',
  per_day: 'Per Day',
  flat_rate: 'Flat Rate'
};

export default function ServiceLibrary() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [newCategory, setNewCategory] = useState({ name: '', description: '', color: '#3b82f6' });
  const [formData, setFormData] = useState({
    category_id: '',
    name: '',
    description: '',
    meeting_point: '',
    meeting_time: '',
    meeting_point_map_url: '',
    duration: '',
    included: '',
    not_included: '',
    points_of_interest: [],
    files: [],
    links: [],
    supplier_ids: [],
    supplier_contacts: [],
    base_price: 0,
    currency: 'USD',
    price_unit: 'per_person',
    is_active: true
  });

  const [newPoi, setNewPoi] = useState({ name: '', description: '', map_url: '' });
  const [newLink, setNewLink] = useState({ title: '', url: '' });

  const { data: services = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['serviceTemplates'],
    queryFn: () => db.entities.ServiceTemplate.list()
  }));

  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['serviceCategories'],
    queryFn: () => db.entities.ServiceCategory.list()
  }));

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['suppliers'],
    queryFn: () => db.entities.Supplier.list()
  }));

  const createMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ data) => db.entities.ServiceTemplate.create(data),
    onSuccess: () => {
      showSuccess('Service created');
      queryClient.invalidateQueries({ queryKey: ['serviceTemplates'] });
      closeModal();
    },
    onError: (error) => showError('Failed to create service', error.message)
  }));

  const updateMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.ServiceTemplate.update(id, data),
    onSuccess: () => {
      showSuccess('Service updated');
      queryClient.invalidateQueries({ queryKey: ['serviceTemplates'] });
      closeModal();
    },
    onError: (error) => showError('Failed to update service', error.message)
  }));

  const deleteMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ id) => db.entities.ServiceTemplate.delete(id),
    onSuccess: () => {
      showSuccess('Service deleted');
      queryClient.invalidateQueries({ queryKey: ['serviceTemplates'] });
    },
    onError: (error) => showError('Failed to delete service', error.message)
  }));

  const createCategoryMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ data) => db.entities.ServiceCategory.create(data),
    onSuccess: () => {
      showSuccess('Category created');
      queryClient.invalidateQueries({ queryKey: ['serviceCategories'] });
      setCategoryModalOpen(false);
      setNewCategory({ name: '', description: '', color: '#3b82f6' });
    },
    onError: (error) => showError('Failed to create category', error.message)
  }));

  const openModal = (service = null) => {
    if (service) {
      setEditingService(service);
      setFormData({
        category_id: service.category_id || '',
        name: service.name || '',
        description: service.description || '',
        meeting_point: service.meeting_point || '',
        meeting_time: service.meeting_time || '',
        meeting_point_map_url: service.meeting_point_map_url || '',
        duration: service.duration || '',
        included: service.included || '',
        not_included: service.not_included || '',
        points_of_interest: service.points_of_interest || [],
        files: service.files || [],
        links: service.links || [],
        supplier_ids: service.supplier_ids || [],
        supplier_contacts: service.supplier_contacts || [],
        base_price: service.base_price || 0,
        currency: service.currency || 'USD',
        price_unit: service.price_unit || 'per_person',
        is_active: service.is_active !== false
      });
    } else {
      setEditingService(null);
      setFormData({
        category_id: '',
        name: '',
        description: '',
        meeting_point: '',
        meeting_time: '',
        meeting_point_map_url: '',
        duration: '',
        included: '',
        not_included: '',
        points_of_interest: [],
        files: [],
        links: [],
        supplier_ids: [],
        supplier_contacts: [],
        base_price: 0,
        currency: 'USD',
        price_unit: 'per_person',
        is_active: true
      });
    }
    setModalOpen(true);
  };

  const toggleSupplier = (supplierId) => {
    const current = formData.supplier_ids || [];
    if (current.includes(supplierId)) {
      setFormData({
        ...formData,
        supplier_ids: current.filter(id => id !== supplierId),
        supplier_contacts: (formData.supplier_contacts || []).filter(c => c.supplier_id !== supplierId)
      });
    } else {
      setFormData({
        ...formData,
        supplier_ids: [...current, supplierId]
      });
    }
  };

  const updateSupplierContact = (supplierId, field, value) => {
    const contacts = formData.supplier_contacts || [];
    const existingIndex = contacts.findIndex(c => c.supplier_id === supplierId);
    if (existingIndex >= 0) {
      const updated = [...contacts];
      updated[existingIndex] = { ...updated[existingIndex], [field]: value };
      setFormData({ ...formData, supplier_contacts: updated });
    } else {
      setFormData({
        ...formData,
        supplier_contacts: [...contacts, { supplier_id: supplierId, [field]: value }]
      });
    }
  };

  const getSupplierContact = (supplierId) => {
    return (formData.supplier_contacts || []).find(c => c.supplier_id === supplierId) || {};
  };

  const openBookingModal = (service) => {
    setSelectedServiceForBooking(service);
    setBookingModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingService(null);
    setNewPoi({ name: '', description: '', map_url: '' });
    setNewLink({ title: '', url: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const addPoi = () => {
    if (newPoi.name) {
      setFormData({
        ...formData,
        points_of_interest: [...formData.points_of_interest, { ...newPoi }]
      });
      setNewPoi({ name: '', description: '', map_url: '' });
    }
  };

  const removePoi = (index) => {
    setFormData({
      ...formData,
      points_of_interest: formData.points_of_interest.filter((_, i) => i !== index)
    });
  };

  const addLink = () => {
    if (newLink.title && newLink.url) {
      setFormData({
        ...formData,
        links: [...formData.links, { ...newLink }]
      });
      setNewLink({ title: '', url: '' });
    }
  };

  const removeLink = (index) => {
    setFormData({
      ...formData,
      links: formData.links.filter((_, i) => i !== index)
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setFormData({
        ...formData,
        files: [...formData.files, { name: file.name, url: file_url }]
      });
    }
  };

  const removeFile = (index) => {
    setFormData({
      ...formData,
      files: formData.files.filter((_, i) => i !== index)
    });
  };

  const filteredServices = services
    .filter(s => selectedCategory === 'all' || s.category_id === selectedCategory)
    .filter(s => 
      searchTerm === '' ||
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || '';
//   const getSupplierName = (id) => suppliers.find(s => s.id === id)?.name || '';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Service Library</h1>
          <p className="text-slate-600">Pre-defined service templates with detailed information</p>
        </div>
        <div className="flex gap-2">
          {hasPermission('manage_categories') && (
            <Button onClick={() => setCategoryModalOpen(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              New Category
            </Button>
          )}
          <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 shadow-lg">
            <Plus className="w-5 h-5 mr-2" />
            New Service
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <Card className="p-4 bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Services Grid */}
      {filteredServices.length === 0 ? (
        <Card className="p-12 text-center bg-white">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No services found</h3>
          <p className="text-slate-600 mb-6">Create service templates for quick use in proposals and itineraries</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map(service => (
            <Card key={service.id} className="p-6 bg-white hover:shadow-xl transition-shadow group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <Badge variant="outline" className="mb-2">{getCategoryName(service.category_id)}</Badge>
                  <h3 className="text-xl font-bold text-slate-900">{service.name}</h3>
                  {service.supplier_ids?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-600">{service.supplier_ids.length} supplier(s)</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => openModal(service)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(service.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>

              {service.description && (
                <p className="text-slate-600 text-sm mb-3 line-clamp-2">{service.description}</p>
              )}

              <div className="space-y-2 text-sm">
                {service.meeting_point && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{service.meeting_point}</span>
                    {service.meeting_point_map_url && (
                      <a href={service.meeting_point_map_url} target="_blank" rel="noopener noreferrer">
                        <Map className="w-4 h-4 text-blue-600" />
                      </a>
                    )}
                  </div>
                )}
                {service.meeting_time && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4" />
                    {service.meeting_time}
                  </div>
                )}
                {service.duration && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4" />
                    Duration: {service.duration}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                <div className="flex gap-2">
                  {service.files?.length > 0 && (
                    <Badge variant="secondary">{service.files.length} files</Badge>
                  )}
                  {service.points_of_interest?.length > 0 && (
                    <Badge variant="secondary">{service.points_of_interest.length} POIs</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-bold text-green-700">
                    ${service.base_price?.toFixed(2)}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openBookingModal(service)}>
                    <Send className="w-3 h-3 mr-1" /> Book
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Service Modal */}
      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Edit Service' : 'Create Service'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <Tabs defaultValue="basic">
              <TabsList>
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
                <TabsTrigger value="meeting">Meeting Point</TabsTrigger>
                <TabsTrigger value="pois">POIs</TabsTrigger>
                <TabsTrigger value="files">Files & Links</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })} required>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Service Name *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Input value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} placeholder="e.g., 2 hours" />
                  </div>
                  <div className="space-y-2">
                    <Label>Price Unit</Label>
                    <Select value={formData.price_unit} onValueChange={(v) => setFormData({ ...formData, price_unit: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(UNIT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Base Price</Label>
                    <Input type="number" step="0.01" value={formData.base_price} onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>What's Included</Label>
                  <Textarea value={formData.included} onChange={(e) => setFormData({ ...formData, included: e.target.value })} rows={2} />
                </div>

                <div className="space-y-2">
                  <Label>What's Not Included</Label>
                  <Textarea value={formData.not_included} onChange={(e) => setFormData({ ...formData, not_included: e.target.value })} rows={2} />
                </div>
              </TabsContent>

              <TabsContent value="suppliers" className="space-y-4 pt-4">
                <Label>Select Suppliers for this Service</Label>
                <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto">
                  {suppliers.map(supplier => {
                    const isSelected = (formData.supplier_ids || []).includes(supplier.id);
                    const contact = getSupplierContact(supplier.id);
                    return (
                      <div key={supplier.id} className={`p-3 border rounded-lg ${isSelected ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleSupplier(supplier.id)}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{supplier.name}</div>
                            <div className="text-sm text-slate-600">{supplier.email}</div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2">
                            <Input 
                              placeholder="Contact Name"
                              value={contact.contact_name || ''}
                              onChange={(e) => updateSupplierContact(supplier.id, 'contact_name', e.target.value)}
                            />
                            <Input 
                              placeholder="Contact Email"
                              value={contact.contact_email || ''}
                              onChange={(e) => updateSupplierContact(supplier.id, 'contact_email', e.target.value)}
                            />
                            <Input 
                              placeholder="Contact Phone"
                              value={contact.contact_phone || ''}
                              onChange={(e) => updateSupplierContact(supplier.id, 'contact_phone', e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="meeting" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Meeting Point Address</Label>
                  <Input value={formData.meeting_point} onChange={(e) => setFormData({ ...formData, meeting_point: e.target.value })} placeholder="Full address" />
                </div>
                <div className="space-y-2">
                  <Label>Meeting Time</Label>
                  <Input value={formData.meeting_time} onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })} placeholder="e.g., 09:00 AM" />
                </div>
                <div className="space-y-2">
                  <Label>Map URL (Google Maps, etc.)</Label>
                  <Input value={formData.meeting_point_map_url} onChange={(e) => setFormData({ ...formData, meeting_point_map_url: e.target.value })} placeholder="https://maps.google.com/..." />
                </div>
              </TabsContent>

              <TabsContent value="pois" className="space-y-4 pt-4">
                <div className="space-y-3">
                  <Label>Points of Interest</Label>
                  {formData.points_of_interest.map((poi, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{poi.name}</div>
                        {poi.description && <div className="text-sm text-slate-600">{poi.description}</div>}
                      </div>
                      {poi.map_url && (
                        <a href={poi.map_url} target="_blank" rel="noopener noreferrer">
                          <Map className="w-4 h-4 text-blue-600" />
                        </a>
                      )}
                      <Button type="button" variant="ghost" size="icon" onClick={() => removePoi(index)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  <div className="grid grid-cols-3 gap-2">
                    <Input value={newPoi.name} onChange={(e) => setNewPoi({ ...newPoi, name: e.target.value })} placeholder="POI Name" />
                    <Input value={newPoi.description} onChange={(e) => setNewPoi({ ...newPoi, description: e.target.value })} placeholder="Description" />
                    <div className="flex gap-2">
                      <Input value={newPoi.map_url} onChange={(e) => setNewPoi({ ...newPoi, map_url: e.target.value })} placeholder="Map URL" className="flex-1" />
                      <Button type="button" onClick={addPoi} variant="outline" size="icon">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="files" className="space-y-4 pt-4">
                <div className="space-y-3">
                  <Label>Attached Files</Label>
                  {formData.files.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                      <FileText className="w-4 h-4 text-slate-600" />
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-blue-600 hover:underline">
                        {file.name}
                      </a>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeFile(index)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input type="file" onChange={handleFileUpload} className="flex-1" />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Related Links</Label>
                  {formData.links.map((link, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                      <LinkIcon className="w-4 h-4 text-slate-600" />
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-blue-600 hover:underline">
                        {link.title}
                      </a>
                      <ExternalLink className="w-4 h-4 text-slate-400" />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeLink(index)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input value={newLink.title} onChange={(e) => setNewLink({ ...newLink, title: e.target.value })} placeholder="Link Title" />
                    <Input value={newLink.url} onChange={(e) => setNewLink({ ...newLink, url: e.target.value })} placeholder="URL" />
                    <Button type="button" onClick={addLink} variant="outline" size="icon">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingService ? 'Update' : 'Create'} Service
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* Category Modal */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Service Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createCategoryMutation.mutate(newCategory); }} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Category Name *</Label>
              <Input 
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input 
                type="color"
                value={newCategory.color}
                onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                className="w-20 h-10"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setCategoryModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Create Category</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Booking Request Modal */}
      {selectedServiceForBooking && (
        <ServiceBookingRequest 
          open={bookingModalOpen}
          onClose={() => { setBookingModalOpen(false); setSelectedServiceForBooking(null); }}
          service={selectedServiceForBooking}
          tripId={''}
          supplierId={''}
        />
      )}
    </div>
  );
}