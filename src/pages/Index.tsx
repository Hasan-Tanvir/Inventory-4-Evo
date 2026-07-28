"use client";

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, ShoppingBag, Clock, DollarSign, ArrowUpRight, Users, Package, CheckCircle2, FileText, Wallet 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const Dashboard = () => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const loadStats = async () => {
      setStats(await api.getDashboardStats());
    };
    loadStats();
  }, []);

  if (!stats) return null;

  const metrics = [
    { label: 'Monthly Sales', value: `${(stats?.monthlySales || 0).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: '+12.5%' },
    { label: 'Monthly Quantity', value: stats?.monthlyQuantity || 0, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+5.2%' },
    { label: 'Total Officers', value: stats?.totalOfficers || 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', trend: 'Stable' },
    { label: 'Pending Approvals', value: stats?.pendingApprovals || 0, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', trend: 'Action Required' },
    { label: 'Total Quotes', value: stats?.totalQuotes || 0, icon: FileText, color: 'text-sky-600', bg: 'bg-sky-50', trend: 'New' },
    { label: 'Due Balance', value: `${(stats?.remainingDueBalance || 0).toLocaleString()}`, icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50', trend: 'Outstanding' },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Business Overview</h1>
            <p className="text-slate-500 font-medium">Welcome back! Here's what's happening today.</p>
          </div>
          <div className="flex gap-2">
            <div className="bg-white px-4 py-2 rounded-xl shadow-sm border flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">System Live</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(Array.isArray(metrics) ? metrics : []).map((m, i) => (
            <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all duration-300 group">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">{m.label}</CardTitle>
                <div className={cn(m.bg, "p-2 rounded-lg group-hover:scale-110 transition-transform")}>
                  <m.icon className={cn("w-4 h-4", m.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-slate-900">{m.value}</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className={cn("text-[10px] font-bold", m.trend.includes('+') ? "text-emerald-600" : "text-orange-600")}>
                    {m.trend}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">vs last month</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Sales Performance</CardTitle>
                <p className="text-xs text-slate-400">Daily revenue trends for the current week</p>
              </div>
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={Array.isArray(stats?.chartData) ? stats.chartData : []}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(v: any) => [`${(Number(v) || 0).toLocaleString()}`, 'Sales']}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <button className="w-full p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between hover:bg-slate-800 transition-colors group">
                <div className="text-left">
                  <p className="text-xs font-bold">New Order</p>
                  <p className="text-[10px] opacity-60">Create a dealer or retail sale</p>
                </div>
                <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </button>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
                  <Package className="w-5 h-5 text-blue-500 mb-2" />
                  <p className="text-[10px] font-bold uppercase text-slate-500">Inventory</p>
                </div>
                <div className="p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-2" />
                  <p className="text-[10px] font-bold uppercase text-slate-500">Approvals</p>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-2xl bg-blue-50 border border-blue-100">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">System Tip</p>
                <p className="text-xs text-blue-800 leading-relaxed">
                  You have <strong>{stats.pendingApprovals}</strong> orders waiting for approval. Review them to update stock levels.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
