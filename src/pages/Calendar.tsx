"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Dealer, Order, Payment } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  CalendarDays, ShoppingCart, CreditCard, BadgePercent, 
  ChevronLeft, ChevronRight, List, LayoutGrid, Store, Users,
  CalendarRange
} from 'lucide-react';
import { formatDisplayDate, getTodayISO } from '@/utils/date';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

type ActivityFilter = 'all' | 'order' | 'payment' | 'retail';
type ViewMode = 'grid' | 'list';

interface CellDetail {
  type: 'order' | 'payment' | 'retail';
  id: string;
  title: string;
  amount: number;
  note?: string;
  date: string;
}

interface CellData {
  orders: CellDetail[];
  payments: CellDetail[];
  retail: CellDetail[];
  totalAmount: number;
}

const Calendar = () => {
  const isMobile = useIsMobile();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  
  const [viewMode, setViewMode] = useState<ViewMode>(() => isMobile ? 'list' : 'grid');
  const [filterType, setFilterType] = useState<ActivityFilter>('all');
  
  // Default range: current month, always start day 1 and end on last day (28/29/30/31)
  const getMonthRange = (year?: number, monthIdx?: number) => {
    const now = new Date();
    const y = typeof year === 'number' ? year : now.getFullYear();
    const m = typeof monthIdx === 'number' ? monthIdx : now.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };
  
  const initRange = getMonthRange();
  const [fromDate, setFromDate] = useState(initRange.start);
  const [toDate, setToDate] = useState(initRange.end);

  const goToMonth = (dir: -1 | 1) => {
    const start = new Date(fromDate);
    const y = start.getFullYear();
    const m = start.getMonth();
    const next = getMonthRange(y, m + dir);
    setFromDate(next.start);
    setToDate(next.end);
  };

  const goToCurrentMonth = () => {
    const next = getMonthRange();
    setFromDate(next.start);
    setToDate(next.end);
  };
  
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailCell, setDetailCell] = useState<{
    date: string;
    dealerId: string;
    dealerName: string;
    data: CellData;
  } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setDealers(await api.getDealers() || []);
      setOrders(await api.getOrders() || []);
      setPayments(await api.getPayments() || []);
    };
    loadData();
  }, []);

  const dateList = useMemo(() => {
    const dates: string[] = [];
    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];
    
    const cur = new Date(start);
    // Cap at 31 days for performance
    let count = 0;
    while (cur <= end && count < 62) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
      count++;
    }
    return dates;
  }, [fromDate, toDate]);

  const shiftRange = (dir: -1 | 1) => {
    // Snap prev/next to full calendar month boundaries (1st → last day)
    goToMonth(dir);
  };

  // Build a map: dealerId -> date -> CellData (plus a special 'retail-sales' key for unassociated retail)
  const activityMatrix = useMemo(() => {
    const matrix = new Map<string, Map<string, CellData>>();
    
    const ensureCell = (rowKey: string, date: string): CellData => {
      if (!matrix.has(rowKey)) matrix.set(rowKey, new Map());
      const row = matrix.get(rowKey)!;
      if (!row.has(date)) row.set(date, { orders: [], payments: [], retail: [], totalAmount: 0 });
      return row.get(date)!;
    };

    // Dealer Orders
    (Array.isArray(orders) ? orders : []).forEach(o => {
      if (!o || !o.date || o.isQuote || o.status !== 'approved') return;
      if (o.date < fromDate || o.date > toDate) return;

      if (o.type === 'dealer' && o.dealerId) {
        const cell = ensureCell(o.dealerId, o.date);
        cell.orders.push({
          type: 'order',
          id: o.id,
          title: `Order ${o.id}`,
          amount: Number(o.netTotal || 0),
          note: o.notes,
          date: o.date
        });
        cell.totalAmount += Number(o.netTotal || 0);
      } else if (o.type === 'retail') {
        const cell = ensureCell('__retail__', o.date);
        cell.retail.push({
          type: 'retail',
          id: o.id,
          title: `Retail Sale to ${o.customerName || 'Walk-in'}`,
          amount: Number(o.netTotal || 0),
          note: o.notes,
          date: o.date
        });
        cell.totalAmount += Number(o.netTotal || 0);
      }
    });

    // Dealer Payments
    (Array.isArray(payments) ? payments : []).forEach(p => {
      if (!p || !p.date || !p.dealerId) return;
      if (p.date < fromDate || p.date > toDate) return;
      const cell = ensureCell(p.dealerId, p.date);
      const isDebit = p.type === 'Last balance Due';
      cell.payments.push({
        type: 'payment',
        id: p.id,
        title: isDebit ? `Due Adjustment: ${p.type}` : `Payment (${p.type})`,
        amount: isDebit ? 0 - Number(p.amount || 0) : Number(p.amount || 0),
        note: p.notes,
        date: p.date
      });
      cell.totalAmount += isDebit ? -Number(p.amount || 0) : Number(p.amount || 0);
    });

    return matrix;
  }, [orders, payments, fromDate, toDate]);

  const getCell = (rowKey: string, date: string): CellData | undefined => {
    return activityMatrix.get(rowKey)?.get(date);
  };

  const openCellDetail = (rowKey: string, date: string, dealerName: string) => {
    const data = getCell(rowKey, date);
    const hasData = data && (data.orders.length + data.payments.length + data.retail.length) > 0;
    setDetailCell({
      date,
      dealerId: rowKey,
      dealerName,
      data: data || { orders: [], payments: [], retail: [], totalAmount: 0 }
    });
    setDetailDialogOpen(true);
  };

  const renderCellContent = (rowKey: string, date: string) => {
    const cell = getCell(rowKey, date);
    if (!cell) return null;

    const showOrders = (filterType === 'all' || filterType === 'order') && cell.orders.length > 0;
    const showPayments = (filterType === 'all' || filterType === 'payment') && cell.payments.length > 0;
    const showRetail = (filterType === 'all' || filterType === 'retail') && cell.retail.length > 0;

    const badges: React.ReactNode[] = [];
    if (showOrders) {
      const orderTotal = cell.orders.reduce((s, o) => s + o.amount, 0);
      badges.push(
        <div key="o" className="flex items-center gap-0.5 bg-orange-100 text-orange-800 rounded-md px-1 py-0.5 text-[9px] font-black">
          <ShoppingCart className="w-2.5 h-2.5" />
          {cell.orders.length}
        </div>
      );
    }
    if (showPayments) {
      const payTotal = cell.payments.reduce((s, p) => s + p.amount, 0);
      badges.push(
        <div key="p" className="flex items-center gap-0.5 bg-green-100 text-green-800 rounded-md px-1 py-0.5 text-[9px] font-black">
          <CreditCard className="w-2.5 h-2.5" />
          {cell.payments.length}
        </div>
      );
    }
    if (showRetail) {
      badges.push(
        <div key="r" className="flex items-center gap-0.5 bg-blue-100 text-blue-800 rounded-md px-1 py-0.5 text-[9px] font-black">
          <BadgePercent className="w-2.5 h-2.5" />
          {cell.retail.length}
        </div>
      );
    }

    if (badges.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 items-center">
        {badges}
      </div>
    );
  };

  const renderCellAmount = (rowKey: string, date: string) => {
    const cell = getCell(rowKey, date);
    if (!cell) return null;
    const hasActivity = cell.orders.length + cell.payments.length + cell.retail.length > 0;
    if (!hasActivity) return null;
    return (
      <div className={cn(
        "text-[9px] font-black mt-1",
        cell.totalAmount >= 0 ? "text-emerald-700" : "text-red-700"
      )}>
        {cell.totalAmount >= 0 ? '+' : ''}{cell.totalAmount.toLocaleString('en-IN')}
      </div>
    );
  };

  const dateRangeLabel = useMemo(() => {
    if (dateList.length === 0) return 'No date range';
    if (dateList.length === 1) return formatDisplayDate(dateList[0]);
    return `${formatDisplayDate(dateList[0])} — ${formatDisplayDate(dateList[dateList.length - 1])}`;
  }, [dateList]);

  const sortedDealers = useMemo(() => {
    return [...(dealers || [])].sort((a, b) => {
      const nameA = (a?.name || '').toUpperCase();
      const nameB = (b?.name || '').toUpperCase();
      return nameA.localeCompare(nameB, 'en');
    });
  }, [dealers]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-slate-600" />
              Activity Calendar
            </h1>
            <p className="text-xs text-slate-500 font-bold mt-1">{dateRangeLabel}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={filterType} onValueChange={(v: ActivityFilter) => setFilterType(v)}>
              <SelectTrigger className="h-11 rounded-xl w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activity</SelectItem>
                <SelectItem value="order">Orders Only</SelectItem>
                <SelectItem value="payment">Payments Only</SelectItem>
                <SelectItem value="retail">Retail Sales Only</SelectItem>
              </SelectContent>
            </Select>
            {isMobile && (
              <div className="flex gap-1">
                <Button variant={viewMode === 'grid' ? 'default' : 'outline'} className="flex-1 h-11 rounded-xl" onClick={() => setViewMode('grid')}>
                  <LayoutGrid className="w-4 h-4 mr-2" /> Grid
                </Button>
                <Button variant={viewMode === 'list' ? 'default' : 'outline'} className="flex-1 h-11 rounded-xl" onClick={() => setViewMode('list')}>
                  <List className="w-4 h-4 mr-2" /> List
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Date Controls */}
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={() => shiftRange(-1)} title="Previous month">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={() => shiftRange(1)} title="Next month">
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl shrink-0 text-[11px] font-black uppercase"
                  onClick={goToCurrentMonth}
                >
                  <CalendarRange className="w-4 h-4 mr-1.5" /> This Month
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <div className="flex flex-col gap-1.5 flex-1 sm:max-w-[220px]">
                  <Label className="text-[10px] font-black uppercase text-slate-500">From Date</Label>
                  <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="flex flex-col gap-1.5 flex-1 sm:max-w-[220px]">
                  <Label className="text-[10px] font-black uppercase text-slate-500">To Date</Label>
                  <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge className="bg-orange-100 text-orange-800 rounded-lg text-[10px] font-black gap-1.5">
                  <ShoppingCart className="w-3 h-3" /> Dealer Orders
                </Badge>
                <Badge className="bg-green-100 text-green-800 rounded-lg text-[10px] font-black gap-1.5">
                  <CreditCard className="w-3 h-3" /> Dealer Payments
                </Badge>
                <Badge className="bg-blue-100 text-blue-800 rounded-lg text-[10px] font-black gap-1.5">
                  <BadgePercent className="w-3 h-3" /> Retail Sales
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grid View (Default for PC / opt-in for mobile) */}
        <div className={cn(viewMode === 'grid' ? 'block' : 'hidden lg:block')}>
          <Card className="border-none shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-slate-50/95 backdrop-blur">
                    <th className="sticky left-0 z-30 bg-slate-50/95 backdrop-blur p-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-r border-slate-200 min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5" />
                        Dealer / Row
                      </div>
                    </th>
                    {dateList.map(d => {
                      const dt = new Date(d);
                      const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()];
                      const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                      const isToday = d === getTodayISO();
                      return (
                        <th
                          key={d}
                          className={cn(
                            "p-2 text-center text-[10px] font-black uppercase border-b border-slate-200 min-w-[92px]",
                            isWeekend && "bg-slate-100/80",
                            isToday && "bg-blue-50"
                          )}
                        >
                          <div className={cn(
                            "font-black",
                            isWeekend ? "text-slate-400" : "text-slate-500"
                          )}>{dayOfWeek}</div>
                          <div className={cn(
                            "flex items-center justify-center",
                            isToday ? "bg-slate-900 text-white rounded-md w-7 h-7 mx-auto mt-1" : "text-slate-800 mt-1"
                          )}>
                            {dt.getDate()}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Retail Sales aggregate row */}
                  <tr className="bg-blue-50/30">
                    <td className="sticky left-0 z-10 bg-blue-50/60 backdrop-blur p-3 border-b border-r border-slate-200">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-blue-600" />
                        <div>
                          <div className="font-black text-sm text-blue-900">Retail Sales</div>
                          <div className="text-[10px] text-blue-600 font-bold uppercase">All Locations</div>
                        </div>
                      </div>
                    </td>
                    {dateList.map(d => {
                      const cell = getCell('__retail__', d);
                      const hasContent = cell && (cell.orders.length + cell.payments.length + cell.retail.length) > 0;
                      return (
                        <td
                          key={d}
                          onClick={() => hasContent && openCellDetail('__retail__', d, 'Retail Sales')}
                          className={cn(
                            "p-2 border-b border-r border-slate-100 align-top min-h-[60px] h-[60px]",
                            hasContent ? "cursor-pointer hover:bg-blue-100/40 bg-blue-50/50" : "bg-white/60"
                          )}
                        >
                          {renderCellContent('__retail__', d)}
                          {renderCellAmount('__retail__', d)}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Dealers rows */}
                  {sortedDealers.map((dealer, idx) => (
                    <tr key={dealer.id} className={idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}>
                      <td className="sticky left-0 z-10 p-3 border-b border-r border-slate-200 backdrop-blur" style={{ backgroundColor: idx % 2 === 1 ? 'rgba(248, 250, 252, 0.95)' : 'rgba(255,255,255,0.95)' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="min-w-0 pl-1">
                            <div className="font-black text-sm text-slate-900 truncate" title={dealer.name}>{dealer.name}</div>
                            <div className="text-[10px] text-slate-500 uppercase font-bold truncate" title={dealer.phone || dealer.address}>
                              {dealer.phone || dealer.address || 'Dealer'}
                            </div>
                          </div>
                        </div>
                      </td>
                      {dateList.map(d => {
                        const cell = getCell(dealer.id, d);
                        const hasContent = cell && (
                          ((filterType === 'all' || filterType === 'order') && cell.orders.length > 0) ||
                          ((filterType === 'all' || filterType === 'payment') && cell.payments.length > 0)
                        );
                        const dt = new Date(d);
                        const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                        const isToday = d === getTodayISO();
                        return (
                          <td
                            key={d}
                            onClick={() => hasContent && openCellDetail(dealer.id, d, dealer.name)}
                            className={cn(
                              "p-2 border-b border-r border-slate-100 align-top h-[60px]",
                              isWeekend && !hasContent && "bg-slate-50/50",
                              isToday && "bg-blue-50/40",
                              hasContent && "cursor-pointer hover:bg-indigo-50 bg-indigo-50/30"
                            )}
                          >
                            {renderCellContent(dealer.id, d)}
                            {renderCellAmount(dealer.id, d)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {sortedDealers.length === 0 && (
                    <tr>
                      <td colSpan={dateList.length + 1} className="p-8 text-center text-slate-400 font-bold text-xs">
                        No dealers loaded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Mobile-friendly list view */}
        <div className={cn(viewMode === 'list' ? 'block lg:hidden' : 'hidden')}>
          <div className="space-y-3">
            {sortedDealers.map(dealer => {
              const perDate = activityMatrix.get(dealer.id);
              let activityCount = 0;
              let totalVal = 0;
              if (perDate) {
                perDate.forEach(cell => {
                  activityCount += cell.orders.length + cell.payments.length;
                  totalVal += cell.totalAmount;
                });
              }
              const entries: { date: string; cell: CellData }[] = [];
              if (perDate) {
                dateList.forEach(d => {
                  const c = perDate.get(d);
                  if (c && (c.orders.length + c.payments.length) > 0) {
                    entries.push({ date: d, cell: c });
                  }
                });
              }

              return (
                <Card key={dealer.id} className="border-none shadow-sm overflow-hidden">
                  <CardHeader className="py-3 px-4 bg-slate-50/60 border-b">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 min-w-0 pl-1">
                        <div className="min-w-0">
                          <div className="font-black text-sm text-slate-900 truncate">{dealer.name}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase">{dealer.phone || 'Dealer'}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-black rounded-lg">
                        {activityCount} activities
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2">
                    {entries.length === 0 ? (
                      <div className="text-[11px] text-slate-400 font-bold py-2 text-center italic">
                        No activity during selected period
                      </div>
                    ) : (
                      entries.map(e => {
                        const showOrders = (filterType === 'all' || filterType === 'order') && e.cell.orders.length > 0;
                        const showPayments = (filterType === 'all' || filterType === 'payment') && e.cell.payments.length > 0;
                        if (!showOrders && !showPayments) return null;
                        return (
                          <button
                            type="button"
                            key={e.date}
                            onClick={() => openCellDetail(dealer.id, e.date, dealer.name)}
                            className="w-full text-left rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <div className="text-[11px] font-black uppercase text-slate-600">
                                {formatDisplayDate(e.date)}
                              </div>
                              <div className={cn(
                                "text-[11px] font-black",
                                e.cell.totalAmount >= 0 ? "text-emerald-700" : "text-red-700"
                              )}>
                                Net {e.cell.totalAmount >= 0 ? '+' : ''}{e.cell.totalAmount.toLocaleString('en-IN')}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {showOrders && e.cell.orders.map(o => (
                                <div key={o.id} className="bg-orange-50 text-orange-900 rounded-lg px-2 py-1 text-[10px] font-bold border border-orange-100 flex items-center gap-1">
                                  <ShoppingCart className="w-3 h-3" /> Order: {o.amount.toLocaleString('en-IN')}
                                </div>
                              ))}
                              {showPayments && e.cell.payments.map(p => (
                                <div key={p.id} className="bg-green-50 text-green-900 rounded-lg px-2 py-1 text-[10px] font-bold border border-green-100 flex items-center gap-1">
                                  <CreditCard className="w-3 h-3" /> Payment: {Math.abs(p.amount).toLocaleString('en-IN')}
                                </div>
                              ))}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Retail card in list view */}
            {(() => {
              const perDate = activityMatrix.get('__retail__');
              const entries: { date: string; cell: CellData }[] = [];
              if (perDate && filterType !== 'order' && filterType !== 'payment') {
                dateList.forEach(d => {
                  const c = perDate.get(d);
                  if (c && c.retail.length > 0) entries.push({ date: d, cell: c });
                });
              }
              if (filterType === 'order' || filterType === 'payment') return null;
              return (
                <Card className="border-none shadow-sm overflow-hidden bg-blue-50/30">
                  <CardHeader className="py-3 px-4 bg-blue-50/60 border-b border-blue-100">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center font-black text-blue-700 shrink-0">
                          <Store className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-black text-sm text-blue-900 truncate">Retail Sales</div>
                          <div className="text-[10px] text-blue-600 font-bold uppercase">All Locations</div>
                        </div>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800 text-[10px] font-black rounded-lg">
                        {entries.length} days
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2">
                    {entries.length === 0 ? (
                      <div className="text-[11px] text-slate-400 font-bold py-2 text-center italic">
                        No retail activity during selected period
                      </div>
                    ) : (
                      entries.map(e => (
                        <button
                          type="button"
                          key={e.date}
                          onClick={() => openCellDetail('__retail__', e.date, 'Retail Sales')}
                          className="w-full text-left rounded-xl border border-blue-100 bg-white p-3 hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-[11px] font-black uppercase text-blue-700">
                              {formatDisplayDate(e.date)}
                            </div>
                            <div className="text-[11px] font-black text-emerald-700">
                              +{e.cell.totalAmount.toLocaleString('en-IN')}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {e.cell.retail.map(r => (
                              <div key={r.id} className="bg-blue-50 text-blue-900 rounded-lg px-2 py-1 text-[10px] font-bold border border-blue-100 flex items-center gap-1">
                                <BadgePercent className="w-3 h-3" /> {r.amount.toLocaleString('en-IN')}
                              </div>
                            ))}
                          </div>
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        </div>

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-slate-600" />
                  <span>{detailCell?.dealerName || 'Activity'}</span>
                </div>
                {detailCell && (
                  <Badge variant="outline" className="self-start sm:self-auto text-[10px] font-black rounded-lg">
                    {formatDisplayDate(detailCell.date)}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {detailCell && detailCell.data && (
              <div className="space-y-4 pt-2">
                {detailCell.data.orders.length > 0 && (filterType === 'all' || filterType === 'order') && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-orange-700 flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5" /> Dealer Orders ({detailCell.data.orders.length})
                    </div>
                    <div className="space-y-1.5">
                      {detailCell.data.orders.map(o => (
                        <div key={o.id} className="rounded-xl border border-orange-100 bg-orange-50/50 p-3">
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <div className="font-black text-sm text-slate-900">{o.title}</div>
                              {o.note && <div className="text-[11px] text-slate-600 mt-0.5 italic">Note: {o.note}</div>}
                            </div>
                            <div className="font-black text-orange-800 whitespace-nowrap">
                              {o.amount.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailCell.data.payments.length > 0 && (filterType === 'all' || filterType === 'payment') && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-green-700 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Dealer Payments ({detailCell.data.payments.length})
                    </div>
                    <div className="space-y-1.5">
                      {detailCell.data.payments.map(p => (
                        <div key={p.id} className="rounded-xl border border-green-100 bg-green-50/50 p-3">
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <div className="font-black text-sm text-slate-900">{p.title}</div>
                              {p.note && <div className="text-[11px] text-slate-600 mt-0.5 italic">Note: {p.note}</div>}
                            </div>
                            <div className={cn(
                              "font-black whitespace-nowrap",
                              p.amount >= 0 ? "text-green-800" : "text-red-800"
                            )}>
                              {p.amount >= 0 ? '+' : ''}{p.amount.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailCell.data.retail.length > 0 && (filterType === 'all' || filterType === 'retail') && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                      <BadgePercent className="w-3.5 h-3.5" /> Retail Sales ({detailCell.data.retail.length})
                    </div>
                    <div className="space-y-1.5">
                      {detailCell.data.retail.map(r => (
                        <div key={r.id} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <div className="font-black text-sm text-slate-900">{r.title}</div>
                              {r.note && <div className="text-[11px] text-slate-600 mt-0.5 italic">Note: {r.note}</div>}
                            </div>
                            <div className="font-black text-blue-800 whitespace-nowrap">
                              +{r.amount.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(() => {
                  const hasAny =
                    ((filterType === 'all' || filterType === 'order') && detailCell.data.orders.length > 0) ||
                    ((filterType === 'all' || filterType === 'payment') && detailCell.data.payments.length > 0) ||
                    ((filterType === 'all' || filterType === 'retail') && detailCell.data.retail.length > 0);
                  if (hasAny) return null;
                  return (
                    <div className="text-center text-slate-400 font-bold text-xs py-6 italic">
                      No activity on this day.
                    </div>
                  );
                })()}

                <div className="pt-3 border-t mt-3">
                  <div className="flex justify-between items-center text-sm font-black">
                    <span>Net Activity Value</span>
                    <span className={cn(
                      "text-lg",
                      detailCell.data.totalAmount >= 0 ? "text-emerald-700" : "text-red-700"
                    )}>
                      {detailCell.data.totalAmount >= 0 ? '+' : ''}
                      {detailCell.data.totalAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Calendar;
