import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SkeletonTable } from '@/components/ui/skeletons';
import { Plus, Edit, Trash2, FolderTree, BookOpen, ArrowRight } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function Categories() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', color: '#3B82F6' });
  const queryClient = useQueryClient();

  const { data: categories = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['categories'],
      queryFn: () => db.entities.SupplierCategory.list(),
    })
  );

  const { data: serviceTemplates = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['serviceTemplates'],
      queryFn: () => db.entities.ServiceTemplate.list(),
    })
  );

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.SupplierCategory.create(data),
      onSuccess: () => {
        showSuccess('Category created');
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        closeModal();
      },
      onError: (error) => showError('Failed to create category', error.message),
    })
  );

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.SupplierCategory.update(id, data),
      onSuccess: () => {
        showSuccess('Category updated');
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        closeModal();
      },
      onError: (error) => showError('Failed to update category', error.message),
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.SupplierCategory.delete(id),
      onSuccess: () => {
        showSuccess('Category deleted');
        queryClient.invalidateQueries({ queryKey: ['categories'] });
      },
      onError: (error) => showError('Failed to delete category', error.message),
    })
  );

  const openModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name || '',
        description: category.description || '',
        color: category.color || '#3B82F6',
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', description: '', color: '#3B82F6' });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCategory(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <SkeletonTable />;
  }

  const getServiceCount = (categoryId) => serviceTemplates.filter((s) => s.category_id === categoryId).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Categories & Services</h1>
          <p className="text-muted-foreground">Organize categories and manage service library</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={createPageUrl('ServiceLibrary')}>
            <Button variant="outline">
              <BookOpen className="w-5 h-5 mr-2" />
              Service Library
            </Button>
          </Link>
          <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 shadow-lg">
            <Plus className="w-5 h-5 mr-2" />
            New Category
          </Button>
        </div>
      </div>

      {/* Categories Grid */}
      {categories.length === 0 ? (
        <Card className="p-12 text-center bg-card shadow-md">
          <div className="bg-blue-100 dark:bg-blue-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FolderTree className="w-8 h-8 text-blue-600 dark:text-blue-300" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">No categories yet</h3>
          <p className="text-muted-foreground mb-6">Create your first category to organize suppliers</p>
          <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Category
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Card key={category.id} className="p-6 bg-card hover:shadow-xl transition-shadow group">
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${category.color}20` }}
                >
                  <FolderTree className="w-6 h-6" style={{ color: category.color }} />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => openModal(category)}>
                    <Edit className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(category.id)}>
                    <Trash2 className="w-4 h-4 text-red-500 dark:text-red-300" />
                  </Button>
                </div>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{category.name}</h3>
              {category.description && <p className="text-muted-foreground text-sm mb-3">{category.description}</p>}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-sm text-muted-foreground">{getServiceCount(category.id)} services</span>
                <Link to={createPageUrl(`ServiceLibrary?category=${category.id}`)}>
                  <Button variant="ghost" size="sm" className="text-blue-600 dark:text-blue-300">
                    View <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Create Category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Category Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Hotels, Transportation, etc."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-3 items-center">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-20 h-10"
                />
                <span className="text-sm text-muted-foreground">{formData.color}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingCategory ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
