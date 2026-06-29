const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookmarkPlus, Check } from 'lucide-react';

export default function SaveAsTemplateButton({ trip, services = [] }) {
  const [open, setOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleOpen = () => {
    setTemplateName(`${trip.destination || trip.name} Template`);
    setSaved(false);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!templateName.trim()) return;
    setSaving(true);

    const templateServices = (trip.services || services).map(s => ({
      supplier_id: s.supplier_id || '',
      name: s.name || '',
      description: s.description || '',
      acquiring_price: parseFloat(s.acquiring_price) || 0,
      selling_price: parseFloat(s.selling_price) || 0,
      quantity: parseInt(s.quantity) || 1,
    }));

    const startDate = trip.start_date ? new Date(trip.start_date) : null;
    const endDate = trip.end_date ? new Date(trip.end_date) : null;
    const durationDays = startDate && endDate
      ? Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
      : null;

    await db.entities.ProposalTemplate.create({
      name: templateName.trim(),
      destination: trip.destination || '',
      duration_days: durationDays,
      notes: trip.notes || '',
      terms_and_conditions: trip.terms_and_conditions || '',
      services: templateServices,
      acquiring_currency: trip.acquiring_currency || 'USD',
      selling_currency: trip.selling_currency || 'USD',
      source_trip_id: trip.id,
      source_trip_name: trip.name,
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setOpen(false), 1200);
  };

  return (
    <>
      <Button variant="outline" onClick={handleOpen} className="gap-2">
        <BookmarkPlus className="w-4 h-4" />
        Save as Template
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as Proposal Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-500">
              This will save <strong>{trip.destination || trip.name}</strong>'s destination, services, and pricing as a reusable template for future proposals.
            </p>
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="e.g. Bali 7-Day Package"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !templateName.trim() || saved}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {saved ? (
                <><Check className="w-4 h-4" /> Saved!</>
              ) : saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
              ) : (
                <><BookmarkPlus className="w-4 h-4" /> Save Template</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}