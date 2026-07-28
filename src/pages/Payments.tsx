"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Dealer, Payment, Order } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { showSuccess, showError } from '@/utils/toast';
import { getTodayISO } from '@/utils/date';
import { numberToWords } from '@/lib/utils';
import { CreditCard, Plus, Trash2, Edit, Printer, Download, Calendar, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const Payments = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [editingPayment, setEditingPayment] = useState<Partial<Payment> | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [dealerSearch, setDealerSearch] = useState('');
  const [dealerSuggestions, setDealerSuggestions] = useState<Dealer[]>([]);
  const [amount, setAmount] = useState<string>('');
  const [type, setType] = useState<Payment['type']>('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayISO());
  const [historyOpen, setHistoryOpen] = useState(false);

  const currentUser = api.getCurrentUser();

  const firstOfMonth = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  };

  const formatDDMMYYYY = (isoDate: string | undefined | null): string => {
    if (!isoDate) return '—';
    const s = String(isoDate).split('T')[0];
    const [y, m, d] = s.split('-');
    if (!y || !m || !d) return String(isoDate);
    return `${d}-${m}-${y}`;
  };

  const [statementFromDate, setStatementFromDate] = useState(firstOfMonth());
  const [statementToDate, setStatementToDate] = useState(getTodayISO());

  useEffect(() => {
    const loadData = async () => {
      setDealers(await api.getDealers());
      const p = await api.getPayments();
      setPayments((Array.isArray(p) ? p : []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setOrders(await api.getOrders() || []);
      setReference(await api.getNextPaymentReference());
    };
    loadData();
  }, []);

  const dealerBalanceMap = useMemo(() => {
    const map: Record<string, number> = {};
    const safeDealers = Array.isArray(dealers) ? dealers : [];
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safePayments = Array.isArray(payments) ? payments : [];

    safeDealers.forEach(d => {
      if (!d) return;
      const billed = safeOrders
        .filter(o => o && o.status === 'approved' && o.dealerId === d.id)
        .reduce((sum, o) => sum + Number(o.netTotal || 0), 0);
      const paid = safePayments
        .filter(p => p && p.dealerId === d.id)
        .reduce((sum, p) => {
          const amt = Number(p.amount || 0);
          if (p.type === 'Last balance Due') return sum - amt;
          return sum + amt;
        }, 0);
      map[d.id] = paid - billed;
    });
    return map;
  }, [dealers, orders, payments]);

  const filteredPayments = useMemo(() => {
    if (!historySearch.trim()) return payments;
    const search = historySearch.toLowerCase();
    return payments.filter(p => 
      p.dealerName.toLowerCase().includes(search) || 
      (p.notes && p.notes.toLowerCase().includes(search)) ||
      (p.reference && p.reference.toLowerCase().includes(search))
    );
  }, [payments, historySearch]);

  const statementPayments = useMemo(() => {
    return payments.filter(p => {
      if (!p) return false;
      if (statementFromDate && p.date < statementFromDate) return false;
      if (statementToDate && p.date > statementToDate) return false;
      if (historySearch.trim()) {
        const search = historySearch.toLowerCase();
        const matches =
          p.dealerName.toLowerCase().includes(search) ||
          (p.notes && p.notes.toLowerCase().includes(search)) ||
          (p.reference && p.reference.toLowerCase().includes(search));
        if (!matches) return false;
      }
      return true;
    }).slice().sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return da === db ? 0 : da > db ? 1 : -1;
    });
  }, [payments, statementFromDate, statementToDate, historySearch]);

  const statementTotals = useMemo(() => {
    let total = 0;
    let totalDue = 0;
    let totalOther = 0;
    statementPayments.forEach(p => {
      const amt = Number(p.amount || 0);
      total += amt;
      if (p.type === 'Last balance Due') totalDue += amt;
      else totalOther += amt;
    });
    return { total, totalDue, totalOther, count: statementPayments.length };
  }, [statementPayments]);

  const escapeCsv = (v: any) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };

  const handleDownloadCsv = () => {
    if (statementPayments.length === 0) { showError('No payment records to export'); return; }
    const header = ['Date', 'Reference', 'Dealer', 'Type', 'Note', 'Amount'];
    const rows = statementPayments.map(p => [
      formatDDMMYYYY(p.date),
      p.reference || '',
      p.dealerName,
      p.type,
      p.notes || '',
      Number(p.amount || 0).toFixed(2)
    ]);
    const csv = [header, ...rows].map(r => r.map(escapeCsv).join(',')).join('\n');
    try {
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments-statement-${formatDDMMYYYY(statementFromDate) || 'start'}-to-${formatDDMMYYYY(statementToDate) || 'end'}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess('Statement downloaded (CSV)');
    } catch (e) {
      showError('Failed to generate CSV');
    }
  };

  const handlePrintStatement = () => {
    if (statementPayments.length === 0) { showError('No payment records to print'); return; }
    const html = `
      <html>
        <head>
          <style>
            * { box-sizing: border-box; }
            body { font-family: 'Times New Roman', Times, serif; padding: 28px; color: #000; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 14px; margin-bottom: 22px; }
            .company { font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
            .title { font-size: 16px; margin-top: 4px; font-weight: bold; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; table-layout: fixed; }
            th, td { border: 1px solid #000; padding: 8px 10px; font-size: 12px; vertical-align: top; }
            th { text-align: left; font-weight: bold; text-transform: uppercase; background: #f3f4f6; }
            .text-right { text-align: right; }
            .summary { margin-top: 20px; border: 1px solid #000; padding: 12px 16px; }
            .summary-row { display: flex; justify-content: space-between; font-weight: bold; padding: 2px 0; font-size: 13px; }
            .grand { padding-top: 6px; margin-top: 6px; border-top: 1px dashed #000; font-size: 14px; }
            .footer { margin-top: 28px; text-align: right; font-size: 12px; color: #333; }
            .date-col { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            @media print {
              .date-col { white-space: nowrap; }
              td, th { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">Payment Collection Statement</div>
            <div class="title">Payment Receipts &amp; Adjustments Report</div>
          </div>
          <div class="meta">
            <div>
              <strong>Period:</strong> ${formatDDMMYYYY(statementFromDate)} to ${formatDDMMYYYY(statementToDate)}<br>
              <strong>Records:</strong> ${statementTotals.count}
            </div>
            <div class="text-right">
              <strong>Generated On:</strong> ${formatDDMMYYYY(new Date().toISOString().split('T')[0])}<br>
              <strong>By:</strong> ${currentUser?.name || 'System'}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:13%;" class="date-col">Date</th>
                <th style="width:14%;">Reference</th>
                <th style="width:18%;">Dealer</th>
                <th style="width:13%;">Type</th>
                <th style="width:27%;">Note</th>
                <th style="width:15%;" class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${statementPayments.map(p => `
                <tr>
                  <td class="date-col">${formatDDMMYYYY(p.date)}</td>
                  <td>${p.reference || ''}</td>
                  <td>${p.dealerName}</td>
                  <td>${p.type}</td>
                  <td>${p.notes || ''}</td>
                  <td class="text-right">${Number(p.amount || 0).toLocaleString('en-IN')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="summary">
            <div class="summary-row"><span>Collected (Cash/Bank/Cheque etc)</span><span>${statementTotals.totalOther.toLocaleString('en-IN')}</span></div>
            <div class="summary-row"><span>Last Balance Due Adjustments (Debit)</span><span>${statementTotals.totalDue.toLocaleString('en-IN')}</span></div>
            <div class="summary-row grand"><span>Grand Total (Net)</span><span>${statementTotals.total.toLocaleString('en-IN')}</span></div>
          </div>
          <div class="footer">
            Printed at ${new Date().toLocaleString('en-GB')}
          </div>
        </body>
      </html>
    `;
    try {
      // Fallback: trigger print via window if no printDoc from utils
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const w = window.open('', '_blank', 'width=900,height=1100');
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
        setTimeout(() => { w.focus(); w.print(); }, 250);
      } else {
        showError('Pop-up blocked, enable pop-ups for print');
      }
    } catch (e) {
      showError('Failed to print');
    }
  };

  const handleDealerSearch = (value: string) => {
    setDealerSearch(value);
    setSelectedDealer(null);
    if (value.length < 1) {
      setDealerSuggestions([]);
      return;
    }
    const safeDealers = Array.isArray(dealers) ? dealers : [];
    setDealerSuggestions(safeDealers.filter(d => d && d.name && d.name.toLowerCase().includes(value.toLowerCase())));
  };

  const pickDealer = (dealer: Dealer) => {
    setSelectedDealer(dealer);
    setDealerSearch('');
    setDealerSuggestions([]);
  };

  const formatIndianAmount = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    const [intPart, decPart] = sanitized.split('.');
    const formattedInt = Number(intPart || 0).toLocaleString('en-IN');
    return decPart !== undefined ? `${formattedInt}.${decPart.slice(0, 2)}` : formattedInt;
  };

  const cleanAmount = (value: string) => Number(value.replace(/,/g, ''));

  const handleSave = async () => {
    if (!selectedDealer || !amount) return showError("Select dealer and enter amount");
    
    const payment: Payment = {
      id: editingPayment?.id || await api.getNextPaymentId(),
      dealerId: selectedDealer.id,
      dealerName: selectedDealer.name,
      date: paymentDate,
      type,
      amount: cleanAmount(amount),
      reference,
      notes
    };

    await api.savePayment(payment);
    const p = await api.getPayments() || [];
    setPayments([...p].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setDealers(await api.getDealers() || []);
    
    // Reset form
    setSelectedDealer(null);
    setDealerSearch('');
    setAmount('');
    setReference(await api.getNextPaymentReference());
    setNotes('');
    setPaymentDate(getTodayISO());
    setEditingPayment(null);
    showSuccess("Payment recorded successfully");
  };

  const handleEdit = (p: Payment) => {
    setEditingPayment(p);
    const dealer = dealers.find(d => d.id === p.dealerId);
    if (dealer) {
      setSelectedDealer(dealer);
      setDealerSearch('');
    }
    setAmount(formatIndianAmount(String(p.amount)));
    setType(p.type);
    setReference(p.reference || '');
    setNotes(p.notes || '');
    setPaymentDate(p.date);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this payment record?")) {
      await api.deletePayment(id);
      const p = await api.getPayments();
      setPayments((Array.isArray(p) ? p : []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setDealers(await api.getDealers());
      showSuccess("Payment deleted");
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
                <Plus className="w-3.5 h-3.5 mr-2" /> {editingPayment ? 'Edit' : 'New'} Collection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Date</Label>
                <Input type="date" className="h-9 text-xs rounded-xl" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Dealer</Label>
                {selectedDealer ? (
                  <div className="flex items-center justify-between bg-blue-50/50 border border-blue-100 p-2 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0 pl-1">
                        <div className="text-xs font-bold text-slate-900 truncate">{selectedDealer.name}</div>
                        <div className="text-[9px] text-blue-600 font-bold">Due: {dealerBalanceMap[selectedDealer.id]?.toLocaleString() || '0'}</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400 hover:text-red-500 shrink-0" onClick={() => setSelectedDealer(null)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      autoComplete="off"
                      className="h-9 text-xs rounded-xl border-slate-200"
                      value={dealerSearch}
                      onChange={(e) => handleDealerSearch(e.target.value)}
                      placeholder="Search dealer..."
                    />
                    {dealerSuggestions.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                        <div className="max-h-60 overflow-y-auto">
                          {dealerSuggestions.slice(0, 8).map(d => (
                            <button
                              key={d.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickDealer(d)}
                              className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 border-b last:border-0"
                            >
                              <div className="font-bold">{d.name}</div>
                              <div className="text-[9px] text-slate-500">{d.address}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Amount</Label>
                <Input className="h-9 text-xs rounded-xl font-black" value={amount} onChange={e => setAmount(formatIndianAmount(e.target.value))} />
                {amount && (
                  <p className="text-[10px] text-slate-900 font-bold mt-1 px-1">
                    {numberToWords(cleanAmount(amount))} Taka
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Method</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Purchase">Purchase</SelectItem>
                    <SelectItem value="Adjustment">Adjustment</SelectItem>
                    {currentUser?.role === 'admin' && <SelectItem value="Last balance Due">Last balance Due</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Reference</Label>
                <Input className="h-9 text-xs rounded-xl" value={reference} onChange={e => setReference(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Notes</Label>
                <Input className="h-9 text-xs rounded-xl" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <div className="pt-2 space-y-2">
                <Button className="w-full bg-slate-900 h-10 rounded-xl font-bold text-xs" onClick={handleSave}>
                  {editingPayment ? 'Update' : 'Save'} Collection
                </Button>
                {editingPayment && (
                  <Button variant="ghost" className="w-full h-9 rounded-xl text-xs" onClick={async () => {
                    setEditingPayment(null);
                    setSelectedDealer(null);
                    setDealerSearch('');
                    setAmount('');
                    setReference(await api.getNextPaymentReference());
                    setNotes('');
                    setPaymentDate(getTodayISO());
                  }}>Cancel</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1 border-none shadow-sm overflow-hidden flex flex-col">
            <CardHeader className="bg-slate-50/50 border-b py-3 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="flex items-center text-[11px] md:text-xs font-black uppercase tracking-widest text-slate-500">
                  <CreditCard className="w-4 h-4 mr-2" /> Payment History
                </CardTitle>
                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-2 w-full lg:w-auto">
                  <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                    <div className="relative flex-1 sm:max-w-[180px]">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        type="date"
                        className="h-9 text-[11px] rounded-xl pl-8 pr-2 w-full"
                        value={statementFromDate}
                        onChange={e => setStatementFromDate(e.target.value)}
                        title="Statement From"
                      />
                    </div>
                    <div className="relative flex-1 sm:max-w-[180px]">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        type="date"
                        className="h-9 text-[11px] rounded-xl pl-8 pr-2 w-full"
                        value={statementToDate}
                        onChange={e => setStatementToDate(e.target.value)}
                        title="Statement To"
                      />
                    </div>
                  </div>
                  <div className="flex gap-1.5 w-full sm:w-auto shrink-0">
                    <Button
                      variant="secondary"
                      type="button"
                      className="h-9 px-3 text-[11px] font-black rounded-xl gap-1.5 flex-1 sm:flex-none bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                      onClick={handlePrintStatement}
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Statement
                    </Button>
                    <Button
                      variant="secondary"
                      type="button"
                      className="h-9 px-3 text-[11px] font-black rounded-xl gap-1.5 flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 text-white border border-slate-900"
                      onClick={handleDownloadCsv}
                    >
                      <Download className="w-3.5 h-3.5" /> Download CSV
                    </Button>
                  </div>
                  <div className="relative flex-1 min-w-0 w-full lg:w-[240px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      className="h-9 text-[11px] rounded-xl pl-8 pr-2 w-full"
                      placeholder="Search dealer, notes, reference..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 items-center justify-between">
                <div className="flex gap-2 items-center flex-wrap">
                  <Badge variant="outline" className="rounded-lg text-[10px] font-black uppercase gap-1 border border-slate-200 bg-white text-slate-700">
                    Showing: {filteredPayments.length} Records
                  </Badge>
                  <Badge variant="outline" className="rounded-lg text-[10px] font-black uppercase gap-1 border border-emerald-200 bg-emerald-50 text-emerald-800">
                    Statement Range: {statementTotals.count} records
                  </Badge>
                  <Badge variant="outline" className="rounded-lg text-[10px] font-black uppercase gap-1 border border-blue-200 bg-blue-50 text-blue-800">
                    Net Total: {statementTotals.total.toLocaleString('en-IN')}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <div className="h-full overflow-auto scrollbar-thin">
                <Table className="w-full">
                  <TableHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-[10px] font-black uppercase py-3 h-10 px-3 tracking-widest text-slate-400">Date</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-3 h-10 px-3 tracking-widest text-slate-400">ID</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-3 h-10 px-3 tracking-widest text-slate-400">Dealer</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-3 h-10 px-3 tracking-widest text-slate-400">Type</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-3 h-10 px-3 tracking-widest text-slate-400">Notes</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-3 h-10 px-3 tracking-widest text-slate-400 text-right">Amount</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-3 h-10 px-3 tracking-widest text-slate-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((p) => (
                      <TableRow key={p.id} className="hover:bg-slate-50/50 border-slate-50 group">
                        <TableCell className="py-4 text-[11px] font-bold text-slate-500 uppercase px-3 h-12 whitespace-nowrap">
                          {formatDDMMYYYY(p.date)}
                        </TableCell>
                        <TableCell className="py-2 px-3 h-12">
                          <div className="text-xs font-black text-blue-600">{p.id}</div>
                        </TableCell>
                        <TableCell className="py-2 px-3 h-12">
                          <div className="text-xs font-bold text-slate-900">{p.dealerName}</div>
                        </TableCell>
                        <TableCell className="py-2 px-3 h-12">
                          <span className={cn(
                            "text-[9px] px-2 py-0.5 rounded-full font-black uppercase border",
                            p.type === 'Cash' ? "bg-green-50 text-green-600 border-green-100" :
                            p.type === 'Bank Transfer' ? "bg-blue-50 text-blue-600 border-blue-100" :
                            "bg-slate-50 text-slate-600 border-slate-100"
                          )}>
                            {p.type}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 px-3 h-12 max-w-[200px] truncate text-[11px] font-bold text-slate-700 uppercase tracking-tight">
                          {p.notes}
                        </TableCell>
                        <TableCell className="text-right py-2 px-3 h-12 whitespace-nowrap font-black text-sm text-slate-900">
                          {p.amount.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="text-right py-2 px-3 h-12 space-x-1">
                          <Button variant="secondary" size="icon" className="h-7 w-7 text-blue-600 bg-blue-50 border-blue-100" onClick={() => handleEdit(p)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="secondary" size="icon" className="h-7 w-7 text-red-500 bg-red-50 border-red-100" onClick={() => handleDelete(p.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Payments;
