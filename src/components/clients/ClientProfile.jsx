import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Globe,
  Instagram,
  Linkedin,
  Facebook,
  Twitter,
  Building,
  Upload,
  Loader2,
  Edit2,
  Check,
  X,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

const emptyExtra = () => ({
  _key: `extra-${Date.now()}-${Math.random()}`,
  name: '',
  supplier_id: '',
  unit: 'per_person',
  quantity: 1,
  acquiring_price: '',
  selling_price: '',
  currency: 'EUR',
});

export default function ClientProfile({ client, clientId }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [form, setForm] = useState({
    website: client.website || '',
    instagram: client.instagram || '',
    linkedin: client.linkedin || '',
    facebook: client.facebook || '',
    twitter: client.twitter || '',
    business_description: client.business_description || '',
    logo_url: client.logo_url || '',
    notes: client.notes || '',
  });
  const queryClient = useQueryClient();

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['suppliers'],
      queryFn: () => db.entities.Supplier.list(),
    })
  );

  const [extrasEditing, setExtrasEditing] = useState(false);
  const [extrasSaving, setExtrasSaving] = useState(false);
  const [extras, setExtras] = useState(client.fixed_extras || []);

  const addExtra = () => setExtras((prev) => [...prev, emptyExtra()]);
  const updateExtra = (key, field, value) =>
    setExtras((prev) => prev.map((x) => (x._key === key ? { ...x, [field]: value } : x)));
  const removeExtra = (key) => setExtras((prev) => prev.filter((x) => x._key !== key));

  const handleExtrasSave = async () => {
    setExtrasSaving(true);
    try {
      const clean = extras
        .filter((x) => x.name.trim())
        .map((x) => ({
          ...x,
          acquiring_price: parseFloat(x.acquiring_price) || 0,
          selling_price: parseFloat(x.selling_price) || 0,
          quantity: parseFloat(x.quantity) || 1,
        }));
      await db.entities.Client.update(clientId, { fixed_extras: clean });
      setExtras(clean);
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setExtrasEditing(false);
    } finally {
      setExtrasSaving(false);
    }
  };

  const handleExtrasCancel = () => {
    setExtras(client.fixed_extras || []);
    setExtrasEditing(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, logo_url: file_url }));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.entities.Client.update(clientId, form);
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      website: client.website || '',
      instagram: client.instagram || '',
      linkedin: client.linkedin || '',
      facebook: client.facebook || '',
      twitter: client.twitter || '',
      business_description: client.business_description || '',
      logo_url: client.logo_url || '',
      notes: client.notes || '',
    });
    setEditing(false);
  };

  const socialLinks = [
    { key: 'website', icon: Globe, label: 'Website', prefix: '' },
    { key: 'instagram', icon: Instagram, label: 'Instagram', prefix: 'https://instagram.com/' },
    { key: 'linkedin', icon: Linkedin, label: 'LinkedIn', prefix: '' },
    { key: 'facebook', icon: Facebook, label: 'Facebook', prefix: '' },
    { key: 'twitter', icon: Twitter, label: 'Twitter/X', prefix: 'https://twitter.com/' },
  ];

  return (
    <div className="space-y-5">
      {/* Logo & Business */}
      <Card className="p-6 bg-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-500 dark:text-blue-300" />
            Business Profile
          </h3>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="w-4 h-4 mr-1" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}Save
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-6 mb-5">
          {/* Logo */}
          <div className="flex-shrink-0">
            {form.logo_url || client.logo_url ? (
              <img
                src={form.logo_url || client.logo_url}
                alt="Logo"
                className="w-20 h-20 rounded-xl object-contain border border-border bg-muted p-1"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-2xl font-bold border border-border">
                {client.company?.[0] || client.name?.[0] || '?'}
              </div>
            )}
            {editing && (
              <label className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-300 cursor-pointer hover:underline">
                <Upload className="w-3 h-3" />
                {uploadingLogo ? 'Uploading...' : 'Upload logo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                />
              </label>
            )}
          </div>

          {/* Business Description */}
          <div className="flex-1">
            <Label className="text-sm text-muted-foreground">Business Description</Label>
            {editing ? (
              <Textarea
                value={form.business_description}
                onChange={(e) => setForm((f) => ({ ...f, business_description: e.target.value }))}
                rows={3}
                className="mt-1"
                placeholder="Describe the client's business..."
              />
            ) : (
              <p className="mt-1 text-foreground text-sm whitespace-pre-wrap">
                {client.business_description || (
                  <span className="text-muted-foreground italic">No description added</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Social & Web */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {socialLinks.map(({ key, icon: Icon, label }) => (
            <div key={key}>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Icon className="w-3 h-3" />
                {label}
              </Label>
              {editing ? (
                <Input
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1 h-8 text-sm"
                  placeholder={`${label} URL`}
                />
              ) : client[key] ? (
                <a
                  href={client[key].startsWith('http') ? client[key] : `https://${client[key]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-sm text-blue-600 dark:text-blue-300 hover:underline flex items-center gap-1 truncate"
                >
                  <Icon className="w-3 h-3 flex-shrink-0" />
                  {client[key]}
                </a>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground italic">Not set</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Internal Notes */}
      <Card className="p-6 bg-card">
        <h3 className="font-bold text-foreground text-lg mb-3">Internal Notes</h3>
        {editing ? (
          <Textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={5}
            placeholder="Add any internal notes about this client..."
          />
        ) : (
          <p className="text-foreground text-sm whitespace-pre-wrap">
            {client.notes || <span className="text-muted-foreground italic">No notes yet. Click Edit to add.</span>}
          </p>
        )}
      </Card>

      {/* Fixed Extras — optional add-ons offered when generating a booking from a Tour Contract for this client */}
      <Card className="p-6 bg-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500 dark:text-amber-300" />
            Fixed Extras
          </h3>
          {!extrasEditing ? (
            <Button variant="outline" size="sm" onClick={() => setExtrasEditing(true)}>
              <Edit2 className="w-4 h-4 mr-1" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleExtrasCancel}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleExtrasSave}
                disabled={extrasSaving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {extrasSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                Save
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Optional add-ons (e.g. hamam, private transfer) offered when generating a booking from a Tour Contract for
          this client.
        </p>

        {!extrasEditing ? (
          extras.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No fixed extras yet. Click Edit to add one.</p>
          ) : (
            <div className="space-y-2">
              {extras.map((x) => (
                <div key={x._key} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                  <span className="font-medium text-foreground">{x.name}</span>
                  <span className="text-muted-foreground">
                    {x.currency} {x.selling_price} / {x.unit?.replace('per_', '')}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">
            {extras.map((x) => (
              <div
                key={x._key}
                className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-2 items-center p-2 border border-border rounded-lg"
              >
                <Input
                  value={x.name}
                  onChange={(e) => updateExtra(x._key, 'name', e.target.value)}
                  placeholder="e.g., Hamam"
                  className="text-sm"
                />
                <Select value={x.supplier_id || ''} onValueChange={(v) => updateExtra(x._key, 'supplier_id', v)}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Supplier (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  value={x.acquiring_price}
                  onChange={(e) => updateExtra(x._key, 'acquiring_price', e.target.value)}
                  placeholder="Cost"
                  className="text-sm"
                  title="Supplier cost (for margin tracking)"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={x.selling_price}
                  onChange={(e) => updateExtra(x._key, 'selling_price', e.target.value)}
                  placeholder="Price"
                  className="text-sm"
                  title="Client price"
                />
                <Select value={x.currency} onValueChange={(v) => updateExtra(x._key, 'currency', v)}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['EUR', 'USD', 'GBP', 'TRY', 'AED'].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => removeExtra(x._key)}>
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addExtra}>
              <Plus className="w-4 h-4 mr-1" />
              Add Extra
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
