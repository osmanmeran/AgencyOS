/// <reference types="vite/client" />
import { db } from '@/lib/DbContext';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/components/permissions/PermissionContext';
import { PERMISSION_GROUPS, DEFAULT_TIER_PERMISSIONS } from '@/lib/permissions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Settings, Globe, Hash, Plus, X, Save, FileText, Mail, Loader2, CheckCircle2, AlertCircle, Shield, RotateCcw, ChevronDown, ChevronRight, Users, KeyRound } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/lib/i18n/I18nContext';
import { showSuccess, showError } from '@/lib/toast';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'tr', name: 'Türkçe' }
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'AED', 'SAR', 'EGP', 'MAD', 'JPY', 'CHF', 'CAD', 'AUD'];

const TIERS = ['admin', 'manager', 'accounting', 'agent'];
const TIER_LABELS = {
  admin: { label: 'Tier 1 - Administrator', color: 'bg-red-100 text-red-800', description: 'Full control: manage users, permissions, app branding, all data' },
  manager: { label: 'Tier 2 - Manager', color: 'bg-purple-100 text-purple-800', description: 'Modify/cancel trips & invoices, create suppliers/clients, manage categories' },
  agent: { label: 'Tier 3 - Agent', color: 'bg-blue-100 text-blue-800', description: 'Create trips/invoices/proposals, add pricing, modify basic supplier info' },
  accounting: { label: 'Tier 4 - Accounting', color: 'bg-green-100 text-green-800', description: 'Search by reference, review invoices, view reports' }
};

const PERMISSION_TIERS = [
  { key: 'admin', label: 'Administrator', color: 'bg-red-100 text-red-800', desc: 'Full system control' },
  { key: 'manager', label: 'Manager', color: 'bg-purple-100 text-purple-800', desc: 'Manage operations' },
  { key: 'agent', label: 'Agent', color: 'bg-blue-100 text-blue-800', desc: 'Daily operations' },
  { key: 'accounting', label: 'Accounting', color: 'bg-green-100 text-green-800', desc: 'Finance & reports' },
];

const PASSWORD_HINT = 'At least 8 characters, with an uppercase letter, a lowercase letter, and a number.';

function passwordError(pw) {
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw)) return 'Password must contain an uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must contain a lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain a number';
  return null;
}

const DEPARTMENT_COLORS = [
  'bg-amber-100 text-amber-800',
  'bg-emerald-100 text-emerald-800',
  'bg-indigo-100 text-indigo-800',
  'bg-cyan-100 text-cyan-800',
  'bg-rose-100 text-rose-800',
  'bg-violet-100 text-violet-800',
  'bg-orange-100 text-orange-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
  'bg-lime-100 text-lime-800',
];

export default function AppSettings() {
  const queryClient = useQueryClient();
  const { user: currentUser, refreshUser } = useAuth();
  const { hasPermission, user } = usePermissions();
  const { t } = useT();
  const [activeTab, setActiveTab] = useState('general');
  const [newDepartment, setNewDepartment] = useState('');
  const [outlookStatus, setOutlookStatus] = useState({ connected: false, email: '', name: '' });
  const [outlookLoading, setOutlookLoading] = useState(true);
  const [formData, setFormData] = useState({
    app_name: 'TravelPro',
    logo_url: '',
    default_language: 'en',
    reference_format: {
      include_department: true,
      include_category: true,
      include_year: true,
      include_client: false,
      prefix: 'TRP'
    },
    departments: [],
    invoice_header: {
      company_name: '', address_line1: '', address_line2: '', city: '', country: '',
      postal_code: '', phone: '', email: '', tax_id: '', bank_details: '', logo_url: ''
    },
    default_payment_terms: 'Due within 30 days',
    default_invoice_notes: ''
  });

  const { data: settings } = /** @type {any} */ (useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => {
      const all = await db.entities.AppSettings.list();
      return all[0] || {};
    }
  }));

  useEffect(() => {
    if (settings) {
      setFormData({
        app_name: settings.app_name || 'TravelPro',
        logo_url: settings.logo_url || '',
        default_language: settings.default_language || 'en',
        reference_format: settings.reference_format || {
          include_department: true, include_category: true, include_year: true, include_client: false, prefix: 'TRP'
        },
        departments: settings.departments || [],
        invoice_header: settings.invoice_header || {
          company_name: '', address_line1: '', address_line2: '', city: '', country: '',
          postal_code: '', phone: '', email: '', tax_id: '', bank_details: '', logo_url: ''
        },
        default_payment_terms: settings.default_payment_terms || 'Due within 30 days',
        default_invoice_notes: settings.default_invoice_notes || ''
      });
    }
  }, [settings]);

  const apiFetch = async (path, opts = {}) => {
    const headers = { 'Content-Type': 'application/json', ...opts.headers };
    const res = await fetch('/api' + path, { ...opts, headers, credentials: 'include' });
    return res.json();
  };

  useEffect(() => {
    apiFetch('/integrations/outlook/status')
      .then(data => {
        setOutlookStatus({ connected: data.connected, email: data.email || '', name: data.name || '' });
        setOutlookLoading(false);
      })
      .catch(() => setOutlookLoading(false));
  }, []);

  const connectOutlook = () => {
    const state = crypto.randomUUID();
    const codeVerifier = crypto.randomUUID();
    const encoder = new TextEncoder();
    crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier)).then(buffer => {
      const base64Url = btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const redirectUri = window.location.origin + '/auth/outlook-callback';
      const authUrl =
        'https://login.microsoftonline.com/' + (import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common') + '/oauth2/v2.0/authorize' +
        '?client_id=' + encodeURIComponent(import.meta.env.VITE_MICROSOFT_CLIENT_ID) +
        '&response_type=code' +
        '&redirect_uri=' + encodeURIComponent(redirectUri) +
        '&scope=' + encodeURIComponent('https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access') +
        '&state=' + encodeURIComponent(state) +
        '&code_challenge=' + encodeURIComponent(base64Url) +
        '&code_challenge_method=S256';
      sessionStorage.setItem('outlook_oauth_state', state);
      sessionStorage.setItem('outlook_oauth_verifier', codeVerifier);
      sessionStorage.setItem('outlook_oauth_redirect', redirectUri);
      sessionStorage.setItem('outlook_oauth_tenant', import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common');
      sessionStorage.setItem('outlook_oauth_client_id', import.meta.env.VITE_MICROSOFT_CLIENT_ID);
      window.location.href = authUrl;
    });
  };

  const disconnectOutlook = () => {
    apiFetch('/integrations/outlook/disconnect', { method: 'POST' })
      .then(() => setOutlookStatus({ connected: false, email: '', name: '' }))
      .catch(() => {});
  };

  const saveSettingsMutation = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ data) => {
      const cleanInvoiceHeader = {};
      Object.entries(data.invoice_header || {}).forEach(([key, value]) => {
        if (value && typeof value === 'string' && value.trim() !== '') {
          cleanInvoiceHeader[key] = value.trim();
        } else if (value && typeof value !== 'string') {
          cleanInvoiceHeader[key] = value;
        }
      });
      const cleanData = {
        app_name: data.app_name || 'TravelPro',
        default_language: data.default_language || 'en',
        reference_format: {
          include_department: Boolean(data.reference_format?.include_department),
          include_category: Boolean(data.reference_format?.include_category),
          include_year: Boolean(data.reference_format?.include_year),
          include_client: Boolean(data.reference_format?.include_client),
          prefix: data.reference_format?.prefix || 'TRP'
        },
        departments: data.departments || []
      };
      if (Object.keys(cleanInvoiceHeader).length > 0) cleanData.invoice_header = cleanInvoiceHeader;
      if (data.logo_url && data.logo_url.trim()) cleanData.logo_url = data.logo_url.trim();
      if (data.default_payment_terms && data.default_payment_terms.trim()) cleanData.default_payment_terms = data.default_payment_terms.trim();
      if (data.default_invoice_notes && data.default_invoice_notes.trim()) cleanData.default_invoice_notes = data.default_invoice_notes.trim();
      if (settings?.id) {
        return db.entities.AppSettings.update(settings.id, cleanData);
      } else {
        return db.entities.AppSettings.create(cleanData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      showSuccess('Settings saved', 'Your changes have been saved successfully');
    },
    onError: (error) => {
      showError('Failed to save settings', error.message || 'Unknown error');
    }
  }));

  const updateUserLanguage = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ language) => db.auth.updateMe({ language }),
    onSuccess: () => { refreshUser(); window.location.reload(); }
  }));

  const updateUserCurrency = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ default_currency) => db.auth.updateMe({ default_currency }),
    onSuccess: () => { refreshUser(); showSuccess('Currency updated', 'Default currency saved'); },
    onError: (err) => showError('Failed to update currency', err.message)
  }));

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, logo_url: file_url });
    }
  };

  const addDepartment = () => {
    if (newDepartment && !formData.departments.includes(newDepartment)) {
      setFormData({ ...formData, departments: [...formData.departments, newDepartment] });
      setNewDepartment('');
    }
  };

  const removeDepartment = (dept) => {
    setFormData({ ...formData, departments: formData.departments.filter(d => d !== dept) });
  };

  const generateSampleReference = () => {
    const { prefix, include_department, include_year, include_category } = formData.reference_format;
    let ref = prefix;
    if (include_department && formData.departments.length > 0) ref += `-${formData.departments[0]?.slice(0, 3).toUpperCase()}`;
    if (include_category) ref += '-LEI';
    if (include_year) ref += `-${new Date().getFullYear()}`;
    ref += '-0001';
    return ref;
  };

  // --- User Management State ---
  const [users, setUsers] = useState([]);
  const [_usersLoading, setUsersLoading] = useState(true);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserUserSuccess] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editTier, setEditTier] = useState('');
  const [editName, setEditName] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editPermissions, setEditPermissions] = useState([]);
  const [editDepartments, setEditDepartments] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', user_tier: 'agent' });
  const [addPermissions, setAddPermissions] = useState([]);
  const [addDepartments, setAddDepartments] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [departmentsList, setDepartmentsList] = useState([]);

  const deptColor = (name) => {
    const idx = departmentsList.indexOf(name);
    return idx >= 0 ? DEPARTMENT_COLORS[idx % DEPARTMENT_COLORS.length] : 'bg-slate-100 text-slate-600';
  };

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await db.auth.users();
      setUsers(data);
    } catch (err) { setUserError(err.message); }
    setUsersLoading(false);
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const all = await db.entities.AppSettings.list();
      const s = all[0];
      if (s?.departments) setDepartmentsList(s.departments);
      else setDepartmentsList(['Luxury', 'Adventure', 'Corporate', 'Cruise']);
    } catch { setDepartmentsList(['Luxury', 'Adventure', 'Corporate', 'Cruise']); }
  }, []);

  useEffect(() => { loadUsers(); loadDepartments(); }, [loadUsers, loadDepartments]);

  const clearUserMsg = () => { setUserError(''); setUserUserSuccess(''); };

  const openEditModal = (u) => {
    setSelectedUser(u);
    setEditTier(u.user_tier);
    setEditName(u.name);
    setEditActive(u.is_active);
    setEditPermissions(u.custom_permissions || []);
    setEditDepartments(u.departments || []);
  };

  const toggleEditPermission = (key) => setEditPermissions(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const toggleEditDepartment = (key) => setEditDepartments(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    clearUserMsg();
    try {
      const updated = await db.auth.updateUser(selectedUser.id, { name: editName, user_tier: editTier, is_active: editActive, custom_permissions: editPermissions, departments: editDepartments });
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, ...updated } : u));
      setSelectedUser(null);
      setUserUserSuccess('User updated');
    } catch (err) { setUserError(err.message); }
  };

  const handleApprove = async (u) => {
    clearUserMsg();
    try {
      const updated = await db.auth.updateUser(u.id, { is_active: true });
      setUsers(users.map(x => x.id === u.id ? { ...x, ...updated } : x));
      setUserUserSuccess(`"${u.name}" approved`);
    } catch (err) { setUserError(err.message); }
  };

  const handleDeny = async (u) => {
    clearUserMsg();
    try {
      await db.auth.deleteUser(u.id);
      setUsers(users.filter(x => x.id !== u.id));
      setUserUserSuccess(`"${u.name}" denied and removed`);
    } catch (err) { setUserError(err.message); }
  };

  const handleDelete = async (id) => {
    clearUserMsg();
    try {
      await db.auth.deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
      setConfirmDelete(null);
      setUserUserSuccess('User deleted');
    } catch (err) { setUserError(err.message); }
  };

  const toggleAddPermission = (key) => setAddPermissions(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const toggleAddDepartment = (key) => setAddDepartments(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    clearUserMsg();
    if (!addForm.name || !addForm.email || !addForm.password) { setUserError('All fields required'); return; }
    const addPwErr = passwordError(addForm.password);
    if (addPwErr) { setUserError(addPwErr); return; }
    try {
      const created = await db.auth.createUser({ ...addForm, custom_permissions: addPermissions, departments: addDepartments });
      setUsers([...users, created]);
      setShowAddForm(false);
      setAddForm({ name: '', email: '', password: '', user_tier: 'agent' });
      setAddPermissions([]);
      setAddDepartments([]);
      setUserUserSuccess(`User "${created.name}" created`);
    } catch (err) { setUserError(err.message); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    clearUserMsg();
    if (passwordForm.new_password !== passwordForm.confirm) { setUserError('Passwords do not match'); return; }
    const changePwErr = passwordError(passwordForm.new_password);
    if (changePwErr) { setUserError(changePwErr); return; }
    try {
      await db.auth.updateMe({ current_password: passwordForm.current_password, new_password: passwordForm.new_password });
      setPasswordForm({ current_password: '', new_password: '', confirm: '' });
      setShowPassword(false);
      setUserUserSuccess('Password changed');
    } catch (err) { setUserError(err.message); }
  };

  // --- Permissions State ---
  const [tierPerms, setTierPerms] = useState(/** @type {any} */ ({}));
  const [expandedGroups, setExpandedGroups] = useState(new Set(PERMISSION_GROUPS.map(g => g.key)));
  const [permDirty, setPermDirty] = useState(false);
  const [selectedTier, setSelectedTier] = useState('agent');

  useEffect(() => {
    if (activeTab !== 'permissions') return;
    if (settings?.tier_permissions) {
      setTierPerms(settings.tier_permissions);
    } else {
      setTierPerms(JSON.parse(JSON.stringify(DEFAULT_TIER_PERMISSIONS)));
    }
  }, [settings, activeTab]);

  const savePermMutation = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ data) => {
      const cleanData = { ...settings, tier_permissions: data };
      if (settings?.id) {
        return db.entities.AppSettings.update(settings.id, cleanData);
      } else {
        return db.entities.AppSettings.create(cleanData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      setPermDirty(false);
      showSuccess('Permissions saved', 'Tier permissions have been updated');
    },
    onError: (err) => showError('Failed to save', err.message),
  }));

  const toggleGroup = (key) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpandedGroups(next);
  };

  const toggleTierPermission = (tier, permKey) => {
    setTierPerms(prev => {
      const current = prev[tier] || [];
      const updated = current.includes(permKey) ? current.filter(k => k !== permKey) : [...current, permKey];
      return { ...prev, [tier]: updated };
    });
    setPermDirty(true);
  };

  const setAllForTier = (tier, value) => {
    setTierPerms(prev => {
      const allKeys = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));
      return { ...prev, [tier]: value ? [...allKeys] : [] };
    });
    setPermDirty(true);
  };

  const resetToDefaults = () => {
    setTierPerms(JSON.parse(JSON.stringify(DEFAULT_TIER_PERMISSIONS)));
    setPermDirty(true);
  };

  const hasAllInGroup = (tier, group) => {
    const tierList = tierPerms[tier] || [];
    return group.permissions.every(p => tierList.includes(p.key));
  };

  const toggleGroupForTier = (tier, group) => {
    const allInGroup = hasAllInGroup(tier, group);
    setTierPerms(prev => {
      const current = prev[tier] || [];
      const without = current.filter(k => !group.permissions.find(p => p.key === k));
      const updated = allInGroup ? without : [...without, ...group.permissions.map(p => p.key)];
      return { ...prev, [tier]: updated };
    });
    setPermDirty(true);
  };

  if (!hasPermission('manage_app_settings')) {
    return (
      <Card className="p-12 text-center">
        <Settings className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">{t('common.accessDenied')}</h3>
        <p className="text-slate-600">{t('settings.accessDenied')}</p>
      </Card>
    );
  }

  const tabs = [
    { key: 'general', label: 'General', icon: Settings },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'permissions', label: 'Permissions', icon: KeyRound },
    { key: 'integrations', label: 'Integrations', icon: Mail },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">{t('settings.title')}</h1>
        <p className="text-slate-600">{t('settings.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 gap-0 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors shrink-0 ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ==================== GENERAL TAB ==================== */}
      {activeTab === 'general' && (
        <div className="space-y-8">
          {/* Branding */}
          <Card className="p-6 bg-white">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{t('settings.branding')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>{t('settings.appName')}</Label>
                <Input value={formData.app_name} onChange={(e) => setFormData({ ...formData, app_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.logo')}</Label>
                <div className="flex items-center gap-4">
                  {formData.logo_url && <img src={formData.logo_url} alt="Logo" className="w-12 h-12 object-contain" />}
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} />
                </div>
              </div>
            </div>
          </Card>

          {/* Language & Currency */}
          <Card className="p-6 bg-white">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5" /> {t('settings.language')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>{t('settings.defaultLanguage')}</Label>
                <Select value={formData.default_language} onValueChange={(v) => setFormData({ ...formData, default_language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('settings.yourLanguage')}</Label>
                <Select value={user?.language || 'en'} onValueChange={(v) => updateUserLanguage.mutate(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Select value={user?.default_currency || 'USD'} onValueChange={(v) => updateUserCurrency.mutate(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400">Used as default in new reservations</p>
              </div>
            </div>
          </Card>

          {/* Reference Number Format */}
          <Card className="p-6 bg-white">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Hash className="w-5 h-5" /> {t('settings.referenceFormat')}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>{t('settings.prefix')}</Label>
                  <Input value={formData.reference_format.prefix} maxLength={5}
                    onChange={(e) => setFormData({ ...formData, reference_format: { ...formData.reference_format, prefix: e.target.value.toUpperCase() } })} />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch checked={formData.reference_format.include_department}
                    onCheckedChange={(v) => setFormData({ ...formData, reference_format: { ...formData.reference_format, include_department: v } })} />
                  <Label>{t('settings.includeDepartment')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch checked={formData.reference_format.include_category}
                    onCheckedChange={(v) => setFormData({ ...formData, reference_format: { ...formData.reference_format, include_category: v } })} />
                  <Label>{t('settings.includeCategory')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch checked={formData.reference_format.include_year}
                    onCheckedChange={(v) => setFormData({ ...formData, reference_format: { ...formData.reference_format, include_year: v } })} />
                  <Label>{t('settings.includeYear')}</Label>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <Label className="text-sm text-slate-600">{t('settings.sampleReference')}:</Label>
                <div className="text-xl font-mono font-bold text-blue-600 mt-1">{generateSampleReference()}</div>
              </div>
            </div>
          </Card>

          {/* Invoice Header */}
          <Card className="p-6 bg-white">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" /> {t('settings.invoiceHeader')}
            </h3>
            <p className="text-sm text-slate-500 mb-4">{t('settings.invoiceHeaderHint')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('settings.companyName')}</Label>
                <Input value={formData.invoice_header.company_name}
                  onChange={(e) => setFormData({ ...formData, invoice_header: { ...formData.invoice_header, company_name: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.taxId')}</Label>
                <Input value={formData.invoice_header.tax_id}
                  onChange={(e) => setFormData({ ...formData, invoice_header: { ...formData.invoice_header, tax_id: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.addressLine1')}</Label>
                <Input value={formData.invoice_header.address_line1}
                  onChange={(e) => setFormData({ ...formData, invoice_header: { ...formData.invoice_header, address_line1: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.addressLine2')}</Label>
                <Input value={formData.invoice_header.address_line2}
                  onChange={(e) => setFormData({ ...formData, invoice_header: { ...formData.invoice_header, address_line2: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.city')}</Label>
                <Input value={formData.invoice_header.city}
                  onChange={(e) => setFormData({ ...formData, invoice_header: { ...formData.invoice_header, city: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.postalCode')}</Label>
                <Input value={formData.invoice_header.postal_code}
                  onChange={(e) => setFormData({ ...formData, invoice_header: { ...formData.invoice_header, postal_code: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.country')}</Label>
                <Input value={formData.invoice_header.country}
                  onChange={(e) => setFormData({ ...formData, invoice_header: { ...formData.invoice_header, country: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>{t('common.phone')}</Label>
                <Input value={formData.invoice_header.phone}
                  onChange={(e) => setFormData({ ...formData, invoice_header: { ...formData.invoice_header, phone: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>{t('common.email')}</Label>
                <Input type="email" value={formData.invoice_header.email}
                  onChange={(e) => setFormData({ ...formData, invoice_header: { ...formData.invoice_header, email: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.invoiceLogo')}</Label>
                <Input type="file" accept="image/*" onChange={async (e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const { file_url } = await db.integrations.Core.UploadFile({ file });
                    setFormData({ ...formData, invoice_header: { ...formData.invoice_header, logo_url: file_url } });
                  }
                }} />
                {formData.invoice_header.logo_url && <img src={formData.invoice_header.logo_url} alt="Invoice Logo" className="w-20 h-20 object-contain mt-2" />}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label>{t('settings.bankDetails')}</Label>
              <Textarea value={formData.invoice_header.bank_details} rows={2}
                placeholder={t('settings.bankDetailsPlaceholder')}
                onChange={(e) => setFormData({ ...formData, invoice_header: { ...formData.invoice_header, bank_details: e.target.value } })} />
            </div>
          </Card>

          {/* Default Invoice Settings */}
          <Card className="p-6 bg-white">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{t('settings.defaultInvoiceSettings')}</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('settings.defaultPaymentTerms')}</Label>
                <Input value={formData.default_payment_terms}
                  onChange={(e) => setFormData({ ...formData, default_payment_terms: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.defaultNotes')}</Label>
                <Textarea value={formData.default_invoice_notes} rows={3}
                  placeholder={t('settings.defaultNotesPlaceholder')}
                  onChange={(e) => setFormData({ ...formData, default_invoice_notes: e.target.value })} />
              </div>
            </div>
          </Card>

          {/* Departments */}
          <Card className="p-6 bg-white">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{t('settings.departments')}</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {formData.departments.map(dept => (
                <Badge key={dept} variant="secondary" className="px-3 py-1">
                  {dept}
                  <button onClick={() => removeDepartment(dept)} className="ml-2"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Input placeholder={t('settings.newDepartment')} value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addDepartment()} />
              <Button onClick={addDepartment} variant="outline"><Plus className="w-4 h-4" /></Button>
            </div>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={() => saveSettingsMutation.mutate(formData)} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" /> {t('settings.saveSettings')}
            </Button>
          </div>
        </div>
      )}

      {/* ==================== USERS TAB ==================== */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">User Management</h2>
              <p className="text-slate-600">Manage user roles, permissions, and credentials</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowPassword(!showPassword)} className="px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                {showPassword ? 'Cancel' : 'Change My Password'}
              </button>
              <button onClick={() => setShowAddForm(!showAddForm)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {showAddForm ? 'Cancel' : '+ Add User'}
              </button>
            </div>
          </div>

          {userError && <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg">{userError}</div>}
          {userSuccess && <div className="p-4 bg-green-50 text-green-600 text-sm rounded-lg">{userSuccess}</div>}

          {showPassword && (
            <form onSubmit={handleChangePassword} className="p-5 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-semibold text-slate-700 mb-3">Change Your Password</h3>
              <div className="grid grid-cols-3 gap-3">
                <input type="password" placeholder="Current password" value={passwordForm.current_password} onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })} required className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input type="password" placeholder="New password" value={passwordForm.new_password} onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })} required className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input type="password" placeholder="Confirm new password" value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })} required className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">{PASSWORD_HINT}</p>
              <button type="submit" className="mt-3 px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">Update Password</button>
            </form>
          )}

          {showAddForm && (
            <form onSubmit={handleAddUser} className="p-5 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-semibold text-slate-700 mb-3">Add New User</h3>
              <div className="grid grid-cols-4 gap-3">
                <input type="text" placeholder="Full name" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} required className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input type="email" placeholder="Email" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} required className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input type="password" placeholder="Password" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} required className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <select value={addForm.user_tier} onChange={e => setAddForm({ ...addForm, user_tier: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  {TIERS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Password: {PASSWORD_HINT}</p>
              <div className="mt-3">
                <p className="text-sm font-medium text-slate-700 mb-2">Custom Permissions <span className="text-xs text-slate-400 font-normal">(optional additions)</span></p>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {PERMISSION_GROUPS.map(group => (
                    <div key={group.key}>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{group.label}</p>
                      <div className="flex flex-wrap gap-1">
                        {group.permissions.map(p => (
                          <label key={p.key} className={`flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer select-none ${addPermissions.includes(p.key) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                            <input type="checkbox" checked={addPermissions.includes(p.key)} onChange={() => toggleAddPermission(p.key)} className="sr-only" />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <p className="text-sm font-medium text-slate-700 mb-2">Departments</p>
                <div className="flex flex-wrap gap-2">
                  {departmentsList.map(d => (
                    <label key={d} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none ${addDepartments.includes(d) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                      <input type="checkbox" checked={addDepartments.includes(d)} onChange={() => toggleAddDepartment(d)} className="sr-only" />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Create User</button>
            </form>
          )}

          {/* Tier cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(TIER_LABELS).map(([tier, { label, color, description }]) => (
              <div key={tier} className="p-4 bg-white rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{label}</span>
                  <span className="text-2xl font-bold">{users.filter(u => u.user_tier === tier).length}</span>
                </div>
                <p className="text-xs text-slate-400">{description}</p>
              </div>
            ))}
          </div>

          {/* Pending users */}
          {users.filter(u => !u.is_active).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                <h3 className="font-semibold text-amber-800 text-sm">Pending Approval</h3>
                <span className="text-xs text-amber-600">({users.filter(u => !u.is_active).length} users)</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-amber-100/50">
                    <th className="text-left px-4 py-2 font-medium text-amber-700">Name</th>
                    <th className="text-left px-4 py-2 font-medium text-amber-700">Email</th>
                    <th className="text-left px-4 py-2 font-medium text-amber-700">Signed up</th>
                    <th className="text-right px-4 py-2 font-medium text-amber-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => !u.is_active).map(u => (
                    <tr key={u.id} className="border-b border-amber-100 hover:bg-amber-50/50">
                      <td className="px-4 py-2.5 font-medium text-amber-900">{u.name}</td>
                      <td className="px-4 py-2.5 text-amber-700">{u.email}</td>
                      <td className="px-4 py-2.5 text-amber-600 text-xs">{u.created_date ? new Date(u.created_date).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => handleApprove(u)} className="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 mr-1">Approve</button>
                        <button onClick={() => handleDeny(u)} className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600">Deny</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Users table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tier</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Departments</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.is_active || u.id === currentUser?.id).map(u => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{u.name}</span>
                      {u.id === currentUser?.id && <span className="ml-2 text-xs text-blue-600">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIER_LABELS[u.user_tier]?.color || 'bg-slate-100 text-slate-600'}`}>
                        {u.user_tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(u.departments || []).map(d => <span key={d} className={`text-xs px-1.5 py-0.5 rounded ${deptColor(d)}`}>{d}</span>)}
                        {(!u.departments || u.departments.length === 0) && <span className="text-xs text-slate-400">&mdash;</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${u.is_active ? 'text-green-600' : 'text-red-500'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEditModal(u)} className="px-3 py-1 bg-white border border-slate-300 text-slate-600 text-xs rounded hover:bg-slate-50 mr-1">Edit</button>
                      {u.id !== currentUser?.id && u.user_tier !== 'admin' && (
                        <button onClick={() => setConfirmDelete(u)} className="px-3 py-1 bg-white border border-red-200 text-red-500 text-xs rounded hover:bg-red-50">Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.filter(u => u.is_active || u.id === currentUser?.id).length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Edit modal */}
          {selectedUser && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSelectedUser(null)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Edit User: {selectedUser.name}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">User Tier / Role</label>
                    <select value={editTier} onChange={e => setEditTier(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" disabled={selectedUser.user_tier === 'admin' && selectedUser.id !== currentUser?.id}>
                      {TIERS.map(t => <option key={t} value={t}>{TIER_LABELS[t]?.label || t}</option>)}
                    </select>
                    {selectedUser.user_tier === 'admin' && selectedUser.id !== currentUser?.id && <p className="text-xs text-amber-600 mt-1">Cannot change another admin's tier</p>}
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} className="rounded" />
                      <span className="text-sm text-slate-700">Account active</span>
                    </label>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">Custom Permissions <span className="text-xs text-slate-400 ml-2 font-normal">(additional capabilities beyond tier defaults)</span></p>
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {PERMISSION_GROUPS.map(group => (
                        <div key={group.key}>
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{group.label}</p>
                          <div className="flex flex-wrap gap-1">
                            {group.permissions.map(p => (
                              <label key={p.key} title={p.description}
                                className={`flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer select-none ${editPermissions.includes(p.key) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                                <input type="checkbox" checked={editPermissions.includes(p.key)} onChange={() => toggleEditPermission(p.key)} className="sr-only" />
                                {p.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">Departments</p>
                    <div className="flex flex-wrap gap-1.5">
                      {departmentsList.map(d => (
                        <label key={d} className={`flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer select-none ${editDepartments.includes(d) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                          <input type="checkbox" checked={editDepartments.includes(d)} onChange={() => toggleEditDepartment(d)} className="sr-only" />
                          {d}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setSelectedUser(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button onClick={handleSaveUser} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delete confirmation */}
          {confirmDelete && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Delete User</h3>
                <p className="text-sm text-slate-600 mb-4">Are you sure you want to delete <strong>{confirmDelete.name}</strong> ({confirmDelete.email})? This cannot be undone.</p>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                  <button onClick={() => handleDelete(confirmDelete.id)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== PERMISSIONS TAB ==================== */}
      {activeTab === 'permissions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Permission Manager</h2>
                <p className="text-sm text-slate-500">Configure what each user tier can do</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={resetToDefaults}>
                <RotateCcw className="w-4 h-4 mr-1" /> Reset Defaults
              </Button>
              <Button size="sm" onClick={() => savePermMutation.mutate(tierPerms)} disabled={!permDirty || savePermMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {savePermMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save Changes
              </Button>
            </div>
          </div>

          {permDirty && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <span className="w-2 h-2 bg-amber-500 rounded-full" />
              Unsaved changes &mdash; click "Save Changes" to apply
            </div>
          )}

          {/* Tier selector */}
          <div className="flex gap-2 flex-wrap">
            {PERMISSION_TIERS.map(t => (
              <button key={t.key} onClick={() => setSelectedTier(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  selectedTier === t.key
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}>
                <Shield className="w-4 h-4" />
                <span>{t.label}</span>
                <Badge variant="secondary" className="ml-1 text-xs">{tierPerms[selectedTier]?.length || 0}</Badge>
              </button>
            ))}
          </div>

          {/* Permission groups for selected tier */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-slate-800">
                {PERMISSION_TIERS.find(t => t.key === selectedTier)?.label || selectedTier}
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setAllForTier(selectedTier, true)}>Select All</Button>
                <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setAllForTier(selectedTier, false)}>Deselect All</Button>
              </div>
            </div>

            {PERMISSION_GROUPS.map(group => {
              const isExpanded = expandedGroups.has(group.key);
              const allChecked = hasAllInGroup(selectedTier, group);
              return (
                <Card key={group.key} className="overflow-hidden">
                  <button onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      <span className="font-semibold text-slate-800 text-sm">{group.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {(tierPerms[selectedTier] || []).filter(k => group.permissions.some(p => p.key === k)).length}/{group.permissions.length}
                      </Badge>
                      {allChecked && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    </div>
                    <Switch checked={allChecked} onCheckedChange={() => toggleGroupForTier(selectedTier, group)} onClick={e => e.stopPropagation()} />
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-100 px-5 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.permissions.map(perm => {
                          const checked = (tierPerms[selectedTier] || []).includes(perm.key);
                          return (
                            <label key={perm.key}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${checked ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                              <Switch checked={checked} onCheckedChange={() => toggleTierPermission(selectedTier, perm.key)} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800">{perm.label}</p>
                                <p className="text-xs text-slate-400 truncate">{perm.description}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== INTEGRATIONS TAB ==================== */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <Card className="p-6 bg-white">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Outlook / Microsoft 365
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Connect your Microsoft 365 account to send emails directly from the app.
            </p>
            {outlookLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking connection status...
              </div>
            ) : outlookStatus.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Connected as</p>
                    <p className="text-sm text-green-700">{outlookStatus.name} ({outlookStatus.email})</p>
                  </div>
                </div>
                <Button onClick={disconnectOutlook} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                  <X className="w-4 h-4 mr-2" /> Disconnect Outlook
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <p className="text-sm text-slate-600">Not connected. Click below to sign in with your Microsoft account.</p>
                </div>
                <Button onClick={connectOutlook} className="bg-blue-600 hover:bg-blue-700">
                  <Mail className="w-4 h-4 mr-2" /> Connect Outlook
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
