import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Lightbulb, Bug, Heart, Star, SendHorizontal, CheckCircle2 } from 'lucide-react';

const TYPES = [
  { value: 'feature', label: 'Feature Request', icon: Star },
  { value: 'bug', label: 'Bug Report', icon: Bug },
  { value: 'improvement', label: 'Improvement', icon: Heart },
  { value: 'other', label: 'Other', icon: Lightbulb },
];

export default function SuggestionDialog({ open, onOpenChange }) {
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
      await db.entities.Suggestion.create({
        type,
        title: title.trim(),
        description: description.trim(),
        status: 'open',
        created_date: new Date().toISOString(),
      });
      setSubmitted(true);
    } catch {
      try {
        await fetch('/api/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ type, title: title.trim(), description: description.trim() }),
        });
        setSubmitted(true);
      } catch {
        alert('Could not submit suggestion. Please try again.');
      }
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
            {submitted ? 'Thank You!' : 'Suggest an Improvement'}
          </DialogTitle>
          {!submitted && (
            <DialogDescription>
              Help us make Marvelops TravelPro better. Share your ideas, report bugs, or suggest improvements.
            </DialogDescription>
          )}
        </DialogHeader>

        {submitted ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-300" />
            </div>
            <p className="font-medium text-lg">Suggestion Submitted</p>
            <p className="text-sm text-muted-foreground mt-1">Our team will review it. Thank you for your input!</p>
            <Button variant="outline" className="mt-4" onClick={handleClose}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Type</label>
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
              <label className="text-sm font-medium text-foreground">Title *</label>
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of your suggestion"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Description</label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your suggestion in detail. What problem does it solve? How should it work?"
              />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={!title.trim() || sending}>
              {sending ? (
                'Submitting...'
              ) : (
                <>
                  <SendHorizontal className="w-4 h-4 mr-2" /> Submit Suggestion
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
