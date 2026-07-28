"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Dealer, Officer, Target, Order, Payment, User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { showError, showSuccess } from '@/utils/toast';
import { Plus, Trash2, Edit, Phone, MapPin, Search, GripVertical, Target as TargetIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { getTodayISO } from '@/utils/date';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  TouchSensor,
  useSensor, 
  useSensors, 
  DragEndEvent 
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableDealerRow = ({ d, dealerBalanceMap, dealerTargetRows, setEditingDealer, deleteDealer, refresh, onDisburse }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: d.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 0 };
  const targetRows = dealerTargetRows(d.id);
  const hasReachedAnyTarget = targetRows.some((r: any) => r.target > 0 && r.current >= r.target);
  const currentBalance = dealerBalanceMap[d.id] || 0;
  const balanceLabel = `${currentBalance >= 0 ? '+' : '-'} ${Math.abs(currentBalance).toLocaleString('en-IN')}`;
  const [showTargets, setShowTargets] = useState(false);

  return (
    <TableRow ref={setNodeRef} style={style} className={cn("hover:bg-slate-50/50 transition-colors border-slate-100 bg-white", isDragging && "shadow-2xl relative")}>
      <TableCell className="w-10">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
          <GripVertical className="w-4 h-4" />
        </div>
      </TableCell>
      <TableCell className="py-4 min-w-[300px]">
        <div className="font-bold text-slate-900 text-sm">{d.name}</div>
        <div className="text-[11px] text-slate-500 flex items-start uppercase font-bold tracking-tight mt-1 leading-relaxed max-w-[400px] break-words">
          <MapPin className="w-3.5 h-3.5 mr-1.5 shrink-0 mt-0.5" /> {d.address}
        </div>
        <div className="text-[10px] text-slate-500 flex items-center font-bold mt-1">
          <Phone className="w-3 h-3 mr-1 text-slate-400" /> {d.phone}
        </div>
      </TableCell>
      <TableCell className="py-4">
        <div className="flex items-center gap-2 bg-slate-50 w-fit px-3 py-1.5 rounded-xl border border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-[11px] font-black text-blue-600">
            {(d.officerName || 'U').charAt(0)}
          </div>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{d.officerName || 'Unassigned'}</span>
        </div>
      </TableCell>
      <TableCell className="py-4">
        {targetRows.length === 0 ? (
          <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">No Targets</span>
        ) : (
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg", hasReachedAnyTarget ? "text-amber-600 bg-amber-50 hover:bg-amber-100" : "text-blue-600 bg-blue-50 hover:bg-blue-100")} onClick={() => setShowTargets(true)}>
              <TargetIcon className="w-4 h-4" />
            </Button>
            
            <Dialog open={showTargets} onOpenChange={setShowTargets}>
              <DialogContent className="rounded-3xl max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-widest text-sm text-slate-500">
                    <TargetIcon className={cn("w-4 h-4", hasReachedAnyTarget ? "text-amber-500" : "text-slate-500")} /> Active Targets: {d.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  {targetRows.map((row: any) => {
                    const reached = row.target > 0 && row.current >= row.target;
                    return (
                    <div key={row.id} className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-black text-slate-700 uppercase">{row.label}</span>
                        <span className={cn("font-black", reached ? "text-amber-600" : "text-blue-600")}>
                          {row.type === 'amount' ? `${row.current.toLocaleString('en-IN')}` : row.current} / {row.type === 'amount' ? `${row.target.toLocaleString('en-IN')}` : row.target}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-500", reached ? "bg-gradient-to-r from-amber-400 to-amber-600" : "bg-blue-500")} 
                          style={{ width: `${Math.min(100, (row.current / row.target) * 100)}%` }} 
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] text-slate-400 font-bold italic">
                          Progression: {Math.floor((row.current / row.target) * 100)}%
                        </p>
                        {row.eligibleCycles > 0 && (
                          <Button
                            size="sm"
                            className="h-7 text-[10px] font-black uppercase bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => {
                              onDisburse(d.id, row.id, row.eligibleCycles, d.officerId);
                              setShowTargets(false);
                            }}
                          >
                            Claim Reward x{row.eligibleCycles}
                          </Button>
                        )}
                      </div>
                    </div>
                  ); })}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </TableCell>
      <TableCell className="py-4">
        <div className={cn("font-bold text-base tracking-tighter", currentBalance < 0 ? 'text-red-600' : 'text-green-600')}>
          {balanceLabel}
        </div>
      </TableCell>
      <TableCell className="py-4 text-right space-x-2">
        <Button variant="secondary" size="icon" className="h-9 w-9 bg-slate-100 border-slate-200" onClick={() => setEditingDealer(d)}><Edit className="w-4 h-4 text-slate-600" /></Button>
        <Button variant="secondary" size="icon" className="h-9 w-9 text-red-500 bg-red-50 border-red-100" onClick={async () => { if(confirm('Delete?')) { await deleteDealer(d.id); refresh(); } }}><Trash2 className="w-4 h-4" /></Button>
      </TableCell>
    </TableRow>
  );
};

const DealerCard = ({ d, dealerBalanceMap, dealerTargetRows, setEditingDealer, deleteDealer, refresh, onDisburse }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: d.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 0 };
  const targetRows = dealerTargetRows(d.id);
  const hasReachedAnyTarget = targetRows.some((r: any) => r.target > 0 && r.current >= r.target);
  const currentBalance = dealerBalanceMap[d.id] || 0;
  const isNegative = currentBalance < 0;
  const balanceLabel = `${isNegative ? '-' : '+'} ${Math.abs(currentBalance).toLocaleString('en-IN')}`;
  const [showTargets, setShowTargets] = useState(false);

  return (
    <div ref={setNodeRef} style={style} className={cn("bg-white p-5 rounded-[2rem] border border-slate-100 shadow-lg space-y-4 relative", isDragging && "shadow-xl z-50 opacity-90")}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div {...attributes} {...listeners} className="p-2 -ml-2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 touch-none shrink-0">
            <GripVertical className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-slate-900 text-base truncate uppercase tracking-tighter leading-none">{d.name}</h3>
            <div className="flex items-center text-[11px] text-slate-400 font-bold mt-1.5">
              <Phone className="w-3 h-3 mr-1 text-slate-300" /> {d.phone}
            </div>
          </div>
        </div>
        <div className="text-right flex flex-col items-end shrink-0 ml-3">
          <div className={cn("text-[10px] font-black uppercase tracking-widest mb-1", isNegative ? "text-red-500" : "text-emerald-500")}>
            {isNegative ? 'Due Balance' : 'Net Balance'}
          </div>
          <div className={cn("px-4 py-2 rounded-2xl text-sm md:text-base font-black tracking-tight shadow-md border-2 whitespace-nowrap", isNegative ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200')}>
            {balanceLabel}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold uppercase tracking-tight bg-slate-50/80 p-3 rounded-2xl border border-slate-100/50">
        <MapPin className="w-4 h-4 shrink-0 text-slate-300" /> 
        <span className="truncate">{d.address}</span>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-[11px] font-black text-blue-600 border border-blue-200/50 shadow-sm">
            {(d.officerName || 'U').charAt(0)}
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Officer</span>
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight leading-none">{d.officerName || 'Unassigned'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {targetRows.length > 0 && (
            <Button variant="ghost" size="icon" className={cn("h-10 w-10 rounded-2xl border shadow-sm", hasReachedAnyTarget ? "text-amber-600 bg-amber-50 border-amber-100/50" : "text-blue-600 bg-blue-50 border-blue-100/50")} onClick={() => setShowTargets(true)}>
              <TargetIcon className="w-5 h-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 bg-slate-50 rounded-2xl border border-slate-100/50 shadow-sm" onClick={() => setEditingDealer(d)}>
            <Edit className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 text-red-500 bg-red-50 rounded-2xl border border-red-100/50 shadow-sm" onClick={async () => { if(confirm('Delete?')) { await deleteDealer(d.id); refresh(); } }}>
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <Dialog open={showTargets} onOpenChange={setShowTargets}>
        <DialogContent className="rounded-[2.5rem] max-w-[92vw] border-none shadow-2xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-widest text-xs text-slate-400">
              <TargetIcon className={cn("w-4 h-4", hasReachedAnyTarget ? "text-amber-500" : "text-blue-500")} /> Active Targets: {d.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {targetRows.map((row: any) => {
              const reached = row.target > 0 && row.current >= row.target;
              return (
              <div key={row.id} className="space-y-3 p-4 rounded-3xl bg-slate-50 border border-slate-100 shadow-inner">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-black text-slate-500 uppercase tracking-widest">{row.label}</span>
                  <span className={cn("font-black bg-white px-2 py-1 rounded-lg border shadow-sm", reached ? "text-amber-600 border-amber-100" : "text-blue-600 border-blue-100")}>
                    {row.type === 'amount' ? `${row.current.toLocaleString('en-IN')}` : row.current} / {row.type === 'amount' ? `${row.target.toLocaleString('en-IN')}` : row.target}
                  </span>
                </div>
                <div className="w-full h-3 bg-white rounded-full overflow-hidden border border-slate-200/50 shadow-sm">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-700 ease-out", reached ? "bg-gradient-to-r from-amber-400 to-amber-600" : "bg-blue-500")} 
                    style={{ width: `${Math.min(100, (row.current / row.target) * 100)}%` }} 
                  />
                </div>
                <div className="flex justify-between items-center">
                   <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                    Progress: {Math.floor((row.current / row.target) * 100)}%
                  </p>
                  {row.eligibleCycles > 0 && (
                    <Button
                      size="sm"
                      className="h-9 px-4 text-[10px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 rounded-2xl shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                      onClick={() => {
                        onDisburse(d.id, row.id, row.eligibleCycles, d.officerId);
                        setShowTargets(false);
                      }}
                    >
                      Claim x{row.eligibleCycles}
                    </Button>
                  )}
                </div>
              </div>
              ); })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Dealers = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [editingDealer, setEditingDealer] = useState<Partial<Dealer> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const isMobile = useIsMobile();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, { 
      coordinateGetter: sortableKeyboardCoordinates 
    })
  );

  const loadData = async () => {
    const user = api.getCurrentUser();
    setCurrentUser(user);
    const dealersList = await api.getDealers() || [];
    setDealers([...dealersList].sort((a, b) => a.name.localeCompare(b.name)));
    setOfficers(await api.getOfficers() || []);
    setTargets(await api.syncTargetStatuses() || []);
    setOrders(await api.getOrders() || []);
    setPayments(await api.getPayments() || []);
  };

  useEffect(() => { loadData(); }, []);

  const handleDisburseReward = async (dealerId: string, targetId: string, targetNumber: number, officerId?: string) => {
    const today = getTodayISO();
    const result = await api.disburseTargetReward(targetId, dealerId, targetNumber, officerId);
    if (!result.success) return showError(result.message || 'Reward not eligible');
    setTargets(await api.getTargets());
    setPayments(await api.getPayments());
    showSuccess('Reward disbursed');
  };

  const dealerTargetRows = (dealerId: string) => {
    const today = getTodayISO();
    const safeTargets = Array.isArray(targets) ? targets : [];
    const safeOrders = Array.isArray(orders) ? orders : [];
    
    const activeTargets = safeTargets.filter(
      t =>
        t &&
        t.status === 'active' &&
        (t.dealerId === 'all' || t.dealerId === dealerId) &&
        t.startDate <= today &&
        t.endDate >= today
    );

    return activeTargets.map((target, idx) => {
      const targetType = target.type || 'amount';
      const dealerOrders = safeOrders.filter(o =>
        o &&
        o.status === 'approved' &&
        !o.isQuote &&
        o.dealerId === dealerId &&
        o.date >= target.startDate &&
        o.date <= target.endDate
      );
      const relevantItems = dealerOrders.flatMap(o =>
        (Array.isArray(o.items) ? o.items : []).filter(i => 
          !target.productIds || target.productIds.length === 0 || target.productIds.includes(i.productId)
        )
      );
      const current = targetType === 'amount'
        ? relevantItems.reduce((sum, i) => sum + (i.total || 0), 0)
        : relevantItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
      const disbursedCycles = (target.rewardDisbursed || {})[dealerId] || 0;
      const achievedCycles = Math.floor(current / Math.max(1, target.targetValue));
      const eligibleCycles = Math.max(0, achievedCycles - disbursedCycles);

      return {
        id: target.id,
        label: target.name?.trim() || `Target-${idx + 1}`,
        current,
        target: target.targetValue,
        type: targetType,
        rewardGranted: disbursedCycles > 0,
        eligibleCycles
      };
    });
  };

  const filteredDealers = useMemo(() => {
    const safeDealers = (Array.isArray(dealers) ? dealers : []).filter(Boolean);
    const visibleDealers = currentUser?.role === 'member'
      ? safeDealers.filter(d => (d.officerId && d.officerId === currentUser.officerId) || d.officerName === currentUser.name)
      : safeDealers;
    
    if (!searchQuery) return visibleDealers;
    const lowerQuery = searchQuery.toLowerCase();
    return visibleDealers.filter(d => 
      (d.name || '').toLowerCase().includes(lowerQuery) || 
      (d.phone || '').toLowerCase().includes(lowerQuery) ||
      (d.officerName || '').toLowerCase().includes(lowerQuery)
    );
  }, [dealers, searchQuery, currentUser]);

  const dealerBalanceMap = useMemo(() => {
    const map: Record<string, number> = {};
    const safeDealers = Array.isArray(dealers) ? dealers : [];
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safePayments = Array.isArray(payments) ? payments : [];

    safeDealers.forEach(d => {
      if (!d) return;
      const billed = safeOrders
        .filter(o => o && o.status === 'approved' && !o.isQuote && o.dealerId === d.id)
        .reduce((sum, o) => sum + Number(o.netTotal || 0), 0);
      const paid = safePayments
        .filter(p => p && p.dealerId === d.id)
        .reduce((sum, p) => {
          const amt = Number(p.amount || 0);
          // If type is "Last balance Due", it's a debit (like a billed amount)
          if (p.type === 'Last balance Due') return sum - amt;
          return sum + amt;
        }, 0);
      map[d.id] = paid - billed;
    });
    return map;
  }, [dealers, orders, payments]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = dealers.findIndex(d => d.id === active.id);
      const newIndex = dealers.findIndex(d => d.id === over.id);
      const reordered = arrayMove(dealers, oldIndex, newIndex);
      setDealers(reordered);
      await api.saveDealers(reordered); // Need to ensure this exists in api
    }
  };

  const handleSave = async () => {
    if (editingDealer && editingDealer.name) {
      const officer = officers.find(o => o.id === editingDealer.officerId);
      const dealerToSave = { ...editingDealer, officerName: officer?.name || '' } as Dealer;
      await api.saveDealer(dealerToSave);
      setDealers(await api.getDealers() || []);
      setEditingDealer(null);
      showSuccess("Dealer saved");
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Dealer Management</h1>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search dealers..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-11 rounded-2xl border-slate-200 bg-white"
              />
            </div>
            <Button onClick={() => setEditingDealer({ name: '', address: '', phone: '', officerId: '', balance: 0 })} className="bg-slate-900 h-11 rounded-2xl px-6 font-black uppercase tracking-widest text-[10px]">
              <Plus className="w-4 h-4 mr-2" /> Add Dealer
            </Button>
          </div>
        </div>

        <Card className="border-none shadow-sm overflow-hidden bg-white rounded-3xl">
          <CardContent className="p-0">
            {isMobile ? (
              <div className="p-4 space-y-4">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={filteredDealers.map(d => d.id)} strategy={verticalListSortingStrategy}>
                    {filteredDealers.map((d) => (
                      <DealerCard 
                        key={d.id} 
                        d={d} 
                        dealerBalanceMap={dealerBalanceMap} 
                        dealerTargetRows={dealerTargetRows}
                        setEditingDealer={setEditingDealer}
                        deleteDealer={api.deleteDealer}
                        refresh={loadData}
                        onDisburse={handleDisburseReward}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 border-none">
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-4 px-6 tracking-widest text-slate-400">Dealer Name</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-4 px-6 tracking-widest text-slate-400">Assigned Officer</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-4 px-6 tracking-widest text-slate-400">Active Targets</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-4 px-6 tracking-widest text-slate-400">Current Balance</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase py-4 px-6 tracking-widest text-slate-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={filteredDealers.map(d => d.id)} strategy={verticalListSortingStrategy}>
                        {filteredDealers.map((d) => (
                          <SortableDealerRow 
                            key={d.id} 
                            d={d} 
                            dealerBalanceMap={dealerBalanceMap} 
                            dealerTargetRows={dealerTargetRows}
                            setEditingDealer={setEditingDealer}
                            deleteDealer={api.deleteDealer}
                            refresh={loadData}
                            onDisburse={handleDisburseReward}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingDealer} onOpenChange={(open) => !open && setEditingDealer(null)}>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-widest text-sm text-slate-500">{editingDealer?.id ? 'Edit Dealer' : 'Add New Dealer'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Dealer Name</Label>
                <Input value={editingDealer?.name} onChange={e => setEditingDealer({...editingDealer, name: e.target.value})} className="h-11 rounded-2xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Address</Label>
                <Input value={editingDealer?.address} onChange={e => setEditingDealer({...editingDealer, address: e.target.value})} className="h-11 rounded-2xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Phone Number</Label>
                <Input value={editingDealer?.phone} onChange={e => setEditingDealer({...editingDealer, phone: e.target.value})} className="h-11 rounded-2xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Assigned Officer</Label>
                <Select value={editingDealer?.officerId} onValueChange={v => setEditingDealer({...editingDealer, officerId: v})}>
                  <SelectTrigger className="h-11 rounded-2xl"><SelectValue placeholder="Select Officer" /></SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {(Array.isArray(officers) ? officers : []).map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full bg-slate-900 h-11 rounded-2xl font-black uppercase tracking-widest text-[10px]" onClick={handleSave}>Save Dealer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Dealers;
