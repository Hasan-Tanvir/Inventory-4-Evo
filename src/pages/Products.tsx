"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Product, Category, ProductStockEntry, ProductStockTransfer, Slab } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showError, showSuccess } from '@/utils/toast';
import { Plus, Trash2, Edit, Tags, Search, Warehouse, History, ArrowRightLeft, Eye, LayoutGrid, List, GripVertical, Copy, CircleX, CircleCheck, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDisplayDate, getTodayISO } from '@/utils/date';
import { useIsMobile } from '@/hooks/use-mobile';
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
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

const ProductSearch = ({ products, value, onChange, placeholder = "Search product..." }: { products: Product[], value: string, onChange: (id: string) => void, placeholder?: string }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const selectedProduct = products.find(p => p.id === value);

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.version?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <Input 
          className="h-8 pl-8 text-xs rounded-lg"
          placeholder={selectedProduct ? selectedProduct.name : placeholder}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
      </div>
      {open && (
        <div className="absolute z-[100] left-0 right-0 mt-1 bg-white border rounded-xl shadow-2xl max-h-60 overflow-auto">
          {filtered.length > 0 ? filtered.map(p => (
            <button
              key={p.id}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b last:border-0"
              onClick={() => {
                onChange(p.id);
                setSearch('');
                setOpen(false);
              }}
            >
              <div className="font-bold">{p.name}</div>
              <div className="text-[10px] text-slate-500">{p.version}</div>
            </button>
          )) : (
            <div className="p-3 text-xs text-slate-400 text-center">No products found</div>
          )}
        </div>
      )}
    </div>
  );
};

const SortableProductRow = ({ p, canDrag, getProductSlabText, setEditingProduct, deleteProduct, handleDuplicate, handleToggleStatus, handleOpenPosition }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: p.id, disabled: !canDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className="hover:bg-slate-50/50 group border-slate-100 bg-white">
      <TableCell className="w-10">
        <div {...attributes} {...listeners} className={cn("p-2 touch-none", canDrag ? "text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing" : "text-slate-200 cursor-not-allowed")}>
          <GripVertical className={cn("w-4 h-4", !canDrag && "opacity-40")} />
        </div>
      </TableCell>
      <TableCell className="font-bold text-slate-900 text-sm">
        {p.name}
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">{p.version}</div>
        <Badge className={`mt-1 ${p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {p.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell className="text-xs">
        <div>Retail: {p.retailPrice}</div>
        <div>Commission/Unit: {p.commission || 0}</div>
        <div className="text-slate-500 truncate max-w-[280px]" title={getProductSlabText(p.id)}>
          Slabs: {getProductSlabText(p.id)}
        </div>
      </TableCell>
      <TableCell className="text-xs">
        <div className="flex gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Dhaka: {p.dhaka || 0}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            CTG: {p.chittagong || 0}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right space-x-1">
        <Button 
          variant="ghost" 
          size="icon" 
          className={`h-8 w-8 ${p.status === 'active' ? 'text-orange-600 bg-orange-50 hover:bg-orange-100' : 'text-green-600 bg-green-50 hover:bg-green-100'}`} 
          onClick={() => handleToggleStatus(p.id)}
          title={p.status === 'active' ? 'Deactivate' : 'Activate'}
        >
          {p.status === 'active' ? <CircleX className="w-4 h-4" /> : <CircleCheck className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600 bg-purple-50 hover:bg-purple-100" onClick={() => handleOpenPosition(p)} title="Change Position"><ArrowUpDown className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 bg-blue-50 hover:bg-blue-100" onClick={() => handleDuplicate(p)}><Copy className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 bg-blue-50 hover:bg-blue-100" onClick={() => setEditingProduct(p)}><Edit className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 bg-red-50 hover:bg-red-100" onClick={() => deleteProduct(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
      </TableCell>
    </TableRow>
  );
};

const ProductCard = ({ p, canDrag, getProductSlabText, setEditingProduct, deleteProduct, handleDuplicate, handleToggleStatus, handleOpenPosition }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: p.id, disabled: !canDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3 relative overflow-hidden", isDragging && "shadow-xl z-50")}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex gap-3 flex-1 min-w-0">
          <div {...attributes} {...listeners} className={cn("mt-1 touch-none shrink-0", canDrag ? "cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500" : "cursor-not-allowed text-slate-200")}>
            <GripVertical className={cn("w-4 h-4", !canDrag && "opacity-40")} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-slate-900 text-sm truncate uppercase tracking-tight leading-none">{p.name}</h3>
            <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider truncate">{p.version}</div>
            <Badge className={`mt-1 ${p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {p.status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
        <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black tracking-tight border border-blue-100 shrink-0">
          Retail: {p.retailPrice}
        </div>
      </div>

      <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50 space-y-2">
        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tight">
          <span>Commission / Unit</span>
          <span className="text-orange-600">{p.commission || 0}</span>
        </div>
        <div className="flex gap-3 text-[10px] font-bold uppercase tracking-tight">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Dhaka: {p.dhaka || 0}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            CTG: {p.chittagong || 0}
          </span>
        </div>
        <div className="text-[10px] text-slate-400 italic truncate">
          Slabs: {getProductSlabText(p.id)}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button 
          variant="ghost" 
          size="icon" 
          className={`h-9 w-9 rounded-xl ${p.status === 'active' ? 'text-orange-600 bg-orange-50 hover:bg-orange-100' : 'text-green-600 bg-green-50 hover:bg-green-100'}`} 
          onClick={() => handleToggleStatus(p.id)}
          title={p.status === 'active' ? 'Deactivate' : 'Activate'}
        >
          {p.status === 'active' ? <CircleX className="w-4 h-4" /> : <CircleCheck className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-xl" onClick={() => handleOpenPosition(p)} title="Change Position">
          <ArrowUpDown className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl" onClick={() => handleDuplicate(p)}>
          <Copy className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl" onClick={() => setEditingProduct(p)}>
          <Edit className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl" onClick={() => deleteProduct(p.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockEntries, setStockEntries] = useState<ProductStockEntry[]>([]);
  const [stockTransfers, setStockTransfers] = useState<ProductStockTransfer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showStockEntryDialog, setShowStockEntryDialog] = useState(false);
  const [stockEntryDate, setStockEntryDate] = useState(getTodayISO());
  const [stockEntryLocation, setStockEntryLocation] = useState<'dhaka' | 'chittagong'>('chittagong');
  const [stockEntryItems, setStockEntryItems] = useState<Array<{
    productId: string;
    quantity: number | string;
  }>>([{ productId: '', quantity: '' }]);
  const [stockEntryNote, setStockEntryNote] = useState('');
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [showStockTransferDialog, setShowStockTransferDialog] = useState(false);

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
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [stockTransferForm, setStockTransferForm] = useState<{
    productId: string;
    from: 'dhaka' | 'chittagong';
    to: 'dhaka' | 'chittagong';
    quantity: number | string;
    date: string;
    note: string;
  }>({
    productId: '',
    from: 'chittagong',
    to: 'dhaka',
    quantity: '',
    date: getTodayISO(),
    note: '',
  });
  const [activeView, setActiveView] = useState<'products' | 'history'>('products');
  const [historyDetailOpen, setHistoryDetailOpen] = useState(false);
  const [historyDetail, setHistoryDetail] = useState<{
    type: 'entry' | 'transfer';
    title: string;
    rows: Array<{ label: string; value: string }>;
  } | null>(null);
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<'tile' | 'list'>(() => isMobile ? 'tile' : 'list');
  const [showPositionDialog, setShowPositionDialog] = useState(false);
  const [positioningProduct, setPositioningProduct] = useState<Product | null>(null);
  const [positionMode, setPositionMode] = useState<'before' | 'after'>('after');
  const [positionTargetId, setPositionTargetId] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      setProducts(await api.getProducts() || []);
      setCategories(await api.getCategories() || []);
      setStockEntries(await api.getProductStockEntries() || []);
      setStockTransfers(await api.getProductStockTransfers() || []);
    };
    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    const safeProducts = Array.isArray(products) ? products : [];
    return safeProducts
      .filter(p => {
        if (!p) return false;
        const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.version || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
        const matchesStatus = productStatusFilter === 'all' || p.status === productStatusFilter;
        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        const oA = typeof a.sortOrder === 'number' && !Number.isNaN(a.sortOrder) ? a.sortOrder : 0;
        const oB = typeof b.sortOrder === 'number' && !Number.isNaN(b.sortOrder) ? b.sortOrder : 0;
        if (oA !== oB) return oA - oB;
        return (a.name || '').localeCompare(b.name || '', 'en', { numeric: true });
      });
  }, [products, searchTerm, selectedCategory, productStatusFilter]);

  const handleSaveProduct = async () => {
    if (editingProduct && editingProduct.name) {
      const isNewProduct = !editingProduct.id;
      const initialDhaka = Number(editingProduct.dhaka || 0);
      const initialCtg = Number(editingProduct.chittagong || 0);
      const savedProduct = await api.saveProduct({
        ...editingProduct,
        dhaka: isNewProduct ? 0 : editingProduct.dhaka,
        chittagong: isNewProduct ? 0 : editingProduct.chittagong
      } as Product);

      if (isNewProduct) {
        // Ensure new product is added at the TOP OF ITS CATEGORY
        const currentProducts = await api.getProducts();
        const newCatId = savedProduct.categoryId || '';
        const otherProducts = currentProducts.filter(p => p.id !== savedProduct.id);
        // Build per-category order map, then flatten preserving category order
        const catOrderMap = new Map<string, string[]>();
        const categoriesFromLoad = await api.getCategories();
        const safeCats = Array.isArray(categoriesFromLoad) ? categoriesFromLoad : [];
        safeCats.forEach(c => catOrderMap.set(c.id, []));
        catOrderMap.set('', []);
        otherProducts.forEach(p => {
          const cid = p.categoryId || '';
          if (!catOrderMap.has(cid)) catOrderMap.set(cid, []);
          catOrderMap.get(cid)!.push(p.id);
        });
        // Ensure new product is FIRST in its category
        const existingInCat = catOrderMap.get(newCatId) || [];
        catOrderMap.set(newCatId, [savedProduct.id, ...existingInCat]);
        // Final ordered ids: iterate categories in original order, then the rest
        const finalIds: string[] = [];
        safeCats.forEach(c => (catOrderMap.get(c.id) || []).forEach(id => finalIds.push(id)));
        catOrderMap.forEach((ids, cid) => {
          if (safeCats.find(c => c.id === cid)) return;
          ids.forEach(id => finalIds.push(id));
        });
        // Catch any remaining products missed due to category data mismatch
        otherProducts.forEach(p => { if (!finalIds.includes(p.id)) finalIds.push(p.id); });
        await api.reorderProducts(finalIds);

        const initialEntries: ProductStockEntry[] = [];
        if (initialDhaka > 0) {
          initialEntries.push({
            id: '',
            batchId: `INIT-${savedProduct.id}`,
            productId: savedProduct.id,
            productName: savedProduct.name,
            date: getTodayISO(),
            location: 'dhaka',
            quantity: initialDhaka,
            note: 'Initial Quantity'
          });
        }
        if (initialCtg > 0) {
          initialEntries.push({
            id: '',
            batchId: `INIT-${savedProduct.id}`,
            productId: savedProduct.id,
            productName: savedProduct.name,
            date: getTodayISO(),
            location: 'chittagong',
            quantity: initialCtg,
            note: 'Initial Quantity'
          });
        }
        if (initialEntries.length > 0) {
          await api.saveProductStockEntries(initialEntries);
        }
      }
      setProducts(await api.getProducts());
      setStockEntries(await api.getProductStockEntries());
      setEditingProduct(null);
      showSuccess('Product saved successfully');
    }
  };

  const handleToggleProductStatus = async (id: string) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const newStatus = product.status === 'active' ? 'inactive' : 'active';
    await api.saveProduct({ ...product, status: newStatus });
    setProducts(await api.getProducts());
    showSuccess(`Product marked as ${newStatus}`);
  };

  const handleOpenPosition = (product: Product) => {
    setPositioningProduct(product);
    const currentIndex = products.findIndex(p => p.id === product.id);
    const nextProduct = products[currentIndex + 1];
    const prevProduct = products[currentIndex - 1];
    setPositionMode('after');
    setPositionTargetId(prevProduct ? prevProduct.id : (nextProduct ? nextProduct.id : ''));
    setShowPositionDialog(true);
  };

  const handleApplyPosition = async () => {
    if (!positioningProduct || !positionTargetId) return;
    if (positioningProduct.id === positionTargetId) return;

    const currentOrder = products.map(p => p.id);
    const movedId = positioningProduct.id;
    const withoutMoved = currentOrder.filter(id => id !== movedId);
    const targetIndex = withoutMoved.indexOf(positionTargetId);

    if (targetIndex < 0) return;

    const insertIndex = positionMode === 'before' ? targetIndex : targetIndex + 1;
    const newOrder = [
      ...withoutMoved.slice(0, insertIndex),
      movedId,
      ...withoutMoved.slice(insertIndex)
    ];

    await api.reorderProducts(newOrder);
    setProducts(await api.getProducts());
    setShowPositionDialog(false);
    setPositioningProduct(null);
    showSuccess(`Product moved ${positionMode} target product`);
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      await api.deleteProduct(id);
      setProducts(await api.getProducts());
      showSuccess('Product deleted');
    }
  };

  const handleSaveCategory = async () => {
    if (!newCategoryName) return;
    await api.saveCategory({ id: editingCategory?.id || `CAT-${Date.now()}`, name: newCategoryName });
    setCategories(await api.getCategories());
    setNewCategoryName('');
    setEditingCategory(null);
    showSuccess("Category saved");
  };

  const addSlabRow = () => {
    if (!editingProduct) return;
    const slabs = Array.isArray(editingProduct.slabs) ? editingProduct.slabs : [];
    setEditingProduct({
      ...editingProduct,
      slabs: [...slabs, { min: 1, max: 1, price: 0 }]
    });
  };

  const updateSlab = (index: number, field: keyof Slab, value: number) => {
    if (!editingProduct) return;
    const slabs = [...(Array.isArray(editingProduct.slabs) ? editingProduct.slabs : [])];
    slabs[index] = { ...slabs[index], [field]: value };
    setEditingProduct({ ...editingProduct, slabs });
  };

  const removeSlab = (index: number) => {
    if (!editingProduct) return;
    const slabs = (Array.isArray(editingProduct.slabs) ? editingProduct.slabs : []).filter((_, i) => i !== index);
    setEditingProduct({ ...editingProduct, slabs });
  };

  const handleSaveStockEntry = async () => {
    const safeItems = Array.isArray(stockEntryItems) ? stockEntryItems : [];
    const validItems = safeItems.filter(i => i && i.productId && Number(i.quantity) > 0);
    if (validItems.length === 0) return;

    const batchId = editingBatchId || `SE-${Date.now()}`;
    const payload: ProductStockEntry[] = validItems.map((item) => {
      const allProducts = Array.isArray(products) ? products : [];
      const product = allProducts.find(p => p && p.id === item.productId);
      return {
        id: (item as any).id || '',
        batchId,
        productId: item.productId,
        productName: product?.name || 'Unknown Product',
        date: stockEntryDate,
        location: stockEntryLocation,
        quantity: Number(item.quantity),
        note: stockEntryNote
      };
    });

    await api.saveProductStockEntries(payload);
    setProducts(await api.getProducts());
    setStockEntries(await api.getProductStockEntries());
    setStockEntryItems([{ productId: '', quantity: '' }]);
    setStockEntryNote('');
    setStockEntryDate(getTodayISO());
    setStockEntryLocation('chittagong');
    setEditingBatchId(null);
    setShowStockEntryDialog(false);
    showSuccess(editingBatchId ? "Stock entry updated" : "Stock entry saved");
  };

  const addStockEntryRow = () => setStockEntryItems([
    ...(Array.isArray(stockEntryItems) ? stockEntryItems : []),
    { productId: '', quantity: '' }
  ]);

  const updateStockEntryRow = (index: number, field: 'productId' | 'quantity', value: string) => {
    const rows = [...(Array.isArray(stockEntryItems) ? stockEntryItems : [])];
    rows[index] = { ...rows[index], [field]: field === 'quantity' ? value : value };
    setStockEntryItems(rows);
  };

  const removeStockEntryRow = (index: number) => {
    setStockEntryItems((Array.isArray(stockEntryItems) ? stockEntryItems : []).filter((_, i) => i !== index));
  };

  const getProductSlabText = (productId: string) => {
    const allProducts = Array.isArray(products) ? products : [];
    const product = allProducts.find(p => p && p.id === productId);
    if (!product || !Array.isArray(product.slabs) || !product.slabs.length) return 'No slabs';
    return product.slabs.map(s => `${s.title ? s.title + ': ' : ''}${s.min}-${s.max}: ${s.price}`).join(' | ');
  };

  const getAvailableQty = (productId: string) => {
    const allProducts = Array.isArray(products) ? products : [];
    const product = allProducts.find(p => p && p.id === productId);
    if (!product) return 0;
    return stockEntryLocation === 'dhaka' ? (product.dhaka || 0) : (product.chittagong || 0);
  };
  const getAvailableQtyByLocation = (productId: string, location: 'dhaka' | 'chittagong') => {
    const allProducts = Array.isArray(products) ? products : [];
    const product = allProducts.find(p => p && p.id === productId);
    if (!product) return 0;
    return location === 'dhaka' ? (product.dhaka || 0) : (product.chittagong || 0);
  };

  const getSelectableProductsForRow = (rowIndex: number) => {
    const safeItems = Array.isArray(stockEntryItems) ? stockEntryItems : [];
    const takenIds = new Set(
      safeItems
        .filter((item, index) => index !== rowIndex)
        .map(item => item?.productId)
        .filter(Boolean)
    );
    const allProducts = Array.isArray(products) ? products : [];
    return allProducts.filter(product => product && !takenIds.has(product.id));
  };

  const canDragProducts = searchTerm.trim() === '' && selectedCategory === 'all' && productStatusFilter === 'active';

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && canDragProducts) {
      const filtered = filteredProducts.map(p => p.id);
      const oldIndex = filtered.indexOf(String(active.id));
      const newIndex = filtered.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;

      const reorderedFiltered = arrayMove(filtered, oldIndex, newIndex);

      const allProducts = products;
      const reorderedSet = new Set(reorderedFiltered);
      let reorderedCursor = 0;
      const finalIds: string[] = [];
      for (let i = 0; i < allProducts.length; i++) {
        const pid = allProducts[i].id;
        if (reorderedSet.has(pid)) {
          finalIds.push(reorderedFiltered[reorderedCursor++]);
        } else {
          finalIds.push(pid);
        }
      }

      const reorderedProducts = finalIds
        .map((id, globalIdx) => {
          const orig = allProducts.find(p => p.id === id);
          if (!orig) return undefined;
          return { ...orig, sortOrder: globalIdx + 1 };
        })
        .filter((p): p is Product => !!p);

      setProducts(reorderedProducts);
      await api.reorderProducts(finalIds);
      const refreshed = await api.getProducts();
      if (Array.isArray(refreshed)) setProducts(refreshed);
    }
  };

  const groupedEntryHistory = useMemo(() => {
    const groups = new Map<string, {
      id: string;
      entryId: string;
      date: string;
      location: string;
      note: string;
      totalQty: number;
      itemCount: number;
      products: string[];
    }>();

    stockEntries.forEach((entry) => {
      const key = entry.batchId || entry.id;
      const current = groups.get(key);
      const locationLabel = entry.location === 'dhaka' ? 'Dhaka' : 'CTG';
      if (!current) {
        groups.set(key, {
          id: key,
          entryId: entry.entryId || key,
          date: entry.date,
          location: locationLabel,
          note: entry.note || '-',
          totalQty: entry.quantity,
          itemCount: 1,
          products: [`${entry.productName} (${entry.quantity})`]
        });
        return;
      }
      current.totalQty += entry.quantity;
      current.itemCount += 1;
      current.products.push(`${entry.productName} (${entry.quantity})`);
      if (current.location !== locationLabel) current.location = 'Mixed';
    });

    return Array.from(groups.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [stockEntries]);

  const handleSaveStockTransfer = async () => {
    if (!stockTransferForm.productId || !stockTransferForm.quantity) return;
    const product = products.find(p => p.id === stockTransferForm.productId);
    if (!product) return;

    const result = await api.saveProductStockTransfer({
      id: (stockTransferForm as any).id || '',
      date: stockTransferForm.date,
      productId: stockTransferForm.productId,
      productName: product.name,
      from: stockTransferForm.from,
      to: stockTransferForm.to,
      quantity: Number(stockTransferForm.quantity),
      note: stockTransferForm.note
    });

    if (result && (result as any).success === false) {
      showError((result as any).message || 'Could not transfer stock');
      return;
    }

    setProducts(await api.getProducts());
    setStockTransfers(await api.getProductStockTransfers());
    setShowStockTransferDialog(false);
    setStockTransferForm({
      productId: '',
      from: 'chittagong',
      to: 'dhaka',
      quantity: '',
      date: getTodayISO(),
      note: ''
    });
    showSuccess(stockTransferForm.id ? 'Stock transfer updated' : 'Stock transferred');
  };

  const openEntryDetail = (entryGroupId: string) => {
    const details = stockEntries.filter(e => (e.batchId || e.id) === entryGroupId);
    if (!details.length) return;
    setHistoryDetail({
      type: 'entry',
      title: `Stock Entry ${details[0].entryId || details[0].batchId || details[0].id}`,
      rows: details.map((d, idx) => ({
        label: `${idx + 1}. ${d.productName}`,
        value: `${d.location.toUpperCase()} | Qty: ${d.quantity} | Date: ${formatDisplayDate(d.date)} | ${d.note || '-'}`
      })),
      id: entryGroupId
    });
    setHistoryDetailOpen(true);
  };

  const openTransferDetail = (transfer: ProductStockTransfer) => {
    setHistoryDetail({
      type: 'transfer',
      title: `Transfer ${transfer.transferId || transfer.id}`,
      rows: [
        { label: 'Product', value: transfer.productName },
        { label: 'Date', value: formatDisplayDate(transfer.date) },
        { label: 'From -> To', value: `${transfer.from.toUpperCase()} -> ${transfer.to.toUpperCase()}` },
        { label: 'Quantity', value: String(transfer.quantity) },
        { label: 'Note', value: transfer.note || '-' }
      ],
      id: transfer.id
    });
    setHistoryDetailOpen(true);
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Delete this stock entry? This will revert the stock.')) return;
    const details = stockEntries.filter(e => (e.batchId || e.id) === id);
    for (const d of details) {
      await api.deleteProductStockEntry(d.id);
    }
    setProducts(await api.getProducts());
    setStockEntries(await api.getProductStockEntries());
    setHistoryDetailOpen(false);
    showSuccess('Stock entry deleted');
  };

  const handleDeleteTransfer = async (id: string) => {
    if (!confirm('Delete this transfer? This will revert the stock.')) return;
    await api.deleteProductStockTransfer(id);
    setProducts(await api.getProducts());
    setStockTransfers(await api.getProductStockTransfers());
    setHistoryDetailOpen(false);
    showSuccess('Transfer deleted');
  };

  const handleEditEntry = (id: string) => {
    const details = stockEntries.filter(e => (e.batchId || e.id) === id);
    if (!details.length) return;
    setEditingBatchId(details[0].batchId || details[0].id);
    setStockEntryDate(details[0].date);
    setStockEntryLocation(details[0].location as any);
    setStockEntryNote(details[0].note || '');
    setStockEntryItems(details.map(d => ({ productId: d.productId, quantity: String(d.quantity), id: d.id })));
    setShowStockEntryDialog(true);
    setHistoryDetailOpen(false);
  };

  const handleEditTransfer = (id: string) => {
    const t = stockTransfers.find(x => x.id === id);
    if (!t) return;
    setStockTransferForm({
      productId: t.productId,
      from: t.from,
      to: t.to,
      quantity: String(t.quantity),
      date: t.date,
      note: t.note || '',
      id: t.id
    } as any);
    setShowStockTransferDialog(true);
    setHistoryDetailOpen(false);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
            <h1 className="text-2xl font-bold text-slate-800">Product Inventory</h1>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Search..." className="pl-10 h-11 w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-40 h-11"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={productStatusFilter} onValueChange={(v: 'all' | 'active' | 'inactive') => setProductStatusFilter(v)}>
                <SelectTrigger className="w-full sm:w-32 h-11"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setShowCategoryManager(true)} className="h-11 w-full sm:w-auto"><Tags className="w-4 h-4 mr-2" /> Categories</Button>
              <Button variant="outline" onClick={() => setShowStockEntryDialog(true)} className="h-11 w-full sm:w-auto"><Warehouse className="w-4 h-4 mr-2" /> Stock Entry</Button>
              <Button variant="outline" onClick={() => setShowStockTransferDialog(true)} className="h-11 w-full sm:w-auto"><ArrowRightLeft className="w-4 h-4 mr-2" /> Stock Transfer</Button>
              <Button onClick={() => setEditingProduct({ name: '', version: '', categoryId: '', retailPrice: 0, commission: 0, status: 'active', dhaka: 0, chittagong: 0, slabs: [] })} className="h-11 w-full sm:w-auto bg-slate-900"><Plus className="w-4 h-4 mr-2" /> Add Product</Button>
            </div>
          </div>
          {isMobile && activeView === 'products' && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button type="button" variant={viewMode === 'tile' ? 'default' : 'outline'} className="min-w-[100px] h-10" onClick={() => setViewMode('tile')}>
                <LayoutGrid className="w-4 h-4 mr-2" /> Tile
              </Button>
              <Button type="button" variant={viewMode === 'list' ? 'default' : 'outline'} className="min-w-[100px] h-10" onClick={() => setViewMode('list')}>
                <List className="w-4 h-4 mr-2" /> List
              </Button>
            </div>
          )}
        </div>

        <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Card className="border-none shadow-sm">
              <CardContent className="p-0">
                {viewMode === 'tile' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={filteredProducts.map(p => p.id)} strategy={verticalListSortingStrategy}>
                        {filteredProducts.map((p) => (
                          <ProductCard 
                            key={p.id} 
                            p={p} 
                            canDrag={canDragProducts}
                            getProductSlabText={getProductSlabText}
                            setEditingProduct={setEditingProduct}
                            deleteProduct={handleDeleteProduct}
                            handleDuplicate={(prod: Product) => setEditingProduct({ ...prod, id: undefined, name: `${prod.name} (Copy)` })}
                            handleToggleStatus={handleToggleProductStatus}
                            handleOpenPosition={handleOpenPosition}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                ) : (
                  <div className="max-h-[62vh] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/30">
                          <TableHead className="w-10"></TableHead>
                          <TableHead className="text-xs font-bold uppercase">Product Details</TableHead>
                          <TableHead className="text-xs font-bold uppercase">Pricing & Slabs</TableHead>
                          <TableHead className="text-xs font-bold uppercase">Stock (D/C)</TableHead>
                          <TableHead className="text-right text-xs font-bold uppercase">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                          <SortableContext items={filteredProducts.map(p => p.id)} strategy={verticalListSortingStrategy}>
                            {filteredProducts.map((p) => (
                              <SortableProductRow 
                                key={p.id} 
                                p={p} 
                                canDrag={canDragProducts}
                                getProductSlabText={getProductSlabText}
                                setEditingProduct={setEditingProduct}
                                deleteProduct={handleDeleteProduct}
                                handleDuplicate={(prod: Product) => setEditingProduct({ ...prod, id: undefined, name: `${prod.name} (Copy)`})}
                                handleToggleStatus={handleToggleProductStatus}
                                handleOpenPosition={handleOpenPosition}
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
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Tabs defaultValue="entry" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="entry">Entry History</TabsTrigger>
                <TabsTrigger value="transfer">Transfer History</TabsTrigger>
              </TabsList>

              <TabsContent value="entry">
                <Card className="border-none shadow-sm">
                  <CardContent className="p-0">
                    <div className="p-4 border-b bg-slate-50/50 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                      <History className="w-4 h-4" /> Stock Entry History (Grouped)
                    </div>
                    <div className="max-h-[40vh] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/30">
                            <TableHead className="text-xs font-bold uppercase">Date</TableHead>
                            <TableHead className="text-xs font-bold uppercase">Entry ID</TableHead>
                            <TableHead className="text-xs font-bold uppercase">Location</TableHead>
                            <TableHead className="text-xs font-bold uppercase">Products</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase">Items</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase">Total Qty</TableHead>
                            <TableHead className="text-xs font-bold uppercase">Note</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase">View</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupedEntryHistory.slice(0, 25).map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="text-xs text-slate-500">{formatDisplayDate(entry.date)}</TableCell>
                              <TableCell className="text-xs font-semibold">{entry.entryId}</TableCell>
                              <TableCell className="capitalize">{entry.location}</TableCell>
                              <TableCell className="text-xs max-w-[360px] truncate" title={entry.products.join(', ')}>
                                {entry.products.join(', ')}
                              </TableCell>
                              <TableCell className="text-right">{entry.itemCount}</TableCell>
                              <TableCell className="text-right font-semibold">{entry.totalQty}</TableCell>
                              <TableCell className="text-xs">{entry.note || '-'}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEntryDetail(entry.id)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="transfer">
                <Card className="border-none shadow-sm">
                  <CardContent className="p-0">
                    <div className="p-4 border-b bg-slate-50/50 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                      <ArrowRightLeft className="w-4 h-4" /> Stock Transfer History
                    </div>
                    <div className="max-h-[40vh] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/30">
                            <TableHead className="text-xs font-bold uppercase">Date</TableHead>
                            <TableHead className="text-xs font-bold uppercase">Transfer ID</TableHead>
                            <TableHead className="text-xs font-bold uppercase">Product</TableHead>
                            <TableHead className="text-xs font-bold uppercase">From</TableHead>
                            <TableHead className="text-xs font-bold uppercase">To</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase">Qty</TableHead>
                            <TableHead className="text-xs font-bold uppercase">Note</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase">View</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stockTransfers.slice().reverse().slice(0, 25).map((transfer) => (
                            <TableRow key={transfer.id}>
                              <TableCell className="text-xs text-slate-500">{formatDisplayDate(transfer.date)}</TableCell>
                              <TableCell className="text-xs font-semibold">{transfer.transferId || transfer.id}</TableCell>
                              <TableCell>{transfer.productName}</TableCell>
                              <TableCell className="capitalize">{transfer.from}</TableCell>
                              <TableCell className="capitalize">{transfer.to}</TableCell>
                              <TableCell className="text-right font-semibold">{transfer.quantity}</TableCell>
                              <TableCell className="text-xs">{transfer.note || '-'}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openTransferDetail(transfer)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Category Manager */}
        <Dialog open={showCategoryManager} onOpenChange={setShowCategoryManager}>
          <DialogContent>
            <DialogHeader><DialogTitle>Manage Categories</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <Input placeholder="Category name..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                <Button onClick={handleSaveCategory} className="bg-slate-900">{editingCategory ? 'Update' : 'Add'}</Button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {categories.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium">{cat.name}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCategory(cat); setNewCategoryName(cat.name); }}><Edit className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={async () => { if(confirm('Delete?')) { await api.deleteCategory(cat.id); setCategories(await api.getCategories()); } }}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Product Edit Dialog */}
        <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editingProduct?.id ? 'Edit Product' : 'New Product'}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Product Name</Label><Input value={editingProduct?.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Version</Label><Input value={editingProduct?.version} onChange={e => setEditingProduct({...editingProduct, version: e.target.value})} /></div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={editingProduct?.categoryId} onValueChange={v => setEditingProduct({...editingProduct, categoryId: v})}>
                    <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Retail Price</Label>
                  <Input type="number" value={editingProduct?.retailPrice || 0} onChange={e => setEditingProduct({...editingProduct, retailPrice: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Commission / Unit</Label>
                  <Input type="number" value={editingProduct?.commission || 0} onChange={e => setEditingProduct({...editingProduct, commission: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Dhaka Stock</Label>
                  <Input type="number" value={editingProduct?.dhaka || 0} onChange={e => setEditingProduct({...editingProduct, dhaka: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>CTG Stock</Label>
                  <Input type="number" value={editingProduct?.chittagong || 0} onChange={e => setEditingProduct({...editingProduct, chittagong: Number(e.target.value)})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Product Status</Label>
                <Select value={editingProduct?.status || 'active'} onValueChange={(v: 'active' | 'inactive') => setEditingProduct({...editingProduct, status: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex justify-between items-center">
                  <Label>Dealer Price Slabs</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addSlabRow}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Slab
                  </Button>
                </div>
                {(editingProduct?.slabs || []).length === 0 && (
                  <p className="text-xs text-slate-500">No slabs added. Dealer orders will use retail price.</p>
                )}
                <div className="space-y-2">
                  {/* Header Row */}
                  <div className="grid grid-cols-4 gap-2 items-center text-[10px] font-bold uppercase text-slate-500 px-1">
                    <span>Min Quantity</span>
                    <span>Max Quantity</span>
                    <span>Dealer Price</span>
                    <span></span>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {(editingProduct?.slabs || []).map((slab, index) => (
                      <div className="grid grid-cols-4 gap-2 items-center" key={index}>
                        <Input type="number" placeholder="Min Qty" value={slab.min} onChange={e => updateSlab(index, 'min', Number(e.target.value))} />
                        <Input type="number" placeholder="Max Qty" value={slab.max} onChange={e => updateSlab(index, 'max', Number(e.target.value))} />
                        <Input type="number" placeholder="Dealer Price" value={slab.price} onChange={e => updateSlab(index, 'price', Number(e.target.value))} />
                        <Button type="button" variant="ghost" size="icon" className="text-red-400" onClick={() => removeSlab(index)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <Button className="w-full bg-slate-900" onClick={handleSaveProduct}>Save Product</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Product Stock Entry Dialog */}
        <Dialog open={showStockEntryDialog} onOpenChange={setShowStockEntryDialog}>
          <DialogContent className="max-w-5xl">
            <DialogHeader><DialogTitle>Stock Entry (Single or Multiple Products)</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Entry Date</Label>
                  <Input type="date" value={stockEntryDate} onChange={e => setStockEntryDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select value={stockEntryLocation} onValueChange={(v: 'dhaka' | 'chittagong') => setStockEntryLocation(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dhaka">Dhaka</SelectItem>
                      <SelectItem value="chittagong">CTG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Entry Note</Label>
                  <Input value={stockEntryNote} onChange={e => setStockEntryNote(e.target.value)} placeholder="Optional note for this stock entry" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Products</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addStockEntryRow}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Product Row
                  </Button>
                </div>
                <div className="rounded-lg border max-h-80 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-xs">Available</TableHead>
                        <TableHead className="text-xs">Retail</TableHead>
                        <TableHead className="text-xs">Slabs</TableHead>
                        <TableHead className="text-xs">Qty</TableHead>
                        <TableHead className="text-right text-xs">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockEntryItems.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="min-w-[220px]">
                            <ProductSearch 
                              products={getSelectableProductsForRow(index)} 
                              value={row.productId} 
                              onChange={(v) => updateStockEntryRow(index, 'productId', v)} 
                            />
                          </TableCell>
                          <TableCell className="text-xs">{row.productId ? getAvailableQty(row.productId) : '-'}</TableCell>
                          <TableCell className="text-xs">{row.productId ? products.find(p => p.id === row.productId)?.retailPrice || 0 : 0}</TableCell>
                          <TableCell className="text-xs max-w-[280px] truncate" title={row.productId ? getProductSlabText(row.productId) : ''}>
                            {row.productId ? getProductSlabText(row.productId) : '-'}
                          </TableCell>
                          <TableCell className="min-w-[110px]">
                            <Input className="h-8" type="number" value={row.quantity} onChange={e => updateStockEntryRow(index, 'quantity', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => removeStockEntryRow(index)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <Button className="w-full bg-slate-900" onClick={handleSaveStockEntry}>Save Stock Entry</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showStockTransferDialog} onOpenChange={setShowStockTransferDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Stock Transfer</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <ProductSearch 
                  products={products} 
                  value={stockTransferForm.productId} 
                  onChange={(v) => setStockTransferForm({ ...stockTransferForm, productId: v })} 
                  placeholder="Select product to transfer..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Select value={stockTransferForm.from} onValueChange={(v: 'dhaka' | 'chittagong') => setStockTransferForm({ ...stockTransferForm, from: v, to: v === 'dhaka' ? 'chittagong' : 'dhaka' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dhaka">Dhaka</SelectItem>
                      <SelectItem value="chittagong">CTG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input value={stockTransferForm.from === 'dhaka' ? 'CTG' : 'Dhaka'} readOnly />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={stockTransferForm.date} onChange={(e) => setStockTransferForm({ ...stockTransferForm, date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" value={stockTransferForm.quantity} onChange={(e) => setStockTransferForm({ ...stockTransferForm, quantity: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Input value={stockTransferForm.note} onChange={(e) => setStockTransferForm({ ...stockTransferForm, note: e.target.value })} placeholder="Optional note" />
              </div>
              {stockTransferForm.productId && (
                <p className="text-xs text-slate-500">
                  Available in {stockTransferForm.from === 'dhaka' ? 'Dhaka' : 'CTG'}: {getAvailableQtyByLocation(stockTransferForm.productId, stockTransferForm.from)}
                </p>
              )}
              <Button className="w-full bg-slate-900" onClick={handleSaveStockTransfer}>Transfer Stock</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={historyDetailOpen} onOpenChange={setHistoryDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex justify-between items-center pr-6">
                <span>{historyDetail?.title || 'History Detail'}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => historyDetail?.type === 'entry' ? handleEditEntry(historyDetail.id) : handleEditTransfer(historyDetail.id)}>
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => historyDetail?.type === 'entry' ? handleDeleteEntry(historyDetail.id) : handleDeleteTransfer(historyDetail.id)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
              {historyDetail?.rows.map((row, idx) => (
                <div key={idx} className="rounded-md border p-2">
                  <div className="text-xs font-semibold text-slate-700">{row.label}</div>
                  <div className="text-xs text-slate-500">{row.value}</div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Product Position Dialog */}
        <Dialog open={showPositionDialog} onOpenChange={(o) => { if (!o) { setShowPositionDialog(false); setPositioningProduct(null); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5 text-purple-600" />
                Change Product Position
              </DialogTitle>
            </DialogHeader>
            {positioningProduct && (
              <div className="space-y-4 py-2">
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                  <div className="text-xs font-black uppercase text-purple-700">Moving Product</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{positioningProduct.name}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold">{positioningProduct.version}</div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500">Position</Label>
                      <Select value={positionMode} onValueChange={(v: 'before' | 'after') => setPositionMode(v)}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="before">Before</SelectItem>
                          <SelectItem value="after">After</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label className="text-[10px] font-black uppercase text-slate-500">Target Product</Label>
                      <Select value={positionTargetId} onValueChange={setPositionTargetId}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Select product..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.filter(p => p.id !== positioningProduct.id).map(p => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              {p.name} ({p.version})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {positionTargetId && (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs">
                      <span className="font-black text-slate-700">Result:</span>{' '}
                      <span className="font-bold text-purple-700">{positioningProduct.name}</span>
                      {' '}will be placed{' '}
                      <span className="font-black uppercase text-slate-900">{positionMode}</span>
                      {' '}<span className="font-bold text-blue-700">{products.find(p => p.id === positionTargetId)?.name}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl font-bold"
                    onClick={() => { setShowPositionDialog(false); setPositioningProduct(null); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 h-11 rounded-xl font-bold bg-purple-700 hover:bg-purple-800"
                    onClick={handleApplyPosition}
                    disabled={!positionTargetId || positioningProduct.id === positionTargetId}
                  >
                    Apply Position
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Products;
