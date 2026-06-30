// const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Mail, Phone, Globe, Lock, Save, Loader2, CreditCard } from 'lucide-react';
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

  const { data: user, isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load profile');
      return data.user;
    },
  }));

  const [form, setForm] = useState({ name: '', phone: '', language: 'en', default_currency: 'USD' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        language: user.language || 'en',
        default_currency: user.default_currency || 'USD',
      });
    }
  }, [user]);

  const updateProfile = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ data) => {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to update profile');
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
  }));

  const updatePassword = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ data) => {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to update password');
      return json;
    },
    onSuccess: () => {
      showSuccess('Password updated successfully');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    },
    onError: (err) => showError(err.message),
  }));

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
    if (passwordForm.new_password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }
    updatePassword.mutate({
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account settings</p>
      </div>

      {/* Contact Information */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Contact Information</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" />
              Email
            </Label>
            <Input
              value={user?.email || ''}
              disabled
              className="bg-slate-50"
            />
            <p className="text-xs text-slate-400">Email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              Full Name
            </Label>
            <Input
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-400" />
              Phone Number
            </Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+1 234 567 890"
            />
          </div>
        </div>
      </Card>

      {/* Preferences */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Preferences</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={form.language} onValueChange={(val) => setForm(prev => ({ ...prev, language: val }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(lang => (
                  <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-slate-400" />
              Default Currency
            </Label>
            <Select value={form.default_currency} onValueChange={(val) => setForm(prev => ({ ...prev, default_currency: val }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Save Profile */}
      <div className="flex justify-end">
        <Button
          onClick={handleProfileSave}
          disabled={updateProfile.isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {updateProfile.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Change Password */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Change Password</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Current Password</Label>
            <Input
              type="password"
              value={passwordForm.current_password}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
              placeholder="Enter current password"
            />
          </div>
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input
              type="password"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
              placeholder="Enter new password"
            />
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
              placeholder="Confirm new password"
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button
            variant="outline"
            onClick={handlePasswordSave}
            disabled={updatePassword.isPending}
          >
            {updatePassword.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Lock className="w-4 h-4 mr-2" />
            )}
            Update Password
          </Button>
        </div>
      </Card>
    </div>
  );
}
