import { db } from '@/lib/DbContext';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Shield, Save, RotateCcw, CheckCircle2, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { PERMISSION_GROUPS, DEFAULT_TIER_PERMISSIONS } from '@/lib/permissions';
import { showSuccess, showError } from '@/lib/toast';
import { usePermissions } from '@/components/permissions/PermissionContext';

const TIERS = [
  { key: 'admin', label: 'Administrator', color: 'bg-red-100 text-red-800', desc: 'Full system control' },
  { key: 'manager', label: 'Manager', color: 'bg-purple-100 text-purple-800', desc: 'Manage operations' },
  { key: 'agent', label: 'Agent', color: 'bg-blue-100 text-blue-800', desc: 'Daily operations' },
  { key: 'accounting', label: 'Accounting', color: 'bg-green-100 text-green-800', desc: 'Finance & reports' },
];

export default function PermissionManager() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [tierPerms, setTierPerms] = useState(/** @type {any} */ ({}));
  const [expandedGroups, setExpandedGroups] = useState(new Set(PERMISSION_GROUPS.map(g => g.key)));
  const [dirty, setDirty] = useState(false);
  const [selectedTier, setSelectedTier] = useState('agent');

  const { data: settings } = /** @type {any} */ (useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => {
      const all = await db.entities.AppSettings.list();
      return all[0] || {};
    },
  }));

  useEffect(() => {
    if (settings?.tier_permissions) {
      setTierPerms(settings.tier_permissions);
    } else {
      setTierPerms(JSON.parse(JSON.stringify(DEFAULT_TIER_PERMISSIONS)));
    }
  }, [settings]);

  const saveMutation = /** @type {any} */ (useMutation({
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
      setDirty(false);
      showSuccess('Permissions saved', 'Tier permissions have been updated');
    },
    onError: (err) => {
      showError('Failed to save', err.message);
    },
  }));

  const toggleGroup = (key) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpandedGroups(next);
  };

  const toggleTierPermission = (tier, permKey) => {
    setTierPerms(prev => {
      const current = prev[tier] || [];
      const updated = current.includes(permKey)
        ? current.filter(k => k !== permKey)
        : [...current, permKey];
      return { ...prev, [tier]: updated };
    });
    setDirty(true);
  };

  const setAllForTier = (tier, value) => {
    setTierPerms(prev => {
      const allKeys = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));
      return { ...prev, [tier]: value ? [...allKeys] : [] };
    });
    setDirty(true);
  };

  const resetToDefaults = () => {
    setTierPerms(JSON.parse(JSON.stringify(DEFAULT_TIER_PERMISSIONS)));
    setDirty(true);
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
    setDirty(true);
  };

  if (!hasPermission('manage_roles') && !hasPermission('manage_users')) {
    return (
      <Card className="p-12 text-center">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-600">Access Denied</h3>
        <p className="text-sm text-slate-400 mt-1">You need the Manage Roles permission to access this page.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Permission Manager</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Configure what each user tier can do</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="w-4 h-4 mr-1" /> Reset Defaults
          </Button>
          <Button size="sm" onClick={() => saveMutation.mutate(tierPerms)} disabled={!dirty || saveMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Save Changes
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <span className="w-2 h-2 bg-amber-500 rounded-full" />
          Unsaved changes — click "Save Changes" to apply
        </div>
      )}

      {/* Tier selector */}
      <div className="flex gap-2 flex-wrap">
        {TIERS.map(t => (
          <button
            key={t.key}
            onClick={() => setSelectedTier(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              selectedTier === t.key
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 dark:bg-slate-100 dark:text-slate-900'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>{t.label}</span>
            <Badge variant="secondary" className="ml-1 text-xs">{tierPerms[selectedTier]?.length || 0}</Badge>
          </button>
        ))}
      </div>

      {/* Permission groups for selected tier */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            {TIERS.find(t => t.key === selectedTier)?.label || selectedTier}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setAllForTier(selectedTier, true)}>Select All</Button>
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setAllForTier(selectedTier, false)}>Deselect All</Button>
          </div>
        </div>

        {PERMISSION_GROUPS.map(group => {
          const isExpanded = expandedGroups.has(group.key);
          const allChecked = hasAllInGroup(selectedTier, group);
//           const someChecked = group.permissions.some(p => (tierPerms[selectedTier] || []).includes(p.key));

          return (
            <Card key={group.key} className="overflow-hidden dark:bg-slate-900 dark:border-slate-700">
              <button
                onClick={() => toggleGroup(group.key)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{group.label}</span>
                  <Badge variant="outline" className="text-xs">
                    {(tierPerms[selectedTier] || []).filter(k => group.permissions.some(p => p.key === k)).length}/{group.permissions.length}
                  </Badge>
                  {allChecked && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                </div>
                <Switch
                  checked={allChecked}
                  onCheckedChange={() => toggleGroupForTier(selectedTier, group)}
                  onClick={e => e.stopPropagation()}
                />
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.permissions.map(perm => {
                      const checked = (tierPerms[selectedTier] || []).includes(perm.key);
                      return (
                        <label
                          key={perm.key}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800'
                              : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Switch checked={checked} onCheckedChange={() => toggleTierPermission(selectedTier, perm.key)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{perm.label}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{perm.description}</p>
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
  );
}
