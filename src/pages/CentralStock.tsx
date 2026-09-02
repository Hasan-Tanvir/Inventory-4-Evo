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
import { GripVertical, ArrowUpToLine, Download, Settings2, Save, ChevronUp, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';

const LS_KEY = 'central-stock-ui-v1';

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
  row, idx, totalInCat, isEditing, onMoveToTop, onMoveUp, onMoveDown, onSetPosition, lastInCategory,
}: {
  row: RowShape;
  idx: number;
  totalInCat: number;
  isEditing: boolean;
  onMoveToTop: (productId: string) => void;
  onMoveUp: (productId: string) => void;
  onMoveDown: (productId: string) => void;
  onSetPosition: (productId: string, pos: number) => void;
  lastInCategory: boolean;
}) => {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: row.id, disabled: !isEditing });
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
      <TableCell className="py-1.5 px-1 w-7 border-r border-slate-100 sticky left-0 bg-inherit z-[5] p-0 text-center">
        {isEditing ? (
          <div {...attributes} {...listeners} className="inline-flex items-center justify-center w-7 h-6 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing touch-none">
            <GripVertical className="w-3 h-3" />
          </div>
        ) : (
          <div className="w-7 h-6 inline-flex items-center justify-center text-[9px] font-black text-slate-400 tabular-nums">{idx + 1}</div>
        )}
      </TableCell>
      <TableCell className="py-1.5 px-0.5 w-6 border-r border-slate-100 sticky left-[28px] bg-inherit z-[5] p-0 text-center">
        {isEditing ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMoveUp(row.id)}
            disabled={idx === 0}
            title="Move up one position"
            className="h-6 w-6 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </Button>
        ) : null}
      </TableCell>
      <TableCell className="py-1.5 px-0.5 w-6 border-r border-slate-100 sticky left-[52px] bg-inherit z-[5] p-0 text-center">
        {isEditing ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMoveDown(row.id)}
            disabled={idx === totalInCat - 1}
            title="Move down one position"
            className="h-6 w-6 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
        ) : null}
      </TableCell>
      <TableCell className="py-1.5 px-0.5 w-6 border-r border-slate-100 sticky left-[76px] bg-inherit z-[5] p-0 text-center">
        {isEditing ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMoveToTop(row.id)}
            disabled={idx === 0}
            title="Move to top of category"
            className="h-6 w-6 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
          >
            <ArrowUpToLine className="w-3 h-3" />
          </Button>
        ) : null}
      </TableCell>
      <TableCell className="py-1.5 px-1 w-9 border-r border-slate-100 sticky left-[100px] bg-inherit z-[5] p-0 text-center">
        {isEditing ? (
          <input
            type="number"
            min={1}
            max={totalInCat}
            value={idx + 1}
            onChange={e => {
              const v = parseInt(e.target.value);
              if (!Number.isNaN(v) && v >= 1 && v <= totalInCat) onSetPosition(row.id, v - 1);
            }}
            onBlur={e => { if (e.target.value === '') e.target.value = String(idx + 1); }}
            className="w-full h-6 text-center text-[9px] font-bold bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 tabular-nums"
            title="Set exact position (1 to top)"
          />
        ) : null}
      </TableCell>
      <TableCell className={cn(
        "py-1.5 px-2 border-r border-slate-100 sticky left-[136px] bg-inherit z-[5] w-[190px]",
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

  const initial: PersistedState = useMemo(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LS_KEY) : null;
      if (raw) return { startDate: defaultStart, endDate: defaultEnd, search: '', categoryFilter: 'all', statusFilter: 'active', ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { startDate: defaultStart, endDate: defaultEnd, search: '', categoryFilter: 'all', statusFilter: 'active' as const };
  }, [defaultStart, defaultEnd]);

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
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [dirtyOrder, setDirtyOrder] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, [startDate, endDate, search, categoryFilter, statusFilter]);

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

  // Sort productIds (per category) by Product.sortOrder ascending
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
        const oa = typeof pa?.sortOrder === 'number' ? pa.sortOrder! : Number.MAX_SAFE_INTEGER;
        const ob = typeof pb?.sortOrder === 'number' ? pb.sortOrder! : Number.MAX_SAFE_INTEGER;
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
        // Remove so we don't double emit
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

  const applyCategoryReorder = (categoryId: string, reordered: string[]) => {
    const safeCats = Array.isArray(categories) ? categories : [];
    const catOrderMap = new Map<string, string[]>();
    safeCats.forEach(c => catOrderMap.set(c.id, []));
    catOrderMap.set('', []);
    catOrderMap.set(categoryId, reordered);
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
    const byId = new Map(products.map(x => [x.id, x]));
    // Fix for jump up/down not working: immediately assign each product its new
    // sortOrder (by position in finalIds) BEFORE calling setProducts. Without this,
    // sortedProductIdsByCategory re-sorts by the stale `sortOrder` on the next
    // render and visually undoes the reorder until the async API save completes.
    const reorderedProducts = finalIds.map((id, i) => {
      const p = byId.get(id);
      if (!p) return null as unknown as Product;
      return { ...p, sortOrder: i + 1 };
    }).filter(Boolean) as Product[];
    setProducts(reorderedProducts);
    scheduleOrderPersist(reorderedProducts);
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
    applyCategoryReorder(categoryId, reordered);
  };

  const handleMoveToTop = (productId: string) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const categoryId = p.categoryId || '';
    const idsInCat = sortedProductIdsByCategory.get(categoryId) || [];
    const oldIdx = idsInCat.indexOf(productId);
    if (oldIdx <= 0) return;
    const reordered = arrayMove(idsInCat, oldIdx, 0);
    applyCategoryReorder(categoryId, reordered);
  };

  const handleMoveUp = (productId: string) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const categoryId = p.categoryId || '';
    const idsInCat = sortedProductIdsByCategory.get(categoryId) || [];
    const oldIdx = idsInCat.indexOf(productId);
    if (oldIdx <= 0) return;
    const reordered = arrayMove(idsInCat, oldIdx, oldIdx - 1);
    applyCategoryReorder(categoryId, reordered);
  };

  const handleMoveDown = (productId: string) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const categoryId = p.categoryId || '';
    const idsInCat = sortedProductIdsByCategory.get(categoryId) || [];
    const oldIdx = idsInCat.indexOf(productId);
    if (oldIdx < 0 || oldIdx >= idsInCat.length - 1) return;
    const reordered = arrayMove(idsInCat, oldIdx, oldIdx + 1);
    applyCategoryReorder(categoryId, reordered);
  };

  const handleSetPosition = (productId: string, newIdx: number) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const categoryId = p.categoryId || '';
    const idsInCat = sortedProductIdsByCategory.get(categoryId) || [];
    const oldIdx = idsInCat.indexOf(productId);
    if (oldIdx < 0 || newIdx < 0 || newIdx >= idsInCat.length || oldIdx === newIdx) return;
    const reordered = arrayMove(idsInCat, oldIdx, newIdx);
    applyCategoryReorder(categoryId, reordered);
  };

  const safeCategories = Array.isArray(categories) ? categories : [];
  const productCount = grouped.reduce((a, g) => a + g.items.length, 0);
  const allFlatIds = useMemo(() => grouped.flatMap(g => g.items.map(r => r.id)), [grouped]);

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

  const handleExportExcel = () => {
    const aoa: (string | number | undefined)[][] = [];
    aoa.push([`Central Stock Report`]);
    aoa.push([
      `From: ${startDate}`, `To: ${endDate}`,
      `Status: ${statusFilter}`,
      `Category: ${categoryFilter === 'all' ? 'All' : (safeCategories.find(c => c.id === categoryFilter)?.name || categoryFilter)}`,
      `Search: "${search || ''}"`,
    ]);
    aoa.push([]);
    aoa.push([
      'Pos', '', '', '', '', 'Product',
      '', 'Entry Qty', '', '',
      '', 'Sold Qty', '', '',
      '', 'Current Qty', '', '',
      'Lowest Slab Price', 'Retail Price',
    ]);
    aoa.push([
      '#', '↑', '↓', 'Top', 'Pos#', 'Name / Version / Status',
      'DHK', 'CTG', 'Total', '',
      'DHK', 'CTG', 'Total', '',
      'DHK', 'CTG', 'Total',
      'Price', 'Price',
    ]);

    grouped.forEach(g => {
      const gTot = g.items.reduce((a, r) => ({
        eT: a.eT + r.entriesTotal, sT: a.sT + r.soldTotal, cT: a.cT + r.curTotal,
      }), { eT: 0, sT: 0, cT: 0 });
      aoa.push([
        '', '', '', '', '', `■ ${g.category.name} (${g.items.length} item${g.items.length === 1 ? '' : 's'})`,
        '', '', gTot.eT,
        '', '', '', gTot.sT,
        '', '', '', gTot.cT,
        '', '',
      ]);
      g.items.forEach((r, idx) => {
        const status = r.status === 'inactive' ? ' [INACTIVE]' : '';
        aoa.push([
          String(idx + 1), '↑', '↓', '^', String(idx + 1),
          `${r.name}${r.version ? ' - ' + r.version : ''}${status}`,
          r.entriesDhaka, r.entriesCtg, r.entriesTotal, '',
          r.soldDhaka, r.soldCtg, r.soldTotal, '',
          r.curDhaka, r.curCtg, r.curTotal,
          r.lowestSlab, r.retail,
        ]);
      });
    });

    aoa.push([]);
    aoa.push([
      '', '', '', '', '', 'GRAND TOTAL',
      totals.entriesDhaka, totals.entriesCtg, totals.entriesTotal,
      '', totals.soldDhaka, totals.soldCtg, totals.soldTotal,
      '', totals.curDhaka, totals.curCtg, totals.curTotal,
      '', '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 5 }, { wch: 4 }, { wch: 4 }, { wch: 5 }, { wch: 5 }, { wch: 38 },
      { wch: 9 }, { wch: 9 }, { wch: 10 }, { wch: 3 },
      { wch: 9 }, { wch: 9 }, { wch: 10 }, { wch: 3 },
      { wch: 9 }, { wch: 9 }, { wch: 10 },
      { wch: 14 }, { wch: 12 },
    ];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 18 } },
      { s: { r: 3, c: 6 }, e: { r: 3, c: 8 } },
      { s: { r: 3, c: 10 }, e: { r: 3, c: 12 } },
      { s: { r: 3, c: 14 }, e: { r: 3, c: 16 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Central Stock');
    XLSX.writeFile(wb, `Central-Stock_${startDate}_${endDate}.xlsx`);
    showSuccess('Excel file downloaded');
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
              <Button
                size="sm"
                onClick={() => setIsEditingOrder(e => !e)}
                className={cn(
                  "h-8 text-[11px] font-black rounded-lg shadow-sm",
                  isEditingOrder
                    ? "bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-200"
                    : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300"
                )}
              >
                <Settings2 className={cn("w-3.5 h-3.5 mr-1", isEditingOrder && "animate-pulse")} />
                {isEditingOrder ? 'Editing…' : 'Edit Order'}
              </Button>
              {(dirtyOrder && isEditingOrder) && (
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
                onClick={handleExportExcel}
                className="h-8 text-[11px] font-black bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Excel (.xlsx)
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
              <div className="col-span-2 md:col-span-4">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Product Status</Label>
                <div className="flex items-center gap-1 h-9 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                  <button
                    onClick={() => setStatusFilter('active')}
                    className={cn(
                      "flex-1 h-full text-[10px] font-black uppercase tracking-wider rounded-md transition-all duration-150",
                      statusFilter === 'active'
                        ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Active
                    </span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('inactive')}
                    className={cn(
                      "flex-1 h-full text-[10px] font-black uppercase tracking-wider rounded-md transition-all duration-150",
                      statusFilter === 'inactive'
                        ? "bg-white text-red-700 shadow-sm ring-1 ring-red-200"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      Inactive
                    </span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={cn(
                      "flex-1 h-full text-[10px] font-black uppercase tracking-wider rounded-md transition-all duration-150",
                      statusFilter === 'all'
                        ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-300"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                      All
                    </span>
                  </button>
                </div>
              </div>
              <div className="col-span-2 md:col-span-2">
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
              <div className="col-span-2 md:col-span-2">
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
                    <TableHead className="py-2 px-1 text-[9px] font-black uppercase text-slate-600 text-center border-r border-slate-200 sticky top-0 left-0 bg-slate-100 z-[50] w-7">
                      {isEditingOrder
                        ? <Settings2 className="w-3 h-3 mx-auto text-slate-500" />
                        : <span className="text-slate-600">#</span>}
                    </TableHead>
                    <TableHead className={cn(
                      "py-2 px-0.5 text-[9px] font-black uppercase text-center border-r border-slate-200 sticky top-0 left-[28px] bg-slate-100 z-[50] w-6 transition-opacity",
                      isEditingOrder ? "text-slate-600" : "opacity-20 text-slate-400"
                    )}>
                      ↑
                    </TableHead>
                    <TableHead className={cn(
                      "py-2 px-0.5 text-[9px] font-black uppercase text-center border-r border-slate-200 sticky top-0 left-[52px] bg-slate-100 z-[50] w-6 transition-opacity",
                      isEditingOrder ? "text-slate-600" : "opacity-20 text-slate-400"
                    )}>
                      ↓
                    </TableHead>
                    <TableHead className={cn(
                      "py-2 px-0.5 text-[9px] font-black uppercase text-center border-r border-slate-200 sticky top-0 left-[76px] bg-slate-100 z-[50] w-6 transition-opacity",
                      isEditingOrder ? "text-slate-600" : "opacity-20 text-slate-400"
                    )}>
                      Top
                    </TableHead>
                    <TableHead className={cn(
                      "py-2 px-1 text-[9px] font-black uppercase text-center border-r border-slate-200 sticky top-0 left-[100px] bg-slate-100 z-[50] w-9 transition-opacity",
                      isEditingOrder ? "text-slate-600" : "opacity-20 text-slate-400"
                    )}>
                      {isEditingOrder ? 'Pos' : ''}
                    </TableHead>
                    <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-slate-700 w-[190px] border-r border-slate-200 sticky top-0 left-[136px] bg-slate-100 z-[50]">
                      Product
                    </TableHead>
                    <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-slate-600 text-center border-r border-slate-200 bg-slate-50 z-[30] sticky top-0" colSpan={3}>
                      Entry Qty
                    </TableHead>
                    <TableHead className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-red-700 text-center border-r border-slate-200 bg-red-50/60 z-[30] sticky top-0" colSpan={3}>
                      Sold Qty
                    </TableHead>
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
                    <TableHead className="py-1.5 px-1 text-[9px] font-black uppercase text-slate-500 text-center border-r border-slate-200 sticky top-[36px] left-0 bg-slate-50 z-[49] w-7">
                      {isEditingOrder ? 'Drag' : 'No.'}
                    </TableHead>
                    <TableHead className={cn(
                      "py-1.5 px-0.5 text-[9px] font-black uppercase text-center border-r border-slate-200 sticky top-[36px] left-[28px] bg-slate-50 z-[49] w-6 transition-opacity",
                      isEditingOrder ? "text-slate-500" : "opacity-0 text-slate-500"
                    )}>
                      Up
                    </TableHead>
                    <TableHead className={cn(
                      "py-1.5 px-0.5 text-[9px] font-black uppercase text-center border-r border-slate-200 sticky top-[36px] left-[52px] bg-slate-50 z-[49] w-6 transition-opacity",
                      isEditingOrder ? "text-slate-500" : "opacity-0 text-slate-500"
                    )}>
                      Down
                    </TableHead>
                    <TableHead className={cn(
                      "py-1.5 px-0.5 text-[9px] font-black uppercase text-center border-r border-slate-200 sticky top-[36px] left-[76px] bg-slate-50 z-[49] w-6 transition-opacity",
                      isEditingOrder ? "text-slate-500" : "opacity-0 text-slate-500"
                    )}>
                      Jump
                    </TableHead>
                    <TableHead className={cn(
                      "py-1.5 px-1 text-[9px] font-black uppercase text-center border-r border-slate-200 sticky top-[36px] left-[100px] bg-slate-50 z-[49] w-9 transition-opacity",
                      isEditingOrder ? "text-slate-500" : "opacity-0 text-slate-500"
                    )}>
                      Set
                    </TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-slate-500 border-r border-slate-200 sticky top-[36px] left-[136px] bg-slate-50 z-[49]">
                      Name / Version
                    </TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-blue-700 text-center border-r border-slate-200 sticky top-[36px] z-[29]">DHK</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-orange-700 text-center border-r border-slate-200 sticky top-[36px] z-[29]">CTG</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-slate-800 text-center border-r border-slate-200 bg-slate-100/70 sticky top-[36px] z-[29]">Total</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-slate-500 text-right border-r border-slate-200 sticky top-[36px] z-[29] w-3"></TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-blue-700 text-center border-r border-slate-200 sticky top-[36px] z-[29]">DHK</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-orange-700 text-center border-r border-slate-200 sticky top-[36px] z-[29]">CTG</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-red-800 text-center border-r border-slate-200 bg-red-50/40 sticky top-[36px] z-[29]">Total</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-slate-500 text-right border-r border-slate-200 sticky top-[36px] z-[29] w-3"></TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-blue-700 text-center border-r border-slate-200 sticky top-[36px] z-[29]">DHK</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-orange-700 text-center border-r border-slate-200 sticky top-[36px] z-[29]">CTG</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-emerald-900 text-center border-r border-slate-200 bg-emerald-50/50 sticky top-[36px] z-[29]">Total</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-indigo-800 text-right border-r border-slate-200 sticky top-[36px] z-[29]">Price</TableHead>
                    <TableHead className="py-1.5 px-2 text-[9px] font-black uppercase tracking-wider text-slate-700 text-right sticky top-[36px] z-[29]">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <SortableContext items={allFlatIds} strategy={verticalListSortingStrategy} disabled={allFlatIds.length === 0}>
                  <TableBody>
                    {grouped.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={19} className="py-10 text-center text-xs text-slate-400 italic">
                          No products match your filters
                        </TableCell>
                      </TableRow>
                    )}
                    {grouped.map((g) => {
                      const catName = g.category.name;
                      const gTot = g.items.reduce((a, r) => ({
                        eT: a.eT + r.entriesTotal, sT: a.sT + r.soldTotal, cT: a.cT + r.curTotal,
                      }), { eT: 0, sT: 0, cT: 0 });
                      const catTotal = g.items.length;
                      return (
                        <React.Fragment key={g.category.id}>
                          <TableRow className="bg-slate-900/90 hover:bg-slate-900/90 border-b border-slate-800">
                            <TableCell className="py-1.5 px-1 border-r border-slate-800/60 sticky left-0 bg-slate-900/90 z-[10] w-7"></TableCell>
                            <TableCell className="py-1.5 px-0.5 border-r border-slate-800/60 sticky left-[28px] bg-slate-900/90 z-[10] w-6"></TableCell>
                            <TableCell className="py-1.5 px-0.5 border-r border-slate-800/60 sticky left-[52px] bg-slate-900/90 z-[10] w-6"></TableCell>
                            <TableCell className="py-1.5 px-0.5 border-r border-slate-800/60 sticky left-[76px] bg-slate-900/90 z-[10] w-6"></TableCell>
                            <TableCell className="py-1.5 px-1 border-r border-slate-800/60 sticky left-[100px] bg-slate-900/90 z-[10] w-9 text-[9px] font-bold text-slate-400 text-center tabular-nums">{catTotal}</TableCell>
                            <TableCell className="py-1.5 px-2 text-[10px] font-black uppercase tracking-widest text-white sticky left-[136px] bg-slate-900/90 z-[10]">
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
                              totalInCat={g.items.length}
                              isEditing={isEditingOrder}
                              onMoveToTop={handleMoveToTop}
                              onMoveUp={handleMoveUp}
                              onMoveDown={handleMoveDown}
                              onSetPosition={handleSetPosition}
                              lastInCategory={idx === g.items.length - 1}
                            />
                          ))}
                        </React.Fragment>
                      );
                    })}
                    {grouped.length > 0 && (
                      <TableRow className="bg-slate-800 hover:bg-slate-800 sticky bottom-0 z-[15] border-t-2 border-slate-700">
                        <TableCell className="py-2 px-1 border-r border-slate-700 sticky bottom-0 left-0 bg-slate-800 z-[16] w-7"></TableCell>
                        <TableCell className="py-2 px-0.5 border-r border-slate-700 sticky bottom-0 left-[28px] bg-slate-800 z-[16] w-6"></TableCell>
                        <TableCell className="py-2 px-0.5 border-r border-slate-700 sticky bottom-0 left-[52px] bg-slate-800 z-[16] w-6"></TableCell>
                        <TableCell className="py-2 px-0.5 border-r border-slate-700 sticky bottom-0 left-[76px] bg-slate-800 z-[16] w-6"></TableCell>
                        <TableCell className="py-2 px-1 border-r border-slate-700 sticky bottom-0 left-[100px] bg-slate-800 z-[16] w-9"></TableCell>
                        <TableCell className="py-2 px-2 text-[10px] font-black uppercase tracking-widest text-white sticky bottom-0 left-[136px] bg-slate-800 z-[16]">
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
