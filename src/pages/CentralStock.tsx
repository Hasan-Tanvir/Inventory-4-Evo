"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Product, Category, ProductStockEntry, ProductStockTransfer, Order, Slab } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getTodayISO } from '@/utils/date';
import { cn } from '@/lib/utils';

const getLowestSlabPrice = (slabs: Slab[] | undefined, fallback: number) => {
  if (!Array.isArray(slabs) || slabs.length === 0) return Number(fallback || 0);
  const prices = slabs.map(s => Number(s.price || 0)).filter(p => p > 0);
  return prices.length ? Math.min(...prices) : Number(fallback || 0);
};

const subtractDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() - days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

const fmt = (n: number | undefined | null) => {
  const v = Number(n || 0);
  if (Number.isInteger(v)) return v.toLocaleString('en-US');
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

export default function CentralStock() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stockEntries, setStockEntries] = useState<ProductStockEntry[]>([]);
  const [stockTransfers, setStockTransfers] = useState<ProductStockTransfer[]>([]);
  const [startDate, setStartDate] = useState<string>(subtractDaysISO(getTodayISO(), 30));
  const [endDate, setEndDate] = useState<string>(getTodayISO());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      const [p, c, o, se, st] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
        api.getOrders(),
        api.getProductStockEntries(),
        api.getProductStockTransfers(),
      ]);
      setProducts(Array.isArray(p) ? p : []);
      setCategories(Array.isArray(c) ? c : []);
      setOrders(Array.isArray(o) ? o : []);
      setStockEntries(Array.isArray(se) ? se : []);
      setStockTransfers(Array.isArray(st) ? st : []);
    };
    load();
  }, []);

  const rows = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeEntries = Array.isArray(stockEntries) ? stockEntries : [];
    const safeTransfers = Array.isArray(stockTransfers) ? stockTransfers : [];
    const safeProducts = Array.isArray(products) ? products : [];

    const inRange = (d: string) => d >= startDate && d <= endDate;

    return safeProducts
      .filter(p => !p || p.status === 'active')
      .map(p => {
        // Entry quantities (stock added) in date range
        const rangeEntries = safeEntries.filter(e => e && e.productId === p.id && inRange(e.date || ''));
        let entriesDhaka = 0;
        let entriesCtg = 0;
        rangeEntries.forEach(e => {
          const q = Number(e.quantity) || 0;
          if (e.location === 'dhaka') entriesDhaka += q;
          else entriesCtg += q;
        });

        // Transfers: Treat transfer-in as "entry" for the destination (recorded as positive)
        // We won't subtract from source to avoid double-counting sales from stock - the user asked for Entry qty only.
        const rangeTransfers = safeTransfers.filter(t => t && t.productId === p.id && inRange(t.date || ''));
        rangeTransfers.forEach(t => {
          const q = Number(t.quantity) || 0;
          // Add transfers INTO each location
          if (t.to === 'dhaka') entriesDhaka += q;
          if (t.to === 'chittagong') entriesCtg += q;
        });
        const entriesTotal = entriesDhaka + entriesCtg;

        // Sold quantities in date range (approved, non-quote)
        const rangeOrders = safeOrders.filter(o =>
          o && !o.isQuote && o.status === 'approved' && inRange(o.date || '')
        );
        let soldDhaka = 0;
        let soldCtg = 0;
        rangeOrders.forEach(o => {
          (Array.isArray(o.items) ? o.items : []).forEach(item => {
            if (item && item.productId === p.id) {
              const q = Number(item.quantity) || 0;
              const loc = (item.location || o.inventorySource || 'dhaka').toLowerCase();
              if (loc === 'dhaka') soldDhaka += q;
              else soldCtg += q;
            }
          });
        });
        const soldTotal = soldDhaka + soldCtg;

        // Current quantities (real-time stock, includes everything - not range bound)
        const curDhaka = Number(p.dhaka) || 0;
        const curCtg = Number(p.chittagong) || 0;
        const curTotal = curDhaka + curCtg;

        // Prices
        const lowestSlab = getLowestSlabPrice(p.slabs, p.retailPrice);
        const retail = Number(p.retailPrice) || 0;

        return {
          id: p.id,
          name: p.name || '',
          version: p.version || '',
          categoryId: p.categoryId || '',
          entriesDhaka,
          entriesCtg,
          entriesTotal,
          soldDhaka,
          soldCtg,
          soldTotal,
          curDhaka,
          curCtg,
          curTotal,
          lowestSlab,
          retail,
        };
      });
  }, [products, orders, stockEntries, stockTransfers, startDate, endDate]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const safeCats = Array.isArray(categories) ? categories : [];
    const filtered = rows.filter(r => {
      if (categoryFilter !== 'all' && r.categoryId !== categoryFilter) return false;
      if (!q) return true;
      return (r.name + ' ' + r.version).toLowerCase().includes(q);
    });

    const byCat = new Map<string, typeof rows>();
    filtered.forEach(r => {
      const key = r.categoryId || '';
      if (!byCat.has(key)) byCat.set(key, [] as any);
      byCat.get(key)!.push(r);
    });

    const ordered: { category: Category | { id: string; name: string }; items: typeof rows }[] = [];
    safeCats.forEach(cat => {
      const items = byCat.get(cat.id);
      if (items && items.length) {
        ordered.push({ category: cat, items: [...items].sort((a, b) =>
          (a.name + a.version).localeCompare(b.name + b.version)
        ) });
        byCat.delete(cat.id);
      }
    });
    // Ungrouped
    byCat.forEach((items, key) => {
      ordered.push({
        category: { id: key, name: key ? 'Uncategorized' : 'No Category' },
        items: [...items].sort((a, b) => (a.name + a.version).localeCompare(b.name + b.version))
      });
    });
    return ordered;
  }, [rows, categories, search, categoryFilter]);

  const totals = useMemo(() => {
    const t = grouped.reduce((acc, g) => acc + g.items.reduce((a, r) => ({
      entriesDhaka: a.entriesDhaka + r.entriesDhaka,
      entriesCtg: a.entriesCtg + r.entriesCtg,
      entriesTotal: a.entriesTotal + r.entriesTotal,
      soldDhaka: a.soldDhaka + r.soldDhaka,
      soldCtg: a.soldCtg + r.soldCtg,
      soldTotal: a.soldTotal + r.soldTotal,
      curDhaka: a.curDhaka + r.curDhaka,
      curCtg: a.curCtg + r.curCtg,
      curTotal: a.curTotal + r.curTotal,
    }), {
      entriesDhaka: 0, entriesCtg: 0, entriesTotal: 0,
      soldDhaka: 0, soldCtg: 0, soldTotal: 0,
      curDhaka: 0, curCtg: 0, curTotal: 0,
    });
    return t;
  }, [grouped]);

  const safeCategories = Array.isArray(categories) ? categories : [];
  const productCount = grouped.reduce((a, g) => a + g.items.length, 0);

  return (
    <Layout>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tighter">Central Stock</h1>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              {productCount} Product{productCount === 1 ? '' : 's'} · {safeCategories.length} Categor{safeCategories.length === 1 ? 'y' : 'ies'}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-end">
            <div className="md:col-span-3">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">From Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-xs font-bold" />
            </div>
            <div className="md:col-span-3">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">To Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-xs font-bold" />
            </div>
            <div className="md:col-span-3">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Category</Label>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full h-9 px-3 border border-slate-200 rounded-lg text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {safeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Search Product</Label>
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name/version..." className="h-9 text-xs font-bold" />
            </div>
          </div>
        </div>

        {/* Table - Excel-like, tight spacing */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-280px)]">
            <Table className="text-xs border-collapse">
              <TableHeader className="sticky top-0 z-20">
                <TableRow className="bg-slate-100 hover:bg-slate-100 border-b border-slate-200">
                  <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-slate-600 w-[200px] border-r border-slate-200 sticky left-0 bg-slate-100 z-30">
                    Product
                  </TableHead>
                  <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-slate-500 text-center border-r border-slate-200 bg-slate-50" colSpan={3}>
                    Entry Qty
                  </TableHead>
                  <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-red-600 text-center border-r border-slate-200 bg-red-50/40" colSpan={3}>
                    Sold Qty
                  </TableHead>
                  <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 text-center border-r border-slate-200 bg-emerald-50/40" colSpan={3}>
                    Current Qty
                  </TableHead>
                  <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-slate-600 text-right border-r border-slate-200">
                    Lowest Slab
                  </TableHead>
                  <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-slate-600 text-right">
                    Retail Price
                  </TableHead>
                </TableRow>
                <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-200">
                  <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-slate-500 border-r border-slate-200 sticky left-0 bg-slate-50 z-30">
                    Name / Version
                  </TableHead>
                  <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-blue-600 text-center border-r border-slate-200">DHK</TableHead>
                  <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-orange-600 text-center border-r border-slate-200">CTG</TableHead>
                  <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-slate-700 text-center border-r border-slate-200 bg-slate-100/60">Total</TableHead>
                  <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-blue-600 text-center border-r border-slate-200">DHK</TableHead>
                  <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-orange-600 text-center border-r border-slate-200">CTG</TableHead>
                  <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-red-700 text-center border-r border-slate-200 bg-red-50/40">Total</TableHead>
                  <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-blue-600 text-center border-r border-slate-200">DHK</TableHead>
                  <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-orange-600 text-center border-r border-slate-200">CTG</TableHead>
                  <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-emerald-800 text-center border-r border-slate-200 bg-emerald-50/40">Total</TableHead>
                  <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-slate-600 text-right border-r border-slate-200">Price</TableHead>
                  <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-slate-600 text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-xs text-slate-400 italic">
                      No products match your filters
                    </TableCell>
                  </TableRow>
                )}
                {grouped.map((g) => {
                  const catName = g.category.name;
                  const gTot = g.items.reduce((a, r) => ({
                    eT: a.eT + r.entriesTotal,
                    sT: a.sT + r.soldTotal,
                    cT: a.cT + r.curTotal,
                  }), { eT: 0, sT: 0, cT: 0 });
                  return (
                    <React.Fragment key={g.category.id}>
                      {/* Category group header */}
                      <TableRow className="bg-slate-900/90 hover:bg-slate-900/90 border-b border-slate-800">
                        <TableCell className="py-1.5 px-2 text-[10px] font-black uppercase tracking-widest text-white sticky left-0 bg-slate-900/90 z-10">
                          <span className="opacity-60 mr-1.5">{String.fromCharCode(9632)}</span>
                          {catName}
                        </TableCell>
                        <TableCell colSpan={2} className="py-1.5 px-2 text-[10px] font-black uppercase tracking-wider text-slate-300 text-center border-r border-slate-800/60">
                          {g.items.length} item{g.items.length === 1 ? '' : 's'}
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-[10px] font-black text-white text-right bg-slate-800/60 border-r border-slate-800/60">
                          {fmt(gTot.eT)}
                        </TableCell>
                        <TableCell colSpan={2} className="py-1.5 px-2 text-[10px] text-slate-400 text-center border-r border-slate-800/60"></TableCell>
                        <TableCell className="py-1.5 px-2 text-[10px] font-black text-red-300 text-right bg-red-950/30 border-r border-slate-800/60">
                          {fmt(gTot.sT)}
                        </TableCell>
                        <TableCell colSpan={2} className="py-1.5 px-2 text-[10px] text-slate-400 text-center border-r border-slate-800/60"></TableCell>
                        <TableCell className="py-1.5 px-2 text-[10px] font-black text-emerald-300 text-right bg-emerald-950/30 border-r border-slate-800/60">
                          {fmt(gTot.cT)}
                        </TableCell>
                        <TableCell colSpan={2} className="py-1.5 px-2"></TableCell>
                      </TableRow>
                      {/* Product rows within category */}
                      {g.items.map((r, idx) => (
                        <TableRow
                          key={r.id}
                          className={cn(
                            "border-b border-slate-100 hover:bg-blue-50/40 transition-colors",
                            idx % 2 === 1 && "bg-slate-50/50"
                          )}
                        >
                          <TableCell className="py-1.5 px-2 border-r border-slate-100 sticky left-0 bg-inherit group-hover:bg-blue-50/40">
                            <div className="font-bold text-slate-800 text-[11px] leading-tight truncate">{r.name}</div>
                            {r.version && (
                              <div className="text-[9px] font-black uppercase tracking-tight text-slate-400 leading-tight">
                                {r.version}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] text-blue-700 border-r border-slate-100 font-medium">
                            {fmt(r.entriesDhaka)}
                          </TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] text-orange-700 border-r border-slate-100 font-medium">
                            {fmt(r.entriesCtg)}
                          </TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] font-black text-slate-900 border-r border-slate-200 bg-slate-50/60">
                            {fmt(r.entriesTotal)}
                          </TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] text-blue-700 border-r border-slate-100 font-medium">
                            {fmt(r.soldDhaka)}
                          </TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] text-orange-700 border-r border-slate-100 font-medium">
                            {fmt(r.soldCtg)}
                          </TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] font-black text-red-700 border-r border-slate-200 bg-red-50/40">
                            {fmt(r.soldTotal)}
                          </TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] text-blue-700 border-r border-slate-100 font-medium">
                            {fmt(r.curDhaka)}
                          </TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] text-orange-700 border-r border-slate-100 font-medium">
                            {fmt(r.curCtg)}
                          </TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] font-black text-emerald-800 border-r border-slate-200 bg-emerald-50/40">
                            {fmt(r.curTotal)}
                          </TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] font-bold text-indigo-700 border-r border-slate-100">
                            {fmt(r.lowestSlab)}
                          </TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] font-bold text-slate-900">
                            {fmt(r.retail)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
                {/* Grand total row */}
                {grouped.length > 0 && (
                  <TableRow className="bg-slate-800 hover:bg-slate-800 sticky bottom-0 z-10 border-t-2 border-slate-700">
                    <TableCell className="py-2 px-2 text-[10px] font-black uppercase tracking-widest text-white sticky left-0 bg-slate-800">
                      Grand Total
                    </TableCell>
                    <TableCell className="py-2 px-2 text-right tabular-nums text-[11px] font-bold text-blue-200 border-r border-slate-700">
                      {fmt(totals.entriesDhaka)}
                    </TableCell>
                    <TableCell className="py-2 px-2 text-right tabular-nums text-[11px] font-bold text-orange-200 border-r border-slate-700">
                      {fmt(totals.entriesCtg)}
                    </TableCell>
                    <TableCell className="py-2 px-2 text-right tabular-nums text-[12px] font-black text-white border-r border-slate-700 bg-slate-700">
                      {fmt(totals.entriesTotal)}
                    </TableCell>
                    <TableCell className="py-2 px-2 text-right tabular-nums text-[11px] font-bold text-blue-200 border-r border-slate-700">
                      {fmt(totals.soldDhaka)}
                    </TableCell>
                    <TableCell className="py-2 px-2 text-right tabular-nums text-[11px] font-bold text-orange-200 border-r border-slate-700">
                      {fmt(totals.soldCtg)}
                    </TableCell>
                    <TableCell className="py-2 px-2 text-right tabular-nums text-[12px] font-black text-red-200 border-r border-slate-700 bg-red-950/50">
                      {fmt(totals.soldTotal)}
                    </TableCell>
                    <TableCell className="py-2 px-2 text-right tabular-nums text-[11px] font-bold text-blue-200 border-r border-slate-700">
                      {fmt(totals.curDhaka)}
                    </TableCell>
                    <TableCell className="py-2 px-2 text-right tabular-nums text-[11px] font-bold text-orange-200 border-r border-slate-700">
                      {fmt(totals.curCtg)}
                    </TableCell>
                    <TableCell className="py-2 px-2 text-right tabular-nums text-[12px] font-black text-emerald-200 border-r border-slate-700 bg-emerald-950/50">
                      {fmt(totals.curTotal)}
                    </TableCell>
                    <TableCell className="py-2 px-2 border-r border-slate-700"></TableCell>
                    <TableCell className="py-2 px-2"></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
