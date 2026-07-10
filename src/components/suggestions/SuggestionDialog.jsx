import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Lightbulb, Bug, Heart, Star, SendHorizontal, CheckCircle2 } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

const TYPE_ICONS = {
  feature: Star,
  bug: Bug,
  improvement: Heart,
  other: Lightbulb,
};

export default function SuggestionDialog({ open, onOpenChange }) {
  const { t } = useT();
  const TYPES = [
    { value: 'feature', label: t('suggestionDialog.typeFeature'), icon: TYPE_ICONS.feature },
    { value: 'bug', label: t('suggestionDialog.typeBug'), icon: TYPE_ICONS.bug },
    { value: 'improvement', label: t('suggestionDialog.typeImprovement'), icon: TYPE_ICONS.improvement },
    { value: 'other', label: t('suggestionDialog.typeOther'), icon: TYPE_ICONS.other },
  ];
  const [type, setType] = useState('feature');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, title: title.trim(), description: description.trim() }),
      });
      if (!res.ok) throw new Error('Request failed');
      setSubmitted(true);
    } catch {
      alert(t('suggestionDialog.submitError'));
    }
    setSending(false);
  };

  const handleClose = () => {
    setSubmitted(false);
    setType('feature');
    setTitle('');
    setDescription('');
    onOpenChange(false);
  };

  //   const TypeIcon = TYPES.find(t => t.value === type)?.icon || Lightbulb;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500 dark:text-amber-300" />
            {submitted ? t('suggestionDialog.thankYou') : t('suggestionDialog.suggestTitle')}
          </DialogTitle>
          {!submitted && <DialogDescription>{t('suggestionDialog.suggestDescription')}</DialogDescription>}
        </DialogHeader>

        {submitted ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-300" />
            </div>
            <p className="font-medium text-lg">{t('suggestionDialog.submittedTitle')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('suggestionDialog.submittedBody')}</p>
            <Button variant="outline" className="mt-4" onClick={handleClose}>
              {t('common.close')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">{t('suggestionDialog.typeLabel')}</label>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                        active
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 ${active ? 'text-blue-600 dark:text-blue-300' : 'text-muted-foreground'}`}
                      />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">{t('suggestionDialog.titleLabel')}</label>
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('suggestionDialog.titlePlaceholder')}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">{t('suggestionDialog.descriptionLabel')}</label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('suggestionDialog.descriptionPlaceholder')}
              />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={!title.trim() || sending}>
              {sending ? (
                t('suggestionDialog.submitting')
              ) : (
                <>
                  <SendHorizontal className="w-4 h-4 mr-2" /> {t('suggestionDialog.submitSuggestion')}
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
