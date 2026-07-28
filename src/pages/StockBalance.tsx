"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Product, Order, SendAmountEntry, ProductStockEntry, ProductStockTransfer } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess } from '@/utils/toast';
import { getTodayISO } from '@/utils/date';
import { Package, MapPin, TrendingUp, DollarSign, Send, History, Edit, Trash2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

const StockBalance = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sendAmounts, setSendAmounts] = useState<SendAmountEntry[]>([]);
  const [stockEntries, setStockEntries] = useState<ProductStockEntry[]>([]);
  const [stockTransfers, setStockTransfers] = useState<ProductStockTransfer[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SendAmountEntry | null>(null);
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [stockHistoryOpen, setStockHistoryOpen] = useState(false);
  const [stockHistoryDate, setStockHistoryDate] = useState(getTodayISO());
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [stockReportStartDate, setStockReportStartDate] = useState(getTodayISO());
  const [stockReportEndDate, setStockReportEndDate] = useState(getTodayISO());
  const [stockReportOpen, setStockReportOpen] = useState(false);
  
  const [sendAmount, setSendAmount] = useState<number | string>('');
  const [sendLocation, setSendLocation] = useState<'dhaka' | 'chittagong'>('chittagong');
  const [sendNote, setSendNote] = useState('');
  const [sendDate, setSendDate] = useState(getTodayISO());

  useEffect(() => {
    const loadData = async () => {
      const p = await api.getProducts();
      const o = await api.getOrders();
      const s = await api.getSendAmounts();
      const se = await api.getProductStockEntries();
      const st = await api.getProductStockTransfers();
      setProducts(Array.isArray(p) ? p : []);
      setOrders(Array.isArray(o) ? o : []);
      setSendAmounts(Array.isArray(s) ? s : []);
      setStockEntries(Array.isArray(se) ? se : []);
      setStockTransfers(Array.isArray(st) ? st : []);
    };
    loadData();
  }, []);

  const balanceData = useMemo(() => {
    let dhakaValue = 0;
    let ctgValue = 0;
    let dhakaSold = 0;
    let ctgSold = 0;

    const safeProducts = Array.isArray(products) ? products : [];
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeSendAmounts = Array.isArray(sendAmounts) ? sendAmounts : [];

    safeProducts.forEach(p => {
      const lowestPrice = (Array.isArray(p.slabs) && p.slabs.length > 0) 
        ? Math.min(...p.slabs.map(s => Number(s.price || 0))) 
        : Number(p.retailPrice || 0);
      dhakaValue += Number(p.dhaka || 0) * lowestPrice;
      ctgValue += Number(p.chittagong || 0) * lowestPrice;
    });

    safeOrders.filter(o => !o.isQuote).forEach(o => {
      if (Array.isArray(o.items)) {
        o.items.forEach(item => {
          if (item.location === 'dhaka') dhakaSold += Number(item.total || 0);
          else ctgSold += Number(item.total || 0);
        });
      }
    });

    const dhakaSent = safeSendAmounts.filter(s => s && s.location === 'dhaka').reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const ctgSent = safeSendAmounts.filter(s => s && s.location === 'chittagong').reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

    return {
      dhaka: { value: dhakaValue, sold: dhakaSold, sent: dhakaSent, due: dhakaSold - dhakaSent },
      ctg: { value: ctgValue, sold: ctgSold, sent: ctgSent, due: ctgSold - ctgSent }
    };
  }, [products, orders, sendAmounts]);

  const handleSendAmount = async () => {
    if (!sendAmount) return;
    const entry = {
      id: editingEntry?.id || `SEND-${Date.now()}`,
      date: sendDate,
      location: sendLocation,
      amount: Number(sendAmount),
      note: sendNote
    };
    await api.saveSendAmount(entry);
    setSendAmounts(await api.getSendAmounts());
    setSendAmount('');
    setSendNote('');
    setSendDate(getTodayISO());
    setEditingEntry(null);
    setShowEntryDialog(false);
    showSuccess(editingEntry ? "Entry updated" : "Send amount recorded");
  };

  const handleEditEntry = (entry: SendAmountEntry) => {
    setEditingEntry(entry);
    setSendAmount(entry.amount);
    setSendLocation(entry.location);
    setSendNote(entry.note || '');
    setSendDate(entry.date);
    setShowEntryDialog(true);
    setHistoryOpen(false);
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Delete this record?')) return;
    await api.deleteSendAmount(id);
    setSendAmounts(await api.getSendAmounts());
    showSuccess("Entry deleted");
  };

  const calculateStockForDate = (productId: string, date: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return null;

    let dhakaOpening = 0;
    let ctgOpening = 0;
    let dhakaAdded = 0;
    let ctgAdded = 0;
    let dhakaRemoved = 0;
    let ctgRemoved = 0;
    let dhakaTransferredIn = 0;
    let ctgTransferredIn = 0;
    let dhakaTransferredOut = 0;
    let ctgTransferredOut = 0;

    // Process all stock entries before/on the date
    stockEntries.forEach(se => {
      if (se.productId === productId) {
        if (se.date <= date) {
          if (se.date < date) {
            if (se.location === 'dhaka') dhakaOpening += Number(se.quantity) || 0;
            else ctgOpening += Number(se.quantity) || 0;
          } else {
            if (se.location === 'dhaka') dhakaAdded += Number(se.quantity) || 0;
            else ctgAdded += Number(se.quantity) || 0;
          }
        }
      }
    });

    // Process all stock transfers
    stockTransfers.forEach(st => {
      if (st.productId === productId) {
        if (st.date <= date) {
          if (st.date < date) {
            if (st.from === 'dhaka') dhakaOpening -= Number(st.quantity) || 0;
            else if (st.from === 'chittagong') ctgOpening -= Number(st.quantity) || 0;
            if (st.to === 'dhaka') dhakaOpening += Number(st.quantity) || 0;
            else if (st.to === 'chittagong') ctgOpening += Number(st.quantity) || 0;
          } else {
            if (st.from === 'dhaka') dhakaTransferredOut += Number(st.quantity) || 0;
            else if (st.from === 'chittagong') ctgTransferredOut += Number(st.quantity) || 0;
            if (st.to === 'dhaka') dhakaTransferredIn += Number(st.quantity) || 0;
            else if (st.to === 'chittagong') ctgTransferredIn += Number(st.quantity) || 0;
          }
        }
      }
    });

    // Process orders
    orders.filter(o => !o.isQuote && o.status === 'approved' && o.date <= date).forEach(o => {
      o.items.forEach(item => {
        if (item.productId === productId) {
          if (o.date < date) {
            if (item.location === 'dhaka') dhakaOpening -= Number(item.quantity) || 0;
            else ctgOpening -= Number(item.quantity) || 0;
          } else {
            if (item.location === 'dhaka') dhakaRemoved += Number(item.quantity) || 0;
            else ctgRemoved += Number(item.quantity) || 0;
          }
        }
      });
    });

    return {
      product,
      dhaka: {
        opening: dhakaOpening,
        added: dhakaAdded + dhakaTransferredIn,
        removed: dhakaRemoved + dhakaTransferredOut,
        closing: dhakaOpening + dhakaAdded + dhakaTransferredIn - dhakaRemoved - dhakaTransferredOut
      },
      ctg: {
        opening: ctgOpening,
        added: ctgAdded + ctgTransferredIn,
        removed: ctgRemoved + ctgTransferredOut,
        closing: ctgOpening + ctgAdded + ctgTransferredIn - ctgRemoved - ctgTransferredOut
      }
    };
  };

  const calculateStockReportForRange = (startDate: string, endDate: string) => {
    return products.filter(p => p.status !== 'inactive').map(product => {
      let totalSold = 0;
      let dhakaSold = 0;
      let ctgSold = 0;

      // Calculate sold quantities in date range
      orders.filter(o => !o.isQuote && o.status === 'approved' && o.date >= startDate && o.date <= endDate).forEach(o => {
        o.items.forEach(item => {
          if (item.productId === product.id) {
            if (item.location === 'dhaka') dhakaSold += Number(item.quantity) || 0;
            else ctgSold += Number(item.quantity) || 0;
            totalSold += Number(item.quantity) || 0;
          }
        });
      });

      // Calculate opening stock at start date and closing stock at end date
      const openingData = calculateStockForDate(product.id, startDate);
      const closingData = calculateStockForDate(product.id, endDate);

      return {
        product,
        openingStock: {
          dhaka: openingData?.dhaka.opening ?? 0,
          ctg: openingData?.ctg.opening ?? 0,
          total: (openingData?.dhaka.opening ?? 0) + (openingData?.ctg.opening ?? 0)
        },
        sold: {
          dhaka: dhakaSold,
          ctg: ctgSold,
          total: totalSold
        },
        closingStock: {
          dhaka: closingData?.dhaka.closing ?? 0,
          ctg: closingData?.ctg.closing ?? 0,
          total: (closingData?.dhaka.closing ?? 0) + (closingData?.ctg.closing ?? 0)
        }
      };
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-800">Warehouse Inventory & Accounts</h1>
          <Dialog open={showEntryDialog} onOpenChange={setShowEntryDialog}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900" onClick={() => { setEditingEntry(null); setSendAmount(''); setSendNote(''); setSendDate(getTodayISO()); }}><Send className="w-4 h-4 mr-2" /> Record Send to Main</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingEntry ? 'Edit Send Record' : 'Send Amount to Main Office'}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={sendDate} onChange={e => setSendDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select value={sendLocation} onValueChange={(v: any) => setSendLocation(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dhaka">Dhaka Warehouse</SelectItem>
                      <SelectItem value="chittagong">Chittagong Warehouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" value={sendAmount} onChange={e => setSendAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Note</Label>
                  <Input value={sendNote} onChange={e => setSendNote(e.target.value)} placeholder="e.g. Bank deposit ref..." />
                </div>
                <Button className="w-full bg-slate-900" onClick={handleSendAmount}>{editingEntry ? 'Update Entry' : 'Save Entry'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {['dhaka', 'chittagong'].map((loc) => {
            const data = loc === 'dhaka' ? balanceData.dhaka : balanceData.ctg;
            return (
              <Card key={loc} className={cn("border-none shadow-lg overflow-hidden relative group", loc === 'dhaka' ? "bg-white" : "bg-white")}>
                <div className={cn("absolute top-0 left-0 w-1.5 h-full", loc === 'dhaka' ? "bg-blue-600" : "bg-orange-600")} />
                <CardHeader className="pb-4 border-b border-slate-50 bg-slate-50/30">
                  <CardTitle className={cn("flex items-center text-xs font-black uppercase tracking-widest", loc === 'dhaka' ? "text-blue-600" : "text-orange-600")}>
                    <MapPin className="w-4 h-4 mr-2" /> {loc} Warehouse Balance
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-x-8 gap-y-6 pt-6">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Stock Value</p>
                    <p className="text-2xl font-black text-slate-900">{data.value.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Sold</p>
                    <p className="text-2xl font-black text-emerald-600">{data.sold.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Sent to Main</p>
                    <p className="text-2xl font-black text-blue-600">{data.sent.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1.5 p-3 rounded-2xl bg-red-50/50 border border-red-100/50">
                    <p className="text-[10px] font-black uppercase text-red-400 tracking-wider">Due to Main</p>
                    <p className="text-2xl font-black text-red-600">{data.due.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden flex flex-col">
            <CardHeader className="bg-slate-50/50 border-b flex items-center justify-between py-4 px-6">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">Product Wise Inventory</CardTitle>
              <Button variant="outline" className="h-9 text-xs font-bold rounded-xl" onClick={() => setInventoryOpen(true)}>Full Report</Button>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <div className="max-h-[60vh] overflow-auto scrollbar-thin">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="text-[10px] font-black uppercase py-4 px-6">Product Details</TableHead>
                    <TableHead className="text-[10px] font-black uppercase py-4 px-6">Dhaka</TableHead>
                    <TableHead className="text-[10px] font-black uppercase py-4 px-6">CTG</TableHead>
                    <TableHead className="text-[10px] font-black uppercase py-4 px-6">Total Qty</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase py-4 px-6">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(Array.isArray(products) ? products : []).map((p) => {
                    const lowestPrice = (Array.isArray(p.slabs) && p.slabs.length > 0) ? Math.min(...p.slabs.map(s => s.price)) : p.retailPrice;
                    const totalQty = (p.dhaka || 0) + (p.chittagong || 0);
                    return (
                      <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors border-slate-50">
                        <TableCell className="py-4 px-6">
                          <div className="font-black text-slate-900 text-sm">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">{p.version}</div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <span className="text-blue-600 font-black text-sm">{p.dhaka}</span>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <span className="text-orange-600 font-black text-sm">{p.chittagong}</span>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="bg-slate-100 w-fit px-3 py-1 rounded-lg font-black text-sm">{totalQty}</div>
                        </TableCell>
                        <TableCell className="text-right py-4 px-6 font-black text-slate-900">
                          {(totalQty * lowestPrice).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="flex items-center text-sm font-bold uppercase tracking-wider text-slate-500">
                <History className="w-4 h-4 mr-2" /> Reports & History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <Button variant="outline" className="w-full h-11" onClick={() => setHistoryOpen(true)}>
                View Send History
              </Button>
              <Button variant="outline" className="w-full h-11" onClick={() => setStockHistoryOpen(true)}>
                <Calendar className="w-4 h-4 mr-2" /> Stock History per Date
              </Button>
              <Button variant="outline" className="w-full h-11" onClick={() => setStockReportOpen(true)}>
                <TrendingUp className="w-4 h-4 mr-2" /> Stock Report (Date Range)
              </Button>
              <p className="text-[10px] text-slate-500 mt-3 uppercase font-bold">
                {sendAmounts.length} send records, {stockEntries.length} stock entries
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={inventoryOpen} onOpenChange={setInventoryOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-4 h-4" /> Product Wise Inventory
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/30">
                  <TableHead className="text-xs font-bold uppercase">Product</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Dhaka</TableHead>
                  <TableHead className="text-xs font-bold uppercase">CTG</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Total</TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Array.isArray(products) ? products : []).map((p) => {
                  const lowestPrice = (Array.isArray(p.slabs) && p.slabs.length > 0) ? Math.min(...p.slabs.map(s => s.price)) : p.retailPrice;
                  const totalQty = (p.dhaka || 0) + (p.chittagong || 0);
                  return (
                    <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.version}</div>
                      </TableCell>
                      <TableCell className="text-blue-600 font-medium">{p.dhaka}</TableCell>
                      <TableCell className="text-orange-600 font-medium">{p.chittagong}</TableCell>
                      <TableCell className="font-black">{totalQty}</TableCell>
                      <TableCell className="text-right font-bold">{(totalQty * lowestPrice).toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4" /> Send History
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/30">
                  <TableHead className="text-xs font-bold uppercase">Date</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Loc</TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase">Amount</TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sendAmounts.slice().reverse().slice(0, 50).map((s) => (
                  <TableRow key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="text-[10px] text-slate-500">{s.date}</TableCell>
                    <TableCell className="capitalize text-[10px] font-bold">{s.location.charAt(0)}</TableCell>
                    <TableCell className="text-right font-bold text-blue-600">{s.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditEntry(s)}><Edit className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => handleDeleteEntry(s.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={stockHistoryOpen} onOpenChange={setStockHistoryOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Stock History per Date
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Select Date</Label>
                <Input type="date" value={stockHistoryDate} onChange={e => setStockHistoryDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Select Product</Label>
                <Select value={selectedProduct || ''} onValueChange={setSelectedProduct}>
                  <SelectTrigger><SelectValue placeholder="Choose a product" /></SelectTrigger>
                  <SelectContent>
                    {products.filter(p => p.status !== 'inactive').map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.version})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedProduct && calculateStockForDate(selectedProduct, stockHistoryDate) && (
              <div className="space-y-4">
                <Card className="border-none shadow-sm">
                  <CardHeader className="bg-slate-50/50 border-b">
                    <CardTitle className="text-sm font-bold">
                      {calculateStockForDate(selectedProduct, stockHistoryDate)?.product.name} ({calculateStockForDate(selectedProduct, stockHistoryDate)?.product.version}) - {stockHistoryDate}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/30">
                          <TableHead className="text-xs font-bold uppercase">Location</TableHead>
                          <TableHead className="text-xs font-bold uppercase text-center">Opening Stock</TableHead>
                          <TableHead className="text-xs font-bold uppercase text-center">Stock Added</TableHead>
                          <TableHead className="text-xs font-bold uppercase text-center">Stock Removed</TableHead>
                          <TableHead className="text-xs font-bold uppercase text-center">Closing Stock</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-bold">Dhaka</TableCell>
                          <TableCell className="text-center">
                            {calculateStockForDate(selectedProduct, stockHistoryDate)?.dhaka.opening}
                          </TableCell>
                          <TableCell className="text-center text-green-600">
                            +{calculateStockForDate(selectedProduct, stockHistoryDate)?.dhaka.added}
                          </TableCell>
                          <TableCell className="text-center text-red-600">
                            -{calculateStockForDate(selectedProduct, stockHistoryDate)?.dhaka.removed}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {calculateStockForDate(selectedProduct, stockHistoryDate)?.dhaka.closing}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-bold">Chittagong</TableCell>
                          <TableCell className="text-center">
                            {calculateStockForDate(selectedProduct, stockHistoryDate)?.ctg.opening}
                          </TableCell>
                          <TableCell className="text-center text-green-600">
                            +{calculateStockForDate(selectedProduct, stockHistoryDate)?.ctg.added}
                          </TableCell>
                          <TableCell className="text-center text-red-600">
                            -{calculateStockForDate(selectedProduct, stockHistoryDate)?.ctg.removed}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {calculateStockForDate(selectedProduct, stockHistoryDate)?.ctg.closing}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-slate-50">
                          <TableCell className="font-bold">Total</TableCell>
                          <TableCell className="text-center font-bold">
                            {(calculateStockForDate(selectedProduct, stockHistoryDate)?.dhaka.opening ?? 0) + (calculateStockForDate(selectedProduct, stockHistoryDate)?.ctg.opening ?? 0)}
                          </TableCell>
                          <TableCell className="text-center font-bold text-green-600">
                            +{(calculateStockForDate(selectedProduct, stockHistoryDate)?.dhaka.added ?? 0) + (calculateStockForDate(selectedProduct, stockHistoryDate)?.ctg.added ?? 0)}
                          </TableCell>
                          <TableCell className="text-center font-bold text-red-600">
                            -{(calculateStockForDate(selectedProduct, stockHistoryDate)?.dhaka.removed ?? 0) + (calculateStockForDate(selectedProduct, stockHistoryDate)?.ctg.removed ?? 0)}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {(calculateStockForDate(selectedProduct, stockHistoryDate)?.dhaka.closing ?? 0) + (calculateStockForDate(selectedProduct, stockHistoryDate)?.ctg.closing ?? 0)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={stockReportOpen} onOpenChange={setStockReportOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Stock Report - Date Range
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={stockReportStartDate} onChange={e => setStockReportStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={stockReportEndDate} onChange={e => setStockReportEndDate(e.target.value)} />
              </div>
            </div>

            <Card className="border-none shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="max-h-[60vh] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white shadow-sm">
                      <TableRow className="bg-slate-50/30">
                        <TableHead className="text-xs font-bold uppercase">Product</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-center" colSpan={3}>Opening Stock</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-center" colSpan={3}>Sold Quantity</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-center" colSpan={3}>Closing Stock</TableHead>
                      </TableRow>
                      <TableRow className="bg-slate-50/20">
                        <TableHead className="text-xs font-bold uppercase text-slate-500"></TableHead>
                        <TableHead className="text-xs font-bold uppercase text-center text-blue-600">Dhaka</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-center text-orange-600">CTG</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-center">Total</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-center text-blue-600">Dhaka</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-center text-orange-600">CTG</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-center">Total</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-center text-blue-600">Dhaka</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-center text-orange-600">CTG</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-center">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculateStockReportForRange(stockReportStartDate, stockReportEndDate).map(item => (
                        <TableRow key={item.product.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="py-4">
                            <div className="font-bold text-slate-900">{item.product.name}</div>
                            <div className="text-[10px] text-slate-500">{item.product.version}</div>
                          </TableCell>
                          <TableCell className="text-center">{item.openingStock.dhaka}</TableCell>
                          <TableCell className="text-center">{item.openingStock.ctg}</TableCell>
                          <TableCell className="text-center font-bold bg-slate-50">{item.openingStock.total}</TableCell>
                          <TableCell className="text-center text-red-600">{item.sold.dhaka}</TableCell>
                          <TableCell className="text-center text-red-600">{item.sold.ctg}</TableCell>
                          <TableCell className="text-center font-bold bg-slate-50 text-red-600">{item.sold.total}</TableCell>
                          <TableCell className="text-center">{item.closingStock.dhaka}</TableCell>
                          <TableCell className="text-center">{item.closingStock.ctg}</TableCell>
                          <TableCell className="text-center font-bold bg-slate-50">{item.closingStock.total}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default StockBalance;
