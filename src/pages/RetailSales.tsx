"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Order, RetailTransaction, RetailTransactionType, Customization } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Landmark, List, LayoutGrid, AlertCircle, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { showError, showSuccess } from '@/utils/toast';
import { cn, numberToWords } from '@/lib/utils';
import { formatDisplayDate, getTodayISO } from '@/utils/date';

const RetailSales = () => {
  const [transactions, setTransactions] = useState<RetailTransaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [location, setLocation] = useState<'dhaka' | 'chittagong'>('dhaka');
  const [config, setConfig] = useState<Customization | null>(null);
  
  const [txDetail, setTxDetail] = useState('');
  const [txAmount, setTxAmount] = useState<number | string>('');
  const [txType, setTxType] = useState<RetailTransactionType>('other');
  const [txDate, setTxDate] = useState(getTodayISO());
  const [historyView, setHistoryView] = useState<'table' | 'cards'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'cards' : 'table'
  );
  const [payAmountOrderId, setPayAmountOrderId] = useState<string | null>(null);
  const [payAmountValue, setPayAmountValue] = useState<number>(0);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payDialogOrder, setPayDialogOrder] = useState<Order | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setTransactions(await api.getRetailTransactions() || []);
      setOrders(await api.getOrders() || []);
      setConfig(await api.getCustomization());
    };
    loadData();
  }, []);

  const refreshRetailData = async () => {
    setTransactions(await api.getRetailTransactions() || []);
    setOrders(await api.getOrders() || []);
  };

  const filteredTransactions = useMemo(() => {
    const manualTxs = (Array.isArray(transactions) ? transactions : []).filter(t => t && t.type !== 'sale');
    const retailOrders = (Array.isArray(orders) ? orders : [])
      .filter(o => o && o.type === 'retail' && o.status === 'approved' && !o.isQuote)
      .map(o => ({
        id: `RTX-AUTO-${o.id}`,
        orderId: o.id,
        date: o.date || getTodayISO(),
        detail: `Retail Sale: ${o.customerName || 'Unknown'} | Order: ${o.id}`,
        amount: Number(o.netTotal || 0),
        location: (o.inventorySource || 'dhaka') as 'dhaka' | 'chittagong',
        type: 'sale' as RetailTransactionType,
        paymentStatus: o.retailPaymentStatus || 'unpaid',
        paidAmount: Number(o.partialAmount || 0)
      }));

    const combined = [...manualTxs, ...retailOrders];
    return combined
      .filter(t => t.location === location)
      .sort((a, b) => {
        const dateDiff = new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
        if (dateDiff !== 0) return dateDiff;
        return b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' });
      });
  }, [transactions, orders, location]);

  const initialByLocation = useMemo(() => {
    if (!config) return 0;
    if (location === 'dhaka') return Number(config.initialRetailAmountDhaka ?? config.initialRetailAmount ?? 0);
    return Number(config.initialRetailAmountChittagong ?? config.initialRetailAmount ?? 0);
  }, [config, location]);

  const dueOrders = useMemo(() => {
    return filteredTransactions.filter(t => t && t.type === 'sale' && (t.paymentStatus || 'paid') !== 'paid');
  }, [filteredTransactions]);

  const netBalance = useMemo(() => {
    const initial = initialByLocation;
    const safeFiltered = Array.isArray(filteredTransactions) ? filteredTransactions : [];
    return initial + safeFiltered.reduce((sum, t) => {
      if (!t) return sum;
      const amt = Number(t.amount || 0);
      const paid = Number(t.paidAmount || 0);
      if (t.type === 'sale') {
        if ((t.paymentStatus || 'paid') === 'unpaid') return sum;
        if (t.paymentStatus === 'partial') return sum + paid;
        return sum + amt;
      }
      return sum + amt;
    }, 0);
  }, [filteredTransactions, initialByLocation]);

  const handleAddTransaction = async () => {
    if (!txDetail || txAmount === '') return;
    const rawAmount = Number(txAmount);
    
    // expense should always be negative in retail_transactions
    // other and adjustment can be positive or negative based on user input
    // "sent_to_main" is no longer a separate type but handled via "adjustment"
    const normalizedAmount = (txType === 'expense')
      ? -Math.abs(rawAmount)
      : rawAmount;
    
    const txId = `RTX-${Date.now()}`;
    const newTx: RetailTransaction = { 
      id: txId, 
      date: txDate, 
      detail: txDetail, 
      amount: normalizedAmount, 
      location,
      type: txType
    };

    await api.saveRetailTransaction(newTx);

    // If the note mentions "Amount sent to main", also record in stock send history as positive
    if (txDetail.toLowerCase().includes('amount sent to main')) {
      await api.saveSendAmount({
        id: `SEND-AUTO-${txId}`,
        date: txDate,
        location: location,
        amount: Math.abs(rawAmount),
        note: `Auto-recorded from Retail: ${txDetail}`
      });
    }

    await refreshRetailData();
    setTxDetail('');
    setTxAmount('');
    showSuccess("Transaction recorded");
  };

  const setRetailPaymentStatus = async (orderId: string, status: 'paid' | 'unpaid' | 'partial') => {
    const result = await api.setRetailOrderPaymentStatus(orderId, status);
    if (!result.success) return;
    await refreshRetailData();
    showSuccess(`Retail order marked as ${status}.`);
  };

  const payAmount = async (orderId: string, amount: number) => {
    const orders = await api.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const currentPaid = Number(order.partialAmount) || 0;
    const newPaid = currentPaid + amount;
    const total = Number(order.netTotal) || 0;
    let newStatus: 'paid' | 'unpaid' | 'partial' = 'partial';
    if (newPaid >= total) {
      newStatus = 'paid';
    }
    const result = await api.setRetailOrderPaymentStatus(orderId, newStatus, newPaid);
    if (!result.success) return;
    await refreshRetailData();
    showSuccess(`Payment of ${amount} added.`);
  };

  const openPayDialog = async (orderId: string) => {
    const orders = await api.getOrders();
    const order = orders.find(o => o.id === orderId) || null;
    const dueAmount = order ? Math.max(Number(order.netTotal) - (Number(order.partialAmount) || 0), 0) : 0;
    setPayAmountOrderId(orderId);
    setPayDialogOrder(order);
    setPayAmountValue(dueAmount);
    setPayDialogOpen(true);
  };

  const submitPayAmount = async () => {
    if (!payAmountOrderId || payAmountValue <= 0) return;
    await payAmount(payAmountOrderId, payAmountValue);
    setPayDialogOpen(false);
    setPayDialogOrder(null);
    setPayAmountOrderId(null);
    setPayAmountValue(0);
  };

  const handleUpdateInitial = async (val: number) => {
    if (config) {
      const newConfig = location === 'dhaka'
        ? { ...config, initialRetailAmountDhaka: val }
        : { ...config, initialRetailAmountChittagong: val };
      await api.saveCustomization(newConfig);
      setConfig(newConfig);
      showSuccess("Initial balance updated");
    }
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 h-full min-h-[calc(100vh-120px)]">
          {/* Left Side: Input Form */}
          <Card className="w-full lg:w-[320px] shrink-0 border-none shadow-sm h-fit">
            <CardHeader className="bg-slate-50/50 border-b py-3">
              <CardTitle className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                <Plus className="w-3.5 h-3.5 mr-2" /> Record Entry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Date</Label>
                <Input type="date" className="h-9 text-xs rounded-xl" value={txDate} onChange={e => setTxDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Branch</Label>
                <Select value={location} onValueChange={(v: any) => setLocation(v)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dhaka">Dhaka Branch</SelectItem>
                    <SelectItem value="chittagong">Chittagong Branch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Entry Type</Label>
                <Select value={txType} onValueChange={(v: any) => {
                  setTxType(v);
                  if (v === 'adjustment') {
                    setTxDetail('Amount sent to main');
                  } else {
                    setTxDetail('');
                  }
                }}>
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="other">Other Sale / Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Detail</Label>
                <Input className="h-9 text-xs rounded-xl" value={txDetail} onChange={e => setTxDetail(e.target.value)} placeholder="Description..." />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Amount</Label>
                <Input type="number" className="h-9 text-xs rounded-xl font-black" value={txAmount} onChange={e => setTxAmount(e.target.value)} />
                {txAmount && Number(txAmount) > 0 && (
                  <p className="text-[10px] text-slate-900 font-bold mt-1 px-1">
                    {numberToWords(Number(txAmount))} Taka
                  </p>
                )}
              </div>
              
              <div className="pt-2">
                <Button className="w-full bg-slate-900 h-10 rounded-xl font-bold text-xs" onClick={handleAddTransaction}>
                  Save Entry
                </Button>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-slate-400">Initial Balance</span>
                  <Input 
                    type="number" 
                    className="w-24 h-7 text-[10px] font-bold bg-slate-50 border-none rounded-lg text-right" 
                    value={initialByLocation}
                    onChange={(e) => handleUpdateInitial(Number(e.target.value))}
                  />
                </div>
                <div className="bg-slate-900 rounded-xl p-3 text-white">
                  <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Current Net Balance</p>
                  <p className="text-xl font-black">{netBalance.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Side: History List (High Density) */}
          <Card className="flex-1 border-none shadow-sm overflow-hidden flex flex-col">
            <CardHeader className="bg-slate-50/50 border-b py-3 shrink-0 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                <History className="w-3.5 h-3.5 mr-2" /> {location === 'dhaka' ? 'Dhaka' : 'CTG'} History
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button 
                  variant={historyView === 'table' ? 'secondary' : 'ghost'} 
                  size="icon" 
                  className="h-7 w-7 rounded-lg" 
                  onClick={() => setHistoryView('table')}
                >
                  <List className="w-3.5 h-3.5" />
                </Button>
                <Button 
                  variant={historyView === 'cards' ? 'secondary' : 'ghost'} 
                  size="icon" 
                  className="h-7 w-7 rounded-lg" 
                  onClick={() => setHistoryView('cards')}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <div className="h-full overflow-auto scrollbar-thin">
                {dueOrders.length > 0 && (
                  <div className="p-3 bg-orange-50/50 border-b space-y-2">
                    <p className="text-[9px] font-black uppercase text-orange-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Due Orders ({dueOrders.length})
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                      {dueOrders.map(t => (
                        <div key={t.id} className="shrink-0 w-48 bg-white border border-orange-100 rounded-xl p-2 shadow-sm">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[8px] font-bold text-slate-400">{t.orderId}</span>
                            <Badge variant="outline" className="text-[7px] h-3 px-1 bg-orange-50 text-orange-600 border-orange-100 uppercase">Due</Badge>
                          </div>
                          <div className="text-[10px] font-bold truncate mb-2">{t.detail.split(' | ')[0]}</div>
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-[7px] uppercase text-slate-400 font-bold">Due Amount</p>
                              <p className="text-[10px] font-black text-orange-600">{(Number(t.amount) - (t.paidAmount || 0)).toLocaleString()}</p>
                            </div>
                            <Button size="sm" className="h-6 text-[9px] bg-blue-600 px-2" onClick={() => openPayDialog(t.orderId!)}>Pay</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {historyView === 'table' ? (
                  <Table className="w-full">
                    <TableHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="text-[12px] md:text-[13px] font-black uppercase py-3 h-10 px-3">Date</TableHead>
                        <TableHead className="text-[12px] md:text-[13px] font-black uppercase py-3 h-10 px-3">Type</TableHead>
                        <TableHead className="text-[12px] md:text-[13px] font-black uppercase py-3 h-10 px-3">Description</TableHead>
                        <TableHead className="text-[12px] md:text-[13px] font-black uppercase py-3 h-10 px-3 text-right">Amount</TableHead>
                        <TableHead className="text-[12px] md:text-[13px] font-black uppercase py-3 h-10 px-3 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((t) => {
                        const isGenerated = t.id.startsWith('RTX-AUTO-');
                        const paymentStatus = t.paymentStatus || 'paid';
                        const canPayToggle = isGenerated && t.type === 'sale' && t.orderId;
                        const mainAmount = t.amount || 0;
                        const paid = paymentStatus === 'paid' ? mainAmount : (t.paidAmount || 0);
                        const due = Math.max(mainAmount - paid, 0);

                        return (
                          <TableRow key={t.id} className="hover:bg-slate-50/50 border-slate-50 group">
                            <TableCell className="text-sm text-slate-500 py-2 px-3 h-10 whitespace-nowrap">
                              {formatDisplayDate(t.date)}
                            </TableCell>
                            <TableCell className="py-2 px-3 h-10">
                              <span className={cn(
                                "text-[10px] md:text-xs px-2 py-1 rounded-full font-black uppercase border",
                                t.type === 'sent_to_main' ? "bg-purple-50 text-purple-600 border-purple-100" : 
                                t.type === 'sale' ? (paymentStatus === 'paid' ? "bg-green-50 text-green-600 border-green-100" : "bg-orange-50 text-orange-600 border-orange-100") :
                                "bg-slate-50 text-slate-600 border-slate-100"
                              )}>
                                {t.type.replace('_', ' ')}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 px-3 h-10 min-w-[150px]">
                              <div className="text-sm font-bold text-slate-800" title={t.detail}>
                                {t.detail}
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-2 px-3 h-10 whitespace-nowrap font-black text-sm md:text-base">
                              <div className={mainAmount >= 0 ? "text-slate-900" : "text-red-600"}>{Math.abs(mainAmount).toLocaleString()}</div>
                              {due > 0 && <div className="text-[10px] md:text-xs text-orange-600">Due: {due.toLocaleString()}</div>}
                            </TableCell>
                            <TableCell className="text-right py-1.5 px-3 h-8 space-x-1">
                              {canPayToggle && paymentStatus !== 'paid' && (
                                <Button variant="secondary" size="icon" className="h-8 w-8 text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200" onClick={() => openPayDialog(t.orderId!)}>
                                  <Landmark className="w-4 h-4" />
                                </Button>
                              )}
                              <Button variant="secondary" size="icon" className="h-8 w-8 text-red-500 bg-red-50 hover:bg-red-100 border-red-200" onClick={async () => {
                                if (confirm(isGenerated ? 'This is linked to an order. Delete the order?' : 'Delete this transaction?')) {
                                  if (isGenerated && t.orderId) {
                                    await api.deleteOrder(t.orderId);
                                  } else {
                                    await api.deleteRetailTransaction(t.id);
                                  }
                                  await refreshRetailData();
                                }
                              }}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredTransactions.map((t) => {
                      const isGenerated = t.id.startsWith('RTX-AUTO-');
                      return (
                      <div key={t.id} className="bg-white border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow relative group">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-slate-400 font-bold">{formatDisplayDate(t.date)}</span>
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-black uppercase border",
                            t.type === 'sent_to_main' ? "bg-purple-50 text-purple-600 border-purple-100" : 
                            t.type === 'sale' ? "bg-green-50 text-green-600 border-green-100" :
                            "bg-slate-50 text-slate-600 border-slate-100"
                          )}>
                            {t.type.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-slate-800 mb-3 line-clamp-2 h-10">{t.detail}</div>
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-[10px] uppercase text-slate-400 font-bold">Amount</p>
                            <p className={cn("text-base font-black", t.amount >= 0 ? "text-slate-900" : "text-red-600")}>{Math.abs(t.amount).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2">
                            {t.type === 'sale' && t.paymentStatus !== 'paid' && (
                              <Button variant="secondary" size="sm" className="h-8 text-xs px-3 bg-blue-50 text-blue-600 border-blue-100" onClick={() => openPayDialog(t.orderId!)}>Pay</Button>
                            )}
                            <Button variant="secondary" size="icon" className="h-8 w-8 text-red-500 bg-red-50 border-red-100" onClick={async () => {
                              if (confirm(isGenerated ? 'Delete linked order?' : 'Delete?')) {
                                if (isGenerated && t.orderId) {
                                  await api.deleteOrder(t.orderId);
                                } else {
                                  await api.deleteRetailTransaction(t.id);
                                }
                                await refreshRetailData();
                              }
                            }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-slate-50 p-3 rounded-xl">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Order / Detail</p>
              <p className="text-xs font-bold text-slate-700">{payDialogOrder ? `${payDialogOrder.id} | ${payDialogOrder.dealerName}` : 'Loading...'}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Payment Amount</Label>
              <Input 
                type="number" 
                className="h-12 text-lg font-black rounded-xl" 
                value={payAmountValue} 
                onChange={e => setPayAmountValue(Number(e.target.value))}
                autoFocus
              />
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] text-slate-400 font-medium">Total: {payDialogOrder?.netTotal.toLocaleString()}</span>
                <span className="text-[10px] text-orange-600 font-black">Due: {payDialogOrder ? (Number(payDialogOrder.netTotal) - (Number(payDialogOrder.partialAmount) || 0)).toLocaleString() : 0}</span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-11 rounded-xl font-bold" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1 h-11 bg-slate-900 rounded-xl font-bold" onClick={submitPayAmount}>Confirm Payment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default RetailSales;
