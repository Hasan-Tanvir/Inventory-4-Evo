"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Target, Dealer, Product, Order } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Target as TargetIcon, 
  Plus, 
  Trophy, 
  Calendar, 
  Edit, 
  Trash2, 
  RefreshCw, 
  History, 
  X, 
  Trash2 as TrashIcon,
  LayoutGrid,
  List,
  User,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { cn, numberToWords } from '@/lib/utils';
import { formatDisplayDate, getTodayISO } from '@/utils/date';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const Targets = () => {
  const [targets, setTargets] = useState<Target[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [pendingProductId, setPendingProductId] = useState('');
  const [dealerSearch, setDealerSearch] = useState('');
  const [dealerSuggestions, setDealerSuggestions] = useState<Dealer[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [productDetailTarget, setProductDetailTarget] = useState<Target | null>(null);
  const [viewMode, setViewMode] = useState<'tile' | 'list'>('tile');
  const [targetDealersDialog, setTargetDealersDialog] = useState<Target | null>(null);
  
  const getInitialTarget = (): Partial<Target> => ({
    name: '',
    dealerId: 'all',
    type: 'amount',
    productIds: [],
    targetValue: 0,
    currentValue: 0,
    startDate: getTodayISO(),
    endDate: getTodayISO(),
    rewardType: 'percentage',
    rewardValue: 0
  });
  const [editingTarget, setEditingTarget] = useState<Partial<Target> | null>(getInitialTarget());
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setTargets(await api.getTargets() || []);
      setDealers(await api.getDealers() || []);
      setProducts(await api.getProducts() || []);
      setOrders(await api.getOrders() || []);
    };
    loadData();
  }, []);

  const activeTargets = useMemo(() => (Array.isArray(targets) ? targets : []).filter(t => t && t.status === 'active'), [targets]);
  const historicalTargets = useMemo(() => (Array.isArray(targets) ? targets : []).filter(t => t && t.status !== 'active'), [targets]);

  const getTargetProductLabel = (target: Target) => {
    if (!target || !Array.isArray(target.productIds) || !target.productIds.length) return 'All Products';
    const allProducts = Array.isArray(products) ? products : [];
    const names = target.productIds
      .map(id => allProducts.find(p => p && p.id === id)?.name)
      .filter(Boolean) as string[];
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  };

  const handleDisburse = async (t: Target, dealerId: string) => {
    if (!confirm(`Disburse reward for ${t.name}? This will update dealer balance and record a reward entry.`)) return;
    
    // Calculate cycles achieved
    const currentValue = getTargetCurrentValue(t, dealerId);
    const cyclesAchieved = Math.floor(currentValue / t.targetValue);
    
    // Subtract already disbursed cycles
    const alreadyDisbursed = (t.rewardDisbursed || {})[dealerId] || 0;
    const pendingCycles = cyclesAchieved - alreadyDisbursed;

    if (pendingCycles <= 0) {
      showError('No pending cycles to disburse.');
      return;
    }

    const result = await api.disburseTargetReward(t.id, dealerId, pendingCycles);
    if (result.success) {
      showSuccess('Reward disbursed successfully. Entry added to Rewards tab.');
      setTargets(await api.getTargets() || []);
    } else {
      showError(result.message || 'Disbursement failed.');
    }
  };

  const getTargetCurrentValue = (target: Target, dealerIdOverride?: string) => {
    if (!target) return 0;
    const allDealers = Array.isArray(dealers) ? dealers : [];
    const allOrders = Array.isArray(orders) ? orders : [];

    const targetDealerId = dealerIdOverride || target.dealerId;
    const applicableDealerIds = targetDealerId === 'all'
      ? allDealers.map(d => d.id)
      : [targetDealerId];

    const matchingOrders = allOrders.filter(o =>
      o &&
      o.status === 'approved' &&
      !o.isQuote &&
      !!o.dealerId &&
      applicableDealerIds.includes(o.dealerId) &&
      o.date >= target.startDate &&
      o.date <= target.endDate
    );

    const relevantItems = matchingOrders.flatMap(o =>
      (Array.isArray(o.items) ? o.items : []).filter(i => 
        !target.productIds || target.productIds.length === 0 || target.productIds.includes(i.productId)
      )
    );

    const targetType = target.type || 'amount';
    return targetType === 'amount'
      ? relevantItems.reduce((sum, i) => sum + (i.total || 0), 0)
      : relevantItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
  };

  const getDealersReachedTarget = (target: Target) => {
    const relevantDealers = target.dealerId === 'all' 
      ? dealers 
      : dealers.filter(d => d.id === target.dealerId);
    
    return relevantDealers.map(dealer => {
      const currentValue = getTargetCurrentValue(target, dealer.id);
      const progress = (currentValue / target.targetValue) * 100;
      const alreadyDisbursed = (target.rewardDisbursed || {})[dealer.id] || 0;
      const cyclesAchieved = Math.floor(currentValue / target.targetValue);
      const pendingCycles = cyclesAchieved - alreadyDisbursed;
      
      return {
        dealer,
        currentValue,
        progress,
        cyclesAchieved,
        alreadyDisbursed,
        pendingCycles
      };
    });
  };

  const handleSave = async () => {
    if (!editingTarget?.targetValue || !editingTarget?.endDate) return showError("Please set target value and end date");
    
    const target: Target = {
      id: editingTarget.id || Math.random().toString(36).substr(2, 9),
      name: (editingTarget.name || '').trim(),
      dealerId: editingTarget.dealerId || 'all',
      dealerName: editingTarget.dealerId === 'all' ? 'All Dealers' : dealers.find(d => d.id === editingTarget.dealerId)?.name || '',
      type: editingTarget.type as any,
      productIds: editingTarget.productIds || [],
      targetValue: Number(editingTarget.targetValue),
      currentValue: editingTarget.currentValue || 0,
      startDate: editingTarget.startDate || getTodayISO(),
      endDate: editingTarget.endDate!,
      rewardType: 'fixed',
      rewardValue: Number(editingTarget.rewardValue ?? 0),
      status: 'active'
    };
    
    // Optimistic update
    if (editingTarget.id) {
      setTargets(prev => prev.map(t => t.id === target.id ? target : t));
    } else {
      setTargets(prev => [...prev, target]);
    }
    
    await api.saveTarget(target);
    setTargets(await api.getTargets() || []);
    setEditingTarget(getInitialTarget());
    setSelectedDealer(null);
    setDealerSearch('');
    setDealerSuggestions([]);
    showSuccess(editingTarget.id ? "Target updated" : "Target created");
  };

  const handleReapply = (t: Target) => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setEditingTarget({
      ...t,
      id: undefined,
      currentValue: 0,
      startDate: getTodayISO(),
      endDate: nextMonth.toISOString().split('T')[0]
    });
  };

  const handleRenewBatch = async (t: Target) => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const archived = { ...t, status: 'expired' as const };
    const renewed: Target = {
      ...t,
      id: `${t.id}-R-${Date.now()}`,
      currentValue: 0,
      status: 'active',
      startDate: getTodayISO(),
      endDate: nextMonth.toISOString().split('T')[0]
    };

    await api.saveTarget(archived);
    await api.saveTarget(renewed);
    setTargets(await api.getTargets() || []);
    showSuccess('Target renewed for next batch');
  };

  const handleDealerSearch = (value: string) => {
    setDealerSearch(value);
    setSelectedDealer(null);
    setEditingTarget({ ...editingTarget, dealerId: 'all' });
    if (value.length < 1) {
      setDealerSuggestions([]);
      return;
    }
    const safeDealers = Array.isArray(dealers) ? dealers : [];
    setDealerSuggestions(safeDealers.filter(d => d && d.name && d.name.toLowerCase().includes(value.toLowerCase())));
  };

  const pickDealer = (dealer: Dealer) => {
    setSelectedDealer(dealer);
    setEditingTarget({ ...editingTarget, dealerId: dealer.id });
    setDealerSearch('');
    setDealerSuggestions([]);
  };

  const selectableProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );
  const addProductToTarget = () => {
    if (!pendingProductId) return;
    const ids = editingTarget?.productIds || [];
    if (ids.includes(pendingProductId)) return;
    setEditingTarget({ ...editingTarget, productIds: [...ids, pendingProductId] });
    setPendingProductId('');
    setProductSearch('');
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-none shadow-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                <Plus className="w-4 h-4" /> {editingTarget?.id ? 'Edit' : 'New'} Target
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Target Name</Label>
                <Input
                  className="h-10 rounded-xl border-slate-200 focus:ring-2 focus:ring-slate-300"
                  placeholder="Example: April Dealer Amount Target"
                  value={editingTarget?.name || ''}
                  onChange={e => setEditingTarget({ ...editingTarget, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Apply To</Label>
                {(selectedDealer && editingTarget?.dealerId !== 'all') ? (
                  <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 p-3 rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                        {selectedDealer.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{selectedDealer.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{selectedDealer.address}</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-red-500 shrink-0" onClick={() => { setSelectedDealer(null); setEditingTarget({ ...editingTarget, dealerId: 'all' }); }}>
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      autoComplete="off"
                      className="h-10 rounded-xl border-slate-200"
                      value={dealerSearch}
                      onChange={(e) => handleDealerSearch(e.target.value)}
                      placeholder="Search dealer or select 'All Dealers'"
                    />
                    {dealerSuggestions.length > 0 && (
                      <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => { setSelectedDealer(null); setEditingTarget({ ...editingTarget, dealerId: 'all' }); setDealerSearch(''); setDealerSuggestions([]); }}
                          className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 border-b font-bold"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                              <User className="w-3 h-3 text-purple-600" />
                            </div>
                            All Dealers (Global)
                          </div>
                        </button>
                        {dealerSuggestions.map(d => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => pickDealer(d)}
                            className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 border-b last:border-0"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                {d.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold">{d.name}</div>
                                <div className="text-[9px] text-slate-500">{d.address}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Product Search</Label>
                <div className="relative">
                  <Input
                    className="h-9 rounded-xl pr-10"
                    placeholder="Search product..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                  />
                  {productSearch.length >= 1 && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-1 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      {selectableProducts.length > 0 ? (
                        selectableProducts.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              const ids = editingTarget?.productIds || [];
                              if (!ids.includes(p.id)) {
                                setEditingTarget({ ...editingTarget, productIds: [...ids, p.id] });
                              }
                              setProductSearch('');
                            }}
                            className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 border-b last:border-0"
                          >
                            <div className="font-bold">{p.name}</div>
                            {p.version && <div className="text-[9px] text-slate-500">{p.version}</div>}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-[10px] text-slate-500 italic">No matching products</div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="max-h-28 overflow-auto border rounded-xl p-2 space-y-1">
                  {(Array.isArray(editingTarget?.productIds) ? editingTarget.productIds : []).map(pid => {
                    const allProducts = Array.isArray(products) ? products : [];
                    const product = allProducts.find(p => p && p.id === pid);
                    return (
                      <div key={pid} className="text-xs flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                        <span className="font-medium text-slate-700">{product?.name || pid}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-red-500"
                          onClick={() => setEditingTarget({ ...editingTarget, productIds: (Array.isArray(editingTarget?.productIds) ? editingTarget.productIds : []).filter(id => id !== pid) })}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Target Type</Label>
                  <Select value={editingTarget?.type || 'amount'} onValueChange={v => setEditingTarget({...editingTarget, type: v as any})}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">Amount</SelectItem>
                      <SelectItem value="quantity">Quantity (Pcs)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Target Value</Label>
                  <Input type="number" className="h-10 rounded-xl" value={editingTarget?.targetValue || ''} onChange={e => setEditingTarget({...editingTarget, targetValue: Number(e.target.value)})} />
                  {editingTarget?.targetValue ? (
                    <p className="text-[10px] text-slate-900 font-bold mt-1 px-1">
                      {numberToWords(Number(editingTarget.targetValue))} {editingTarget.type === 'amount' ? 'Taka' : 'Pcs'}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Reward Commission (Fixed)</Label>
                <Input
                  type="number"
                  className="h-10 rounded-xl"
                  value={editingTarget?.rewardValue || ''}
                  onChange={e => setEditingTarget({ ...editingTarget, rewardType: 'fixed', rewardValue: Number(e.target.value) })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Start Date</Label>
                  <Input type="date" className="h-10 rounded-xl" value={editingTarget?.startDate || ''} onChange={e => setEditingTarget({...editingTarget, startDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">End Date</Label>
                  <Input type="date" className="h-10 rounded-xl" value={editingTarget?.endDate || ''} onChange={e => setEditingTarget({...editingTarget, endDate: e.target.value})} />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1 h-11 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 rounded-xl font-black uppercase text-xs tracking-widest">
                  {editingTarget?.id ? 'Update' : 'Create'}
                </Button>
                {editingTarget && (
                  <Button variant="outline" onClick={() => { setEditingTarget(getInitialTarget()); setSelectedDealer(null); setDealerSearch(''); setDealerSuggestions([]); }} className="h-11 rounded-xl">Cancel</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" /> Active Targets
              </h2>
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn("h-8 w-8 rounded-lg transition-all", viewMode === 'tile' ? "bg-white shadow-sm text-slate-900" : "text-slate-500")}
                  onClick={() => setViewMode('tile')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn("h-8 w-8 rounded-lg transition-all", viewMode === 'list' ? "bg-white shadow-sm text-slate-900" : "text-slate-500")}
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {viewMode === 'tile' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeTargets.map((t, targetIndex) => {
                  const targetType = t.type || 'amount';
                  const currentValue = getTargetCurrentValue(t);
                  const progress = Math.min((currentValue / t.targetValue) * 100, 100);
                  const rewardType = t.rewardType || 'percentage';
                  const rewardValue = Number(t.rewardValue ?? 0);
                  const dealersReached = getDealersReachedTarget(t).filter(d => d.progress >= 100);
                  
                  return (
                    <Card key={t.id} className="border-none shadow-sm hover:shadow-lg transition-all overflow-hidden">
                      <div className={cn("h-2", targetType === 'amount' ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-gradient-to-r from-orange-400 to-amber-500")} />
                      <CardContent className="pt-6 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-black text-slate-900">{t.name?.trim() || `Target-${targetIndex + 1}`}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">{t.dealerName}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mt-1">
                              <Calendar className="w-3 h-3" /> {formatDisplayDate(t.startDate)} to {formatDisplayDate(t.endDate)}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                              Products: {t.productIds?.length || 0}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500 mt-1">
                              Package: {getTargetProductLabel(t)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge className={cn("border-none text-[8px] font-black uppercase", t.dealerId === 'all' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600")}>
                              {t.dealerId === 'all' ? 'Global' : 'Dealer'}
                            </Badge>
                            <Badge className={cn("border-none text-[8px] font-black uppercase", targetType === 'amount' ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600")}>
                              {targetType === 'amount' ? 'Amount' : 'Quantity'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-slate-500 flex justify-between">
                            <span>Achieved: {currentValue.toLocaleString('en-IN')}</span>
                            <span>Target: {t.targetValue.toLocaleString('en-IN')} ({Math.round(progress)}%)</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full transition-all duration-500 rounded-full", 
                                progress >= 100 ? "bg-gradient-to-r from-emerald-400 to-green-500" : 
                                progress >= 50 ? "bg-gradient-to-r from-yellow-400 to-amber-500" : 
                                "bg-gradient-to-r from-blue-400 to-indigo-500"
                              )}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        {dealersReached.length > 0 && (
                          <div className="space-y-2">
                            <Button 
                              variant="outline" 
                              className="w-full justify-between bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => setTargetDealersDialog(t)}
                            >
                              <span className="flex items-center gap-2 text-xs font-bold">
                                <Trophy className="w-4 h-4" />
                                {dealersReached.length} Dealer{dealersReached.length !== 1 ? 's' : ''} Reached Target
                              </span>
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          </div>
                        )}

                        {t.rewardDisbursed && Object.keys(t.rewardDisbursed).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {Object.entries(t.rewardDisbursed).map(([dId, count]) => {
                              const dealer = dealers.find(d => d.id === dId);
                              if (!count) return null;
                              return (
                                <div key={dId} className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase">
                                  <Trophy className="w-2.5 h-2.5" /> Reward Disbursed x {count} {t.dealerId === 'all' ? `(${dealer?.name || dId})` : ''}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {progress >= 100 && t.dealerId !== 'all' && (
                          <div className="pt-2">
                            <Button 
                              className="w-full h-9 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-[10px] font-black uppercase tracking-wider"
                              onClick={() => handleDisburse(t, t.dealerId)}
                            >
                              <Trophy className="w-3 h-3 mr-2" /> Disburse Reward
                            </Button>
                          </div>
                        )}

                        <div className="pt-4 border-t flex justify-between items-center">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setProductDetailTarget(t)} title="View Products">
                              <TargetIcon className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { 
                              setEditingTarget(t); 
                              if (t.dealerId !== 'all') {
                                const dealer = dealers.find(d => d.id === t.dealerId);
                                setSelectedDealer(dealer || null);
                              } else {
                                setSelectedDealer(null);
                              }
                            }}><Edit className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleReapply(t)}><RefreshCw className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleRenewBatch(t)} title="Renew next batch"><TargetIcon className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={async () => { if(confirm('Delete?')) { await api.deleteTarget(t.id); setTargets(await api.getTargets() || []); } }}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                          <div className="text-xs font-black text-emerald-600">
                            {rewardType === 'percentage' ? `${rewardValue}%` : `${rewardValue.toLocaleString('en-IN')}`}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {activeTargets.map((t, targetIndex) => {
                  const targetType = t.type || 'amount';
                  const currentValue = getTargetCurrentValue(t);
                  const progress = Math.min((currentValue / t.targetValue) * 100, 100);
                  const rewardType = t.rewardType || 'percentage';
                  const rewardValue = Number(t.rewardValue ?? 0);
                  const dealersReached = getDealersReachedTarget(t).filter(d => d.progress >= 100);
                  
                  return (
                    <Card key={t.id} className="border-none shadow-sm hover:shadow-md transition-all overflow-hidden">
                      <div className="p-5 flex items-center gap-4">
                        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shrink-0", 
                          targetType === 'amount' ? "bg-gradient-to-br from-green-100 to-emerald-200" : "bg-gradient-to-br from-orange-100 to-amber-200"
                        )}>
                          <Trophy className={cn("w-7 h-7", targetType === 'amount' ? "text-green-600" : "text-orange-600")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-black text-slate-900 truncate">{t.name?.trim() || `Target-${targetIndex + 1}`}</h3>
                            <Badge className={cn("border-none text-[8px] font-black uppercase", t.dealerId === 'all' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600")}>
                              {t.dealerId === 'all' ? 'Global' : 'Dealer'}
                            </Badge>
                            <Badge className={cn("border-none text-[8px] font-black uppercase", targetType === 'amount' ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600")}>
                              {targetType === 'amount' ? 'Amount' : 'Quantity'}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-slate-500 mb-2">
                            {t.dealerName} • {formatDisplayDate(t.startDate)} - {formatDisplayDate(t.endDate)} • {t.productIds?.length || 0} Products
                          </p>
                          <div className="flex items-center gap-4">
                            <div className="flex-1 max-w-xs">
                              <div className="text-[10px] font-bold text-slate-500 flex justify-between mb-1">
                                <span>{currentValue.toLocaleString('en-IN')}</span>
                                <span>{t.targetValue.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={cn("h-full transition-all duration-500 rounded-full", 
                                    progress >= 100 ? "bg-gradient-to-r from-emerald-400 to-green-500" : 
                                    progress >= 50 ? "bg-gradient-to-r from-yellow-400 to-amber-500" : 
                                    "bg-gradient-to-r from-blue-400 to-indigo-500"
                                  )}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                            {dealersReached.length > 0 && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-xs bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => setTargetDealersDialog(t)}
                              >
                                {dealersReached.length} Dealers
                              </Button>
                            )}
                            <div className="text-sm font-black text-emerald-600">
                              {rewardType === 'percentage' ? `${rewardValue}%` : `${rewardValue.toLocaleString('en-IN')}`}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setProductDetailTarget(t)} title="View Products">
                                <TargetIcon className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { 
                                setEditingTarget(t); 
                                if (t.dealerId !== 'all') {
                                  const dealer = dealers.find(d => d.id === t.dealerId);
                                  setSelectedDealer(dealer || null);
                                } else {
                                  setSelectedDealer(null);
                                }
                              }}><Edit className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => { if(confirm('Delete?')) { await api.deleteTarget(t.id); setTargets(await api.getTargets() || []); } }}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {targets.length === 0 && (
              <Card className="border-dashed border-2 bg-slate-50/60">
                <CardContent className="py-10 text-center text-xs font-bold uppercase text-slate-400">
                  No targets found yet.
                </CardContent>
              </Card>
            )}

            <div className="pt-2">
              <Button variant="outline" className="w-full bg-white" onClick={() => setHistoryOpen(true)}>
                <History className="w-4 h-4 mr-2 text-slate-500" />
                View Target History
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Target History
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-auto">
            {historicalTargets.length === 0 ? (
              <p className="text-[10px] uppercase font-bold text-slate-400">No history yet.</p>
            ) : (
              historicalTargets.map(t => (
                <Card key={t.id} className="border-none shadow-sm bg-slate-50/60">
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{t.name?.trim() || t.dealerName}</p>
                      <p className="text-[10px] text-slate-500">{t.dealerName}</p>
                      <p className="text-[10px] text-slate-500">
                        {formatDisplayDate(t.startDate)} to {formatDisplayDate(t.endDate)} | {getTargetProductLabel(t)}
                      </p>
                    </div>
                    <Badge variant="outline" className="uppercase text-[10px]">{t.status}</Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!productDetailTarget} onOpenChange={() => setProductDetailTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TargetIcon className="w-4 h-4" />
              {productDetailTarget?.name} - Products
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {productDetailTarget && (!Array.isArray(productDetailTarget.productIds) || productDetailTarget.productIds.length === 0) ? (
              <p className="text-sm text-slate-500">All products are included.</p>
            ) : (
              productDetailTarget?.productIds?.map(pid => {
                const product = products.find(p => p.id === pid);
                return (
                  <div key={pid} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{product?.name}</p>
                      {product?.version && <p className="text-xs text-slate-500">{product.version}</p>}
                    </div>
                    {product && (
                      <p className="text-xs font-bold text-slate-600">
                        Stock: {product.dhaka + product.chittagong}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!targetDealersDialog} onOpenChange={() => setTargetDealersDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              {targetDealersDialog?.name} - Dealers Reached Target
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {targetDealersDialog && (
              <div className="space-y-3">
                {getDealersReachedTarget(targetDealersDialog)
                  .sort((a, b) => b.progress - a.progress)
                  .map(({ dealer, currentValue, progress, cyclesAchieved, alreadyDisbursed, pendingCycles }) => {
                    const targetType = targetDealersDialog.type || 'amount';
                    const reached = progress >= 100;
                    
                    return (
                      <Card key={dealer.id} className={cn("border-none shadow-sm overflow-hidden", reached ? "bg-gradient-to-r from-emerald-50/50 to-green-50/50" : "bg-white")}>
                        <div className="p-5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                                {dealer.name.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-black text-slate-900">{dealer.name}</h4>
                                  {reached && (
                                    <Badge className="bg-emerald-100 text-emerald-700 border-none text-[10px] font-bold flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> Reached
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500">{dealer.address} • {dealer.phone}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-slate-700">
                                {currentValue.toLocaleString('en-IN')} {targetType === 'amount' ? 'Taka' : 'Pcs'}
                              </p>
                              <p className="text-[10px] text-slate-500">{Math.round(progress)}% of target</p>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Cycles</p>
                                <p className="text-sm font-black text-slate-700">{cyclesAchieved}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Disbursed</p>
                                <p className="text-sm font-black text-blue-600">{alreadyDisbursed}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Pending</p>
                                <p className="text-sm font-black text-emerald-600">{pendingCycles}</p>
                              </div>
                            </div>
                            {pendingCycles > 0 && targetDealersDialog && (
                              <Button 
                                className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                                onClick={() => handleDisburse(targetDealersDialog, dealer.id)}
                              >
                                <Trophy className="w-4 h-4 mr-2" />
                                Disburse x{pendingCycles}
                              </Button>
                            )}
                          </div>
                          <div className="mt-4">
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full transition-all duration-500 rounded-full", 
                                  progress >= 100 ? "bg-gradient-to-r from-emerald-400 to-green-500" : 
                                  progress >= 50 ? "bg-gradient-to-r from-yellow-400 to-amber-500" : 
                                  "bg-gradient-to-r from-blue-400 to-indigo-500"
                                )}
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Targets;
