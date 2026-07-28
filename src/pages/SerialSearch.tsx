"use client";

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Order, OrderItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, User, Calendar, MapPin, History, List, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const SerialSearch = () => {
  const [serial, setSerial] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [result, setResult] = useState<{ order: Order; item: OrderItem } | null>(null);
  const [searched, setSearched] = useState(false);
  const [allSerials, setAllSerials] = useState<string[]>([]);
  const [productsWithSerials, setProductsWithSerials] = useState<{ productName: string; version: string; serials: string[] }[]>([]);
  const [showProductList, setShowProductList] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setAllSerials(await api.getAllSerials());
      setProductsWithSerials(await api.getProductsWithSerials());
    };
    loadData();
  }, []);

  const handleInputChange = (val: string) => {
    setSerial(val);
    if (val.length > 1) {
      const filtered = (Array.isArray(allSerials) ? allSerials : []).filter(s => s && s.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleSearch = async (searchVal?: string) => {
    const finalVal = searchVal || serial;
    if (!finalVal) return;
    try {
      const found = await api.searchBySerial(finalVal);
      setResult(found);
      setSearched(true);
      setSuggestions([]);
      setSerial(finalVal);
    } catch (e) {
      console.error("Serial search error:", e);
      setSearched(true);
      setResult(null);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8 py-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Serial Number Lookup</h1>
          <p className="text-sm text-slate-500 font-medium">Track products and verify order details instantly</p>
        </div>

        <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-visible">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input 
                  placeholder="Enter Serial Number (e.g. SN123456)..." 
                  value={serial} 
                  onChange={e => handleInputChange(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleSearch()} 
                  className="h-14 pl-12 text-lg font-bold rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-inner"
                />
                {suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[100] mt-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b bg-slate-50">
                      <p className="text-[10px] font-black uppercase text-slate-400 px-2 tracking-widest">Recent Matches</p>
                    </div>
                    {suggestions.map(s => (
                      <button 
                        key={s} 
                        className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-blue-50 flex items-center gap-3 transition-colors"
                        onClick={() => handleSearch(s)}
                      >
                        <History className="w-4 h-4 text-slate-300" />
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={() => handleSearch()} className="h-14 px-8 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-slate-900/20 transition-all active:scale-95">
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
          <CardHeader 
            className="bg-slate-50 border-b py-4 px-6 cursor-pointer"
            onClick={() => setShowProductList(!showProductList)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-800 flex items-center text-sm font-black uppercase tracking-wider">
                <List className="w-5 h-5 text-slate-500 mr-3" />
                Products with Serial Numbers
              </CardTitle>
              {showProductList ? (
                <ChevronUp className="w-5 h-5 text-slate-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500" />
              )}
            </div>
          </CardHeader>
          {showProductList && (
            <CardContent className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              {productsWithSerials.map((product, index) => (
                <div key={index} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-black text-slate-900">{product.productName}</h4>
                      {product.version && (
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-xs">
                          {product.version}
                        </Badge>
                      )}
                    </div>
                    <Badge className="bg-slate-900 text-white text-xs">
                      {product.serials.length} Serials
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.serials.map((s) => (
                      <button
                        key={s}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all"
                        onClick={() => {
                          handleSearch(s);
                          setShowProductList(false);
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {productsWithSerials.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No products with serial numbers found.
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {searched && result ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
              <div className="bg-emerald-500 h-2 w-full" />
              <CardHeader className="bg-slate-50/50 border-b py-6 px-8">
                <CardTitle className="text-emerald-700 flex items-center text-xs font-black uppercase tracking-[0.2em]">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mr-3">
                    <Package className="w-5 h-5 text-emerald-600" />
                  </div>
                  Verified Product Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Product Name</p>
                    <p className="font-black text-2xl text-slate-900 leading-tight">{result.item.productName}</p>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 font-bold uppercase text-[10px] px-2 py-0.5 rounded-md border-blue-100">
                      {result.item.version}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Order Reference</p>
                    <div className="flex items-center gap-2">
                      <p className="font-black text-2xl text-slate-900">{result.order.id}</p>
                      <Badge className="bg-slate-900 text-white font-black text-[10px] uppercase">
                        {result.order.type}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Customer / Dealer</p>
                        <p className="font-black text-slate-800 text-lg">{result.order.customerName}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Dispatch Date</p>
                        <p className="font-black text-slate-800 text-lg">{result.order.date}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Origin Warehouse</p>
                        <p className="font-black text-slate-800 text-lg capitalize">{result.item.location}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-4">Batch Serial Numbers</p>
                  <div className="flex flex-wrap gap-2.5">
                    {result.item.serialNumbers?.map(s => (
                      <div 
                        key={s} 
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-black transition-all", 
                          s.toLowerCase() === serial.toLowerCase() 
                            ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-110 z-10" 
                            : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-white"
                        )}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : searched && (
          <div className="text-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-slate-100 animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-200" />
            </div>
            <h3 className="text-xl font-black text-slate-800">No Record Found</h3>
            <p className="text-slate-400 font-bold mt-1">Serial <span className="text-red-500">"{serial}"</span> does not match any orders.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SerialSearch;
