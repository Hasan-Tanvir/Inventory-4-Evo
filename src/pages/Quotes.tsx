"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Order, User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Edit, Trash2, List, LayoutGrid, Eye, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { showSuccess } from '@/utils/toast';
import { formatDisplayDate } from '@/utils/date';
import { cn } from '@/lib/utils';
import { generateInvoiceHtml } from '@/utils/invoice-generator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const Quotes = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [historyView, setHistoryView] = useState<'table' | 'cards'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'cards' : 'table'
  );
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const allOrders = await api.getOrders();
      setOrders(allOrders.filter(o => o.isQuote));
      setUser(api.getCurrentUser());
    };
    loadData();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this quotation?")) {
      await api.deleteOrder(id);
      const allOrders = await api.getOrders();
      setOrders(allOrders.filter(o => o.isQuote));
      showSuccess("Quotation deleted");
    }
  };

  const filtered = orders.filter(o => 
    (o && o.customerName && o.customerName.toLowerCase().includes(search.toLowerCase())) || 
    (o && o.id && o.id.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    // Secondary sort by ID descending (numeric)
    return b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' });
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Quotations
          </h1>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search quotes..." 
              className="pl-10 h-10 rounded-xl" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">Quotation History</CardTitle>
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
                  <TableHead className="text-[10px] font-black uppercase">Quote ID</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Customer</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Type</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Inventory</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Amount</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-bold text-slate-900 py-2.5">{o.id}</TableCell>
                    <TableCell>
                      <div className="font-bold text-slate-800">{o.customerName}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{formatDisplayDate(o.date)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-bold uppercase">
                        {o.type === 'retail' ? 'Retail' : 'Dealer'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-bold uppercase">
                        {o.inventorySource === 'chittagong' ? 'CTG' : o.inventorySource || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-black text-slate-900 whitespace-nowrap">{o.netTotal.toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setInvoiceOrder(o)}><Eye className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => navigate(`/new-order?edit=${o.id}`)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-red-400" onClick={() => handleDelete(o.id)}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-slate-400 text-xs font-bold uppercase">No quotations found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
            <div className={cn("p-3 space-y-2 sm:hidden", historyView === 'cards' ? "block" : "hidden")}>
              {filtered.map((o) => (
                <div key={o.id} className="rounded-xl border bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-slate-900">{o.id}</p>
                    <p className="text-[10px] text-slate-500">{formatDisplayDate(o.date)}</p>
                  </div>
                  <p className="text-xs font-semibold">{o.customerName}</p>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase">{o.type}</Badge>
                    <span className="text-xs font-black text-slate-900">{o.netTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="h-8" onClick={() => setInvoiceOrder(o)}><Eye className="w-3.5 h-3.5 mr-1" /> View</Button>
                    <Button variant="outline" size="sm" className="h-8" onClick={() => navigate(`/new-order?edit=${o.id}`)}><Edit className="w-3.5 h-3.5 mr-1" /> Edit</Button>
                    <Button variant="outline" size="sm" className="h-8 text-red-500" onClick={() => handleDelete(o.id)}><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!invoiceOrder} onOpenChange={() => setInvoiceOrder(null)}>
        <DialogContent className="max-w-full max-h-[90vh] overflow-auto p-0">
          <DialogHeader>
            <DialogTitle>Quotation Preview</DialogTitle>
          </DialogHeader>
          {invoiceOrder && (
            <div className="p-4 bg-white border rounded min-w-full overflow-auto">
              <div className="mx-auto w-[210mm] origin-top md:scale-100 scale-[0.55]">
                <div dangerouslySetInnerHTML={{ __html: generateInvoiceHtml(invoiceOrder, true, api.getConfig()) }} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Quotes;
