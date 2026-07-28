"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Dealer, Order, Payment, Customization } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wallet, ArrowUpRight, ArrowDownLeft, Printer, Calendar, RotateCcw, Trash2, X, MessageSquareOff, MessageSquare } from 'lucide-react';
import { printDoc, generateInvoiceHtml } from '@/utils/invoice-generator';
import { formatDisplayDate, getTodayISO } from '@/utils/date';

const Balance = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  
  // Initialize state from localStorage right away
  const [selectedDealerId, setSelectedDealerId] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('inventory4-dealer-balance-state');
        if (raw) return JSON.parse(raw).selectedDealerId || '';
      } catch {}
    }
    return '';
  });
  
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [dealerSearch, setDealerSearch] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('inventory4-dealer-balance-state');
        if (raw) return JSON.parse(raw).dealerSearch || '';
      } catch {}
    }
    return '';
  });
  
  const [dealerSuggestions, setDealerSuggestions] = useState<Dealer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [fromDate, setFromDate] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('inventory4-dealer-balance-state');
        if (raw) return JSON.parse(raw).fromDate || getTodayISO();
      } catch {}
    }
    return getTodayISO();
  });
  
  const [toDate, setToDate] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('inventory4-dealer-balance-state');
        if (raw) return JSON.parse(raw).toDate || getTodayISO();
      } catch {}
    }
    return getTodayISO();
  });
  
  const [config, setConfig] = useState<Customization | null>(null);
  const [showNotes, setShowNotes] = useState(true);
  const BALANCE_DRAFT_KEY = 'inventory4-dealer-balance-state';

  useEffect(() => {
    const loadData = async () => {
      const dealersList = await api.getDealers();
      setDealers(dealersList);
      setOrders(await api.getOrders());
      setPayments(await api.getPayments());
      setConfig(await api.getCustomization());
      
      // Set selected dealer after dealers are loaded
      if (selectedDealerId) {
        const dealer = dealersList.find(d => d.id === selectedDealerId);
        if (dealer) {
          setSelectedDealer(dealer);
          if (!dealerSearch) setDealerSearch(dealer.name);
        }
      }
    };
    loadData();
  }, []);

  // Save to localStorage whenever any relevant state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const data = {
        selectedDealerId,
        dealerSearch,
        fromDate,
        toDate
      };
      window.localStorage.setItem(BALANCE_DRAFT_KEY, JSON.stringify(data));
    }
  }, [selectedDealerId, dealerSearch, fromDate, toDate]);

  const ledger = useMemo(() => {
    if (!selectedDealerId) return [];
    
    const dealerOrders = orders
      .filter(o => o.dealerId === selectedDealerId && !o.isQuote && ['approved', 'pending'].includes(o.status || 'pending'))
      .map(o => ({
      date: o.date,
      ref: o.id,
      type: 'Order',
      // Only actually bill the dealer once order is APPROVED; placed orders are preview only
      debit: o.status === 'approved' ? o.netTotal : 0,
      credit: 0,
      notes: (o.status === 'pending' ? '[PLACED] ' : '') + (o.notes ? `Sales Order: ${o.notes}` : 'Sales Order')
    }));

    const dealerPayments = payments.filter(p => p.dealerId === selectedDealerId).map(p => ({
      date: p.date,
      ref: p.reference || 'PAY',
      type: 'Payment',
      debit: p.type === 'Last balance Due' ? p.amount : 0,
      credit: p.type === 'Last balance Due' ? 0 : p.amount,
      notes: 
        p.type === 'Bank Transfer' 
          ? (p.notes ? `Bank Payment: ${p.notes}` : 'Bank Payment')
          : p.type === 'Purchase'
          ? (p.notes ? `Purchase: ${p.notes}` : 'Purchase')
          : p.notes || `Payment via ${p.type}`
    }));

    const combined = [...dealerOrders, ...dealerPayments].sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      return (isNaN(aTime) ? 0 : aTime) - (isNaN(bTime) ? 0 : bTime);
    });

    // Apply showNotes toggle: if off, strip custom note suffix and show only base label
    if (!showNotes) {
      for (let i = 0; i < combined.length; i++) {
        const entry = combined[i];
        if (entry.type === 'Order') entry.notes = 'Sales Order';
        else if (entry.type === 'Payment') {
          if (entry.notes?.startsWith('Bank Payment:')) entry.notes = 'Bank Payment';
          else if (entry.notes?.startsWith('Purchase:')) entry.notes = 'Purchase';
          else entry.notes = `Payment via ${combined[i]?.ref ? '—' : (payments.find(p => p.reference === entry.ref)?.type || '—')}`;
          const baseType = payments.find(p => p.reference === entry.ref)?.type;
          if (baseType) entry.notes = `Payment via ${baseType}`;
        }
      }
    }

    // Calculate running balance for ALL items first
    let running = 0;
    const itemsWithRunning = combined.map(item => {
      running += (item.credit - item.debit);
      return { ...item, runningBalance: running };
    });

    // Then filter by date if needed
    let filtered = itemsWithRunning;
    if (fromDate) filtered = filtered.filter(x => x.date >= fromDate);
    if (toDate) filtered = filtered.filter(x => x.date <= toDate);

    return filtered;
  }, [selectedDealerId, orders, payments, fromDate, toDate, showNotes]);

  const totals = useMemo(() => {
    // Totals for the VISIBLE period
    const billed = ledger.reduce((sum, item) => sum + item.debit, 0);
    const paid = ledger.reduce((sum, item) => sum + item.credit, 0);
    
    // Total lifetime balance (last item's running balance)
    const lifetimeBalance = ledger.length > 0 ? ledger[ledger.length - 1].runningBalance : 0;
    
    return { debit: billed, credit: paid, balance: lifetimeBalance };
  }, [ledger]);

  const handleReset = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(BALANCE_DRAFT_KEY);
    }
    setSelectedDealerId('');
    setSelectedDealer(null);
    setDealerSearch('');
    setShowSuggestions(false);
    setFromDate(getTodayISO());
    setToDate(getTodayISO());
  };

  const handleDealerSearchChange = (value: string) => {
    setDealerSearch(value);
    if (value.trim()) {
      const filtered = dealers.filter(d => d.name.toLowerCase().includes(value.toLowerCase()));
      setDealerSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setDealerSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectDealer = (dealer: Dealer) => {
    setSelectedDealer(dealer);
    setSelectedDealerId(dealer.id);
    setDealerSearch(dealer.name);
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BALANCE_DRAFT_KEY, JSON.stringify({ selectedDealerId, fromDate, toDate }));
    }
  }, [selectedDealerId, fromDate, toDate]);

  const handlePrint = () => {
    if (!selectedDealerId || !config) return;
    const dealer = dealers.find(d => d.id === selectedDealerId);
    
    const html = `
      <html>
        <head>
          <style>
            * { box-sizing:border-box; }
            body { font-family: 'Times New Roman', Times, serif; padding: 24px; color: #000; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
            .company { font-size: 22px; font-weight: bold; text-transform: uppercase; }
            .title { font-size: 16px; margin-top: 4px; font-weight: bold; }
            .info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000; padding: 8px; font-size: 12px; }
            th { text-align: left; font-weight: bold; text-transform: uppercase; }
            .text-right { text-align: right; }
            .summary { margin-top: 16px; border:1px solid #000; padding: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">${config.title}</div>
            <div class="title" style="text-transform: none;">Dealer Statement of Account</div>
          </div>
          <div class="info">
            <div>
              <strong>Dealer:</strong> ${dealer?.name}<br>
              <strong>Address:</strong> ${dealer?.address}<br>
              <strong>Phone:</strong> ${dealer?.phone}
            </div>
            <div class="text-right">
              <strong>Period:</strong> ${formatDisplayDate(fromDate)} to ${formatDisplayDate(toDate)}<br>
              <strong>Date Generated:</strong> ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-')}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description / Note</th>
                <th class="text-right">Credit (+)</th>
                <th class="text-right">Debit (-)</th>
                <th class="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${ledger.map((item, i) => {
                return `
                  <tr>
                    <td>${formatDisplayDate(item.date)}</td>
                    <td>${item.ref}</td>
                    <td>${item.notes}</td>
                    <td class="text-right">${item.credit > 0 ? item.credit.toLocaleString('en-IN') : '-'}</td>
                    <td class="text-right">${item.debit > 0 ? item.debit.toLocaleString('en-IN') : '-'}</td>
                    <td class="text-right"><strong>${item.runningBalance.toLocaleString('en-IN')}</strong></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div class="summary">
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>Total Billed: ${totals.debit.toLocaleString('en-IN')}</span>
              <span>Total Paid: ${totals.credit.toLocaleString('en-IN')}</span>
              <span>Net Balance: ${totals.balance.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </body>
      </html>
    `;
    printDoc(html);
  };

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Side: Filters */}
        <div className="w-full lg:w-[320px] shrink-0 space-y-4">
          <Card className="border-none shadow-sm h-fit">
            <CardHeader className="bg-slate-50/50 border-b py-3">
              <CardTitle className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                Statement Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Select Dealer</Label>
                {selectedDealer ? (
                  <div className="flex items-center justify-between bg-blue-50/50 border border-blue-100 p-2 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0 pl-1">
                        <div className="text-xs font-bold text-slate-900 truncate">{selectedDealer.name}</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400 hover:text-red-500 shrink-0" onClick={() => { 
                      setSelectedDealer(null); 
                      setSelectedDealerId(''); 
                      setDealerSearch(''); 
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      autoComplete="off"
                      className="h-10 text-xs rounded-xl"
                      placeholder="Search dealer..."
                      value={dealerSearch}
                      onChange={(e) => handleDealerSearchChange(e.target.value)}
                      onFocus={() => dealerSearch.trim() && setShowSuggestions(true)}
                    />
                    {showSuggestions && dealerSuggestions.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                        {dealerSuggestions.map(d => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => handleSelectDealer(d)}
                            className="w-full px-4 py-2 text-left text-xs hover:bg-slate-50 border-b last:border-0"
                          >
                            <div className="font-bold">{d.name}</div>
                            <div className="text-[9px] text-slate-500">{d.address}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Show Notes</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={showNotes ? 'default' : 'outline'} size="sm" className="h-10 text-[11px] font-black rounded-xl gap-1.5" onClick={() => setShowNotes(true)}>
                    <MessageSquare className="w-3.5 h-3.5" /> ON
                  </Button>
                  <Button variant={!showNotes ? 'default' : 'outline'} size="sm" className="h-10 text-[11px] font-black rounded-xl gap-1.5" onClick={() => setShowNotes(false)}>
                    <MessageSquareOff className="w-3.5 h-3.5" /> OFF
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400">From Date</Label>
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400">To Date</Label>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="pt-4 flex flex-col gap-2">
                <Button variant="outline" onClick={handleReset} className="w-full rounded-xl gap-2 h-10 font-bold">
                  <RotateCcw className="w-4 h-4" /> Reset Filters
                </Button>
                <Button variant="default" onClick={handlePrint} disabled={!selectedDealerId} className="w-full rounded-xl gap-2 h-10 font-bold bg-slate-900">
                  <Printer className="w-4 h-4" /> Print Statement
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Results */}
        <div className="flex-1 space-y-6">
          {selectedDealerId ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-red-50 border-red-100 shadow-none">
                  <CardHeader className="pb-2 px-4 pt-4"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-red-600 flex items-center"><ArrowUpRight className="w-4 h-4 mr-2" /> Total Billed</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-4"><div className="text-3xl font-black text-red-900">{totals.debit.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card className="bg-green-50 border-green-100 shadow-none">
                  <CardHeader className="pb-2 px-4 pt-4"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-green-600 flex items-center"><ArrowDownLeft className="w-4 h-4 mr-2" /> Total Paid</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-4"><div className="text-3xl font-black text-green-900">{totals.credit.toLocaleString('en-IN')}</div></CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-100 shadow-none">
                  <CardHeader className="pb-2 px-4 pt-4"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center"><Wallet className="w-4 h-4 mr-2" /> Net Balance</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-4"><div className="text-3xl font-black text-blue-900">{totals.balance.toLocaleString('en-IN')}</div></CardContent>
                </Card>
              </div>

              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b py-3">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Transaction History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/30">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase py-3">Date</TableHead>
                          <TableHead className="text-[10px] font-black uppercase py-3">Reference</TableHead>
                          <TableHead className="text-[10px] font-black uppercase py-3">Note</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase py-3">Credit (+)</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase py-3">Debit (-)</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase py-3">Running Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledger.map((item, i) => {
                          const order = orders.find(o => o.id === item.ref);
                          return (
                            <TableRow key={`${item.ref}-${i}`} className="hover:bg-slate-50 transition-colors border-slate-100">
                              <TableCell className="py-4 text-[11px] font-bold text-slate-500 uppercase">{formatDisplayDate(item.date)}</TableCell>
                              <TableCell className="font-black text-slate-900 text-xs">
                                {order ? (
                                  <Button 
                                    variant="ghost" 
                                    className="p-0 h-auto text-blue-600 hover:text-blue-800 font-black"
                                    onClick={() => {
                                      setSelectedOrderForInvoice(order);
                                      setShowInvoiceDialog(true);
                                    }}
                                  >
                                    {item.ref}
                                  </Button>
                                ) : (
                                  item.ref
                                )}
                              </TableCell>
                              <TableCell className="max-w-[200px]">
                                <div className="text-[11px] font-bold text-slate-700 leading-relaxed uppercase tracking-tight">{item.notes}</div>
                              </TableCell>
                              <TableCell className="text-right text-green-600 font-black text-sm">{item.credit > 0 ? `${item.credit.toLocaleString('en-IN')}` : '-'}</TableCell>
                              <TableCell className="text-right text-red-600 font-black text-sm">{item.debit > 0 ? `${item.debit.toLocaleString('en-IN')}` : '-'}</TableCell>
                              <TableCell className={`text-right font-black text-sm ${item.runningBalance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                {item.runningBalance.toLocaleString('en-IN')}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="h-[400px] flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Wallet className="w-8 h-8 text-slate-200" />
              </div>
              <h3 className="text-lg font-black text-slate-800">No Dealer Selected</h3>
              <p className="text-slate-400 font-bold text-sm mt-1">Please select a dealer from the left sidebar to view the statement.</p>
            </div>
          )}
        </div>
      </div>

      {showInvoiceDialog && selectedOrderForInvoice && config && (
        <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto p-0">
            <DialogHeader className="px-6 pt-6 pb-0">
              <div className="flex justify-between items-center">
                <DialogTitle>Invoice: {selectedOrderForInvoice.id}</DialogTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowInvoiceDialog(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </DialogHeader>
            <div className="p-6">
              <div 
                className="bg-white shadow-sm border rounded-lg overflow-auto"
                dangerouslySetInnerHTML={{ 
                  __html: generateInvoiceHtml(selectedOrderForInvoice, selectedOrderForInvoice.isQuote, config) 
                }} 
              />
              <div className="flex justify-end gap-2 mt-4">
                <Button 
                  onClick={() => {
                    printDoc(generateInvoiceHtml(selectedOrderForInvoice, selectedOrderForInvoice.isQuote, config));
                  }}
                  className="bg-slate-900"
                >
                  <Printer className="w-4 h-4 mr-2" /> Print
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
};

export default Balance;
