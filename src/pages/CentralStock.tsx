"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Product, Category, ProductStockEntry, ProductStockTransfer, Order, Slab } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getTodayISO } from '@/utils/date';
import { showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ArrowUpToLine, Download, Settings2, Save, ArrowUpDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';
import { useTabState } from '@/context/TabStateContext';

const LS_KEY = 'central-stock-ui-v1';
const TAB_PATH = '/central-stock';

interface PersistedState {
  startDate: string;
  endDate: string;
  search: string;
  categoryFilter: string;
  statusFilter: 'active' | 'inactive' | 'all';
}

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

const csvEscape = (val: any) => {
  const s = val === undefined || val === null ? '' : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

interface RowShape {
  id: string;
  name: string;
  version: string;
  categoryId: string;
  status: 'active' | 'inactive';
  entriesDhaka: number; entriesCtg: number; entriesTotal: number;
  soldDhaka: number; soldCtg: number; soldTotal: number;
  curDhaka: number; curCtg: number; curTotal: number;
  lowestSlab: number; retail: number;
}

const SortableProductRow = ({
  row, idx, onMoveToTop, lastInCategory, onOpenPosition,
}: {
  row: RowShape;
  idx: number;
  onMoveToTop: (productId: string) => void;
  lastInCategory: boolean;
  onOpenPosition: (productId: string) => void;
}) => {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: row.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-slate-100 hover:bg-blue-50/40 transition-colors bg-white",
        idx % 2 === 1 && "bg-slate-50/60",
        lastInCategory && "border-b-2 border-b-slate-300"
      )}
    >
      <TableCell className="py-1.5 px-1 w-8 border-r border-slate-100 sticky left-0 bg-inherit z-[5] p-0 text-center">
        <div {...attributes} {...listeners} className="inline-flex items-center justify-center w-8 h-6 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing touch-none">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      </TableCell>
      <TableCell className="py-1.5 px-1 w-8 border-r border-slate-100 sticky left-[32px] bg-inherit z-[5] p-0 text-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMoveToTop(row.id)}
          title="Move to top of category"
          className="h-7 w-7 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"
        >
          <ArrowUpToLine className="w-3.5 h-3.5" />
        </Button>
      </TableCell>
      <TableCell className="py-1.5 px-1 w-8 border-r border-slate-100 sticky left-[64px] bg-inherit z-[5] p-0 text-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenPosition(row.id)}
          title="Edit position (before/after another product)"
          className="h-7 w-7 rounded-md text-purple-500 hover:text-purple-700 hover:bg-purple-50"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
        </Button>
      </TableCell>
      <TableCell className={cn(
        "py-1.5 px-2 border-r border-slate-100 sticky left-[96px] bg-inherit z-[5] w-[200px]",
        row.status === 'inactive' && "line-through opacity-60"
      )}>
        <div className="font-bold text-slate-800 text-[11px] leading-tight truncate">{row.name}</div>
        <div className="flex items-center gap-1 mt-0.5">
          {row.version && (
            <div className="text-[9px] font-black uppercase tracking-tight text-slate-400 leading-tight">{row.version}</div>
          )}
          {row.status === 'inactive' && (
            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">Inactive</span>
          )}
        </div>
      </TableCell>
      <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] text-blue-700 border-r border-slate-100 font-medium">{fmt(row.entriesDhaka)}</TableCell>
      <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] text-orange-700 border-r border-slate-100 font-medium">{fmt(row.entriesCtg)}</TableCell>
      <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] font-black text-slate-900 border-r border-slate-200 bg-slate-50/60">{fmt(row.entriesTotal)}</TableCell>
      <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] text-blue-700 border-r border-slate-100 font-medium">{fmt(row.soldDhaka)}</TableCell>
      <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] text-orange-700 border-r border-slate-100 font-medium">{fmt(row.soldCtg)}</TableCell>
      <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] font-black text-red-700 border-r border-slate-200 bg-red-50/40">{fmt(row.soldTotal)}</TableCell>
      <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] text-blue-700 border-r border-slate-100 font-medium">{fmt(row.curDhaka)}</TableCell>
      <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] text-orange-700 border-r border-slate-100 font-medium">{fmt(row.curCtg)}</TableCell>
      <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] font-black text-emerald-800 border-r border-slate-200 bg-emerald-50/40">{fmt(row.curTotal)}</TableCell>
      <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] font-bold text-indigo-700 border-r border-slate-100">{fmt(row.lowestSlab)}</TableCell>
      <TableCell className="py-1.5 px-2 text-right tabular-nums text-[11px] font-bold text-slate-900">{fmt(row.retail)}</TableCell>
    </TableRow>
  );
};

export default function CentralStock() {
  const defaultStart = subtractDaysISO(getTodayISO(), 30);
  const defaultEnd = getTodayISO();
  const { getTabState, saveTabState } = useTabState();

  const initial: PersistedState = useMemo(() => {
    let tab: Partial<PersistedState> = {};
    try {
      const t = getTabState(TAB_PATH);
      if (t && typeof t === 'object') tab = t as Partial<PersistedState>;
    } catch { /* ignore */ }
    let local: Partial<PersistedState> = {};
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LS_KEY) : null;
      if (raw) local = JSON.parse(raw) as Partial<PersistedState>;
    } catch { /* ignore */ }
    const merged: PersistedState = {
      startDate: defaultStart,
      endDate: defaultEnd,
      search: '',
      categoryFilter: 'all',
      statusFilter: 'active',
      ...local,
      ...tab,
    };
    return merged;
  }, [defaultStart, defaultEnd, getTabState]);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stockEntries, setStockEntries] = useState<ProductStockEntry[]>([]);
  const [stockTransfers, setStockTransfers] = useState<ProductStockTransfer[]>([]);
  const [startDate, setStartDate] = useState<string>(initial.startDate);
  const [endDate, setEndDate] = useState<string>(initial.endDate);
  const [search, setSearch] = useState<string>(initial.search);
  const [categoryFilter, setCategoryFilter] = useState<string>(initial.categoryFilter);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>(initial.statusFilter);
  const [dirtyOrder, setDirtyOrder] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const saveTimerRef = useRef<any | null>(null);

  const [showPositionDialog, setShowPositionDialog] = useState(false);
  const [positioningProductId, setPositioningProductId] = useState<string>('');
  const [positionMode, setPositionMode] = useState<'before' | 'after'>('after');
  const [positionTargetId, setPositionTargetId] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  useEffect(() => {
    const snap: PersistedState = { startDate, endDate, search, categoryFilter, statusFilter };
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(snap)); } catch { /* ignore */ }
    try { saveTabState(TAB_PATH, snap); } catch { /* ignore */ }
  }, [startDate, endDate, search, categoryFilter, statusFilter, saveTabState]);

  const rows = useMemo<RowShape[]>(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeEntries = Array.isArray(stockEntries) ? stockEntries : [];
    const safeTransfers = Array.isArray(stockTransfers) ? stockTransfers : [];
    const safeProducts = Array.isArray(products) ? products : [];

    const inRange = (d: string) => d >= startDate && d <= endDate;

    return safeProducts
      .filter(p => {
        if (!p) return false;
        if (statusFilter === 'active' && p.status !== 'active') return false;
        if (statusFilter === 'inactive' && p.status !== 'inactive') return false;
        return true;
      })
      .map(p => {
        const rangeEntries = safeEntries.filter(e => e && e.productId === p.id && inRange(e.date || ''));
        let entriesDhaka = 0;
        let entriesCtg = 0;
        rangeEntries.forEach(e => {
          const q = Number(e.quantity) || 0;
          if (e.location === 'dhaka') entriesDhaka += q;
          else entriesCtg += q;
        });

        const rangeTransfers = safeTransfers.filter(t => t && t.productId === p.id && inRange(t.date || ''));
        rangeTransfers.forEach(t => {
          const q = Number(t.quantity) || 0;
          if (t.to === 'dhaka') entriesDhaka += q;
          if (t.to === 'chittagong') entriesCtg += q;
        });
        const entriesTotal = entriesDhaka + entriesCtg;

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

        const curDhaka = Number(p.dhaka) || 0;
        const curCtg = Number(p.chittagong) || 0;
        const curTotal = curDhaka + curCtg;

        const lowestSlab = getLowestSlabPrice(p.slabs, p.retailPrice);
        const retail = Number(p.retailPrice) || 0;

        return {
          id: p.id,
          name: p.name || '',
          version: p.version || '',
          categoryId: p.categoryId || '',
          status: p.status || 'active',
          entriesDhaka, entriesCtg, entriesTotal,
          soldDhaka, soldCtg, soldTotal,
          curDhaka, curCtg, curTotal,
          lowestSlab, retail,
        };
      });
  }, [products, orders, stockEntries, stockTransfers, startDate, endDate, statusFilter]);

  const rowById = useMemo(() => {
    const m = new Map<string, RowShape>();
    rows.forEach(r => m.set(r.id, r));
    return m;
  }, [rows]);

  // Sort productIds (per category) by Product.sortOrder ascending.
  // sortOrder default = 0 so new products (no sortOrder yet) come FIRST (top of category).
  const sortedProductIdsByCategory = useMemo(() => {
    const safeProducts = Array.isArray(products) ? products : [];
    const filteredIds = new Set(rows.map(r => r.id));
    const map = new Map<string, string[]>();
    safeProducts
      .filter(p => filteredIds.has(p.id))
      .forEach(p => {
        const key = p.categoryId || '';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(p.id);
      });
    map.forEach((ids, key) => {
      ids.sort((a, b) => {
        const pa = safeProducts.find(p => p.id === a);
        const pb = safeProducts.find(p => p.id === b);
        const oa = typeof pa?.sortOrder === 'number' && !Number.isNaN(pa.sortOrder) ? pa.sortOrder! : 0;
        const ob = typeof pb?.sortOrder === 'number' && !Number.isNaN(pb.sortOrder) ? pb.sortOrder! : 0;
        if (oa !== ob) return oa - ob;
        return (pa?.name + pa?.version).localeCompare(pb?.name + pb?.version);
      });
    });
    return map;
  }, [products, rows]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const safeCats = Array.isArray(categories) ? categories : [];

    const filterRows = (ids: string[]) => {
      const arr: RowShape[] = [];
      ids.forEach(id => {
        const r = rowById.get(id);
        if (!r) return;
        if (categoryFilter !== 'all' && r.categoryId !== categoryFilter) return;
        if (q && !(r.name + ' ' + r.version).toLowerCase().includes(q)) return;
        arr.push(r);
      });
      return arr;
    };

    const ordered: { category: Category | { id: string; name: string }; items: RowShape[] }[] = [];
    safeCats.forEach(cat => {
      const ids = sortedProductIdsByCategory.get(cat.id) || [];
      const items = filterRows(ids);
      if (items.length) {
        ordered.push({ category: cat, items });
        ids.forEach(id => sortedProductIdsByCategory.delete(cat.id));
      }
    });
    sortedProductIdsByCategory.forEach((ids, key) => {
      const items = filterRows(ids);
      if (items.length) {
        ordered.push({
          category: { id: key, name: key ? 'Uncategorized' : 'No Category' },
          items,
        });
      }
    });
    return ordered;
  }, [rows, categories, search, categoryFilter, sortedProductIdsByCategory, rowById]);

  const totals = useMemo(() => {
    const t = {
      entriesDhaka: 0, entriesCtg: 0, entriesTotal: 0,
      soldDhaka: 0, soldCtg: 0, soldTotal: 0,
      curDhaka: 0, curCtg: 0, curTotal: 0,
    };
    grouped.forEach(g => g.items.forEach(r => {
      t.entriesDhaka += r.entriesDhaka; t.entriesCtg += r.entriesCtg; t.entriesTotal += r.entriesTotal;
      t.soldDhaka += r.soldDhaka; t.soldCtg += r.soldCtg; t.soldTotal += r.soldTotal;
      t.curDhaka += r.curDhaka; t.curCtg += r.curCtg; t.curTotal += r.curTotal;
    }));
    return t;
  }, [grouped]);

  const scheduleOrderPersist = (newProducts: Product[]) => {
    setDirtyOrder(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        setSavingOrder(true);
        const ids = newProducts.map(p => p.id);
        await api.reorderProducts(ids);
        setDirtyOrder(false);
        showSuccess('Order saved');
      } finally {
        setSavingOrder(false);
      }
    }, 700);
  };

  const rebuildProductsWithNewOrder = (categoryId: string, idsInCategoryNewOrder: string[]) => {
    const safeCats = Array.isArray(categories) ? categories : [];
    const catOrderMap = new Map<string, string[]>();
    safeCats.forEach(c => catOrderMap.set(c.id, []));
    catOrderMap.set('', []);
    catOrderMap.set(categoryId, idsInCategoryNewOrder);
    sortedProductIdsByCategory.forEach((ids, cid) => {
      if (cid === categoryId) return;
      if (!catOrderMap.has(cid)) catOrderMap.set(cid, [...ids]);
      else if (catOrderMap.get(cid)!.length === 0) catOrderMap.set(cid, [...ids]);
    });
    const finalIds: string[] = [];
    safeCats.forEach(c => (catOrderMap.get(c.id) || []).forEach(id => finalIds.push(id)));
    catOrderMap.forEach((ids, cid) => {
      if (safeCats.find(c => c.id === cid)) return;
      ids.forEach(id => finalIds.push(id));
    });
    products.forEach(x => { if (!finalIds.includes(x.id)) finalIds.push(x.id); });
    const byId = new Map(products.map(p => [p.id, p]));
    return finalIds.map(id => byId.get(id)).filter(Boolean) as Product[];
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedId = String(active.id);
    const overId = String(over.id);
    const dragged = products.find(p => p.id === draggedId);
    if (!dragged) return;
    const categoryId = dragged.categoryId || '';

    const idsInCat = sortedProductIdsByCategory.get(categoryId) || [];
    const oldIdx = idsInCat.indexOf(draggedId);
    const newIdx = idsInCat.indexOf(overId);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(idsInCat, oldIdx, newIdx);

    const reorderedProducts = rebuildProductsWithNewOrder(categoryId, reordered);
    setProducts(reorderedProducts);
    scheduleOrderPersist(reorderedProducts);
  };

  const handleMoveToTop = (productId: string) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const categoryId = p.categoryId || '';
    const idsInCat = sortedProductIdsByCategory.get(categoryId) || [];
    const oldIdx = idsInCat.indexOf(productId);
    if (oldIdx <= 0) return;
    const reordered = arrayMove(idsInCat, oldIdx, 0);

    const reorderedProducts = rebuildProductsWithNewOrder(categoryId, reordered);
    setProducts(reorderedProducts);
    scheduleOrderPersist(reorderedProducts);
  };

  const handleOpenPosition = (productId: string) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const categoryId = p.categoryId || '';
    const idsInCat = sortedProductIdsByCategory.get(categoryId) || [];
    const currentIndex = idsInCat.indexOf(productId);
    const prevId = currentIndex > 0 ? idsInCat[currentIndex - 1] : '';
    const nextId = currentIndex < idsInCat.length - 1 ? idsInCat[currentIndex + 1] : '';
    setPositioningProductId(productId);
    if (prevId) {
      setPositionMode('after');
      setPositionTargetId(prevId);
    } else if (nextId) {
      setPositionMode('before');
      setPositionTargetId(nextId);
    } else {
      setPositionTargetId('');
    }
    setShowPositionDialog(true);
  };

  const handleApplyPosition = async () => {
    if (!positioningProductId || !positionTargetId) return;
    if (positioningProductId === positionTargetId) return;
    const p = products.find(x => x.id === positioningProductId);
    if (!p) return;
    const categoryId = p.categoryId || '';
    const idsInCat = sortedProductIdsByCategory.get(categoryId) || [];
    const withoutMoved = idsInCat.filter(id => id !== positioningProductId);
    const targetIdx = withoutMoved.indexOf(positionTargetId);
    if (targetIdx < 0) return;
    const insertIdx = positionMode === 'before' ? targetIdx : targetIdx + 1;
    const reordered = [
      ...withoutMoved.slice(0, insertIdx),
      positioningProductId,
      ...withoutMoved.slice(insertIdx),
    ];
    const reorderedProducts = rebuildProductsWithNewOrder(categoryId, reordered);
    setProducts(reorderedProducts);
    scheduleOrderPersist(reorderedProducts);
    setShowPositionDialog(false);
    showSuccess(`Product moved ${positionMode} target`);
  };

  const safeCategories = Array.isArray(categories) ? categories : [];
  const productCount = grouped.reduce((a, g) => a + g.items.length, 0);
  const allFlatIds = useMemo(() => grouped.flatMap(g => g.items.map(r => r.id)), [grouped]);

  // Position target candidates: products in the same category excluding the one being moved
  const positionTargets = useMemo(() => {
    const p = products.find(x => x.id === positioningProductId);
    if (!p) return [] as Product[];
    const categoryId = p.categoryId || '';
    const idsInCat = sortedProductIdsByCategory.get(categoryId) || [];
    const byId = new Map(products.map(x => [x.id, x]));
    return idsInCat
      .filter(id => id !== positioningProductId)
      .map(id => byId.get(id))
      .filter(Boolean) as Product[];
  }, [positioningProductId, products, sortedProductIdsByCategory]);

  const handleSaveOrderNow = async () => {
    try {
      setSavingOrder(true);
      const ids = products.map(p => p.id);
      await api.reorderProducts(ids);
      setDirtyOrder(false);
      showSuccess('Product order saved');
    } finally {
      setSavingOrder(false);
    }
  };

  const buildExportRows = () => {
    const dataRows: any[] = [];
    dataRows.push([`Central Stock Report`]);
    dataRows.push([`From: ${startDate}`, `To: ${endDate}`, `Status: ${statusFilter}`, `Category: ${categoryFilter === 'all' ? 'All' : (safeCategories.find(c => c.id === categoryFilter)?.name || categoryFilter)}`, `Search: "${search || ''}"`]);
    dataRows.push([]);
    dataRows.push([
      '#', '', '', 'Product',
      '', 'Entry Qty', '', '',
      '', 'Sold Qty', '', '',
      '', 'Current Qty', '', '',
      'Lowest Slab Price', 'Retail Price',
    ]);
    dataRows.push([
      'Sort', 'Top', 'Pos', 'Name / Version / Status',
      'DHK', 'CTG', 'Total', '',
      'DHK', 'CTG', 'Total', '',
      'DHK', 'CTG', 'Total',
      'Price', 'Price',
    ]);

    grouped.forEach(g => {
      const gTot = g.items.reduce((a, r) => ({
        eT: a.eT + r.entriesTotal, sT: a.sT + r.soldTotal, cT: a.cT + r.curTotal,
      }), { eT: 0, sT: 0, cT: 0 });
      dataRows.push([
        '', '', '', `■ ${g.category.name} (${g.items.length} item${g.items.length === 1 ? '' : 's'})`,
        '', '', fmt(gTot.eT),
        '', '', '', fmt(gTot.sT),
        '', '', '', fmt(gTot.cT),
        '', '',
      ]);
      g.items.forEach((r, idx) => {
        const status = r.status === 'inactive' ? ' [INACTIVE]' : '';
        dataRows.push([
          String(idx + 1), '^', '↕', `${r.name}${r.version ? ' - ' + r.version : ''}${status}`,
          r.entriesDhaka, r.entriesCtg, r.entriesTotal, '',
          r.soldDhaka, r.soldCtg, r.soldTotal, '',
          r.curDhaka, r.curCtg, r.curTotal,
          r.lowestSlab, r.retail,
        ]);
      });
    });

    dataRows.push([]);
    dataRows.push([
      '', '', '', 'GRAND TOTAL',
      totals.entriesDhaka, totals.entriesCtg, totals.entriesTotal,
      '', totals.soldDhaka, totals.soldCtg, totals.soldTotal,
      '', totals.curDhaka, totals.curCtg, totals.curTotal,
      '', '',
    ]);
    return dataRows;
  };

  const handleExportCSV = () => {
    const dataRows = buildExportRows();
    const csv = dataRows.map(row => row.map(csvEscape).join(',')).join('\r\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Central-Stock_${startDate}_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const handleExportXLSX = () => {
    const dataRows = buildExportRows();
    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    ws['!cols'] = [
      { wch: 6 }, { wch: 5 }, { wch: 5 }, { wch: 40 },
      { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 2 },
      { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 2 },
      { wch: 10 }, { wch: 10 }, { wch: 12 },
      { wch: 16 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Central Stock');
    XLSX.writeFile(wb, `Central-Stock_${startDate}_${endDate}.xlsx`);
  };

  return (
    <Layout>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tighter">Central Stock</h1>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                {productCount} Product{productCount === 1 ? '' : 's'} · {safeCategories.length} Categor{safeCategories.length === 1 ? 'y' : 'ies'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {dirtyOrder && (
                <Button
                  size="sm"
                  onClick={handleSaveOrderNow}
                  disabled={savingOrder}
                  className="h-8 text-[11px] font-black bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm"
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  {savingOrder ? 'Saving...' : 'Save Order'}
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleExportXLSX}
                className="h-8 text-[11px] font-black bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-sm"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Excel (.xlsx)
              </Button>
              <Button
                size="sm"
                onClick={handleExportCSV}
                className="h-8 text-[11px] font-black bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Excel (.csv)
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-sm">
            <div className="grid grid-cols-2 md:grid-cols-12 gap-3 md:gap-4 items-end">
              <div className="col-span-2 md:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">From Date</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-xs font-bold" />
              </div>
              <div className="col-span-2 md:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">To Date</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-xs font-bold" />
              </div>
              <div className="col-span-2 md:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Status</Label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-lg text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active only (default)</option>
                  <option value="inactive">Inactive only</option>
                  <option value="all">All products</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-3">
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
              <div className="col-span-2 md:col-span-3">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <SearchTextIcon /> Search
                </Label>
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name / version..." className="h-9 text-xs font-bold" />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="relative overflow-auto max-h-[calc(100vh-290px)] tabular-nums">
              <Table className="text-xs border-collapse">
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100 border-b border-slate-200">
                    <TableHead className="py-2 px-1 text-[9px] font-black uppercase text-slate-600 text-center border-r border-slate-200 sticky top-0 left-0 bg-slate-100 z-[50] w-8">
                      <Settings2 className="w-3 h-3 mx-auto text-slate-500" />
                    </TableHead>
                    <TableHead className="py-2 px-1 text-[9px] font-black uppercase text-slate-600 text-center border-r border-slate-200 sticky top-0 left-[32px] bg-slate-100 z-[50] w-8">
                      #
                    </TableHead>
                    <TableHead className="py-2 px-1 text-[9px] font-black uppercase text-slate-600 text-center border-r border-slate-200 sticky top-0 left-[64px] bg-slate-100 z-[50] w-8">
                      Pos
                    </TableHead>
                    <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-slate-700 w-[200px] border-r border-slate-200 sticky top-0 left-[96px] bg-slate-100 z-[50]">
                      Product
                    </TableHead>
                    <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-slate-600 text-center border-r border-slate-200 bg-slate-50 z-[30] sticky top-0" colSpan={3}>
                      Entry Qty
                    </TableHead>
                    <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-slate-500 text-center border-r border-slate-200 sticky top-0 z-[30] w-3"></TableHead>
                    <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-red-700 text-center border-r border-slate-200 bg-red-50/60 z-[30] sticky top-0" colSpan={3}>
                      Sold Qty
                    </TableHead>
                    <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-slate-500 text-center border-r border-slate-200 sticky top-0 z-[30] w-3"></TableHead>
                    <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-emerald-800 text-center border-r border-slate-200 bg-emerald-50/60 z-[30] sticky top-0" colSpan={3}>
                      Current Qty
                    </TableHead>
                    <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-indigo-800 text-right border-r border-slate-200 sticky top-0 z-[30]">
                      Lowest Slab
                    </TableHead>
                    <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-slate-700 text-right sticky top-0 z-[30]">
                      Retail Price
                    </TableHead>
                  </TableRow>
                  <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-200">
                    <TableHead className="py-1.5 px-1 text-[9px] font-black uppercase text-slate-500 text-center border-r border-slate-200 sticky top-[40px] left-0 bg-slate-50 z-[49] w-8">
                      Drag
                    </TableHead>
                    <TableHead className="py-1.5 px-1 text-[9px] font-black uppercase text-slate-500 text-center border-r border-slate-200 sticky top-[40px] left-[32px] bg-slate-50 z-[49] w-8">
                      Top
                    </TableHead>
                    <TableHead className="py-1.5 px-1 text-[9px] font-black uppercase text-slate-500 text-center border-r border-slate-200 sticky top-[40px] left-[64px] bg-slate-50 z-[49] w-8">
                      Edit
                    </TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-slate-500 border-r border-slate-200 sticky top-[40px] left-[96px] bg-slate-50 z-[49]">
                      Name / Version
                    </TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-blue-700 text-center border-r border-slate-200 sticky top-[40px] z-[29]">DHK</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-orange-700 text-center border-r border-slate-200 sticky top-[40px] z-[29]">CTG</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-slate-800 text-center border-r border-slate-200 bg-slate-100/70 sticky top-[40px] z-[29]">Total</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-slate-500 text-right border-r border-slate-200 sticky top-[40px] z-[29] w-3"></TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-blue-700 text-center border-r border-slate-200 sticky top-[40px] z-[29]">DHK</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-orange-700 text-center border-r border-slate-200 sticky top-[40px] z-[29]">CTG</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-red-800 text-center border-r border-slate-200 bg-red-50/40 sticky top-[40px] z-[29]">Total</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-slate-500 text-right border-r border-slate-200 sticky top-[40px] z-[29] w-3"></TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-blue-700 text-center border-r border-slate-200 sticky top-[40px] z-[29]">DHK</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-orange-700 text-center border-r border-slate-200 sticky top-[40px] z-[29]">CTG</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-emerald-900 text-center border-r border-slate-200 bg-emerald-50/50 sticky top-[40px] z-[29]">Total</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-indigo-800 text-right border-r border-slate-200 sticky top-[40px] z-[29]">Price</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-slate-700 text-right sticky top-[40px] z-[29]">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <SortableContext items={allFlatIds} strategy={verticalListSortingStrategy} disabled={allFlatIds.length === 0}>
                  <TableBody>
                    {grouped.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={16} className="py-10 text-center text-xs text-slate-400 italic">
                          No products match your filters
                        </TableCell>
                      </TableRow>
                    )}
                    {grouped.map((g) => {
                      const catName = g.category.name;
                      const gTot = g.items.reduce((a, r) => ({
                        eT: a.eT + r.entriesTotal, sT: a.sT + r.soldTotal, cT: a.cT + r.curTotal,
                      }), { eT: 0, sT: 0, cT: 0 });
                      return (
                        <React.Fragment key={g.category.id}>
                          <TableRow className="bg-slate-900/90 hover:bg-slate-900/90 border-b border-slate-800">
                            <TableCell className="py-1.5 px-1 border-r border-slate-800/60 sticky left-0 bg-slate-900/90 z-[10] w-8"></TableCell>
                            <TableCell className="py-1.5 px-1 border-r border-slate-800/60 sticky left-[32px] bg-slate-900/90 z-[10] w-8"></TableCell>
                            <TableCell className="py-1.5 px-1 border-r border-slate-800/60 sticky left-[64px] bg-slate-900/90 z-[10] w-8"></TableCell>
                            <TableCell className="py-1.5 px-2 text-[10px] font-black uppercase tracking-widest text-white sticky left-[96px] bg-slate-900/90 z-[10]">
                              <span className="opacity-60 mr-1.5">{String.fromCharCode(9632)}</span>
                              {catName}
                              <span className="ml-2 font-normal text-slate-300 text-[9px] tracking-wide">
                                ({g.items.length})
                              </span>
                            </TableCell>
                            <TableCell colSpan={2} className="py-1.5 px-2 text-[10px] text-slate-400 text-center border-r border-slate-800/60"></TableCell>
                            <TableCell className="py-1.5 px-2 text-[10px] font-black text-white text-right bg-slate-800/60 border-r border-slate-800/60 tabular-nums">
                              {fmt(gTot.eT)}
                            </TableCell>
                            <TableCell className="py-1.5 px-2 border-r border-slate-800/60 w-3"></TableCell>
                            <TableCell colSpan={2} className="py-1.5 px-2 text-[10px] text-slate-400 text-center border-r border-slate-800/60"></TableCell>
                            <TableCell className="py-1.5 px-2 text-[10px] font-black text-red-300 text-right bg-red-950/40 border-r border-slate-800/60 tabular-nums">
                              {fmt(gTot.sT)}
                            </TableCell>
                            <TableCell className="py-1.5 px-2 border-r border-slate-800/60 w-3"></TableCell>
                            <TableCell colSpan={2} className="py-1.5 px-2 text-[10px] text-slate-400 text-center border-r border-slate-800/60"></TableCell>
                            <TableCell className="py-1.5 px-2 text-[10px] font-black text-emerald-300 text-right bg-emerald-950/40 border-r border-slate-800/60 tabular-nums">
                              {fmt(gTot.cT)}
                            </TableCell>
                            <TableCell colSpan={2} className="py-1.5 px-2"></TableCell>
                          </TableRow>
                          {g.items.map((r, idx) => (
                            <SortableProductRow
                              key={r.id}
                              row={r}
                              idx={idx}
                              onMoveToTop={handleMoveToTop}
                              onOpenPosition={handleOpenPosition}
                              lastInCategory={idx === g.items.length - 1}
                            />
                          ))}
                        </React.Fragment>
                      );
                    })}
                    {grouped.length > 0 && (
                      <TableRow className="bg-slate-800 hover:bg-slate-800 sticky bottom-0 z-[15] border-t-2 border-slate-700">
                        <TableCell className="py-2 px-1 border-r border-slate-700 sticky bottom-0 left-0 bg-slate-800 z-[16] w-8"></TableCell>
                        <TableCell className="py-2 px-1 border-r border-slate-700 sticky bottom-0 left-[32px] bg-slate-800 z-[16] w-8"></TableCell>
                        <TableCell className="py-2 px-1 border-r border-slate-700 sticky bottom-0 left-[64px] bg-slate-800 z-[16] w-8"></TableCell>
                        <TableCell className="py-2 px-2 text-[10px] font-black uppercase tracking-widest text-white sticky bottom-0 left-[96px] bg-slate-800 z-[16]">
                          Grand Total
                        </TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums text-[11px] font-bold text-blue-200 border-r border-slate-700">{fmt(totals.entriesDhaka)}</TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums text-[11px] font-bold text-orange-200 border-r border-slate-700">{fmt(totals.entriesCtg)}</TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums text-[12px] font-black text-white border-r border-slate-700 bg-slate-700">{fmt(totals.entriesTotal)}</TableCell>
                        <TableCell className="py-2 px-2 border-r border-slate-700 w-3"></TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums text-[11px] font-bold text-blue-200 border-r border-slate-700">{fmt(totals.soldDhaka)}</TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums text-[11px] font-bold text-orange-200 border-r border-slate-700">{fmt(totals.soldCtg)}</TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums text-[12px] font-black text-red-200 border-r border-slate-700 bg-red-950/40">{fmt(totals.soldTotal)}</TableCell>
                        <TableCell className="py-2 px-2 border-r border-slate-700 w-3"></TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums text-[11px] font-bold text-blue-200 border-r border-slate-700">{fmt(totals.curDhaka)}</TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums text-[11px] font-bold text-orange-200 border-r border-slate-700">{fmt(totals.curCtg)}</TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums text-[12px] font-black text-emerald-200 border-r border-slate-700 bg-emerald-950/40">{fmt(totals.curTotal)}</TableCell>
                        <TableCell className="py-2 px-2 border-r border-slate-700"></TableCell>
                        <TableCell className="py-2 px-2"></TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </SortableContext>
              </Table>
            </div>
          </div>
        </div>
      </DndContext>

      {/* Position Edit Dialog */}
      <Dialog open={showPositionDialog} onOpenChange={setShowPositionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-tight">
              Edit Product Position
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="text-xs text-slate-500 font-bold">
              Place the selected product:
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={positionMode === 'before' ? 'default' : 'outline'}
                onClick={() => setPositionMode('before')}
                className="h-9 text-xs font-bold"
              >
                Before Target
              </Button>
              <Button
                type="button"
                variant={positionMode === 'after' ? 'default' : 'outline'}
                onClick={() => setPositionMode('after')}
                className="h-9 text-xs font-bold"
              >
                After Target
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Target Product (same category)
              </Label>
              <Select value={positionTargetId} onValueChange={setPositionTargetId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select target product..." />
                </SelectTrigger>
                <SelectContent>
                  {positionTargets.length === 0 && (
                    <div className="px-3 py-6 text-xs text-slate-400 text-center italic">
                      No other products in this category
                    </div>
                  )}
                  {positionTargets.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      <span className="font-bold">{p.name}</span>
                      {p.version && <span className="text-slate-400 ml-2 text-[10px]">{p.version}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPositionDialog(false)}
                className="flex-1 h-9 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleApplyPosition}
                disabled={!positionTargetId}
                className="flex-1 h-9 text-xs font-black bg-slate-900"
              >
                Apply Position
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function SearchTextIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
