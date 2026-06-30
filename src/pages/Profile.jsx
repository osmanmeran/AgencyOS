const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Mail, Phone, Globe, Lock, Save, Loader2, CreditCard, Camera, X } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';
import { showSuccess, showError } from '@/lib/toast';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'tr', name: 'Türkçe' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'AED', 'SAR', 'EGP', 'MAD', 'JPY', 'CHF', 'CAD', 'AUD'];

export default function Profile() {
  const queryClient = useQueryClient();
  const { language, setLanguage } = useT();
  const fileInputRef = useRef(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || data.error || 'Failed to load profile');
      return data.user;
    },
  });

  const [form, setForm] = useState({ name: '', phone: '', language: 'en', default_currency: 'USD', avatar_url: '' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        language: user.language || 'en',
        default_currency: user.default_currency || 'USD',
        avatar_url: user.avatar_url || '',
      });
    }
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || json.error || 'Failed to update profile');
      return json;
    },
    onSuccess: (data) => {
      showSuccess('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      if (data.user?.language && data.user.language !== language) {
        setLanguage(data.user.language);
      }
    },
    onError: (err) => showError(err.message),
  });

  const updatePassword = useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || json.error || 'Failed to update password');
      return json;
    },
    onSuccess: () => {
      showSuccess('Password updated successfully');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    },
    onError: (err) => showError(err.message),
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showError('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { showError('Image must be under 5MB'); return; }

    setUploadingPhoto(true);
    try {
      const result = await db.integrations.Core.UploadFile({ file });
      const avatar_url = result.file_url;
      setForm(prev => ({ ...prev, avatar_url }));
      // Save immediately
      await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url }),
      });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      showSuccess('Profile photo updated');
    } catch (err) {
      showError('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    setForm(prev => ({ ...prev, avatar_url: '' }));
    await fetch('/api/auth/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_url: '' }),
    });
    queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    showSuccess('Profile photo removed');
  };

  const handleProfileSave = () => {
    updateProfile.mutate({
      name: form.name,
      phone: form.phone,
      language: form.language,
      default_currency: form.default_currency,
    });
  };

  const handlePasswordSave = () => {
    if (!passwordForm.current_password || !passwordForm.new_password) {
      showError('Please fill in current and new password');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showError('New passwords do not match');
      return;
    }
    if (passwordForm.new_password.length < 8) {
      showError('Password must be at least 8 characters');
      return;
    }
    updatePassword.mutate({
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password,
    });
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account settings</p>
      </div>

      {/* Avatar */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Camera className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Profile Photo</h2>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative group">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border">
                <span className="text-2xl font-bold text-primary">{initials}</span>
              </div>
            )}
            {uploadingPhoto && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}>
              <Camera className="w-4 h-4 mr-2" />
              {form.avatar_url ? 'Change Photo' : 'Upload Photo'}
            </Button>
            {form.avatar_url && (
              <Button variant="ghost" size="sm" onClick={handleRemovePhoto} className="text-destructive hover:text-destructive">
                <X className="w-4 h-4 mr-2" />
                Remove
              </Button>
            )}
            <p className="text-xs text-muted-foreground">JPG, PNG up to 5MB</p>
          </div>
        </div>
      </Card>

      {/* Contact Information */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Contact Information</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              Email
            </Label>
            <Input value={user?.email || ''} disabled className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Full Name
            </Label>
            <Input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Your name" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              Phone Number
            </Label>
            <Input value={form.phone} onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))} placeholder="+39 000 000 0000" />
          </div>
        </div>
      </Card>

      {/* Preferences */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Preferences</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={form.language} onValueChange={(val) => setForm(prev => ({ ...prev, language: val }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(lang => (
                  <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              Default Currency
            </Label>
            <Select value={form.default_currency} onValueChange={(val) => setForm(prev => ({ ...prev, default_currency: val }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleProfileSave} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      {/* Change Password */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Change Password</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Current Password</Label>
            <Input type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))} placeholder="Enter current password" />
          </div>
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))} placeholder="Min 8 chars, uppercase, number" />
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))} placeholder="Confirm new password" />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={handlePasswordSave} disabled={updatePassword.isPending}>
            {updatePassword.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
            Update Password
          </Button>
        </div>
      </Card>
    </div>
  );
}
