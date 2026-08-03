import { useEffect, useState } from 'react';
import { db } from '@/lib/DbContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, RotateCcw, Save, Loader2, ClipboardList } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { useT } from '@/lib/i18n/I18nContext';

const PRIORITY_COLORS = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  high: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  critical: 'bg-red-600 text-white dark:bg-red-700',
};

const ANCHOR_LABEL_KEYS = {
  start_date: 'taskTemplates.anchorDeparture',
  end_date: 'taskTemplates.anchorReturn',
  created_date: 'taskTemplates.anchorBookingCreated',
};

const EMPTY_FORM = {
  title: '',
  anchor: 'start_date',
  timing: 'before',
  days: '7',
  priority: 'medium',
  department: '',
  description: '',
};

function slugify(title) {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'template'
  );
}

function uniqueKey(base, taken) {
  let key = base;
  let i = 2;
  while (taken.includes(key)) {
    key = `${base}_${i++}`;
  }
  return key;
}

/**
 * Editor for AppSettings.task_templates — the admin-configurable list that
 * server/services/tasks.js's generateTasksForBooking() uses to auto-generate
 * a booking's operational tasks (falling back to its own built-in defaults
 * when this list is empty). Fully self-contained, like StripeSettingsPanel:
 * loads/saves directly against AppSettings rather than through the parent
 * page's general-tab formData.
 */
export default function TaskTemplatesPanel() {
  const { t } = useT();
  const [settingsId, setSettingsId] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogIndex, setDialogIndex] = useState(null); // null = closed, -1 = adding, N = editing index N
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    try {
      const all = await db.entities.AppSettings.list();
      const settings = all[0] || {};
      setSettingsId(settings.id || null);
      setDepartmentsList(settings.departments || []);
      if (Array.isArray(settings.task_templates) && settings.task_templates.length > 0) {
        setTemplates(settings.task_templates);
      } else {
        setTemplates(await db.tasks.defaultTemplates());
      }
    } catch (err) {
      showError(t('taskTemplates.loadError'), err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setDialogIndex(-1);
  };

  const openEdit = (index) => {
    const tpl = templates[index];
    setForm({
      title: tpl.title || '',
      anchor: tpl.anchor || 'start_date',
      timing: (tpl.offsetDays || 0) < 0 ? 'before' : 'after',
      days: String(Math.abs(tpl.offsetDays || 0)),
      priority: tpl.priority || 'medium',
      department: tpl.department || '',
      description: tpl.description || '',
    });
    setDialogIndex(index);
  };

  const removeTemplate = (index) => {
    setTemplates((prev) => prev.filter((_, i) => i !== index));
  };

  const saveForm = () => {
    if (!form.title.trim()) return;
    const days = Math.max(0, Number(form.days) || 0);
    const offsetDays = form.timing === 'before' ? -days : days;

    if (dialogIndex === -1) {
      const existingKeys = templates.map((t) => t.template_key);
      const template_key = uniqueKey(slugify(form.title), existingKeys);
      setTemplates((prev) => [
        ...prev,
        {
          template_key,
          title: form.title.trim(),
          anchor: form.anchor,
          offsetDays,
          priority: form.priority,
          department: form.department,
          description: form.description.trim(),
        },
      ]);
    } else {
      setTemplates((prev) =>
        prev.map((tpl, i) =>
          i === dialogIndex
            ? {
                ...tpl,
                title: form.title.trim(),
                anchor: form.anchor,
                offsetDays,
                priority: form.priority,
                department: form.department,
                description: form.description.trim(),
              }
            : tpl,
        ),
      );
    }
    setDialogIndex(null);
  };

  const resetToDefaults = async () => {
    try {
      setTemplates(await db.tasks.defaultTemplates());
    } catch (err) {
      showError(t('taskTemplates.loadError'), err.message);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      if (settingsId) {
        await db.entities.AppSettings.update(settingsId, { task_templates: templates });
      } else {
        const created = await db.entities.AppSettings.create({ task_templates: templates });
        setSettingsId(created.id);
      }
      showSuccess(t('taskTemplates.saveSuccess'));
    } catch (err) {
      showError(t('taskTemplates.saveError'), err.message);
    } finally {
      setSaving(false);
    }
  };

  const timingLabel = (tpl) => {
    const days = Math.abs(tpl.offsetDays || 0);
    const anchor = t(ANCHOR_LABEL_KEYS[tpl.anchor] || ANCHOR_LABEL_KEYS.start_date);
    const key = (tpl.offsetDays || 0) < 0 ? 'taskTemplates.timingBefore' : 'taskTemplates.timingAfter';
    return t(key, { days, anchor });
  };

  if (loading) {
    return (
      <Card className="p-6 bg-card">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-card">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">{t('taskTemplates.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('taskTemplates.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetToDefaults}>
              <RotateCcw className="w-4 h-4 mr-1.5" />
              {t('taskTemplates.resetDefaults')}
            </Button>
            <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-1.5" />
              {t('taskTemplates.addButton')}
            </Button>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="p-10 text-center">
            <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">{t('taskTemplates.noItemsFound')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((tpl, index) => (
              <div
                key={tpl.template_key || index}
                className="flex items-start gap-3 p-4 rounded-lg border border-border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{tpl.title}</span>
                    <Badge className={`text-xs ${PRIORITY_COLORS[tpl.priority] || PRIORITY_COLORS.medium}`}>
                      {t(`priority.${tpl.priority}`) || tpl.priority}
                    </Badge>
                    {tpl.department && (
                      <Badge variant="outline" className="text-xs">
                        {tpl.department}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{timingLabel(tpl)}</p>
                  {tpl.description && <p className="text-xs text-muted-foreground mt-1">{tpl.description}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEdit(index)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeTemplate(index)}
                    className="p-1.5 text-muted-foreground hover:text-red-500 dark:hover:text-red-300 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-6">
          <Button onClick={handleSaveAll} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            {t('taskTemplates.saveAll')}
          </Button>
        </div>
      </Card>

      <Dialog open={dialogIndex !== null} onOpenChange={(open) => !open && setDialogIndex(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogIndex === -1 ? t('taskTemplates.addButton') : t('taskTemplates.editTitle')}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveForm();
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-1">
              <Label>{t('taskTemplates.titleLabel')}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                placeholder={t('taskTemplates.titlePlaceholder')}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{t('taskTemplates.relativeToLabel')}</Label>
                <Select value={form.anchor} onValueChange={(v) => setForm((f) => ({ ...f, anchor: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start_date">{t('taskTemplates.anchorDeparture')}</SelectItem>
                    <SelectItem value="end_date">{t('taskTemplates.anchorReturn')}</SelectItem>
                    <SelectItem value="created_date">{t('taskTemplates.anchorBookingCreated')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t('taskTemplates.timingLabel')}</Label>
                <Select value={form.timing} onValueChange={(v) => setForm((f) => ({ ...f, timing: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before">{t('taskTemplates.timingBeforeOption')}</SelectItem>
                    <SelectItem value="after">{t('taskTemplates.timingAfterOption')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t('taskTemplates.daysLabel')}</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.days}
                  onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('priority.label')}</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('priority.low')}</SelectItem>
                    <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                    <SelectItem value="high">{t('priority.high')}</SelectItem>
                    <SelectItem value="critical">{t('priority.critical')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t('taskTemplates.departmentLabel')}</Label>
                <Select
                  value={form.department || '__all__'}
                  onValueChange={(v) => setForm((f) => ({ ...f, department: v === '__all__' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t('taskTemplates.allDepartments')}</SelectItem>
                    {departmentsList.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>{t('common.description')}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder={t('taskTemplates.descriptionPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('taskTemplates.descriptionHint')}</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogIndex(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">{t('common.save')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
