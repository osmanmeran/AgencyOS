const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], list:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

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
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${JSON.parse(localStorage.getItem('b44_user') || '{}').token || ''}` },
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
            <Lightbulb className="w-5 h-5 text-amber-500" />
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
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <p className="font-medium text-lg">Suggestion Submitted</p>
            <p className="text-sm text-slate-500 mt-1">Our team will review it. Thank you for your input!</p>
            <Button variant="outline" className="mt-4" onClick={handleClose}>Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map(t => {
                  const Icon = t.icon;
                  const active = type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                        active
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Title *</label>
              <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief summary of your suggestion" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <Textarea rows={4} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Describe your suggestion in detail. What problem does it solve? How should it work?"
              />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={!title.trim() || sending}>
              {sending ? 'Submitting...' : <><SendHorizontal className="w-4 h-4 mr-2" /> Submit Suggestion</>}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
