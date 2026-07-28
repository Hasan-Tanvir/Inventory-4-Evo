"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Order, User, Dealer, Product, OrderShippingDetail } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, Search, Edit, Trash2, List, LayoutGrid, Eye, Printer, Truck, Package, Plus, X, PauseCircle, ChevronDown, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { showError, showSuccess } from '@/utils/toast';
import { formatDisplayDate, getTodayISO } from '@/utils/date';
import { cn } from '@/lib/utils';
import { generateInvoiceHtml, printDoc } from '@/utils/invoice-generator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
import { GripVertical } from 'lucide-react';

const SortableOrderRow = ({ 
  o, 
  user, 
  navigate, 
  setInvoiceOrder, 
  handleApprove, 
  handleReject, 
  handleDelete,
  handlePrint,
  handleOpenShipping,
  resolveShippingStatus,
  getShippingIconStyle,
  getShippingIconTitle
}: any) => {
  const status = resolveShippingStatus(o.shipping);
  const hasShipping = !!o.shipping && (o.shipping.shippingDate || o.shipping.parcelName || o.shipping.parcelId || o.shipping.isComplete);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: o.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    position: 'relative' as const,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className="hover:bg-slate-50/50 transition-colors group">
      <TableCell className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none">
            <GripVertical className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-900">{o.id}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="font-bold text-slate-800">{o.customerName}</div>
        <div className="text-[10px] text-slate-400 uppercase font-bold">{formatDisplayDate(o.date)}</div>
        <div className="text-[10px] text-slate-400">Placer: {o.createdBy || '-'}</div>
        <div className="text-[10px] text-slate-400">Approver: {o.approvedBy || '-'}</div>
        {o.notes && <div className="text-[10px] text-slate-500 italic">Note: {o.notes}</div>}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-[10px] font-bold uppercase">
          {o.type === 'retail' ? 'Retail' : 'Dealer'}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-[10px] font-bold uppercase">
          {o.inventorySource === 'chittagong' ? 'CTG' : o.inventorySource}
        </Badge>
      </TableCell>
      <TableCell className="font-black text-slate-900 whitespace-nowrap">{o.netTotal.toLocaleString('en-IN')}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {o.status === 'pending' && <Badge className="bg-orange-100 text-orange-600 border-none shadow-none text-[10px] font-black uppercase"><Clock className="w-3 h-3 mr-1" /> {user?.role === 'member' ? 'Pending Approval' : 'Pending'}</Badge>}
          {o.status === 'approved' && <Badge className="bg-emerald-100 text-emerald-600 border-none shadow-none text-[10px] font-black uppercase"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>}
          {o.status === 'rejected' && <Badge className="bg-red-100 text-red-600 border-none shadow-none text-[10px] font-black uppercase"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>}
        </div>
      </TableCell>
      <TableCell className="text-right space-x-1 whitespace-nowrap">
        <div className="inline-flex items-center gap-1 align-middle mr-1">
          <Button 
              variant="ghost" 
              size="icon" 
              className={cn(
                "h-8 w-8 rounded-lg transition-all",
                getShippingIconStyle(status)
              )} 
              onClick={() => { handleOpenShipping(o); if (typeof window !== 'undefined') document.body.classList.add('hide-mobile-bottom-bar'); }} 
              title={getShippingIconTitle(status, hasShipping)}
            >
              <Truck className="w-4 h-4" />
            </Button>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100" onClick={() => handlePrint(o)} title="Print"><Printer className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setInvoiceOrder(o)}><Eye className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { if (typeof window !== 'undefined') document.body.classList.add('hide-mobile-bottom-bar'); navigate(`/new-order?edit=${o.id}`); }}><Edit className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-red-400" onClick={() => handleDelete(o.id)}><Trash2 className="w-4 h-4" /></Button>
        {user?.role === 'admin' && o.status === 'pending' && (
          <>
            <Button 
              onClick={() => handleApprove(o.id)}
              className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-[10px] font-black uppercase"
            >
              Approve
            </Button>
            <Button 
              onClick={() => handleReject(o.id)}
              className="h-8 px-3 bg-red-600 hover:bg-red-700 text-[10px] font-black uppercase"
            >
              Reject
            </Button>
          </>
        )}
      </TableCell>
    </TableRow>
  );
};

const SortableOrderCard = ({ 
  o, 
  user, 
  navigate, 
  setInvoiceOrder, 
  handleApprove, 
  handleReject, 
  handleDelete,
  handlePrint,
  handleOpenShipping,
  resolveShippingStatus,
  getShippingIconStyle,
  getShippingIconTitle
}: any) => {
  const status = resolveShippingStatus(o.shipping);
  const hasShipping = !!o.shipping && (o.shipping.shippingDate || o.shipping.parcelName || o.shipping.parcelId || o.shipping.isComplete);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: o.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.8 : 1,
  };

  const truckLabel = (() => {
    switch (status) {
      case 'completed': return 'Shipped ✓';
      case 'hold': return 'On Hold';
      case 'cancelled': return 'Cancelled';
      case 'in_progress': return 'Shipping';
      default: return hasShipping ? 'Shipping' : 'Ship';
    }
  })();

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border bg-white p-3 space-y-2 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none">
            <GripVertical className="w-4 h-4" />
          </div>
          <p className="text-xs font-black text-slate-900">{o.id}</p>
        </div>
        <p className="text-[10px] text-slate-500">{formatDisplayDate(o.date)}</p>
      </div>
      <p className="text-xs font-semibold">{o.customerName}</p>
      {o.notes && <p className="text-[10px] text-slate-500 italic">Note: {o.notes}</p>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-bold uppercase">{o.type}</Badge>
          {o.status === 'pending' && <Badge className="bg-orange-100 text-orange-600 border-none shadow-none text-[10px] font-black uppercase">{user?.role === 'member' ? 'Pending Approval' : 'Pending'}</Badge>}
          {o.status === 'approved' && <Badge className="bg-emerald-100 text-emerald-600 border-none shadow-none text-[10px] font-black uppercase">Approved</Badge>}
          {o.status === 'rejected' && <Badge className="bg-red-100 text-red-600 border-none shadow-none text-[10px] font-black uppercase">Rejected</Badge>}
        </div>
        <span className="text-xs font-black text-slate-900">{o.netTotal.toLocaleString('en-IN')}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="inline-flex items-center gap-1">
          <Button 
            variant="outline" 
            size="sm" 
            className={cn(
              "h-8 text-white border-transparent shadow-sm",
              getShippingIconStyle(status)
            )} 
            onClick={() => { handleOpenShipping(o); if (typeof window !== 'undefined') document.body.classList.add('hide-mobile-bottom-bar'); }}
            title={getShippingIconTitle(status, hasShipping)}
          >
            <Truck className="w-3.5 h-3.5 mr-1" /> 
            {truckLabel}
          </Button>
        </div>
        <Button variant="outline" size="sm" className="h-8" onClick={() => handlePrint(o)}><Printer className="w-3.5 h-3.5 mr-1" /> Print</Button>
        <Button variant="outline" size="sm" className="h-8" onClick={() => setInvoiceOrder(o)}><Eye className="w-3.5 h-3.5 mr-1" /> View</Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => { if (typeof window !== 'undefined') document.body.classList.add('hide-mobile-bottom-bar'); navigate(`/new-order?edit=${o.id}`); }}><Edit className="w-3.5 h-3.5 mr-1" /> Edit</Button>
        <Button variant="outline" size="sm" className="h-8 text-red-500" onClick={() => handleDelete(o.id)}><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</Button>
        {user?.role === 'admin' && o.status === 'pending' && (
          <>
            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(o.id)}>Approve</Button>
            <Button size="sm" className="h-8 bg-red-600 hover:bg-red-700" onClick={() => handleReject(o.id)}>Reject</Button>
          </>
        )}
      </div>
    </div>
  );
};

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [historyView, setHistoryView] = useState<'table' | 'cards'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'cards' : 'table'
  );
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  
  // Get unique customer names from orders
  const customerSuggestions = useMemo(() => {
    const uniqueCustomers = Array.from(new Set(orders.map(o => o.customerName).filter(Boolean)));
    return uniqueCustomers.filter(customer => 
      customer.toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [orders, customerSearch]);
  
  // Get unique product names from order items
  const productSuggestions = useMemo(() => {
    const uniqueProducts = Array.from(
      new Set(
        orders.flatMap(o => 
          (o.items || []).map(item => item.productName).filter(Boolean)
        )
      )
    );
    return uniqueProducts.filter(product => 
      product.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [orders, productSearch]);

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

  const loadData = async () => {
    const [allOrders, allDealers, allProducts] = await Promise.all([
      api.getOrders(),
      api.getDealers(),
      api.getProducts(),
    ]);
    const sortedOrders = (allOrders || [])
      .filter(o => !o.isQuote)
      .sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' });
      });
    setOrders(sortedOrders);
    setDealers(allDealers || []);
    setProducts(allProducts || []);
    setUser(api.getCurrentUser());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (id: string) => {
    if (!user) return;
    await api.approveOrder(id, user.id);
    await loadData();
    showSuccess("Order approved and stock updated.");
  };

  const handleReject = async (id: string) => {
    await api.rejectOrder(id);
    await loadData();
    showSuccess("Order rejected");
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this order?")) {
      await api.deleteOrder(id);
      await loadData();
      showSuccess("Order deleted");
    }
  };

  const handlePrintOrder = (order: Order) => {
    const config = api.getConfig();
    if (!config) {
      showError("Could not load configuration");
      return;
    }
    printDoc(generateInvoiceHtml(order, order.isQuote, config));
  };

  // Shipping dialog state & handlers
  const [shippingDialogOpen, setShippingDialogOpen] = useState(false);
  const [shippingDialogMode, setShippingDialogMode] = useState<'view' | 'edit'>('view');
  const [shippingOrder, setShippingOrder] = useState<Order | null>(null);
  const [shippingForm, setShippingForm] = useState<OrderShippingDetail>({
    isComplete: false,
    shippingDate: '',
    parcelName: '',
    parcelId: '',
    status: 'pending'
  });
  const [editableOrder, setEditableOrder] = useState<Order | null>(null);
  const [checkedShippingItems, setCheckedShippingItems] = useState<Record<string, boolean>>({});
  const [shippingTab, setShippingTab] = useState('orders');
  const [savedParcelNames, setSavedParcelNames] = useState<string[]>([]);

  const loadParcelNames = async () => {
    try {
      const names = await api.getParcelNames();
      setSavedParcelNames(names);
    } catch (e) {
      console.error('loadParcelNames failed', e);
    }
  };

  // Hide mobile bottom bar while shipping dialog is open — especially when in edit mode
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (shippingDialogOpen || shippingDialogMode === 'edit') document.body.classList.add('hide-mobile-bottom-bar');
    else document.body.classList.remove('hide-mobile-bottom-bar');
    return () => { document.body.classList.remove('hide-mobile-bottom-bar'); };
  }, [shippingDialogOpen, shippingDialogMode]);

  const handleEditParcelName = async (oldName: string) => {
    const newName = prompt('Edit parcel name', oldName);
    if (!newName) return;
    const trimmed = newName.trim();
    if (!trimmed) return showError('Name cannot be empty');
    if (trimmed.toLowerCase() === oldName.toLowerCase()) return;
    try {
      // Prevent duplicates
      if (savedParcelNames.some(n => n.toLowerCase() === trimmed.toLowerCase())) {
        return showError('A parcel with that name already exists');
      }
      await api.removeParcelName(oldName);
      const res = await api.saveParcelName(trimmed);
      if (res.saved) {
        showSuccess('Parcel name updated');
      } else {
        showError('Could not save updated parcel name');
      }
      await loadParcelNames();
    } catch (e: any) {
      console.error('editParcelName failed', e);
      showError(`Update failed: ${e?.message || 'Unknown error'}`);
      await loadParcelNames();
    }
  };

  useEffect(() => {
    loadParcelNames();
  }, []);

  const resolveShippingStatus = (s?: OrderShippingDetail): 'pending' | 'in_progress' | 'hold' | 'cancelled' | 'completed' => {
    if (!s) return 'pending';
    if (s.status) return s.status;
    const hasAny = s.shippingDate || s.parcelName || s.parcelId;
    if (s.isComplete) return 'completed';
    if (hasAny) return 'in_progress';
    return 'pending';
  };

  const getShippingIconStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-900/20 shadow-sm';
      case 'hold':
        return 'bg-yellow-400 text-white hover:bg-yellow-500 shadow-yellow-500/20 shadow-sm';
      case 'cancelled':
        return 'bg-red-600 text-white hover:bg-red-700 shadow-red-900/20 shadow-sm';
      case 'in_progress':
        return 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-900/20 shadow-sm';
      default:
        return 'text-slate-500 bg-slate-100 hover:bg-slate-200';
    }
  };

  const getShippingBadgeStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'hold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getShippingStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'hold': return 'On Hold';
      case 'cancelled': return 'Cancelled';
      case 'in_progress': return 'In Progress';
      default: return 'Pending';
    }
  };

  const getShippingIconTitle = (status: string, hasShipping: boolean) => {
    switch (status) {
      case 'completed': return 'Shipping Completed - View Details';
      case 'hold': return 'Parcel On Hold - View Details';
      case 'cancelled': return 'Shipping Cancelled - View Details';
      case 'in_progress': return 'Shipping In Progress - View Details';
      default:
        return hasShipping ? 'Shipping in Progress - View' : 'Add Shipping Detail';
    }
  };

  const handleOpenShipping = (o: Order, mode: 'view' | 'edit' = 'view') => {
    setShippingOrder(o);
    const s = o.shipping;
    const status = resolveShippingStatus(s);
    setShippingForm({
      isComplete: status === 'completed',
      shippingDate: s?.shippingDate || getTodayISO(),
      parcelName: s?.parcelName || '',
      parcelId: s?.parcelId || '',
      status
    });
    setCheckedShippingItems((o.items || []).reduce((acc, item, index) => {
      acc[`${item.productId}-${index}`] = false;
      return acc;
    }, {} as Record<string, boolean>));
    setShippingDialogMode(mode);
    setShippingDialogOpen(true);
    setEditableOrder(mode === 'edit' ? { ...o, items: (o.items || []).map(i => ({ ...i })) } : null);
    if (typeof window !== 'undefined') setTimeout(() => document.body.classList.add('hide-mobile-bottom-bar'), 0);
  };

  const closeShippingDialog = () => {
    setShippingDialogOpen(false);
    setShippingOrder(null);
    setEditableOrder(null);
    if (typeof window !== 'undefined') document.body.classList.remove('hide-mobile-bottom-bar');
  };

  const handleSaveOrderEdits = async () => {
    if (!editableOrder) return;
    try {
      await api.saveOrder(editableOrder);
      showSuccess('Order changes saved');
      setShippingOrder(editableOrder);
      await loadData();
    } catch (e: any) {
      console.error('saveOrder (from shipping edit) failed', e);
      showError(`Saving order failed: ${e?.message || 'Unknown error'}`);
    }
  };

  const handleSaveShipping = async () => {
    if (!shippingOrder) return;
    const trimmedParcelName = shippingForm.parcelName.trim();

    // Ensure status syncs with isComplete (completed = isComplete true)
    const finalStatus = shippingForm.isComplete ? 'completed' : (shippingForm.status === 'completed' ? 'in_progress' : shippingForm.status);
    const finalShipping: OrderShippingDetail = {
      isComplete: finalStatus === 'completed',
      shippingDate: shippingForm.shippingDate || undefined,
      parcelName: trimmedParcelName || undefined,
      parcelId: shippingForm.parcelId.trim() || undefined,
      completedAt: finalStatus === 'completed' ? (shippingOrder?.shipping?.completedAt || getTodayISO()) : undefined,
      status: finalStatus
    };
    const updated: Order = { ...shippingOrder, shipping: finalShipping };
    try {
      await api.saveOrder(updated);
      // Fetch canonical copy from server to reduce chance of stale state across devices
      const remote = await api.getOrder(updated.id);
      if (remote) setShippingOrder(remote);
    } catch (e: any) {
      console.error('saveOrder failed', e);
      showError(`Database save failed: ${e?.message || 'Unknown error'}. Make sure orders.shipping column exists in Supabase. Saved locally for now.`);
    }

    if (trimmedParcelName) {
      try {
        const res = await api.saveParcelName(trimmedParcelName);
        if (res.saved) {
          showSuccess(`Saved "${trimmedParcelName}" to parcel list.`);
        }
      } catch (e: any) {
        console.error('saveParcelName (from saveShipping) failed', e);
        showError(`Saved to order, but could not persist to parcels list DB: ${e?.message || 'Unknown error'}. Make sure customization.parcel_names column exists (see migration SQL). Saved locally for now.`);
      }
      await loadParcelNames();
    }

    const messages: Record<string, string> = {
      completed: 'Shipping marked Completed',
      hold: 'Shipping placed On Hold',
      cancelled: 'Shipping marked Cancelled',
      in_progress: 'Shipping details saved (In Progress)',
      pending: 'Shipping details saved (Pending)'
    };
    showSuccess(messages[finalStatus] || 'Shipping details saved');
    await loadData();
    closeShippingDialog();
  };

  const handleDeleteShipping = async () => {
    if (!shippingOrder) return;
    if (!confirm("Clear shipping details from this order?")) return;
    const updated: Order = { ...shippingOrder, shipping: undefined };
    await api.saveOrder(updated);
    showSuccess("Shipping removed");
    await loadData();
    closeShippingDialog();
  };

  const handleSaveNewParcelName = async () => {
    const name = shippingForm.parcelName.trim();
    if (!name) return;
    try {
      const res = await api.saveParcelName(name);
      if (!res.saved) {
        if (res.reason === 'exists') showSuccess('Parcel already in saved list');
        await loadParcelNames();
        return;
      }
      await loadParcelNames();
      showSuccess(`Saved parcel: ${name}`);
    } catch (e: any) {
      console.error('saveParcelName failed', e);
      showError(`Could not save to database: ${e?.message || 'Unknown error'}. Run customization.parcel_names migration SQL in Supabase. Saved locally for now.`);
      // Force refresh from localStorage so UI shows the entry even if DB failed.
      await loadParcelNames();
    }
  };

  const handleRemoveParcelName = async (name: string) => {
    if (!confirm(`Remove "${name}" from saved parcels list?`)) return;
    try {
      await api.removeParcelName(name);
    } catch (e: any) {
      console.error('removeParcelName failed', e);
      showError(`Database remove failed: ${e?.message || 'Unknown error'}. Removed from local view only.`);
    }
    await loadParcelNames();
    showSuccess('Parcel removed from list');
  };

  const shippingList = useMemo(() => {
    return (orders || []).filter(o => !o.isQuote);
  }, [orders]);

  const pendingShipping = useMemo(() => shippingList.filter(o => resolveShippingStatus(o.shipping) === 'pending'), [shippingList]);
  const inProgressShipping = useMemo(() => shippingList.filter(o => resolveShippingStatus(o.shipping) === 'in_progress'), [shippingList]);
  const holdShipping = useMemo(() => shippingList.filter(o => resolveShippingStatus(o.shipping) === 'hold'), [shippingList]);
  const cancelledShipping = useMemo(() => shippingList.filter(o => resolveShippingStatus(o.shipping) === 'cancelled'), [shippingList]);
  const completedShipping = useMemo(() => shippingList.filter(o => resolveShippingStatus(o.shipping) === 'completed'), [shippingList]);

  const filteredParcelSuggestions = useMemo(() => {
    const q = shippingForm.parcelName.trim().toLowerCase();
    if (!q) return savedParcelNames;
    return savedParcelNames.filter(n => n.toLowerCase().includes(q));
  }, [savedParcelNames, shippingForm.parcelName]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'hold': return <PauseCircle className="w-3.5 h-3.5" />;
      case 'cancelled': return <XCircle className="w-3.5 h-3.5" />;
      case 'in_progress': return <Truck className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  // Header background on mobile should reflect selected or current shipping status
  const headerBgClass = shippingOrder
    ? (shippingDialogMode === 'edit'
        ? getShippingBadgeStyle(shippingForm.status || 'pending')
        : getShippingBadgeStyle(resolveShippingStatus(shippingOrder?.shipping)))
    : '';

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = orders.findIndex(o => o.id === active.id);
      const newIndex = orders.findIndex(o => o.id === over.id);
      const reordered = arrayMove(orders, oldIndex, newIndex);
      setOrders(reordered);
      await api.reorderOrders(reordered.map(o => o.id));
    }
  };

  const filtered = (Array.isArray(orders) ? orders : []).filter(o => {
    // Check customer/dealer name or order ID
    const matchesCustomer = !customerSearch.trim() || 
      (o && (
        (o.customerName && o.customerName.toLowerCase().includes(customerSearch.toLowerCase())) || 
        (o.id && o.id.toLowerCase().includes(customerSearch.toLowerCase()))
      ));

    // Check product name in items
    const matchesProduct = !productSearch.trim() || 
      (o && o.items && Array.isArray(o.items) && o.items.some(item => 
        item.productName && item.productName.toLowerCase().includes(productSearch.toLowerCase())
      ));

    return matchesCustomer && matchesProduct;
  });

  // If searching, we don't apply custom sort to avoid confusion during drag
  const displayOrders = customerSearch.trim() === '' && productSearch.trim() === '' ? filtered : [...filtered].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Defensive: ensure orders used in DnD/Sortable have valid ids to avoid runtime errors
  const safeDisplayOrders = Array.isArray(displayOrders) ? displayOrders.filter(o => o && typeof o.id === 'string' && o.id.length > 0) : [];

  return (
    <Layout>
      <Tabs value={shippingTab} onValueChange={setShippingTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="orders" className="text-[11px] font-black uppercase">📦 Orders</TabsTrigger>
          <TabsTrigger value="shipping" className="text-[11px] font-black uppercase">🚚 Shipping ({shippingList.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-6 mt-0">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Search customer/dealer..." 
                  className="pl-10 h-10 rounded-xl" 
                  value={customerSearch}
                  onChange={e => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerSuggestions(true);
                  }}
                  onFocus={() => customerSearch && setShowCustomerSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                />
                {showCustomerSuggestions && customerSearch && customerSuggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {customerSuggestions.map(customer => (
                      <button
                        key={customer}
                        type="button"
                        className="w-full px-4 py-2 text-left text-xs hover:bg-slate-50"
                        onClick={() => {
                          setCustomerSearch(customer);
                          setShowCustomerSuggestions(false);
                        }}
                      >
                        {customer}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Search product..." 
                  className="pl-10 h-10 rounded-xl" 
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value);
                    setShowProductSuggestions(true);
                  }}
                  onFocus={() => productSearch && setShowProductSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
                />
                {showProductSuggestions && productSearch && productSuggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {productSuggestions.map(product => (
                      <button
                        key={product}
                        type="button"
                        className="w-full px-4 py-2 text-left text-xs hover:bg-slate-50"
                        onClick={() => {
                          setProductSearch(product);
                          setShowProductSuggestions(false);
                        }}
                      >
                        {product}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Card className="border-none shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">Order History & Approvals</CardTitle>
                <div className="flex items-center gap-1 sm:hidden">
                  <Button variant={historyView === 'table' ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => setHistoryView('table')}>
                    <List className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant={historyView === 'cards' ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => setHistoryView('cards')}>
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className={cn("max-h-[58vh] overflow-auto", historyView === 'cards' ? "hidden sm:block" : "block")}>
            <Table className="min-w-[900px]">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-slate-100/90 backdrop-blur">
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Order ID</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Customer</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Type</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Inventory</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Amount</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Status</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={safeDisplayOrders.map(o => o.id)} strategy={verticalListSortingStrategy}>
                    {safeDisplayOrders.map((o) => (
                      <SortableOrderRow 
                        key={o.id} 
                        o={o} 
                        user={user}
                        navigate={navigate}
                        setInvoiceOrder={setInvoiceOrder}
                        handleApprove={handleApprove}
                        handleReject={handleReject}
                        handleDelete={handleDelete}
                        handlePrint={handlePrintOrder}
                        handleOpenShipping={handleOpenShipping}
                        resolveShippingStatus={resolveShippingStatus}
                        getShippingIconStyle={getShippingIconStyle}
                        getShippingIconTitle={getShippingIconTitle}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </TableBody>
            </Table>
            </div>
            <div className={cn("p-3 space-y-2 sm:hidden", historyView === 'cards' ? "block" : "hidden")}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={safeDisplayOrders.map(o => o.id)} strategy={verticalListSortingStrategy}>
                  {safeDisplayOrders.map((o) => (
                    <SortableOrderCard 
                      key={o.id} 
                      o={o} 
                      user={user}
                      navigate={navigate}
                      setInvoiceOrder={setInvoiceOrder}
                      handleApprove={handleApprove}
                      handleReject={handleReject}
                      handleDelete={handleDelete}
                      handlePrint={handlePrintOrder}
                      handleOpenShipping={handleOpenShipping}
                      resolveShippingStatus={resolveShippingStatus}
                      getShippingIconStyle={getShippingIconStyle}
                      getShippingIconTitle={getShippingIconTitle}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="shipping" className="space-y-6 mt-0">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card className="bg-slate-50/60 border-none shadow-sm">
              <CardContent className="px-4 py-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Shipments</div>
                <div className="text-2xl font-black text-slate-900">{shippingList.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50/60 border-none shadow-sm">
              <CardContent className="px-4 py-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">In Progress</div>
                <div className="text-2xl font-black text-blue-800">{inProgressShipping.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50/60 border-none shadow-sm">
              <CardContent className="px-4 py-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-yellow-600 mb-1">On Hold</div>
                <div className="text-2xl font-black text-yellow-700">{holdShipping.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50/60 border-none shadow-sm">
              <CardContent className="px-4 py-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1">Cancelled</div>
                <div className="text-2xl font-black text-red-700">{cancelledShipping.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50/60 border-none shadow-sm col-span-2 sm:col-span-1">
              <CardContent className="px-4 py-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Completed</div>
                <div className="text-2xl font-black text-emerald-800">{completedShipping.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b py-3">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Truck className="w-4 h-4" /> Shipments List
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[68vh] overflow-auto">
                <Table className="min-w-[900px]">
                  <TableHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b">
                    <TableRow className="bg-slate-100/90 backdrop-blur hover:bg-transparent border-none">
                      <TableHead className="text-[10px] font-black uppercase py-3">Order ID</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-3">Dealer / Customer</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-3">Ship Date</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-3">Parcel Name</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-3">Parcel ID</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-3">Order Value</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-3">Status</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase py-3">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shippingList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-xs font-bold text-slate-400 py-10 italic">
                          No shipments yet. Click 🚚 on any order in the Orders tab to begin.
                        </TableCell>
                      </TableRow>
                    ) : (
                      shippingList.map(o => {
                        const s = o.shipping || { isComplete: false };
                        const status = resolveShippingStatus(o.shipping);
                        return (
                          <TableRow key={o.id} className="hover:bg-slate-50/60 border-slate-100">
                            <TableCell className="py-3 whitespace-nowrap">
                              <div className="text-[11px] font-black text-blue-600">{o.id}</div>
                              {o.mainOrderId ? <div className="text-[10px] text-slate-600">Main: {o.mainOrderId}</div> : null}
                              <div className="text-[9px] text-slate-400 font-bold uppercase">Order date: {formatDisplayDate(o.date)}</div>
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="text-xs font-bold text-slate-900">{o.customerName}</div>
                              <div className="text-[10px] text-slate-500 uppercase font-bold">{o.customerPhone || o.customerAddress || ''}</div>
                              {o.notes ? <div className="text-[11px] text-slate-500 truncate mt-1">{o.notes}</div> : null}
                            </TableCell>
                            <TableCell className="py-3 whitespace-nowrap text-[11px] font-bold text-slate-800">
                              {s.shippingDate ? formatDisplayDate(s.shippingDate) : ''}
                            </TableCell>
                            <TableCell className="py-3 whitespace-nowrap text-[11px] font-bold text-slate-800">
                              {s.parcelName || ''}
                            </TableCell>
                            <TableCell className="py-3 whitespace-nowrap text-[11px] font-bold text-slate-800 flex items-center gap-1">
                              <Package className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="max-w-[180px] truncate">
                                {s.parcelId || <span className="text-slate-400 italic text-[10px] font-bold uppercase">None</span>}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 whitespace-nowrap text-[12px] font-black text-slate-900">
                              {Number(o.netTotal || 0).toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="py-3 whitespace-nowrap">
                              {status === 'completed' ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-none text-[10px] font-black uppercase flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="w-3 h-3" /> Completed
                                  {s.completedAt && <span className="opacity-70 ml-1 font-bold normal-case"> · {formatDisplayDate(s.completedAt)}</span>}
                                </Badge>
                              ) : status === 'hold' ? (
                                <Badge className="bg-yellow-100 text-yellow-700 border-none text-[10px] font-black uppercase flex items-center gap-1 w-fit">
                                  <PauseCircle className="w-3 h-3" /> On Hold
                                </Badge>
                              ) : status === 'cancelled' ? (
                                <Badge className="bg-red-100 text-red-700 border-none text-[10px] font-black uppercase flex items-center gap-1 w-fit">
                                  <XCircle className="w-3 h-3" /> Cancelled
                                </Badge>
                              ) : status === 'in_progress' ? (
                                <Badge className="bg-blue-100 text-blue-700 border-none text-[10px] font-black uppercase flex items-center gap-1 w-fit">
                                  <Clock className="w-3 h-3" /> In Progress
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] font-black uppercase flex items-center gap-1 w-fit">
                                  <Clock className="w-3 h-3" /> Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-3 text-right whitespace-nowrap space-x-1">
                              <Button variant="secondary" size="icon" className="h-8 w-8 text-slate-600 bg-slate-50" onClick={() => { setInvoiceOrder(o); }} title="View Invoice">
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="secondary" size="icon" className="h-8 w-8 text-blue-600 bg-blue-50 border-blue-100" onClick={() => handleOpenShipping(o)} title="Edit / View Shipping">
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="secondary" size="icon" className={cn("h-8 w-8", o.shipping ? "text-red-500 bg-red-50 border-red-100" : "text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed")} onClick={async () => {
                                if (!o.shipping) return;
                                if (!confirm(`Clear shipping info for order ${o.id}?`)) return;
                                const updated: Order = { ...o, shipping: undefined };
                                await api.saveOrder(updated);
                                showSuccess("Shipping removed from order");
                                await loadData();
                              }} title="Delete Shipping Detail">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile card view for shipping */}
          <div className="sm:hidden space-y-3">
            {shippingList.length === 0 ? (
              <Card className="border-none shadow-sm"><CardContent className="text-center text-xs font-bold text-slate-400 py-8 italic">No shipments yet.</CardContent></Card>
            ) : (
              shippingList.map(o => {
                const s = o.shipping || { isComplete: false };
                const status = resolveShippingStatus(o.shipping);
                const statusBadge = (() => {
                  switch (status) {
                    case 'completed':
                      return <Badge className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase">Completed</Badge>;
                    case 'hold':
                      return <Badge className="bg-yellow-100 text-yellow-700 text-[10px] font-black uppercase">On Hold</Badge>;
                    case 'cancelled':
                      return <Badge className="bg-red-100 text-red-700 text-[10px] font-black uppercase">Cancelled</Badge>;
                    case 'in_progress':
                      return <Badge className="bg-blue-100 text-blue-700 text-[10px] font-black uppercase">In Progress</Badge>;
                    default:
                      return <Badge className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase">Pending</Badge>;
                  }
                })();
                return (
                  <Card key={o.id} className="border-none shadow-sm overflow-hidden">
                    <CardHeader className="py-3 px-4 bg-slate-50/60 border-b">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-black text-blue-700">{o.id}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5 truncate">{o.customerName}</div>
                        </div>
                        {statusBadge}
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold uppercase">Ship Date</span>
                        <span className="font-bold">{s.shippingDate ? formatDisplayDate(s.shippingDate) : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold uppercase">Parcel</span>
                        <span className="font-bold truncate ml-2 max-w-[60%] text-right">{s.parcelName || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold uppercase">Tracking ID</span>
                        <span className="font-bold truncate ml-2 max-w-[60%] text-right">{s.parcelId || '—'}</span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span className="text-slate-500 font-bold uppercase">Net Total</span>
                        <span className="font-black">{Number(o.netTotal || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 pt-2">
                        <Button variant="outline" size="sm" className="h-9 text-[11px] font-bold rounded-lg" onClick={() => handleOpenShipping(o)}>
                          <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="h-9 text-[11px] font-bold rounded-lg" onClick={() => setInvoiceOrder(o)}>
                          <Eye className="w-3.5 h-3.5 mr-1" /> Invoice
                        </Button>
                        <Button variant="outline" size="sm" className={cn("h-9 text-[11px] font-bold rounded-lg", o.shipping ? "text-red-600" : "text-slate-400 cursor-not-allowed")} onClick={async () => {
                          if (!o.shipping) return;
                          if (!confirm(`Clear shipping for order ${o.id}?`)) return;
                          const updated: Order = { ...o, shipping: undefined };
                          await api.saveOrder(updated);
                          showSuccess("Shipping removed");
                          await loadData();
                        }}>
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!invoiceOrder} onOpenChange={() => setInvoiceOrder(null)}>
        <DialogContent className="max-w-full max-h-[90vh] overflow-auto p-0">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
          </DialogHeader>
          {invoiceOrder && (
            <div className="p-4 bg-white border rounded min-w-full overflow-auto">
              <div className="mx-auto w-[210mm] origin-top md:scale-100 scale-[0.55]">
                <div dangerouslySetInnerHTML={{ __html: generateInvoiceHtml(invoiceOrder, false, api.getConfig()) }} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Shipping Detail Dialog */}
      <Dialog open={shippingDialogOpen} onOpenChange={(v) => { if (!v) { setShippingDialogOpen(false); setShippingOrder(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[86vh] sm:max-h-[92vh] overflow-hidden flex flex-col !p-0 gap-0">
          <DialogHeader className={cn("px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-slate-200/80", headerBgClass ? `${headerBgClass} sm:bg-transparent` : '')}>
            <DialogTitle className="flex items-center gap-2.5">
              <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                shippingOrder ? (shippingDialogMode === 'edit' ? getShippingIconStyle(shippingForm.status || resolveShippingStatus(shippingOrder?.shipping)) : getShippingIconStyle(resolveShippingStatus(shippingOrder?.shipping))) : 'bg-slate-100 text-slate-500'
              )}>
                {shippingDialogMode === 'edit' ? getStatusIcon(shippingForm.status || resolveShippingStatus(shippingOrder?.shipping || undefined)) : getStatusIcon(resolveShippingStatus(shippingOrder?.shipping))}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] sm:text-[15px] font-black leading-tight">
                  {shippingDialogMode === 'view' ? 'Shipping Details' : 'Edit Shipping'}
                </div>
              </div>
              {/* Editing badge removed per UX request */}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 pb-64 sm:pb-28 space-y-4 sm:space-y-5">
            {shippingOrder && shippingDialogMode === 'view' && (
              (() => {
                const s = shippingOrder?.shipping;
                const status = resolveShippingStatus(s);
                return (
                  <div className="space-y-3 sm:pb-0 pb-8 mb-6 sm:mb-0">
                    <div className={cn("rounded-2xl border p-3.5 sm:p-4", getShippingBadgeStyle(status))}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", getShippingIconStyle(status))}>
                            {getStatusIcon(status)}
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Shipping Status</div>
                            <div className="text-[15px] font-black">{getShippingStatusLabel(status)}</div>
                          </div>
                        </div>
                        <div className="text-right text-[11px] font-semibold">
                          {s?.shippingDate ? (
                            <>
                              <div className="uppercase opacity-70">Ship Date</div>
                              <div>{formatDisplayDate(s.shippingDate)}</div>
                            </>
                          ) : s?.completedAt ? (
                            <>
                              <div className="uppercase opacity-70">Completed</div>
                              <div>{formatDisplayDate(s.completedAt)}</div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Order Summary</div>
                        <div className="text-[10px] font-semibold text-slate-400">Read only</div>
                      </div>
                      <div className="p-3.5 sm:p-4 space-y-0">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Order Summary</div>
                          <div className="text-sm font-bold text-slate-800">{formatDisplayDate(shippingOrder.date)}</div>
                          <div className="text-lg font-black text-slate-900 mt-1">{shippingOrder.customerName || ''}</div>
                          {shippingOrder.customerPhone && <div className="text-sm text-slate-700 mt-1">{shippingOrder.customerPhone}</div>}
                          {shippingOrder.customerAddress && <div className="text-sm text-slate-700">{shippingOrder.customerAddress}</div>}
                          <div className="text-sm text-slate-700 mt-1">Order ID: <span className="font-black text-blue-700">{shippingOrder.id}</span></div>
                          {shippingOrder.notes && <div className="text-sm text-slate-700 mt-1"><span className="font-black">Note:</span> {shippingOrder.notes}</div>}
                          {shippingOrder.mainOrderId && <div className="text-sm text-slate-700">Main Order ID: <span className="font-black">{shippingOrder.mainOrderId}</span></div>}
                          <div className="text-sm text-slate-700 mt-1 flex items-center justify-between">
                            <span className="font-black">Net Total:</span>
                            <span className="font-black text-slate-900">{Number(shippingOrder.netTotal || 0).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <Package className="w-4 h-4 text-slate-500" />
                          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Shipping Details</div>
                        </div>
                        <div className="text-[10px] font-semibold text-slate-400">Read only</div>
                      </div>
                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Ship Date</div>
                          <div className="mt-1 text-sm font-semibold text-slate-800">{s?.shippingDate ? formatDisplayDate(s.shippingDate) : ''}</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Parcel Service</div>
                          <div className="mt-1 text-sm font-semibold text-slate-800">{s?.parcelName || ''}</div>
                          {s?.parcelId ? (
                            <div className="mt-1 text-sm text-slate-600">ID: <span className="font-mono text-[12px]">{s.parcelId}</span></div>
                          ) : null}
                        </div>
                        <div className="sm:col-span-2 rounded-xl bg-slate-50 p-3">
                          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Tracking / Parcel ID</div>
                          <div className="mt-1 text-sm font-mono text-slate-700">{s?.parcelId || ''}</div>
                        </div>
                      </div>
                    </div>

                    {/* footer for view mode moved below to keep content scrollable */}
                  </div>
                );
              })()
            )}

            {shippingOrder && shippingDialogMode === 'edit' && (
              <div className="space-y-3 sm:pb-0 pb-8 mb-6 sm:mb-0">
                {/* Mobile-only shipping status — frozen at top */}
                <div className="sm:hidden rounded-2xl border border-slate-200 bg-white overflow-hidden sticky top-[-0.75rem] z-20 shadow-md -mx-4 px-4 -mt-5 pt-3 pb-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/95">
                  <div className="px-2 py-2 border-b border-slate-200 bg-slate-50/80">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Shipping Status</div>
                    </div>
                  </div>
                  <div className="p-2">
                    <div className="grid grid-cols-5 gap-1.5">
                      {([
                        { k: 'pending',     label: 'Pending',     sub: 'Not booked yet', cls: 'bg-slate-100 text-slate-700 hover:bg-slate-200 data-[active=true]:bg-slate-600 data-[active=true]:text-white data-[active=true]:shadow-sm data-[active=true]:border-transparent', icon: <Clock className="w-4 h-4" /> },
                        { k: 'in_progress', label: 'In Transit', sub: 'Booked / shipped', cls: 'bg-blue-100 text-blue-700 hover:bg-blue-200 data-[active=true]:bg-blue-600 data-[active=true]:text-white data-[active=true]:shadow-sm data-[active=true]:border-transparent', icon: <Truck className="w-4 h-4" /> },
                        { k: 'hold',        label: 'On Hold',     sub: 'Paused', cls: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 data-[active=true]:bg-yellow-400 data-[active=true]:text-white data-[active=true]:shadow-sm data-[active=true]:border-transparent', icon: <PauseCircle className="w-4 h-4" /> },
                        { k: 'cancelled',   label: 'Cancelled',   sub: 'Will not ship', cls: 'bg-red-100 text-red-700 hover:bg-red-200 data-[active=true]:bg-red-600 data-[active=true]:text-white data-[active=true]:shadow-sm data-[active=true]:border-transparent', icon: <XCircle className="w-4 h-4" /> },
                        { k: 'completed',   label: 'Delivered',   sub: 'Completed', cls: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 data-[active=true]:bg-emerald-600 data-[active=true]:text-white data-[active=true]:shadow-sm data-[active=true]:border-transparent', icon: <CheckCircle2 className="w-4 h-4" /> },
                      ] as const).map((opt) => {
                        const active = (shippingForm.status || 'pending') === opt.k || (opt.k === 'completed' && shippingForm.isComplete);
                        return (
                          <Button key={opt.k} type="button" variant="outline" data-active={active} title={`${opt.label}: ${opt.sub}`} className={cn("h-auto rounded-lg text-[10px] font-black uppercase border-slate-200 flex flex-col items-center justify-center gap-0 py-2 px-1 text-center w-full aspect-square h-12", opt.cls)} onClick={() => { const isCompleted = opt.k === 'completed'; setShippingForm(prev => ({ ...prev, status: opt.k, isComplete: isCompleted })); }}>
                            <div className="flex items-center justify-center w-full relative">
                              <div>{opt.icon}</div>
                              {active && <div className="absolute -top-0.5 -right-0.5"><Check className="w-3 h-3 opacity-90" /></div>}
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <div className="text-sm font-black uppercase tracking-widest text-slate-500">Order Items{shippingOrder?.items ? ` (${shippingOrder.items.length})` : ''}</div>
                    <div>
                      <Button onClick={() => {
                        if (shippingOrder) {
                          navigate(`/new-order?edit=${shippingOrder.id}`);
                          closeShippingDialog();
                        }
                      }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold">Edit Order</Button>
                    </div>
                  </div>

                  <div className="p-3 space-y-2 text-sm text-slate-700">
                    {/* Order Summary for edit mode */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Order Summary</div>
                      <div className="text-sm font-bold text-slate-800">{formatDisplayDate((editableOrder || shippingOrder)?.date)}</div>
                      <div className="text-lg font-black text-slate-900 mt-1">{(editableOrder || shippingOrder)?.customerName || ''}</div>
                      {(editableOrder || shippingOrder)?.customerPhone && <div className="text-sm text-slate-700 mt-1">{(editableOrder || shippingOrder)?.customerPhone}</div>}
                      {(editableOrder || shippingOrder)?.customerAddress && <div className="text-sm text-slate-700">{(editableOrder || shippingOrder)?.customerAddress}</div>}
                      <div className="text-sm text-slate-700 mt-1">Order ID: <span className="font-black text-blue-700">{(editableOrder || shippingOrder)?.id}</span></div>
                      {(editableOrder || shippingOrder)?.notes && <div className="text-sm text-slate-700 mt-1"><span className="font-black">Note:</span> {(editableOrder || shippingOrder)?.notes}</div>}
                      {(editableOrder || shippingOrder)?.mainOrderId && <div className="text-sm text-slate-700">Main Order ID: <span className="font-black">{(editableOrder || shippingOrder)?.mainOrderId}</span></div>}
                    </div>

                    {shippingOrder?.items && shippingOrder.items.length > 0 ? (
                      shippingOrder.items.slice(0,5).map((it: any, i: number) => {
                        const key = `${it.productId}-${i}`;
                        return (
                          <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                            <input
                              type="checkbox"
                              checked={!!checkedShippingItems[key]}
                              onChange={() => setCheckedShippingItems(prev => ({ ...prev, [key]: !prev[key] }))}
                              className="h-4 w-4 rounded border-slate-300 text-slate-900"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-slate-900 text-sm truncate">{it.productName || it.productId}{it.version ? ` ${it.version}` : ''}</div>
                              <div className="text-[12px] text-slate-600">Qty {it.quantity} · Price {Number(it.price || 0).toLocaleString('en-IN')}</div>
                            </div>
                            <div className="text-right font-black text-slate-900 text-sm">{Number(it.total || (it.quantity * (it.price || 0))).toLocaleString('en-IN')}</div>
                          </label>
                        );
                      })
                    ) : (
                      <div className="text-slate-500">No items on this order.</div>
                    )}
                    {shippingOrder?.items && shippingOrder.items.length > 5 && (
                      <div className="text-xs text-slate-400">+{shippingOrder.items.length - 5} more items</div>
                    )}
                  </div>
                </div>

                {/* Product list removed — items preview above already contains checkboxes */}

                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/80">
                    <div className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-slate-500" />
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Booking Details</div>
                    </div>
                  </div>
                  <div className="p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Shipping Date</Label>
                      <Input type="date" className="h-11 rounded-xl text-sm" value={shippingForm.shippingDate || ''} onChange={e => setShippingForm({ ...shippingForm, shippingDate: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <List className="w-3.5 h-3.5" /> Tracking / Parcel ID <span className="text-slate-400 normal-case font-bold text-[9px]">(optional)</span>
                      </Label>
                      <Input className="h-11 rounded-xl text-sm" placeholder="Enter tracking / parcel ID..." value={shippingForm.parcelId || ''} onChange={e => setShippingForm({ ...shippingForm, parcelId: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/80 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-slate-500" />
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Parcel Service</div>
                  </div>
                  <div className="p-3.5 sm:p-4 space-y-3">
                    <div>
                      <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Search or enter parcel service</Label>
                      <div className="relative">
                        <Input className="h-11 rounded-xl text-sm pr-10" placeholder="Search or type parcel service" value={shippingForm.parcelName || ''} onChange={e => setShippingForm({ ...shippingForm, parcelName: e.target.value })} />
                        {shippingForm.parcelName ? (
                          <button type="button" onClick={() => setShippingForm({ ...shippingForm, parcelName: '' })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {shippingForm.parcelName.trim() && filteredParcelSuggestions.length > 0 && !savedParcelNames.some(n => n.toLowerCase() === shippingForm.parcelName.trim().toLowerCase()) && (
                      <div className="grid gap-2">
                        {filteredParcelSuggestions.slice(0, 6).map((name) => (
                              <div key={name} className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShippingForm({ ...shippingForm, parcelName: name })}
                                  className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  {name}
                                </button>
                                <button type="button" title="Edit parcel name" onClick={() => handleEditParcelName(name)} className="h-9 w-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100">
                                  <Edit className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <Button type="button" variant="outline" size="sm" className="h-11 rounded-xl text-[11px] font-black uppercase border-dashed flex-1" onClick={handleSaveNewParcelName} disabled={!shippingForm.parcelName.trim()}>
                        <Plus className="w-4 h-4 mr-1.5" /> Save
                      </Button>
                    </div>

                    {shippingForm.parcelName.trim() && !savedParcelNames.some(n => n.toLowerCase() === shippingForm.parcelName.trim().toLowerCase()) && (
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                        New parcel service will be saved when you click Save.
                      </div>
                    )}
                  </div>
                </div>

                {/* footer for edit mode moved below to keep content scrollable */}
              </div>
            )}
          </div>
          {/* Fixed footer: keeps action buttons + PC shipping status visible while content scrolls */}
          {/* Force flex-col on ALL sizes including sm/PC — override shadcn DialogFooter sm:flex-row default with !sm:flex-col */}
          <DialogFooter className="!m-0 border-t bg-white p-3 sm:p-4 !flex !flex-col !sm:flex-col gap-2 sm:gap-3 justify-end mb-6 sm:mb-0">
            {shippingDialogMode === 'view' ? (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:justify-end">
                <Button variant="outline" className="h-11 rounded-xl font-bold w-full sm:w-auto sm:flex-1" onClick={() => closeShippingDialog()}>
                  Close
                </Button>
                <Button className={cn("h-11 rounded-xl font-bold w-full sm:w-auto sm:flex-1",
                  shippingOrder ? getShippingIconStyle(resolveShippingStatus(shippingOrder?.shipping)) : 'bg-slate-900 text-white')}
                  onClick={() => { setEditableOrder(shippingOrder ? { ...shippingOrder, items: (shippingOrder.items || []).map(i => ({ ...i })) } : null); setShippingDialogMode('edit'); if (typeof window !== 'undefined') document.body.classList.add('hide-mobile-bottom-bar'); }}
                >
                  <Edit className="w-3.5 h-3.5 mr-1.5" />
                  Edit Shipping
                </Button>
              </div>
            ) : (
              <>
                {/* PC-only shipping status — frozen FULL WIDTH just above the action buttons */}
                {shippingOrder && (
                  <div className="hidden sm:block w-full">
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm w-full">
                      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50/80">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Shipping Status</div>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-5 gap-2 w-full">
                          {([
                            { k: 'pending',     label: 'Pending',     sub: 'Not booked yet', cls: 'bg-slate-100 text-slate-700 hover:bg-slate-200 data-[active=true]:bg-slate-600 data-[active=true]:text-white data-[active=true]:shadow-sm data-[active=true]:border-transparent', icon: <Clock className="w-4 h-4" /> },
                            { k: 'in_progress', label: 'In Transit', sub: 'Booked / shipped', cls: 'bg-blue-100 text-blue-700 hover:bg-blue-200 data-[active=true]:bg-blue-600 data-[active=true]:text-white data-[active=true]:shadow-sm data-[active=true]:border-transparent', icon: <Truck className="w-4 h-4" /> },
                            { k: 'hold',        label: 'On Hold',     sub: 'Paused', cls: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 data-[active=true]:bg-yellow-400 data-[active=true]:text-white data-[active=true]:shadow-sm data-[active=true]:border-transparent', icon: <PauseCircle className="w-4 h-4" /> },
                            { k: 'cancelled',   label: 'Cancelled',   sub: 'Will not ship', cls: 'bg-red-100 text-red-700 hover:bg-red-200 data-[active=true]:bg-red-600 data-[active=true]:text-white data-[active=true]:shadow-sm data-[active=true]:border-transparent', icon: <XCircle className="w-4 h-4" /> },
                            { k: 'completed',   label: 'Delivered',   sub: 'Completed', cls: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 data-[active=true]:bg-emerald-600 data-[active=true]:text-white data-[active=true]:shadow-sm data-[active=true]:border-transparent', icon: <CheckCircle2 className="w-4 h-4" /> },
                          ] as const).map((opt) => {
                            const active = (shippingForm.status || 'pending') === opt.k || (opt.k === 'completed' && shippingForm.isComplete);
                            return (
                              <Button key={opt.k} type="button" variant="outline" data-active={active} title={`${opt.label}: ${opt.sub}`} className={cn("h-auto rounded-xl text-[10px] font-black uppercase border-slate-200 flex flex-col items-center justify-start gap-1.5 py-3 px-2 text-left w-full", opt.cls)} onClick={() => { const isCompleted = opt.k === 'completed'; setShippingForm(prev => ({ ...prev, status: opt.k, isComplete: isCompleted })); }}>
                                <div className="flex items-center justify-between w-full">{opt.icon}{active && <Check className="w-3.5 h-3.5 opacity-90" />}</div>
                                <div className="w-full leading-tight">
                                  <div className="font-black text-[11px]">{opt.label}</div>
                                  <div className="font-bold normal-case opacity-80 text-[9.5px]">{opt.sub}</div>
                                </div>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Action button row — FULL WIDTH on mobile (stacked), row on PC */}
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:justify-end">
                  {shippingOrder?.shipping && (
                    <Button variant="destructive" type="button" className="h-11 rounded-xl font-bold w-full sm:w-auto sm:order-first sm:mr-auto" onClick={handleDeleteShipping}>
                      <Trash2 className="w-4 h-4 mr-1.5" /> Delete Shipping
                    </Button>
                  )}
                  <Button variant="outline" className="h-11 rounded-xl font-bold w-full sm:w-auto sm:flex-1" onClick={() => { setShippingDialogMode('view'); setEditableOrder(null); }}>
                    Back to View
                  </Button>
                  <Button className="h-11 rounded-xl font-bold w-full sm:w-auto sm:flex-1 bg-slate-900 hover:bg-slate-800 text-white" onClick={handleSaveShipping}>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    {((shippingForm.status || 'pending') === 'completed' || shippingForm.isComplete) ? 'Save & Mark Delivered' : 'Save Shipping Details'}
                  </Button>
                </div>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Orders;
