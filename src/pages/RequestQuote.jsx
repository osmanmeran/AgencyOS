import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SendHorizontal, CheckCircle2, Plane } from 'lucide-react';
import LocationSearch from '@/components/services/LocationSearch';

export default function RequestQuote() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    destination: '',
    start_date: '',
    end_date: '',
    travelers: 1,
    budget: '',
    description: '',
    referral: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const lead = {
        type: 'lead',
        name: form.name,
        email: form.email,
        phone: form.phone,
        source: 'web_quote_request',
        notes: `Destination: ${form.destination}\nDates: ${form.start_date} to ${form.end_date}\nTravelers: ${form.travelers}\nBudget: ${form.budget}\nDescription: ${form.description}\nReferral: ${form.referral}`,
        status: 'potential_deal',
        created_date: new Date().toISOString(),
      };
      await db.entities.Client.create(lead);
      setSubmitted(true);
    } catch {
      alert('Something went wrong. Please email us directly.');
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 dark:from-blue-950/40 to-indigo-50 dark:to-indigo-950/40 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center bg-card shadow-xl">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-300" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Thank You!</h1>
          <p className="text-muted-foreground mb-4">
            We've received your trip request. Our travel experts will review it and get back to you within 24 hours.
          </p>
          <p className="text-sm text-muted-foreground">
            Reference: {form.name} - {form.destination}
          </p>
          <Button className="mt-6" onClick={() => setSubmitted(false)}>
            Submit Another
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 dark:from-blue-950/40 via-card to-indigo-50 dark:to-indigo-950/40">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
            <Plane className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Request a Quote</h1>
          <p className="text-muted-foreground mt-2">Tell us about your trip and we'll craft the perfect itinerary</p>
        </div>

        <Card className="p-6 bg-card shadow-lg border-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Name *</label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Email *</label>
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="your@email.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Phone</label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Destination *</label>
                <LocationSearch
                  value={form.destination}
                  onChange={(v) => setForm({ ...form, destination: v })}
                  placeholder="e.g., Paris, France"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Start Date</label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">End Date</label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Number of Travelers</label>
                <Input
                  type="number"
                  min={1}
                  value={form.travelers}
                  onChange={(e) => setForm({ ...form, travelers: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Budget Range</label>
                <Select value={form.budget} onValueChange={(v) => setForm({ ...form, budget: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under_1000">Under $1,000</SelectItem>
                    <SelectItem value="1000_3000">$1,000 - $3,000</SelectItem>
                    <SelectItem value="3000_5000">$3,000 - $5,000</SelectItem>
                    <SelectItem value="5000_10000">$5,000 - $10,000</SelectItem>
                    <SelectItem value="over_10000">$10,000+</SelectItem>
                    <SelectItem value="not_sure">Not sure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">How did you hear about us?</label>
                <Select value={form.referral} onValueChange={(v) => setForm({ ...form, referral: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">Google Search</SelectItem>
                    <SelectItem value="social">Social Media</SelectItem>
                    <SelectItem value="referral">Friend/Family</SelectItem>
                    <SelectItem value="repeat">Returning Client</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Trip Description *</label>
              <Textarea
                required
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Tell us about your ideal trip - preferred activities, accommodation style, special requirements..."
              />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base">
              <SendHorizontal className="w-5 h-5 mr-2" />
              Send Request
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
