const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, MessageSquare, User, Briefcase } from 'lucide-react';
import { format } from 'date-fns';

export default function MessageThread({ clientId, referenceType = 'general', referenceId = null, isAgent = false }) {
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me()
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', clientId, referenceType, referenceId],
    queryFn: async () => {
      let filter = { client_id: clientId };
      if (referenceType !== 'general' && referenceId) {
        filter.reference_type = referenceType;
        filter.reference_id = referenceId;
      }
      return db.entities.Message.filter(filter, 'created_date');
    },
    enabled: !!clientId
  });

  const sendMutation = useMutation({
    mutationFn: (content) => db.entities.Message.create({
      client_id: clientId,
      sender_type: isAgent ? 'agent' : 'client',
      sender_email: currentUser?.email,
      content,
      reference_type: referenceType,
      reference_id: referenceId,
      is_read: false
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', clientId, referenceType, referenceId] });
      setNewMessage('');
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: (messageId) => db.entities.Message.update(messageId, { is_read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', clientId, referenceType, referenceId] })
  });

  // Mark unread messages as read
  React.useEffect(() => {
    const unreadMessages = messages.filter(m => 
      !m.is_read && 
      ((isAgent && m.sender_type === 'client') || (!isAgent && m.sender_type === 'agent'))
    );
    unreadMessages.forEach(m => markAsReadMutation.mutate(m.id));
  }, [messages, isAgent]);

  const handleSend = () => {
    if (newMessage.trim()) {
      sendMutation.mutate(newMessage.trim());
    }
  };

  return (
    <Card className="p-4 bg-white shadow-md">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-blue-600" />
        Messages
      </h3>

      <div className="h-80 overflow-y-auto mb-4 space-y-3 p-2 bg-slate-50 rounded-lg">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map(message => {
            const isOwnMessage = (isAgent && message.sender_type === 'agent') || 
                                (!isAgent && message.sender_type === 'client');
            return (
              <div 
                key={message.id} 
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                  <div className={`rounded-2xl px-4 py-2 ${
                    isOwnMessage 
                      ? 'bg-blue-600 text-white rounded-br-md' 
                      : 'bg-white border border-slate-200 text-slate-900 rounded-bl-md'
                  }`}>
                    <p className="text-sm">{message.content}</p>
                  </div>
                  <div className={`flex items-center gap-1 mt-1 text-xs text-slate-500 ${isOwnMessage ? 'justify-end' : ''}`}>
                    {message.sender_type === 'agent' ? (
                      <Briefcase className="w-3 h-3" />
                    ) : (
                      <User className="w-3 h-3" />
                    )}
                    <span>
                      {message.created_date && format(new Date(message.created_date), 'MMM d, h:mm a')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-2">
        <Textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          rows={2}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button 
          onClick={handleSend} 
          className="bg-blue-600 hover:bg-blue-700"
          disabled={!newMessage.trim()}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}