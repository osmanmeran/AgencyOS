import { Shield, RotateCcw, Save, Loader2, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PERMISSION_GROUPS } from '@/lib/permissions';
import { useT } from '@/lib/i18n/I18nContext';

export default function PermissionManager({
  resetToDefaults,
  saveMutation,
  dirty,
  permissionTiers,
  selectedTier,
  setSelectedTier,
  tierPerms,
  expandedGroups,
  toggleGroup,
  hasAllInGroup,
  toggleGroupForTier,
  setAllForTier,
  toggleTierPermission,
}) {
  const { t: _t } = useT();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{_t('userManagement.permission')}</h1>
            <p className="text-sm text-muted-foreground">{_t('userManagement.configure')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="w-4 h-4 mr-1" /> {_t('userManagement.resetDefaults')}
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate(tierPerms)}
            disabled={!dirty || saveMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            {_t('userManagement.save')}
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
          <span className="w-2 h-2 bg-amber-500 rounded-full" />
          {_t('userManagement.unsaved')}
        </div>
      )}

      {/* Tier selector */}
      <div className="flex gap-2 flex-wrap">
        {permissionTiers.map((t) => (
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
            {permissionTiers.find((t) => t.key === selectedTier)?.label || selectedTier}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setAllForTier(selectedTier, true)}>
              {_t('userManagement.select')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8"
              onClick={() => setAllForTier(selectedTier, false)}
            >
              {_t('userManagement.deselect')}
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
                    {(tierPerms[selectedTier] || []).filter((k) => group.permissions.some((p) => p.key === k)).length}/
                    {group.permissions.length}
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
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
                              : 'bg-card border-border hover:bg-muted'
                          }`}
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
  );
}
