const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, MapPin, Calendar, Sparkles, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';

export default function ItineraryAgent() {
  const [selectedTripId, setSelectedTripId] = useState('');
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const { data: trips = [] } = useQuery({
    queryKey: ['trips'],
    queryFn: () => db.entities.Trip.list('-start_date')
  });

  const selectedTrip = trips.find(t => t.id === selectedTripId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!conversation) return;
    const unsub = db.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });
    return unsub;
  }, [conversation?.id]);

  const startConversation = async (trip) => {
    const conv = await db.agents.createConversation({
      agent_name: 'itinerary_builder',
      metadata: { name: `Itinerary for ${trip.name}`, trip_id: trip.id }
    });
    setConversation(conv);

    // Send initial context message
    const startMsg = `I need help building a comprehensive itinerary for this trip:

**Trip:** ${trip.name}
**Destination:** ${trip.destination}
**Dates:** ${format(new Date(trip.start_date), 'MMM d, yyyy')} – ${format(new Date(trip.end_date), 'MMM d, yyyy')}
**Trip ID:** ${trip.id}
${trip.activities?.length ? `**Planned Activities:** ${trip.activities.join(', ')}` : ''}
${trip.notes ? `**Notes:** ${trip.notes}` : ''}

Please build a detailed day-by-day itinerary and save the events to the database.`;

    setSending(true);
    await db.agents.addMessage(conv, { role: 'user', content: startMsg });
    setSending(false);
  };

  const handleTripSelect = async (tripId) => {
    setSelectedTripId(tripId);
    setConversation(null);
    setMessages([]);
    const trip = trips.find(t => t.id === tripId);
    if (trip) await startConversation(trip);
  };

  const handleSend = async () => {
    if (!input.trim() || !conversation || sending) return;
    const msg = input.trim();
    setInput('');
    setSending(true);
    await db.agents.addMessage(conversation, { role: 'user', content: msg });
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Reservations')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-blue-600" />
              AI Itinerary Builder
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">Select a trip to auto-generate and manage its itinerary</p>
          </div>
        </div>

        <div className="w-72">
          <Select value={selectedTripId} onValueChange={handleTripSelect}>
            <SelectTrigger className="bg-white shadow-sm">
              <SelectValue placeholder="Select a trip to plan..." />
            </SelectTrigger>
            <SelectContent>
              {trips.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-slate-500">{t.destination} · {format(new Date(t.start_date), 'MMM d')}–{format(new Date(t.end_date), 'MMM d, yyyy')}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Trip Info Banner */}
      {selectedTrip && (
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 flex-shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-blue-700">
              <MapPin className="w-4 h-4" />
              <span className="font-semibold">{selectedTrip.destination}</span>
            </div>
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(selectedTrip.start_date), 'MMM d')} – {format(new Date(selectedTrip.end_date), 'MMM d, yyyy')}</span>
            </div>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">{selectedTrip.status}</Badge>
            {selectedTrip.activities?.slice(0, 3).map((a, i) => (
              <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
            ))}
            {selectedTrip.activities?.length > 3 && (
              <span className="text-xs text-slate-500">+{selectedTrip.activities.length - 3} more</span>
            )}
          </div>
        </Card>
      )}

      {/* Chat Area */}
      {!selectedTripId ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Select a Trip to Get Started</h2>
            <p className="text-slate-500 max-w-sm">Choose a trip from the dropdown above and the AI will automatically generate a comprehensive day-by-day itinerary for you.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role !== 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-800'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <ReactMarkdown className="text-sm prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {sending && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                  <div className="flex gap-1 items-center h-5">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 p-4">
            <div className="flex gap-3 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask to add events, adjust the schedule, focus on specific days..."
                className="flex-1 min-h-[44px] max-h-32 resize-none"
                rows={1}
                disabled={sending}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="bg-blue-600 hover:bg-blue-700 h-11 w-11 p-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-2">Events are saved directly to the trip's itinerary. View them in Trip Details.</p>
          </div>
        </div>
      )}
    </div>
  );
}