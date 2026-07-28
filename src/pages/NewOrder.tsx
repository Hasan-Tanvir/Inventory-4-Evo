"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { formatNumber, generateInvoiceHtml, printDoc } from '@/utils/invoice-generator';
import { getTodayISO } from '@/utils/date';
import { showSuccess, showError } from '@/utils/toast';
import { Dealer, Officer, Product, Order, Customization } from '@/types';
import { Trash2, ChevronDown, ChevronUp, Plus, GripVertical, Download, FileText, X, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import html2pdf from 'html2pdf.js';

const emptyItem = () => ({
  id: Math.random().toString(36).substr(2, 9),
  productId: '',
  productName: '',
  version: '',
  quantity: 1,
  price: 0,
  total: 0,
  location: 'dhaka' as 'dhaka' | 'chittagong',
  commission: 0,
  serials: '',
  basePrice: 0,
  baseCommissionPerUnit: 0,
  priceIncrease: 0,
});

type OrderItemRow = ReturnType<typeof emptyItem>;

const SortableItem = ({ item, index, products, orderType, inventorySource, updateItem, removeItem, addItem, selectedProductIds }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const productOptions = (Array.isArray(products) ? products : [])
    .filter((p: any) => p && p.status === 'active' && (!selectedProductIds.includes(p.id) || p.id === item.productId));
  const getDisplayName = (item: OrderItemRow) => item.version ? `${item.productName} ${item.version}` : item.productName;
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [productInput, setProductInput] = useState(getDisplayName(item) || '');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({
    position: 'absolute',
    zIndex: 9999,
    top: 'calc(100% + 0.25rem)',
    left: 0,
    width: '100%',
    maxHeight: 288,
    overflowY: 'auto',
    backgroundColor: 'white',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.12)'
  });

  const updateDropdownPosition = () => {
    // Inline absolute dropdown does not need runtime repositioning.
  };

  useEffect(() => {
    setProductInput(getDisplayName(item) || '');
  }, [item.productName, item.version]);

  useEffect(() => {
    // No dynamic repositioning needed for the inline dropdown.
  }, [showSuggestions]);

  const productQuery = productInput.trim().toLowerCase();
  const matchingProducts = (Array.isArray(productOptions) ? productOptions : [])
    .filter((p: any) => {
      if (!p) return false;
      const fullName = `${p.name}${p.version ? ` ${p.version}` : ''}`.toLowerCase();
      return productQuery === '' ? true : fullName.includes(productQuery);
    });

  const handleProductInput = (value: string) => {
    setProductInput(value);
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    setProductInput('');
    setShowSuggestions(true);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
      const displayName = item.productId ? getDisplayName(item) : '';
      setProductInput(displayName);
    }, 150);
  };

  const selectProduct = (product: any) => {
    const fullName = `${product.name}${product.version ? ` ${product.version}` : ''}`;
    setProductInput(fullName);
    setShowSuggestions(false);
    updateItem(index, 'productId', product.id);
    updateItem(index, 'productName', fullName);
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-slate-200 rounded-2xl p-2 md:p-3 relative group shadow-sm hover:shadow-md transition-all">
      {/* Desktop Row Layout */}
      <div className="hidden md:grid grid-cols-[30px_2.5fr_70px_100px_80px_90px_110px_1.5fr_30px] gap-3 items-end">
        <div {...attributes} {...listeners} className="h-8 flex items-center justify-center text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-500 transition-colors">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="relative">
          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Product Description</label>
          <input
            ref={inputRef}
            autoComplete="off"
            value={productInput}
            onChange={e => handleProductInput(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="w-full border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-bold rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 transition-all"
            placeholder="Search products..."
          />
          {showSuggestions && (
            <div style={dropdownStyle} onMouseDown={e => e.preventDefault()}>
              <div className="max-h-72 overflow-y-auto">
                {(Array.isArray(matchingProducts) ? matchingProducts : []).length ? (Array.isArray(matchingProducts) ? matchingProducts : []).map((product: any) => (
                <button
                  key={product.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => selectProduct(product)}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors"
                >
                  <div className="font-bold text-slate-900">{product.name}</div>
                  {product.version && <div className="text-[10px] text-slate-500 uppercase font-black">{product.version}</div>}
                </button>
              )) : (
                <div className="px-4 py-3 text-sm text-slate-500 italic">No products found</div>
              )}
            </div>
          </div>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Qty</label>
          <input type="number" value={item.quantity} onChange={e => updateItem(index, 'quantity', Number(e.target.value))} className="w-full border border-slate-200 bg-slate-50/50 px-2 py-2 text-sm font-black rounded-xl text-center outline-none focus:bg-white focus:border-blue-400 transition-all" />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider text-right">Unit Price</label>
          <input 
            type="number" 
            value={item.price} 
            onChange={e => updateItem(index, 'price', Number(e.target.value))} 
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
            className={cn("w-full border px-3 py-2 text-sm font-black rounded-xl text-right outline-none focus:ring-4 transition-all", item.priceIncrease > 0 ? "bg-emerald-50 border-emerald-200 focus:ring-emerald-500/5" : "bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-blue-500/5")} 
          />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider text-right">Branch</label>
          <select
            value={inventorySource === 'mixed' ? item.location : inventorySource}
            onChange={e => updateItem(index, 'location', e.target.value as any)}
            disabled={inventorySource !== 'mixed'}
            className="w-full border border-slate-200 bg-slate-50/50 px-2 py-2 text-xs font-black rounded-xl text-right outline-none focus:bg-white transition-all appearance-none cursor-pointer"
          >
            <option value="dhaka">DHAKA</option>
            <option value="chittagong">CTG</option>
          </select>
        </div>
        {orderType === 'dealer' && (
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider text-right">Com.</label>
            <input type="number" value={item.commission} onChange={e => updateItem(index, 'commission', Number(e.target.value))} className="w-full border border-slate-200 bg-slate-50/50 px-2 py-2 text-sm font-black rounded-xl text-right outline-none focus:bg-white transition-all" />
          </div>
        )}
        <div>
          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider text-right">Total</label>
          <div className="w-full border border-slate-100 bg-slate-100/50 px-3 py-2 text-sm rounded-xl text-right font-black text-slate-900">{formatNumber(item.total)}</div>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Serial Numbers</label>
          <input type="text" value={item.serials} onChange={e => updateItem(index, 'serials', e.target.value)} className="w-full border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold rounded-xl outline-none focus:bg-white focus:border-blue-400 transition-all" placeholder="Enter S/N..." />
        </div>
        <button onClick={() => removeItem(index)} className="h-10 w-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Compact Layout */}
      <div className="md:hidden space-y-2">
        <div className="relative flex items-center justify-between gap-2">
          <div {...attributes} {...listeners} className="p-1 text-slate-300 cursor-grab active:cursor-grabbing">
            <GripVertical className="w-4 h-4" />
          </div>
          <input
            ref={inputRef}
            value={productInput}
            onChange={e => handleProductInput(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="flex-1 min-w-0 border border-slate-200 bg-white px-2 py-1.5 text-sm rounded-lg outline-none font-bold"
            placeholder="Search product..."
          />
          <button onClick={() => removeItem(index)} className="text-red-400 p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {showSuggestions && (
          <div className="relative overflow-visible">
            <div style={dropdownStyle} onMouseDown={e => e.preventDefault()}>
              {(Array.isArray(matchingProducts) ? matchingProducts : []).length ? (Array.isArray(matchingProducts) ? matchingProducts : []).map((product: any) => (
                <button
                  key={product.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => selectProduct(product)}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 whitespace-normal break-words"
                >
                  <span className="font-medium">{product.name}</span>
                  {product.version && <span className="text-xs text-slate-500"> {product.version}</span>}
                </button>
              )) : (
                <div className="px-3 py-2 text-sm text-slate-500">No matching products found.</div>
              )}
            </div>
          </div>
        )}

        <div className={cn("grid gap-2", orderType === 'dealer' ? "grid-cols-4" : "grid-cols-3")}>
          <div>
            <label className="block text-[8px] font-black uppercase text-slate-400 mb-0.5">Qty</label>
            <input type="number" value={item.quantity} onChange={e => updateItem(index, 'quantity', Number(e.target.value))} className="w-full border border-slate-200 bg-white px-2 py-1 text-xs rounded-lg text-center outline-none" />
          </div>
          <div>
            <label className="block text-[8px] font-black uppercase text-slate-400 mb-0.5 text-right">Price</label>
            <input
              type="number"
              value={item.price}
              onChange={e => updateItem(index, 'price', Number(e.target.value))}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
              className={cn(
                "w-full border px-2 py-1 text-xs rounded-lg text-right outline-none",
                item.priceIncrease > 0 ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"
              )}
            />
          </div>
          <div>
            <label className="block text-[8px] font-black uppercase text-slate-400 mb-0.5 text-right">Source</label>
            <select
              value={inventorySource === 'mixed' ? item.location : inventorySource}
              onChange={e => updateItem(index, 'location', e.target.value as any)}
              disabled={inventorySource !== 'mixed'}
              className="w-full border border-slate-200 bg-white px-2 py-1 text-xs rounded-lg text-right outline-none"
            >
              <option value="dhaka">Dhaka</option>
              <option value="chittagong">CTG</option>
            </select>
          </div>
          {orderType === 'dealer' && (
            <div>
              <label className="block text-[8px] font-black uppercase text-slate-400 mb-0.5 text-right">Comm.</label>
              <input type="number" value={item.commission} onChange={e => updateItem(index, 'commission', Number(e.target.value))} className="w-full border border-slate-200 bg-white px-2 py-1 text-xs rounded-lg text-right outline-none" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-[1fr_100px] gap-2 items-end">
          <div>
            <label className="block text-[8px] font-black uppercase text-slate-400 mb-0.5">Serials</label>
            <input type="text" value={item.serials} onChange={e => updateItem(index, 'serials', e.target.value)} className="w-full border border-slate-200 bg-white px-2 py-1 text-xs rounded-lg outline-none" placeholder="S/N..." />
          </div>
          <div className="text-right">
            <label className="block text-[8px] font-black uppercase text-slate-400 mb-0.5">Total</label>
            <div className="text-sm font-black text-slate-900">{formatNumber(item.total)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function NewOrder() {
  const { orderId: routeOrderId } = useParams();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [settings, setSettings] = useState<Customization | null>(null);

  const [orderDate, setOrderDate] = useState(getTodayISO());
  const [orderType, setOrderType] = useState<'dealer' | 'retail'>('dealer');
  const [inventorySource, setInventorySource] = useState<'dhaka' | 'chittagong' | 'mixed'>('dhaka');
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [dealerSearch, setDealerSearch] = useState('');
  const [dealerSuggestions, setDealerSuggestions] = useState<Dealer[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [items, setItems] = useState<OrderItemRow[]>([emptyItem()]);
  const [discount, setDiscount] = useState(0);
  const [extra, setExtra] = useState(0);
  const [mainOrderId, setMainOrderId] = useState('');
  const [notes, setNotes] = useState('');
  const [showSerials, setShowSerials] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quoteModal, setQuoteModal] = useState(false);
  const [quoteHtml, setQuoteHtml] = useState('');
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [originalOrderStatus, setOriginalOrderStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [originalApprovedBy, setOriginalApprovedBy] = useState<string | undefined>(undefined);
  const [originalIsQuote, setOriginalIsQuote] = useState(false);
  const [originalOrderType, setOriginalOrderType] = useState<'dealer' | 'retail'>('dealer');
  const [retailOfficer, setRetailOfficer] = useState('');
  const [isQuote, setIsQuote] = useState(false);
  const [retailPaymentStatus, setRetailPaymentStatus] = useState<'paid' | 'unpaid' | 'partial'>('unpaid');
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const currentUser = api.getCurrentUser();
  const isMember = currentUser?.role === 'member';
  const draftStorageKey = routeOrderId ? `inventory4-new-order-draft-${routeOrderId}` : 'inventory4-new-order-draft';

  useEffect(() => {
    setItems(prev => prev.map(item => ({
      ...item,
      location: inventorySource === 'mixed' ? item.location : inventorySource
    })));
  }, [inventorySource]);

  useEffect(() => {
    if (orderType === 'dealer') {
      // Clear retail fields when switching to dealer
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setRetailOfficer('');
      setRetailPaymentStatus('unpaid');
      setPartialAmount(0);
      setInventorySource('chittagong'); // Default to Chittagong for dealer
    } else if (orderType === 'retail') {
      // Clear dealer fields when switching to retail
      setSelectedDealer(null);
      setDealerSearch('');
      setDealerSuggestions([]);
      setInventorySource('dhaka'); // Default to Dhaka for retail
    }
  }, [orderType]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadData = async () => {
    const [dealers, products, orders, officers, settings] = await Promise.all([
      api.getDealers(),
      api.getProducts(),
      api.getOrders(),
      api.getOfficers(),
      api.getCustomization()
    ]);
    const d = dealers || [];
    const p = products || [];
    const o = orders || [];
    const off = officers || [];
    
    setDealers(d);
    setProducts(p);
    setOrders(o);
    setOfficers(off);
    setSettings(settings);

    return { dealers: d, products: p, orders: o, officers: off, settings };
  };

  useEffect(() => {
    const init = async () => {
      const data = await loadData();
      const params = new URLSearchParams(window.location.search);
      const editId = routeOrderId || params.get('edit');
      
      if (editId) {
        const existingOrder = await api.getOrder(editId);
        if (existingOrder) {
          loadOrderIntoForm(existingOrder, data.dealers, data.products);
          return;
        }
      }

      const draftKey = editId ? `inventory4-new-order-draft-${editId}` : 'inventory4-new-order-draft';
      const draftJson = typeof window !== 'undefined' ? window.localStorage.getItem(draftKey) : null;
      const draft = draftJson ? JSON.parse(draftJson) : null;

      if (draft) {
        // Always use today's date for new orders, ignore draft date
        setOrderDate(getTodayISO());
        setOrderType(draft.orderType || 'dealer');
        setInventorySource(draft.inventorySource || 'chittagong');
        setDealerSearch(draft.dealerSearch || '');
        const allDealers = Array.isArray(data.dealers) ? data.dealers : [];
        setSelectedDealer(draft.selectedDealerId ? allDealers.find(d => d && d.id === draft.selectedDealerId) || null : null);
        setCustomerName(draft.customerName || '');
        setCustomerPhone(draft.customerPhone || '');
        setCustomerAddress(draft.customerAddress || '');
        setDiscount(draft.discount || 0);
        setExtra(draft.extra || 0);
        setNotes(draft.notes || '');
        setMainOrderId(draft.mainOrderId || '');
        setShowSerials(Boolean(draft.showSerials));
        setRetailOfficer(draft.retailOfficer || '');
        setIsQuote(Boolean(draft.isQuote));
        setRetailPaymentStatus(draft.retailPaymentStatus || 'unpaid');
        setPartialAmount(draft.partialAmount || 0);
        setItems(Array.isArray(draft.items) ? draft.items : [emptyItem()]);
      }
      setIsInitialLoad(false);
    };
    init();
  }, [routeOrderId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const isEdit = !!editOrderId || !!routeOrderId || params.has('edit');
    if (isEdit) document.body.classList.add('hide-mobile-bottom-bar');
    return () => { document.body.classList.remove('hide-mobile-bottom-bar'); };
  }, [editOrderId, routeOrderId]);

  const loadOrderIntoForm = (ord: Order, currentDealers?: Dealer[], currentProducts?: Product[]) => {
    const effectiveDealers = currentDealers || dealers;
    const effectiveProducts = currentProducts || products;

    setEditOrderId(ord.id);
    setOriginalOrderStatus(ord.status || 'pending');
    setOriginalApprovedBy(ord.approvedBy || undefined);
    setOriginalIsQuote(Boolean(ord.isQuote));
    setOriginalOrderType(ord.type || 'dealer');
    setOrderDate(ord.date || getTodayISO());
    setOrderType(ord.type || 'dealer');
    setInventorySource(ord.inventorySource || 'chittagong');
    setDiscount(ord.discount || 0);
    setExtra(ord.extra || 0);
    setMainOrderId(ord.mainOrderId || '');
    setNotes(ord.notes || '');
    setShowSerials(Boolean(ord.showSerialsOnInvoice));
    setIsQuote(Boolean(ord.isQuote));
    setRetailPaymentStatus(ord.retailPaymentStatus || 'unpaid');
    setPartialAmount(ord.partialAmount || 0);

    if (ord.dealerId) {
      const allDealers = Array.isArray(effectiveDealers) ? effectiveDealers : [];
      const dealer = allDealers.find(d => d && d.id === ord.dealerId);
      if (dealer) {
        setSelectedDealer(dealer);
        setDealerSearch(dealer.name); // Restore dealer name
      }
    } else {
      setCustomerName(ord.customerName || '');
      setCustomerPhone(ord.customerPhone || '');
      setCustomerAddress(ord.customerAddress || '');
      setRetailOfficer(ord.officer || '');
    }

    setItems((Array.isArray(ord.items) ? ord.items : []).map(item => {
      const allProducts = Array.isArray(effectiveProducts) ? effectiveProducts : [];
      const product = allProducts.find(p => p && p.id === item.productId);
      const retailPrice = product?.retailPrice ?? (item.basePrice || item.price || 0);
      const commissionPerUnit = product ? product.commission : Number(item.commission || 0) / (item.quantity || 1);
      return {
        id: Math.random().toString(36).substr(2, 9),
        productId: item.productId,
        productName: item.productName,
        version: item.version || '',
        quantity: item.quantity || 1,
        price: item.price || 0,
        total: item.total || 0,
        location: item.location || 'dhaka',
        commission: item.commission, // Preserve the edited commission value
        serials: (Array.isArray(item.serialNumbers) ? item.serialNumbers : []).join(', '),
        basePrice: retailPrice,
        baseCommissionPerUnit: commissionPerUnit,
        priceIncrease: Math.max(0, (item.price || 0) - retailPrice),
      };
    }));
  };

  const searchDealerInput = (value: string) => {
    setDealerSearch(value);
    setSelectedDealer(null);
    if (value.length < 2) {
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

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateItem = (index: number, field: keyof OrderItemRow, value: string | number) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      const updated = { ...item, [field]: value } as OrderItemRow;

      if (field === 'productId' || field === 'productName') {
        const allProducts = Array.isArray(products) ? products : [];
        const product = field === 'productId'
          ? allProducts.find(p => p && p.id === value)
          : allProducts.find(p => p && `${p.name}${p.version ? ` ${p.version}` : ''}`.toLowerCase() === String(value).toLowerCase().trim());
        if (product) {
          updated.productId = product.id;
          updated.productName = product.name;
          updated.version = product.version || '';
          const qty = Number(updated.quantity) || 1;
          if (orderType === 'retail') {
            updated.price = product.retailPrice || 0;
          } else {
            const slab = (Array.isArray(product.slabs) ? product.slabs : []).find(s => s && qty >= s.min && qty <= s.max);
            updated.price = slab ? slab.price : product.retailPrice || 0;
          }
          updated.basePrice = product.retailPrice;
          updated.baseCommissionPerUnit = product.commission || 0;
          updated.total = qty * updated.price;
          updated.commission = (product.commission || 0) * qty;
          updated.location = inventorySource === 'mixed' ? updated.location : inventorySource;
        }
      }

      if (field === 'quantity' || field === 'price') {
        const qty = Number(updated.quantity) || 0;
        let price = Number(updated.price) || 0;
        if (field === 'quantity' && orderType === 'dealer') {
          const allProducts = Array.isArray(products) ? products : [];
          const product = allProducts.find(p => p && p.id === updated.productId);
          if (product) {
            const slab = (Array.isArray(product.slabs) ? product.slabs : []).find(s => s && qty >= s.min && qty <= s.max);
            if (slab) {
              price = slab.price;
              updated.price = slab.price;
            }
          }
        }
        updated.total = qty * price;
        const priceIncrease = Math.max(0, price - (updated.basePrice || 0));
        updated.priceIncrease = priceIncrease;
        updated.commission = (updated.baseCommissionPerUnit || 0) * qty;
      }

      return updated;
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const filledItems = items.filter(item => item.productId);
  const subtotal = filledItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const netTotal = subtotal - (Number(discount) || 0) + (Number(extra) || 0);
  const totalBaseCommission = filledItems.reduce((sum, item) => sum + (item.commission || 0), 0);
  const totalPriceIncreaseCommission = filledItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const increase = Number(item.priceIncrease) || 0;
    return sum + (increase * qty);
  }, 0);
  const totalCommission = totalBaseCommission;

  const placeOrder = async (forceQuote = false) => {
    if (orderType === 'dealer' && !selectedDealer) return showError('Select a dealer');
    if (orderType === 'retail' && !customerName.trim()) return showError('Enter customer name');
    if (!filledItems.length) return showError('Add at least one item');

    setSaving(true);
    const shouldSaveAsQuote = forceQuote || (isQuote && !editOrderId);
    const isQuoteConversion = !!(editOrderId && originalIsQuote && !shouldSaveAsQuote);
    
    // Generate new order ID: if converting quote, get next order ID, otherwise get new ID
    let orderId = editOrderId || await api.getNextOrderId(shouldSaveAsQuote);
    if (isQuoteConversion && editOrderId && editOrderId.startsWith('Q')) {
      // Convert quote to order: get next available order ID (maintains proper sequencing)
      orderId = await api.getNextOrderId(false); // false = order, not quote
      // Delete the old quote order
      await api.deleteOrder(editOrderId);
    }
    
    const shouldAutoApprove = currentUser?.role === 'admin';
    const orderStatus = editOrderId && !isQuoteConversion ? originalOrderStatus : 'pending';
    const normalizedNotes = notes || '';

    // Check stock availability
    if (!shouldSaveAsQuote) {
      const allProducts = Array.isArray(products) ? products : [];
      for (const item of filledItems) {
        const product = allProducts.find(p => p.id === item.productId);
        if (product) {
          const location = inventorySource === 'mixed' ? item.location : inventorySource;
          const available = location === 'dhaka' ? (product.dhaka || 0) : (product.chittagong || 0);
          
          // If editing an approved order, we need to account for current quantity already reserved
          let reservedQty = 0;
          if (editOrderId && originalOrderStatus === 'approved' && !originalIsQuote) {
            const originalOrder = orders.find(o => o.id === editOrderId);
            const originalItem = originalOrder?.items.find(i => i.productId === item.productId && i.location === location);
            reservedQty = originalItem?.quantity || 0;
          }

          if (item.quantity > (available + reservedQty)) {
            setSaving(false);
            return showError(`Insufficient quantity in ${location === 'dhaka' ? 'Dhaka' : 'Chittagong'} for "${item.productName}". Available: ${available + reservedQty}`);
          }
        }
      }
    }

    const order: Order = {
      id: orderId,
      date: orderDate,
      type: orderType,
      status: orderStatus,
      approvedBy: orderStatus === 'approved' ? originalApprovedBy || currentUser?.id : undefined,
      customerName: orderType === 'dealer' ? selectedDealer?.name || '' : customerName,
      dealerId: selectedDealer?.id,
      customerPhone: orderType === 'dealer' ? selectedDealer?.phone || '' : customerPhone,
      customerAddress: orderType === 'dealer' ? selectedDealer?.address || '' : customerAddress,
      officer: orderType === 'dealer' ? (selectedDealer?.officerName || '') : retailOfficer,
      items: filledItems.map(i => ({
        productId: i.productId,
        productName: i.productName,
        version: i.version,
        quantity: i.quantity,
        basePrice: i.basePrice,
        price: i.price,
        total: i.total,
        location: inventorySource === 'mixed' ? i.location : inventorySource,
        commission: i.commission,
        serialNumbers: i.serials.split(',').map(s => s.trim()).filter(Boolean),
      })),
      subtotal,
      discount: Number(discount) || 0,
      extra: Number(extra) || 0,
      netTotal,
      notes: normalizedNotes,
      mainOrderId: mainOrderId.trim() || undefined,
      createdBy: api.getCurrentUser()?.id || 'unknown',
      isQuote: shouldSaveAsQuote,
      retailPaymentStatus: orderType === 'retail' ? retailPaymentStatus : undefined,
      partialAmount: orderType === 'retail' && retailPaymentStatus === 'partial' ? partialAmount : undefined,
      includePriceIncreaseInCommission: false,
      inventorySource,
      showSerialsOnInvoice: showSerials,
    };

    await api.placeOrder(order);
    if (shouldAutoApprove && orderStatus === 'pending') {
      await api.approveOrder(orderId, currentUser?.id || 'admin');
    }
    showSuccess(shouldSaveAsQuote ? 'Quote saved' : 'Order placed');
    resetForm();
    setSaving(false);
    return order.id;
  };

  const showQuote = async () => {
    const order = await buildOrderData();
    setQuoteHtml(generateInvoiceHtml(order, true, settings));
    setQuoteModal(true);
  };

  const downloadQuote = async () => {
    const order = await buildOrderData();

    // Stock check for quote too
    const allProducts = Array.isArray(products) ? products : [];
    for (const item of order.items) {
      const product = allProducts.find(p => p.id === item.productId);
      if (product) {
        const available = item.location === 'dhaka' ? (product.dhaka || 0) : (product.chittagong || 0);
        if (item.quantity > available) {
          return showError(`Insufficient quantity in ${item.location === 'dhaka' ? 'Dhaka' : 'Chittagong'} for "${item.productName}". Available: ${available}`);
        }
      }
    }

    const element = document.createElement('div');
    element.innerHTML = quoteHtml;
    
    const opt = {
      margin: 10,
      filename: `${order.id}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    await html2pdf().set(opt).from(element).save();
    await placeOrder(true);
    setQuoteModal(false);
  };

  const buildOrderData = async (): Promise<Order> => ({
    id: editOrderId || await api.getNextOrderId(true),
    date: orderDate,
    type: orderType,
    status: 'pending',
    customerName: orderType === 'dealer' ? selectedDealer?.name || '' : customerName,
    dealerId: selectedDealer?.id,
    customerPhone: orderType === 'dealer' ? selectedDealer?.phone || '' : customerPhone,
    customerAddress: orderType === 'dealer' ? selectedDealer?.address || '' : customerAddress,
    officer: orderType === 'dealer' ? (selectedDealer?.officerName || '') : retailOfficer,
    items: filledItems.map(i => ({
      productId: i.productId,
      productName: i.productName,
      version: i.version,
      quantity: i.quantity,
      basePrice: i.basePrice,
      price: i.price,
      total: i.total,
      location: inventorySource === 'mixed' ? i.location : inventorySource,
      commission: i.commission,
      serialNumbers: i.serials.split(',').map(s => s.trim()).filter(Boolean),
    })),
    subtotal,
    discount: Number(discount) || 0,
    extra: Number(extra) || 0,
    netTotal,
    notes,
    mainOrderId: mainOrderId.trim() || undefined,
    createdBy: api.getCurrentUser()?.id || 'unknown',
    isQuote: true,
    inventorySource,
    showSerialsOnInvoice: showSerials,
  });

  const clearDraftStorage = () => {
    if (typeof window !== 'undefined') {
      const draftKey = routeOrderId ? `inventory4-new-order-draft-${routeOrderId}` : 'inventory4-new-order-draft';
      window.localStorage.removeItem(draftKey);
    }
  };

  const resetForm = () => {
    clearDraftStorage();
    setOrderDate(getTodayISO());
    setEditOrderId(null);
    setOriginalOrderStatus('pending');
    setOriginalApprovedBy(undefined);
    setOriginalIsQuote(false);
    setOriginalOrderType('dealer');
    setOrderType('dealer');
    setInventorySource('chittagong');
    setSelectedDealer(null);
    setDealerSearch('');
    setDealerSuggestions([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setDiscount(0);
    setExtra(0);
    setMainOrderId('');
    setNotes('');
    setShowSerials(false);
    setIsQuote(false);
    setRetailOfficer('');
    setRetailPaymentStatus('unpaid');
    setPartialAmount(0);
    setItems([emptyItem()]);
    setQuoteHtml('');
  };

  useEffect(() => {
    if (typeof window === 'undefined' || isInitialLoad) return;
    const key = routeOrderId ? `inventory4-new-order-draft-${routeOrderId}` : 'inventory4-new-order-draft';
    try {
      window.localStorage.setItem(key, JSON.stringify({
        orderDate,
        orderType,
        inventorySource,
        selectedDealerId: selectedDealer?.id || '',
        dealerSearch,
        customerName,
        customerPhone,
        customerAddress,
        discount,
        extra,
        mainOrderId,
        notes,
        showSerials,
        retailOfficer,
        isQuote,
        retailPaymentStatus,
        partialAmount,
        items,
      }));
    } catch {
      // ignore storage errors
    }
  }, [routeOrderId, orderDate, orderType, inventorySource, selectedDealer?.id, dealerSearch, customerName, customerPhone, customerAddress, discount, extra, notes, showSerials, retailOfficer, isQuote, retailPaymentStatus, partialAmount, items]);

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 pb-40">
        <div className="w-full mx-auto px-2 py-4 md:px-4 lg:px-6 xl:px-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">New Sales Order</h1>
            <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
              <RefreshCcw className="w-4 h-4" /> Reset Draft
            </button>
          </div>
          <div className="grid gap-4 lg:grid-cols-[280px_1fr] mt-4">
            {/* Sidebar: Settings & Customer (Left on PC) */}
            <div className="space-y-4">
              <section className="bg-white p-4 shadow-sm border border-slate-200 rounded-xl">
                <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Order Config</div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Date</label>
                    <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="w-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Type</label>
                      <select value={orderType} onChange={e => setOrderType(e.target.value as any)} className="w-full border border-slate-300 bg-slate-50 px-3 py-2 text-sm rounded-lg outline-none">
                        <option value="dealer">Dealer</option>
                        {(!isMember || (editOrderId && originalOrderType === 'retail')) && <option value="retail">Retail</option>}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Source</label>
                      <select value={inventorySource} onChange={e => setInventorySource(e.target.value as any)} className="w-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm rounded-lg outline-none">
                        <option value="chittagong">CTG</option>
                        <option value="dhaka">Dhaka</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white p-4 shadow-sm border border-slate-200 rounded-xl">
                <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{orderType === 'dealer' ? 'Dealer Info' : 'Customer Info'}</div>
                {orderType === 'dealer' ? (
                  <div className="space-y-3">
                    {!selectedDealer ? (
                      <div className="relative">
                        <input type="text" value={dealerSearch} onChange={e => searchDealerInput(e.target.value)} className="w-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm rounded-lg outline-none" placeholder="Search dealer..." />
                        {dealerSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full z-30 mt-1 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden">
                            {dealerSuggestions.map(d => (
                              <button key={d.id} onClick={() => pickDealer(d)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 border-b last:border-0">
                                <div className="font-bold">{d.name}</div>
                                <div className="text-[10px] text-slate-500">{d.address}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg">
                        <div className="font-bold text-blue-900 text-sm">{selectedDealer.name}</div>
                        <div className="text-[10px] text-blue-700 mt-1">{selectedDealer.address}</div>
                        <div className="text-[10px] text-blue-700 mt-1">Assigned Officer: {selectedDealer.officerName || 'N/A'}</div>
                        <button onClick={() => setSelectedDealer(null)} className="mt-2 text-[10px] font-black uppercase text-blue-600 hover:underline">Change Dealer</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Name</label>
                        <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm rounded-lg outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Phone</label>
                        <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm rounded-lg outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Address</label>
                      <input type="text" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm rounded-lg outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Officer</label>
                        <select value={retailOfficer} onChange={e => setRetailOfficer(e.target.value)} className="w-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm rounded-lg outline-none">
                          <option value="">Select...</option>
                          {officers.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Payment</label>
                        <select 
                          value={retailPaymentStatus} 
                          onChange={e => setRetailPaymentStatus(e.target.value as any)} 
                          className={cn(
                            "w-full border px-3 py-2 text-sm rounded-lg outline-none font-bold",
                            retailPaymentStatus === 'paid' ? "bg-green-50 border-green-200 text-green-700" : retailPaymentStatus === 'partial' ? "bg-yellow-50 border-yellow-200 text-yellow-700" : "bg-red-50 border-red-200 text-red-700"
                          )}
                        >
                          <option value="unpaid">Unpaid</option>
                          <option value="partial">Partial Payment</option>
                          <option value="paid">Paid</option>
                        </select>
                      </div>
                    </div>
                    {retailPaymentStatus === 'partial' && (
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Partial Amount</label>
                        <input 
                          type="number" 
                          value={partialAmount} 
                          onChange={e => setPartialAmount(Number(e.target.value))} 
                          className="w-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm rounded-lg outline-none" 
                          placeholder="Enter partial amount"
                        />
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Adjustments Section */}
              <section className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
                <button 
                  onClick={() => setShowAdjustments(!showAdjustments)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adjustments & Notes</span>
                  {showAdjustments ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                
                <div className={cn("p-4 pt-0 space-y-4", !showAdjustments && "hidden md:block")}>
                  {!isMember && <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Discount</label>
                      <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm rounded-lg outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Extra</label>
                      <input type="number" value={extra} onChange={e => setExtra(Number(e.target.value))} className="w-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm rounded-lg outline-none" />
                    </div>
                  </div>}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Main Order ID</label>
                    <input type="text" value={mainOrderId} onChange={e => setMainOrderId(e.target.value)} className="w-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm rounded-lg outline-none" placeholder="Optional main order ID" />
                  </div>
                  <div className="space-y-2">
                    {!isMember && <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={showSerials} onChange={e => setShowSerials(e.target.checked)} className="rounded border-slate-300" />
                      Show serials on invoice
                    </label>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Order Notes</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm rounded-lg outline-none h-20 resize-none" placeholder="Optional note" />
                  </div>
                </div>
              </section>
            </div>

            {/* Order Items (Right on PC) */}
            <div className="space-y-4">
              <section className="bg-white shadow-sm border border-slate-200 rounded-xl">
                <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="text-sm font-bold uppercase tracking-widest text-slate-500">Order Items ({filledItems.length})</div>
                  <button onClick={addItem} className="hidden md:flex bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold items-center gap-1 hover:bg-blue-700 transition-colors">
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>

                <div className="p-2 md:p-4 space-y-3">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                      {items.map((item, index) => (
                        <SortableItem 
                          key={item.id} 
                          item={item} 
                          index={index} 
                          products={products} 
                          orderType={orderType} 
                          inventorySource={inventorySource}
                          updateItem={updateItem} 
                          removeItem={removeItem} 
                          addItem={addItem}
                          selectedProductIds={items.map(i => i.productId).filter(Boolean)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                  
                  <button onClick={addItem} className="md:hidden w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors mt-4">
                    <Plus className="w-4 h-4" /> Add New Item
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="fixed bottom-[56px] lg:bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40">
          <div className="max-w-7xl mx-auto px-4 py-3">
            {/* Mobile Footer Layout */}
            <div className="md:hidden space-y-3">
              <div className="flex items-center justify-between text-center">
                <div className="flex-1">
                  <div className="text-[8px] font-black uppercase text-slate-400">Items</div>
                  <div className="text-sm font-bold text-slate-900">{filledItems.reduce((s, i) => s + i.quantity, 0)}</div>
                </div>
                <div className="flex-1 border-x border-slate-100">
                  <div className="text-[8px] font-black uppercase text-slate-400">Amount</div>
                  <div className="text-sm font-black text-blue-600">{formatNumber(netTotal)}</div>
                </div>
                {orderType === 'dealer' && (
                  <div className="flex-1">
                    <div className="text-[8px] font-black uppercase text-slate-400">Comm.</div>
                    <div className="text-sm font-black text-orange-600">{formatNumber(totalCommission)}</div>
                </div>
              )}
            </div>
              <div className="flex gap-3">
                <button onClick={showQuote} className="flex-1 border border-slate-200 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">Quote</button>
                <button onClick={() => placeOrder()} disabled={saving} className="flex-[1.5] bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50">
                  {saving ? 'Saving...' : 'Place Order'}
                </button>
              </div>
            </div>

            {/* Desktop Footer Layout */}
            <div className="hidden md:flex items-center justify-between">
              <div className="flex items-center gap-12">
                <div className="text-center">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Items</div>
                  <div className="text-xl font-black text-slate-900">{filledItems.reduce((s, i) => s + i.quantity, 0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Net Amount</div>
                  <div className="text-2xl font-black text-blue-600">{formatNumber(netTotal)}</div>
                </div>
                {orderType === 'dealer' && (
                  <div className="text-center">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Commission</div>
                    <div className="text-2xl font-black text-orange-600">{formatNumber(totalCommission)}</div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <button onClick={showQuote} className="px-8 py-3 border-2 border-slate-200 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all">Preview Quote</button>
                <button onClick={() => placeOrder()} disabled={saving} className="px-12 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50">
                  {saving ? 'Processing...' : 'Place Order'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quote Modal */}
        {quoteModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4">
            <div className="w-full h-full md:h-auto md:max-w-4xl bg-white md:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
                <h2 className="font-black uppercase tracking-widest text-slate-500 text-sm">Quotation Preview</h2>
                <button onClick={() => setQuoteModal(false)} className="text-slate-400 hover:text-slate-600 p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 bg-slate-100 overflow-auto p-2 md:p-4">
                <div className="w-full min-h-full bg-white shadow-inner rounded-xl overflow-hidden">
                  <iframe 
                    title="quote" 
                    srcDoc={quoteHtml} 
                    className="w-full h-[70vh] md:h-[60vh] border-none" 
                  />
                </div>
              </div>
              
              <div className="p-4 md:p-6 grid grid-cols-1 md:flex md:justify-end gap-3 bg-slate-50 border-t">
                <button onClick={() => setQuoteModal(false)} className="hidden md:block px-6 py-2 text-sm font-bold text-slate-500">Close</button>
                
                <div className="grid grid-cols-2 md:flex gap-3">
                  <button 
                    onClick={downloadQuote} 
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </button>
                  
                  <button 
                    onClick={() => { setIsQuote(true); placeOrder(true); setQuoteModal(false); }} 
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-200"
                  >
                    <FileText className="w-4 h-4" /> Save Quote
                  </button>
                </div>
                
                <button onClick={() => setQuoteModal(false)} className="md:hidden w-full py-3 text-sm font-bold text-slate-500 border border-slate-200 rounded-xl">Close Preview</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
