"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Order, Dealer, Product, Officer, Customization, Category } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Trophy, Medal, Filter, Printer, ChevronRight, MessageSquare, LayoutGrid, Users, Tags, Settings2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateReportHtml } from '@/utils/report-generator';
import { printDoc, formatNumber } from '@/utils/invoice-generator';
import { formatDisplayDate, getTodayISO } from '@/utils/date';
import { useTabState } from '@/context/TabStateContext';

const Reports = () => {
  const { getTabState, saveTabState } = useTabState();
  const tabPath = "reports";
  
  // Load saved state
  const savedState = getTabState(tabPath);
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [config, setConfig] = useState<Customization | null>(null);
  
  const [fromDate, setFromDate] = useState(savedState.fromDate || getTodayISO());
  const [toDate, setToDate] = useState(savedState.toDate || getTodayISO());
  
  const [salesReportType, setSalesReportType] = useState<'dealer' | 'officer'>(savedState.salesReportType || 'dealer');
  const [officerSubtype, setOfficerSubtype] = useState<'product' | 'dealer'>(savedState.officerSubtype || 'product');
  const [selectedEntity, setSelectedEntity] = useState(savedState.selectedEntity || 'all');
  const [dealerSearch, setDealerSearch] = useState(savedState.dealerSearch || '');
  const [dealerSuggestions, setDealerSuggestions] = useState<Dealer[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(savedState.selectedDealer || null);
  const [selectedCategory, setSelectedCategory] = useState(savedState.selectedCategory || 'all');
  const [reportComment, setReportComment] = useState(savedState.reportComment || '');
  const [activeTab, setActiveTab] = useState(savedState.activeTab || 'sales');
  
  // Advanced Options
  const [categoryView, setCategoryView] = useState<'splitted' | 'combined'>(savedState.categoryView || 'splitted');
  const [showAdvanced, setShowAdvanced] = useState(savedState.showAdvanced || false);
  const [showCommission, setShowCommission] = useState(savedState.showCommission ?? true);
  
  // Save state whenever any changes
  useEffect(() => {
    saveTabState(tabPath, {
      fromDate,
      toDate,
      salesReportType,
      officerSubtype,
      selectedEntity,
      dealerSearch,
      selectedDealer,
      selectedCategory,
      reportComment,
      activeTab,
      categoryView,
      showAdvanced,
      showCommission
    });
  }, [fromDate, toDate, salesReportType, officerSubtype, selectedEntity, dealerSearch, selectedDealer, selectedCategory, reportComment, activeTab, categoryView, showAdvanced, showCommission, saveTabState, tabPath]);

  useEffect(() => {
    const loadData = async () => {
      setOrders(await api.getOrders());
      setDealers(await api.getDealers());
      setOfficers(await api.getOfficers());
      setProducts(await api.getProducts());
      setCategories(await api.getCategories());
      setConfig(await api.getCustomization());
    };
    loadData();
  }, []);

  const handleDealerSearch = (value: string) => {
    setDealerSearch(value);
    setSelectedDealer(null);
    setSelectedEntity('all');
    if (value.length < 1) {
      setDealerSuggestions([]);
      return;
    }
    const safeDealers = Array.isArray(dealers) ? dealers : [];
    setDealerSuggestions(safeDealers.filter(d => d && d.name && d.name.toLowerCase().includes(value.toLowerCase())));
  };

  const pickDealer = (dealer: Dealer) => {
    setSelectedDealer(dealer);
    setSelectedEntity(dealer.id);
    setDealerSearch('');
    setDealerSuggestions([]);
  };

  const filteredOrders = useMemo(() => 
    orders.filter(o => !o.isQuote && o.date >= fromDate && o.date <= toDate), 
  [orders, fromDate, toDate]);

  const entityName = useMemo(() => {
    if (selectedEntity === 'all') return 'all';
    if (salesReportType === 'dealer') {
      return dealers.find(d => d.id === selectedEntity)?.name || selectedEntity;
    }
    return selectedEntity;
  }, [selectedEntity, salesReportType, dealers]);

  const salesReportData = useMemo(() => {
    const summary: Record<string, { qty: number; amount: number; commission: number; categoryId?: string }> = {};
    let totalQty = 0;
    let totalAmount = 0;
    let totalCommission = 0;

    filteredOrders.forEach(o => {
      // Exclude retail orders for officer reports
      if (salesReportType === 'officer' && o.type === 'retail') return;

      if (salesReportType === 'dealer') {
        if (selectedEntity !== 'all' && o.dealerId !== selectedEntity) return;
      } else {
        if (selectedEntity !== 'all' && o.officer !== selectedEntity) return;
      }

      o.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (selectedCategory !== 'all' && product?.categoryId !== selectedCategory) return;

        const key = (salesReportType === 'officer' && officerSubtype === 'dealer')
          ? `${o.customerName || 'Unknown'}${selectedEntity === 'all' ? ` [${o.officer || 'Unassigned'}]` : ''}`
          : item.productName;
        
        if (!summary[key]) {
          summary[key] = { qty: 0, amount: 0, commission: 0, categoryId: product?.categoryId };
        }
        const itemComm = (item.commission || 0) + (
          o.includePriceIncreaseInCommission
            ? (item.price - (item.basePrice || 0)) * item.quantity
            : 0
        );
        summary[key].qty += item.quantity;
        summary[key].amount += item.total;
        summary[key].commission += itemComm;
        
        totalQty += item.quantity;
        totalAmount += item.total;
        totalCommission += itemComm;
      });
      if (o.includePriceIncreaseInCommission) {
        totalCommission += o.extra;
      }
    });

    const rows = Object.entries(summary).map(([name, data]) => ({ name, ...data }));

    if (categoryView === 'splitted') {
      const grouped: Record<string, { rows: typeof rows, subQty: number, subAmount: number, subCommission: number }> = {};
      rows.forEach(r => {
        const catName = categories.find(c => c.id === r.categoryId)?.name || 'Uncategorized';
        if (!grouped[catName]) grouped[catName] = { rows: [], subQty: 0, subAmount: 0, subCommission: 0 };
        grouped[catName].rows.push(r);
        grouped[catName].subQty += r.qty;
        grouped[catName].subAmount += r.amount;
        grouped[catName].subCommission += r.commission;
      });
      Object.keys(grouped).forEach(cat => {
        if (!grouped[cat].rows.length) delete grouped[cat];
      });
      return { grouped, totalQty, totalAmount, totalCommission, isSplitted: true };
    }

    return { rows, totalQty, totalAmount, totalCommission, isSplitted: false };
  }, [filteredOrders, salesReportType, officerSubtype, selectedEntity, selectedCategory, products, categoryView, categories]);

  const dealerRankings = useMemo(() => {
    const summary: Record<string, { name: string; amount: number; qty: number; orders: number }> = {};
    
    filteredOrders.forEach(o => {
      if (!o.dealerId) return;
      
      const filteredItems = o.items.filter(item => {
        if (selectedCategory === 'all') return true;
        const product = products.find(p => p.id === item.productId);
        return product?.categoryId === selectedCategory;
      });

      if (filteredItems.length === 0) return;

      if (!summary[o.dealerId]) summary[o.dealerId] = { name: o.customerName, amount: 0, qty: 0, orders: 0 };
      
      const orderAmount = filteredItems.reduce((sum, i) => sum + i.total, 0);
      const orderQty = filteredItems.reduce((sum, i) => sum + i.quantity, 0);

      summary[o.dealerId].amount += orderAmount;
      summary[o.dealerId].orders += 1;
      summary[o.dealerId].qty += orderQty;
    });

    return Object.values(summary).sort((a, b) => b.amount - a.amount);
  }, [filteredOrders, selectedCategory, products]);

  const handlePrintReport = () => {
    if (!config) return;

    const categoryName = selectedCategory === 'all' ? 'All Categories' : categories.find(c => c.id === selectedCategory)?.name || 'Unknown';

    if (activeTab === 'sales') {
      const descriptionLabel = (salesReportType === 'officer' && officerSubtype === 'dealer') ? "Dealer Name" : "Product Description";
      
      const html = generateReportHtml(
        `${salesReportType.charAt(0).toUpperCase() + salesReportType.slice(1)} Sales Report (${categoryName})`,
        entityName,
        salesReportData as any, 
        fromDate, 
        toDate, 
        config, 
        salesReportType === 'officer' && showCommission,
        reportComment,
        descriptionLabel
      );
      printDoc(html);
    } else {
      const html = generateReportHtml(
        `Dealer Performance Ranking (${categoryName})`,
        'All Dealers',
        { rows: dealerRankings.map(d => ({ name: d.name, qty: d.qty, amount: d.amount })), totalQty: dealerRankings.reduce((s, d) => s + d.qty, 0), totalAmount: dealerRankings.reduce((s, d) => s + d.amount, 0) }, 
        fromDate, 
        toDate, 
        config, 
        false,
        reportComment,
        "Dealer Name"
      );
      printDoc(html);
    }
  };

  return (
    <Layout>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-3 space-y-4 no-print">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
                <Filter className="w-4 h-4 mr-2" /> Report Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Date Range</Label>
                <div className="space-y-2">
                  <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-9 text-xs" />
                  <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-9 text-xs" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                  <Tags className="w-3 h-3" /> Category
                </Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {activeTab === 'sales' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Report Type</Label>
                    <Select value={salesReportType} onValueChange={(v: any) => { setSalesReportType(v); setSelectedEntity('all'); }}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dealer">Dealer Sales</SelectItem>
                        <SelectItem value="officer">Officer Sales</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {salesReportType === 'officer' && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Group By</Label>
                      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                        <Button 
                          variant={officerSubtype === 'product' ? 'secondary' : 'ghost'} 
                          size="sm" 
                          className="flex-1 h-7 text-[10px] font-bold uppercase"
                          onClick={() => setOfficerSubtype('product')}
                        >
                          <LayoutGrid className="w-3 h-3 mr-1" /> Product
                        </Button>
                        <Button 
                          variant={officerSubtype === 'dealer' ? 'secondary' : 'ghost'} 
                          size="sm" 
                          className="flex-1 h-7 text-[10px] font-bold uppercase"
                          onClick={() => setOfficerSubtype('dealer')}
                        >
                          <Users className="w-3 h-3 mr-1" /> Dealer
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">
                      Select {salesReportType === 'dealer' ? 'Dealer' : 'Officer'}
                    </Label>
                    {salesReportType === 'dealer' ? (
                      selectedDealer ? (
                        <div className="flex items-center justify-between bg-blue-50/50 border border-blue-100 p-2 rounded-xl">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 shrink-0 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-[10px]">
                              {selectedDealer.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">{selectedDealer.name}</div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400 hover:text-red-500 shrink-0" onClick={() => { setSelectedDealer(null); setSelectedEntity('all'); }}>
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
                            <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                              <button
                                type="button"
                                onClick={() => { setSelectedDealer(null); setSelectedEntity('all'); setDealerSearch(''); setDealerSuggestions([]); }}
                                className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 border-b font-bold"
                              >
                                All Dealers
                              </button>
                              {dealerSuggestions.map(d => (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => pickDealer(d)}
                                  className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 border-b last:border-0"
                                >
                                  <div className="font-bold">{d.name}</div>
                                  <div className="text-[9px] text-slate-500">{d.address}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Officers</SelectItem>
                          {officers.map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {salesReportType === 'officer' && (
                    <div className="flex items-center space-x-2 pt-1">
                      <Checkbox id="showComm" checked={showCommission} onCheckedChange={(v: any) => setShowCommission(v)} />
                      <Label htmlFor="showComm" className="text-[10px] font-bold uppercase text-slate-500 cursor-pointer">Show Commission</Label>
                    </div>
                  )}
                </>
              )}

              <div className="pt-2 border-t">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-between text-[10px] font-bold uppercase text-slate-500 h-8"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <span className="flex items-center gap-1.5"><Settings2 className="w-3 h-3" /> Advanced Options</span>
                  <ChevronRight className={cn("w-3 h-3 transition-transform", showAdvanced && "rotate-90")} />
                </Button>
                
                {showAdvanced && (
                  <div className="space-y-3 pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold uppercase text-slate-400">Category View</Label>
                      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                        <Button 
                          variant={categoryView === 'splitted' ? 'secondary' : 'ghost'} 
                          size="sm" 
                          className="flex-1 h-6 text-[9px] font-bold uppercase"
                          onClick={() => setCategoryView('splitted')}
                        >
                          Splitted
                        </Button>
                        <Button 
                          variant={categoryView === 'combined' ? 'secondary' : 'ghost'} 
                          size="sm" 
                          className="flex-1 h-6 text-[9px] font-bold uppercase"
                          onClick={() => setCategoryView('combined')}
                        >
                          Combined
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold uppercase text-slate-400 flex items-center gap-1">
                        <MessageSquare className="w-2.5 h-2.5" /> Print Comment
                      </Label>
                      <Textarea 
                        placeholder="Add a note to the report..." 
                        className="text-[10px] min-h-[60px] resize-none"
                        value={reportComment}
                        onChange={e => setReportComment(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <Button onClick={handlePrintReport} className="w-full bg-slate-900 gap-2 h-10 mt-4">
                <Printer className="w-4 h-4" /> Print Report
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-blue-50/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase text-blue-600">Quick Stats</span>
                <ChevronRight className="w-3 h-3 text-blue-400" />
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[9px] text-slate-500 uppercase">Total Qty</p>
                  <p className="text-lg font-black text-slate-900">{salesReportData.totalQty} Pcs</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase">Net Sales</p>
                  <p className="text-lg font-black text-blue-700">{formatNumber(salesReportData.totalAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-9 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-white p-1 border shadow-sm no-print">
              <TabsTrigger value="sales" className="gap-2"><FileText className="w-4 h-4" /> Sales Report</TabsTrigger>
              <TabsTrigger value="ranking" className="gap-2"><Trophy className="w-4 h-4" /> Dealer Ranking</TabsTrigger>
            </TabsList>
            
            <TabsContent value="sales" className="space-y-6">
              <Card className="border-none shadow-lg overflow-hidden print:shadow-none print:border">
                <CardHeader className="bg-slate-900 text-white py-6 print:bg-white print:text-black print:border-b-2 print:border-black">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400 print:text-slate-500">
                        {salesReportType} Sales Report {salesReportType === 'officer' && `(${officerSubtype}-wise)`}
                      </p>
                      <CardTitle className="text-xl font-black tracking-tight mt-1">
                        {entityName === 'all' ? 'All ' + salesReportType + 's' : entityName}
                      </CardTitle>
                      <p className="text-slate-400 text-[10px] mt-1 print:text-black">Period: {formatDisplayDate(fromDate)} to {formatDisplayDate(toDate)}</p>
                      <p className="text-slate-400 text-[10px] mt-1 print:text-black">Category: {selectedCategory === 'all' ? 'All' : categories.find(c => c.id === selectedCategory)?.name}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {salesReportData.isSplitted ? (
                    Object.entries(salesReportData.grouped!).map(([catName, group]) => (
                      <div key={catName} className="mb-8 last:mb-0">
                        <div className="bg-slate-100 px-6 py-2 border-y flex justify-between items-center">
                          <h4 className="text-[10px] font-black uppercase text-slate-600 tracking-widest">{catName}</h4>
                        </div>
                        <Table>
                          <TableBody>
                            {group.rows.map((r, i) => (
                              <TableRow key={i} className="hover:bg-slate-50/30 transition-colors">
                                <TableCell className="py-3 font-normal text-slate-900 text-xs w-[40%] pl-6">
                                  {r.name}
                                </TableCell>
                                <TableCell className="text-center font-normal text-slate-600 text-xs">{r.qty}</TableCell>
                                <TableCell className="text-right font-normal text-slate-900 text-xs">{formatNumber(r.amount)}</TableCell>
                                {salesReportType === 'officer' && showCommission && (
                                  <TableCell className="text-right font-normal text-orange-600 text-xs pr-6">{formatNumber(r.commission)}</TableCell>
                                )}
                              </TableRow>
                            ))}
                            <TableRow className="bg-slate-50/50">
                              <TableCell className="py-3 text-sm font-black uppercase text-slate-900 pl-6">SUBTOTAL</TableCell>
                              <TableCell className="text-center text-sm font-black text-blue-700">{group.subQty}</TableCell>
                              <TableCell className="text-right text-sm font-black text-slate-900">{formatNumber(group.subAmount)}</TableCell>
                              {salesReportType === 'officer' && showCommission && (
                                <TableCell className="text-right text-sm font-black text-orange-600 pr-6">{formatNumber(group.subCommission)}</TableCell>
                              )}
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    ))
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/50">
                          <TableHead className="text-[10px] font-bold uppercase py-4 pl-6">
                            {salesReportType === 'officer' && officerSubtype === 'dealer' ? 'Dealer Name' : 'Product Description'}
                          </TableHead>
                          <TableHead className="text-center text-[10px] font-bold uppercase">Qty</TableHead>
                          <TableHead className="text-right text-[10px] font-bold uppercase">Total Amount</TableHead>
                          {salesReportType === 'officer' && showCommission && (
                            <TableHead className="text-right text-[10px] font-bold uppercase pr-6">Commission</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesReportData.rows!.map((r, i) => (
                          <TableRow key={i} className="hover:bg-slate-50/30 transition-colors">
                            <TableCell className="py-3 font-normal text-slate-900 text-xs pl-6">
                              {r.name}
                            </TableCell>
                            <TableCell className="text-center font-normal text-slate-600 text-xs">{r.qty}</TableCell>
                            <TableCell className="text-right font-normal text-slate-900 text-xs">{formatNumber(r.amount)}</TableCell>
                            {salesReportType === 'officer' && showCommission && (
                              <TableCell className="text-right font-normal text-orange-600 text-xs pr-6">{formatNumber(r.commission)}</TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  
                  {((!salesReportData.isSplitted && salesReportData.rows!.length === 0) || (salesReportData.isSplitted && Object.keys(salesReportData.grouped!).length === 0)) && (
                    <div className="text-center py-12 text-slate-400">No data found for this selection.</div>
                  )}
                  
                  <div className="bg-slate-900 text-white border-t-2 border-slate-200">
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="py-4 text-sm font-black w-[40%] pl-6">GRAND TOTAL</TableCell>
                          <TableCell className="text-center text-sm font-black text-blue-400">{salesReportData.totalQty}</TableCell>
                          <TableCell className="text-right text-sm font-black">{formatNumber(salesReportData.totalAmount)}</TableCell>
                          {salesReportType === 'officer' && showCommission && (
                            <TableCell className="text-right text-sm font-black text-orange-400 pr-6">{formatNumber(salesReportData.totalCommission || 0)}</TableCell>
                          )}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ranking" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
                {dealerRankings.slice(0, 3).map((d, i) => (
                  <Card key={i} className={cn(
                    "border-none shadow-md relative overflow-hidden",
                    i === 0 ? "bg-slate-900 text-white" : "bg-white"
                  )}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded uppercase", i === 0 ? "bg-blue-500" : "bg-slate-100 text-slate-500")}>
                          Rank #{i + 1}
                        </span>
                        {i === 0 ? <Trophy className="w-4 h-4 text-yellow-400" /> : <Medal className="w-4 h-4 text-slate-300" />}
                      </div>
                      <CardTitle className="text-sm font-black truncate mt-2">{d.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={cn("text-xl font-black", i === 0 ? "text-blue-400" : "text-slate-900")}>{formatNumber(d.amount)}</div>
                      <p className="text-[9px] text-slate-400 uppercase mt-1">{d.qty} Products Sold</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-none shadow-sm">
                <CardHeader className="border-b">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Performance Ranking</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/30">
                        <TableHead className="text-[10px] font-bold uppercase pl-6">Rank</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Dealer Name</TableHead>
                        <TableHead className="text-center text-[10px] font-bold uppercase">Orders</TableHead>
                        <TableHead className="text-center text-[10px] font-bold uppercase">Qty</TableHead>
                        <TableHead className="text-right text-[10px] font-bold uppercase pr-6">Total Sales</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dealerRankings.map((d, i) => (
                        <TableRow key={i} className="hover:bg-slate-50/30 transition-colors">
                          <TableCell className="font-bold text-slate-400 text-xs pl-6">#{i + 1}</TableCell>
                          <TableCell className="font-bold text-slate-900 text-xs">{d.name}</TableCell>
                          <TableCell className="text-center text-xs">{d.orders}</TableCell>
                          <TableCell className="text-center font-black text-blue-600 text-xs">{d.qty}</TableCell>
                          <TableCell className="text-right font-black text-green-600 text-xs pr-6">{formatNumber(d.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default Reports;
