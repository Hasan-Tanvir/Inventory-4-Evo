"use client";

import React, { useState } from 'react';
import { MessageSquare, Send, X, Bot, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: "Hello! I'm your ERP Assistant. How can I help you today?" }
  ]);

  const handleSend = () => {
    if (!query.trim()) return;
    
    const userMsg = query;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setQuery('');

    // Simulated AI Logic
    setTimeout(async () => {
      let response = "I'm not sure about that. Could you rephrase?";
      const stats = await api.getDashboardStats();
      const q = userMsg.toLowerCase();

      if (q.includes('sales') || q.includes('revenue')) {
        response = `Total sales for this month is ${(stats?.monthlySales || 0).toLocaleString()}. You have ${stats?.totalOrders || 0} approved orders.`;
      } else if (q.includes('pending') || q.includes('approval')) {
        response = `There are currently ${stats?.pendingApprovals || 0} orders waiting for your approval.`;
      } else if (q.includes('help')) {
        response = "I can help you check sales, pending approvals, or navigate to different sections like Inventory or Dealers.";
      } else if (q.includes('reminder')) {
        response = "I've noted that. I'll remind you about it later!";
      }

      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    }, 600);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <Button 
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full shadow-2xl bg-blue-600 hover:bg-blue-700 animate-bounce"
        >
          <Bot className="w-6 h-6" />
        </Button>
      ) : (
        <Card className="w-80 md:w-96 shadow-2xl border-none animate-in slide-in-from-bottom-4">
          <CardHeader className="bg-blue-600 text-white rounded-t-xl flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> AI Business Assistant
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 text-white hover:bg-white/20">
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-80 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed shadow-sm",
                    m.role === 'user' ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-slate-800 rounded-tl-none"
                  )}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t bg-white flex gap-2">
              <Input 
                placeholder="Ask me anything..." 
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                className="h-9 text-xs"
              />
              <Button size="icon" onClick={handleSend} className="h-9 w-9 bg-blue-600">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIAssistant;
