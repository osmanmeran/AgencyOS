const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Globe, Instagram, Linkedin, Facebook, Twitter, Building, Upload, Loader2, Edit2, Check, X } from 'lucide-react';

import { useQueryClient } from '@tanstack/react-query';

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

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, logo_url: file_url }));
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
      <Card className="p-6 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2"><Building className="w-5 h-5 text-blue-500" />Business Profile</h3>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Edit2 className="w-4 h-4 mr-1" />Edit</Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCancel}><X className="w-4 h-4 mr-1" />Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}Save
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-6 mb-5">
          {/* Logo */}
          <div className="flex-shrink-0">
            {(form.logo_url || client.logo_url) ? (
              <img src={form.logo_url || client.logo_url} alt="Logo" className="w-20 h-20 rounded-xl object-contain border border-slate-200 bg-slate-50 p-1" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-2xl font-bold border border-slate-200">
                {client.company?.[0] || client.name?.[0] || '?'}
              </div>
            )}
            {editing && (
              <label className="mt-2 flex items-center gap-1 text-xs text-blue-600 cursor-pointer hover:underline">
                <Upload className="w-3 h-3" />
                {uploadingLogo ? 'Uploading...' : 'Upload logo'}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
              </label>
            )}
          </div>

          {/* Business Description */}
          <div className="flex-1">
            <Label className="text-sm text-slate-500">Business Description</Label>
            {editing ? (
              <Textarea
                value={form.business_description}
                onChange={e => setForm(f => ({ ...f, business_description: e.target.value }))}
                rows={3}
                className="mt-1"
                placeholder="Describe the client's business..."
              />
            ) : (
              <p className="mt-1 text-slate-700 text-sm whitespace-pre-wrap">{client.business_description || <span className="text-slate-400 italic">No description added</span>}</p>
            )}
          </div>
        </div>

        {/* Social & Web */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {socialLinks.map(({ key, icon: Icon, label }) => (
            <div key={key}>
              <Label className="text-xs text-slate-500 flex items-center gap-1"><Icon className="w-3 h-3" />{label}</Label>
              {editing ? (
                <Input
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="mt-1 h-8 text-sm"
                  placeholder={`${label} URL`}
                />
              ) : client[key] ? (
                <a href={client[key].startsWith('http') ? client[key] : `https://${client[key]}`} target="_blank" rel="noopener noreferrer"
                  className="mt-1 text-sm text-blue-600 hover:underline flex items-center gap-1 truncate">
                  <Icon className="w-3 h-3 flex-shrink-0" />{client[key]}
                </a>
              ) : (
                <p className="mt-1 text-sm text-slate-400 italic">Not set</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Internal Notes */}
      <Card className="p-6 bg-white">
        <h3 className="font-bold text-slate-900 text-lg mb-3">Internal Notes</h3>
        {editing ? (
          <Textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={5}
            placeholder="Add any internal notes about this client..."
          />
        ) : (
          <p className="text-slate-700 text-sm whitespace-pre-wrap">{client.notes || <span className="text-slate-400 italic">No notes yet. Click Edit to add.</span>}</p>
        )}
      </Card>
    </div>
  );
}