"use client";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, User, ShieldCheck } from 'lucide-react';
import { showError } from '@/utils/toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const user = await api.login(email, pass);
    setIsLoading(false);
    if (user) {
      // Small delay to ensure localStorage is written
      setTimeout(() => {
        navigate('/', { replace: true });
        window.location.reload(); // Force a fresh state load
      }, 100);
    } else {
      showError('Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600 rounded-full blur-[120px]" />
      </div>

      <Card className="w-full max-w-md border-none shadow-2xl bg-slate-900/50 backdrop-blur-xl text-white relative z-10">
        <CardHeader className="text-center pt-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-black tracking-tight">Inventory 4.0</CardTitle>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Advanced Inventory Management</p>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input 
                  className="bg-slate-800/50 border-slate-700 pl-10 h-12 rounded-xl focus:ring-blue-500" 
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input 
                  type="password"
                  className="bg-slate-800/50 border-slate-700 pl-10 h-12 rounded-xl focus:ring-blue-500" 
                  placeholder="••••••••"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 rounded-xl font-black uppercase tracking-widest text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Sign In to System'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

