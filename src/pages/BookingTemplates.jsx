import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sanitizeForInnerHtml } from '@/lib/sanitize';
import { showSuccess, showError } from '@/lib/toast';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, FileCode, Eye, Star } from 'lucide-react';
import { usePermissions } from '../components/permissions/PermissionContext';

export default function BookingTemplates() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    html_content: '',
    is_default: false
  });

  const { data: templates = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['bookingTemplates'],
    queryFn: () => db.entities.BookingTemplate.list()
  }));

  const createMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ data) => db.entities.BookingTemplate.create(data),
    onSuccess: () => {
      showSuccess('Template created');
      queryClient.invalidateQueries({ queryKey: ['bookingTemplates'] });
      closeModal();
    },
    onError: (error) => showError('Failed to create template', error.message)
  }));

  const updateMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.BookingTemplate.update(id, data),
    onSuccess: () => {
      showSuccess('Template updated');
      queryClient.invalidateQueries({ queryKey: ['bookingTemplates'] });
      closeModal();
    },
    onError: (error) => showError('Failed to update template', error.message)
  }));

  const deleteMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ id) => db.entities.BookingTemplate.delete(id),
    onSuccess: () => {
      showSuccess('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['bookingTemplates'] });
    },
    onError: (error) => showError('Failed to delete template', error.message)
  }));

  const openModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name || '',
        subject: template.subject || '',
        html_content: template.html_content || '',
        is_default: template.is_default || false
      });
    } else {
      setEditingTemplate(null);
      setFormData({ name: '', subject: '', html_content: '', is_default: false });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTemplate(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!hasPermission('manage_booking_templates')) {
    return (
      <Card className="p-12 text-center">
        <FileCode className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h3>
        <p className="text-slate-600">You don't have permission to manage booking templates</p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Booking Templates</h1>
          <p className="text-slate-600">Customize email templates for booking requests</p>
        </div>
        <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> New Template
        </Button>
      </div>

      <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
        <strong>Available placeholders:</strong> {`{{reference_number}}, {{service_date}}, {{num_guests}}, {{trip_name}}, {{trip_destination}}, {{client_name}}, {{client_email}}, {{total_cost}}, {{service_details}}, {{supplier_name}}, {{company_name}}`}
      </div>

      {templates.length === 0 ? (
        <Card className="p-12 text-center">
          <FileCode className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No templates yet</h3>
          <p className="text-slate-600">Create your first booking email template</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(template => (
            <Card key={template.id} className="p-6 bg-white">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">{template.name}</h3>
                  {template.is_default && (
                    <Badge className="bg-yellow-100 text-yellow-800 mt-1">
                      <Star className="w-3 h-3 mr-1" /> Default
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => {
                    setPreviewHtml(template.html_content);
                    setShowPreview(true);
                  }}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openModal(template)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(template.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
              {template.subject && (
                <p className="text-sm text-slate-600 mb-2">Subject: {template.subject}</p>
              )}
              <pre className="text-xs bg-slate-50 p-2 rounded overflow-hidden max-h-20 text-slate-500">
                {template.html_content?.substring(0, 200)}...
              </pre>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email Subject</Label>
                <Input 
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Booking Request - {{reference_number}}"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch 
                checked={formData.is_default}
                onCheckedChange={(v) => setFormData({ ...formData, is_default: v })}
              />
              <Label>Set as default template</Label>
            </div>

            <div className="space-y-2">
              <Label>HTML Content *</Label>
              <Textarea 
                value={formData.html_content}
                onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                rows={15}
                className="font-mono text-sm"
                required
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingTemplate ? 'Update' : 'Create'} Template
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg p-4 bg-white" dangerouslySetInnerHTML={{ __html: sanitizeForInnerHtml(previewHtml) }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}