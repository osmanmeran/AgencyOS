/// <reference types="vite/client" />
import { db } from '@/lib/DbContext';

import { useState, useEffect } from 'react';
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
import {
  Settings,
  Globe,
  Hash,
  Plus,
  X,
  Save,
  FileText,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  KeyRound,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
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

const PERMISSION_TIERS = [
  {
    key: 'admin',
    label: 'Administrator',
    color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
    desc: 'Full system control',
  },
  {
    key: 'manager',
    label: 'Manager',
    color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300',
    desc: 'Manage operations',
  },
  {
    key: 'agent',
    label: 'Agent',
    color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
    desc: 'Daily operations',
  },
  {
    key: 'accounting',
    label: 'Accounting',
    color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
    desc: 'Finance & reports',
  },
];

export default function AppSettings() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
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
      prefix: 'TRP',
    },
    departments: [],
    invoice_header: {
      company_name: '',
      address_line1: '',
      address_line2: '',
      city: '',
      country: '',
      postal_code: '',
      phone: '',
      email: '',
      tax_id: '',
      bank_details: '',
      logo_url: '',
    },
    default_payment_terms: 'Due within 30 days',
    default_invoice_notes: '',
  });

  const { data: settings } = /** @type {any} */ (
    useQuery({
      queryKey: ['appSettings'],
      queryFn: async () => {
        const all = await db.entities.AppSettings.list();
        return all[0] || {};
      },
    })
  );

  useEffect(() => {
    if (settings) {
      setFormData({
        app_name: settings.app_name || 'TravelPro',
        logo_url: settings.logo_url || '',
        default_language: settings.default_language || 'en',
        reference_format: settings.reference_format || {
          include_department: true,
          include_category: true,
          include_year: true,
          include_client: false,
          prefix: 'TRP',
        },
        departments: settings.departments || [],
        invoice_header: settings.invoice_header || {
          company_name: '',
          address_line1: '',
          address_line2: '',
          city: '',
          country: '',
          postal_code: '',
          phone: '',
          email: '',
          tax_id: '',
          bank_details: '',
          logo_url: '',
        },
        default_payment_terms: settings.default_payment_terms || 'Due within 30 days',
        default_invoice_notes: settings.default_invoice_notes || '',
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
      .then((data) => {
        setOutlookStatus({ connected: data.connected, email: data.email || '', name: data.name || '' });
        setOutlookLoading(false);
      })
      .catch(() => setOutlookLoading(false));
  }, []);

  const connectOutlook = () => {
    const state = crypto.randomUUID();
    const codeVerifier = crypto.randomUUID();
    const encoder = new TextEncoder();
    crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier)).then((buffer) => {
      const base64Url = btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const redirectUri = window.location.origin + '/auth/outlook-callback';
      const authUrl =
        'https://login.microsoftonline.com/' +
        (import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common') +
        '/oauth2/v2.0/authorize' +
        '?client_id=' +
        encodeURIComponent(import.meta.env.VITE_MICROSOFT_CLIENT_ID) +
        '&response_type=code' +
        '&redirect_uri=' +
        encodeURIComponent(redirectUri) +
        '&scope=' +
        encodeURIComponent(
          'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access',
        ) +
        '&state=' +
        encodeURIComponent(state) +
        '&code_challenge=' +
        encodeURIComponent(base64Url) +
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

  const saveSettingsMutation = /** @type {any} */ (
    useMutation({
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
            prefix: data.reference_format?.prefix || 'TRP',
          },
          departments: data.departments || [],
        };
        if (Object.keys(cleanInvoiceHeader).length > 0) cleanData.invoice_header = cleanInvoiceHeader;
        if (data.logo_url && data.logo_url.trim()) cleanData.logo_url = data.logo_url.trim();
        if (data.default_payment_terms && data.default_payment_terms.trim())
          cleanData.default_payment_terms = data.default_payment_terms.trim();
        if (data.default_invoice_notes && data.default_invoice_notes.trim())
          cleanData.default_invoice_notes = data.default_invoice_notes.trim();
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
      },
    })
  );

  const updateUserLanguage = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ language) => db.auth.updateMe({ language }),
      onSuccess: () => {
        refreshUser();
        window.location.reload();
      },
    })
  );

  const updateUserCurrency = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ default_currency) => db.auth.updateMe({ default_currency }),
      onSuccess: () => {
        refreshUser();
        showSuccess('Currency updated', 'Default currency saved');
      },
      onError: (err) => showError('Failed to update currency', err.message),
    })
  );

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
    setFormData({ ...formData, departments: formData.departments.filter((d) => d !== dept) });
  };

  const generateSampleReference = () => {
    const { prefix, include_department, include_year, include_category } = formData.reference_format;
    let ref = prefix;
    if (include_department && formData.departments.length > 0)
      ref += `-${formData.departments[0]?.slice(0, 3).toUpperCase()}`;
    if (include_category) ref += '-LEI';
    if (include_year) ref += `-${new Date().getFullYear()}`;
    ref += '-0001';
    return ref;
  };

  // --- Permissions State ---
  const [tierPerms, setTierPerms] = useState(/** @type {any} */ ({}));
  const [expandedGroups, setExpandedGroups] = useState(new Set(PERMISSION_GROUPS.map((g) => g.key)));
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

  const savePermMutation = /** @type {any} */ (
    useMutation({
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
    })
  );

  const toggleGroup = (key) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroups(next);
  };

  const toggleTierPermission = (tier, permKey) => {
    setTierPerms((prev) => {
      const current = prev[tier] || [];
      const updated = current.includes(permKey) ? current.filter((k) => k !== permKey) : [...current, permKey];
      return { ...prev, [tier]: updated };
    });
    setPermDirty(true);
  };

  const setAllForTier = (tier, value) => {
    setTierPerms((prev) => {
      const allKeys = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));
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
    return group.permissions.every((p) => tierList.includes(p.key));
  };

  const toggleGroupForTier = (tier, group) => {
    const allInGroup = hasAllInGroup(tier, group);
    setTierPerms((prev) => {
      const current = prev[tier] || [];
      const without = current.filter((k) => !group.permissions.find((p) => p.key === k));
      const updated = allInGroup ? without : [...without, ...group.permissions.map((p) => p.key)];
      return { ...prev, [tier]: updated };
    });
    setPermDirty(true);
  };

  if (!hasPermission('manage_app_settings')) {
    return (
      <Card className="p-12 text-center">
        <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">{t('common.accessDenied')}</h3>
        <p className="text-muted-foreground">{t('settings.accessDenied')}</p>
      </Card>
    );
  }

  const tabs = [
    { key: 'general', label: 'General', icon: Settings },
    { key: 'permissions', label: 'Permissions', icon: KeyRound },
    { key: 'integrations', label: 'Integrations', icon: Mail },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-border gap-0 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors shrink-0 ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-300'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
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
          <Card className="p-6 bg-card">
            <h3 className="text-lg font-bold text-foreground mb-4">{t('settings.branding')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>{t('settings.appName')}</Label>
                <Input
                  value={formData.app_name}
                  onChange={(e) => setFormData({ ...formData, app_name: e.target.value })}
                />
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
          <Card className="p-6 bg-card">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5" /> {t('settings.language')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>{t('settings.defaultLanguage')}</Label>
                <Select
                  value={formData.default_language}
                  onValueChange={(v) => setFormData({ ...formData, default_language: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('settings.yourLanguage')}</Label>
                <Select value={user?.language || 'en'} onValueChange={(v) => updateUserLanguage.mutate(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Select value={user?.default_currency || 'USD'} onValueChange={(v) => updateUserCurrency.mutate(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Used as default in new reservations</p>
              </div>
            </div>
          </Card>

          {/* Reference Number Format */}
          <Card className="p-6 bg-card">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Hash className="w-5 h-5" /> {t('settings.referenceFormat')}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>{t('settings.prefix')}</Label>
                  <Input
                    value={formData.reference_format.prefix}
                    maxLength={5}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        reference_format: { ...formData.reference_format, prefix: e.target.value.toUpperCase() },
                      })
                    }
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.reference_format.include_department}
                    onCheckedChange={(v) =>
                      setFormData({
                        ...formData,
                        reference_format: { ...formData.reference_format, include_department: v },
                      })
                    }
                  />
                  <Label>{t('settings.includeDepartment')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.reference_format.include_category}
                    onCheckedChange={(v) =>
                      setFormData({
                        ...formData,
                        reference_format: { ...formData.reference_format, include_category: v },
                      })
                    }
                  />
                  <Label>{t('settings.includeCategory')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.reference_format.include_year}
                    onCheckedChange={(v) =>
                      setFormData({ ...formData, reference_format: { ...formData.reference_format, include_year: v } })
                    }
                  />
                  <Label>{t('settings.includeYear')}</Label>
                </div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <Label className="text-sm text-muted-foreground">{t('settings.sampleReference')}:</Label>
                <div className="text-xl font-mono font-bold text-blue-600 dark:text-blue-300 mt-1">
                  {generateSampleReference()}
                </div>
              </div>
            </div>
          </Card>

          {/* Invoice Header */}
          <Card className="p-6 bg-card">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" /> {t('settings.invoiceHeader')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{t('settings.invoiceHeaderHint')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('settings.companyName')}</Label>
                <Input
                  value={formData.invoice_header.company_name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      invoice_header: { ...formData.invoice_header, company_name: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.taxId')}</Label>
                <Input
                  value={formData.invoice_header.tax_id}
                  onChange={(e) =>
                    setFormData({ ...formData, invoice_header: { ...formData.invoice_header, tax_id: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.addressLine1')}</Label>
                <Input
                  value={formData.invoice_header.address_line1}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      invoice_header: { ...formData.invoice_header, address_line1: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.addressLine2')}</Label>
                <Input
                  value={formData.invoice_header.address_line2}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      invoice_header: { ...formData.invoice_header, address_line2: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.city')}</Label>
                <Input
                  value={formData.invoice_header.city}
                  onChange={(e) =>
                    setFormData({ ...formData, invoice_header: { ...formData.invoice_header, city: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.postalCode')}</Label>
                <Input
                  value={formData.invoice_header.postal_code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      invoice_header: { ...formData.invoice_header, postal_code: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.country')}</Label>
                <Input
                  value={formData.invoice_header.country}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      invoice_header: { ...formData.invoice_header, country: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('common.phone')}</Label>
                <Input
                  value={formData.invoice_header.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, invoice_header: { ...formData.invoice_header, phone: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('common.email')}</Label>
                <Input
                  type="email"
                  value={formData.invoice_header.email}
                  onChange={(e) =>
                    setFormData({ ...formData, invoice_header: { ...formData.invoice_header, email: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.invoiceLogo')}</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const { file_url } = await db.integrations.Core.UploadFile({ file });
                      setFormData({ ...formData, invoice_header: { ...formData.invoice_header, logo_url: file_url } });
                    }
                  }}
                />
                {formData.invoice_header.logo_url && (
                  <img
                    src={formData.invoice_header.logo_url}
                    alt="Invoice Logo"
                    className="w-20 h-20 object-contain mt-2"
                  />
                )}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label>{t('settings.bankDetails')}</Label>
              <Textarea
                value={formData.invoice_header.bank_details}
                rows={2}
                placeholder={t('settings.bankDetailsPlaceholder')}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    invoice_header: { ...formData.invoice_header, bank_details: e.target.value },
                  })
                }
              />
            </div>
          </Card>

          {/* Default Invoice Settings */}
          <Card className="p-6 bg-card">
            <h3 className="text-lg font-bold text-foreground mb-4">{t('settings.defaultInvoiceSettings')}</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('settings.defaultPaymentTerms')}</Label>
                <Input
                  value={formData.default_payment_terms}
                  onChange={(e) => setFormData({ ...formData, default_payment_terms: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.defaultNotes')}</Label>
                <Textarea
                  value={formData.default_invoice_notes}
                  rows={3}
                  placeholder={t('settings.defaultNotesPlaceholder')}
                  onChange={(e) => setFormData({ ...formData, default_invoice_notes: e.target.value })}
                />
              </div>
            </div>
          </Card>

          {/* Departments */}
          <Card className="p-6 bg-card">
            <h3 className="text-lg font-bold text-foreground mb-4">{t('settings.departments')}</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {formData.departments.map((dept) => (
                <Badge key={dept} variant="secondary" className="px-3 py-1">
                  {dept}
                  <button onClick={() => removeDepartment(dept)} className="ml-2">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder={t('settings.newDepartment')}
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addDepartment()}
              />
              <Button onClick={addDepartment} variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
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

      {/* ==================== PERMISSIONS TAB ==================== */}
      {activeTab === 'permissions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Permission Manager</h2>
                <p className="text-sm text-muted-foreground">Configure what each user tier can do</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={resetToDefaults}>
                <RotateCcw className="w-4 h-4 mr-1" /> Reset Defaults
              </Button>
              <Button
                size="sm"
                onClick={() => savePermMutation.mutate(tierPerms)}
                disabled={!permDirty || savePermMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {savePermMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Save Changes
              </Button>
            </div>
          </div>

          {permDirty && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
              <span className="w-2 h-2 bg-amber-500 rounded-full" />
              Unsaved changes &mdash; click "Save Changes" to apply
            </div>
          )}

          {/* Tier selector */}
          <div className="flex gap-2 flex-wrap">
            {PERMISSION_TIERS.map((t) => (
              <button
                key={t.key}
                onClick={() => setSelectedTier(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  selectedTier === t.key
                    ? 'bg-foreground text-background shadow-lg shadow-foreground/20'
                    : 'bg-card text-muted-foreground border border-border hover:bg-muted'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>{t.label}</span>
                <Badge variant="secondary" className="ml-1 text-xs">
                  {tierPerms[selectedTier]?.length || 0}
                </Badge>
              </button>
            ))}
          </div>

          {/* Permission groups for selected tier */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                {PERMISSION_TIERS.find((t) => t.key === selectedTier)?.label || selectedTier}
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setAllForTier(selectedTier, true)}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setAllForTier(selectedTier, false)}
                >
                  Deselect All
                </Button>
              </div>
            </div>

            {PERMISSION_GROUPS.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              const allChecked = hasAllInGroup(selectedTier, group);
              return (
                <Card key={group.key} className="overflow-hidden">
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="font-semibold text-foreground text-sm">{group.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {
                          (tierPerms[selectedTier] || []).filter((k) => group.permissions.some((p) => p.key === k))
                            .length
                        }
                        /{group.permissions.length}
                      </Badge>
                      {allChecked && <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-300" />}
                    </div>
                    <Switch
                      checked={allChecked}
                      onCheckedChange={() => toggleGroupForTier(selectedTier, group)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border px-5 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.permissions.map((perm) => {
                          const checked = (tierPerms[selectedTier] || []).includes(perm.key);
                          return (
                            <label
                              key={perm.key}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${checked ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' : 'bg-card border-border hover:bg-muted'}`}
                            >
                              <Switch
                                checked={checked}
                                onCheckedChange={() => toggleTierPermission(selectedTier, perm.key)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{perm.label}</p>
                                <p className="text-xs text-muted-foreground truncate">{perm.description}</p>
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
          <Card className="p-6 bg-card">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              Outlook / Microsoft 365
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Microsoft 365 account to send emails directly from the app.
            </p>
            {outlookLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking connection status...
              </div>
            ) : outlookStatus.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-300 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">Connected as</p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {outlookStatus.name} ({outlookStatus.email})
                    </p>
                  </div>
                </div>
                <Button
                  onClick={disconnectOutlook}
                  variant="outline"
                  className="text-red-600 dark:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <X className="w-4 h-4 mr-2" /> Disconnect Outlook
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted border border-border rounded-lg">
                  <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Not connected. Click below to sign in with your Microsoft account.
                  </p>
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
