import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CATEGORIES = ['Clothing', 'Toiletries', 'Electronics', 'Documents', 'Medication', 'Activities', 'Other'];

export default function PackingList({ tripId, items }) {
  const [newItem, setNewItem] = useState({ item_name: '', category: 'Other', quantity: 1 });
  const queryClient = useQueryClient();

  const addMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.PackingItem.create({ ...data, trip_id: tripId }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['packingItems', tripId] });
        setNewItem({ item_name: '', category: 'Other', quantity: 1 });
      },
    })
  );

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.PackingItem.update(id, data),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packingItems', tripId] }),
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.PackingItem.delete(id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packingItems', tripId] }),
    })
  );

  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const packedCount = items.filter((i) => i.packed).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (packedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Progress */}
      {totalCount > 0 && (
        <Card className="p-6 bg-gradient-to-br from-blue-50 dark:from-blue-950/40 to-card border-0 shadow-md">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-foreground">Packing Progress</h3>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-300">
              {packedCount}/{totalCount}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-600 to-blue-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </Card>
      )}

      {/* Add New Item */}
      <Card className="p-6 bg-card shadow-md">
        <h3 className="font-semibold text-foreground mb-4">Add Item</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Item name"
            value={newItem.item_name}
            onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
            className="flex-1"
          />
          <Select value={newItem.category} onValueChange={(v) => setNewItem({ ...newItem, category: v })}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min="1"
            value={newItem.quantity}
            onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })}
            className="w-20"
          />
          <Button
            onClick={() => newItem.item_name && addMutation.mutate(newItem)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>
      </Card>

      {/* Items by Category */}
      {CATEGORIES.map((category) => {
        const categoryItems = groupedItems[category] || [];
        if (categoryItems.length === 0) return null;

        return (
          <Card key={category} className="p-6 bg-card shadow-md">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              {category}
              <span className="text-sm text-muted-foreground font-normal">({categoryItems.length})</span>
            </h3>
            <div className="space-y-3">
              {categoryItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
                >
                  <Checkbox
                    checked={item.packed}
                    onCheckedChange={(checked) =>
                      updateMutation.mutate({ id: item.id, data: { ...item, packed: checked } })
                    }
                  />
                  <span className={`flex-1 ${item.packed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {item.item_name}
                  </span>
                  {item.quantity > 1 && <span className="text-sm text-muted-foreground">x{item.quantity}</span>}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4 text-red-500 dark:text-red-300" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
