"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Officer } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { showSuccess, showError } from '@/utils/toast';
import { Eye } from 'lucide-react';
import { generateInvoiceHtml, printDoc } from '@/utils/invoice-generator';
import OrderItemsGrid from '@/components/OrderItemsGrid';

const Officers = () => {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [tab, setTab] = useState<'officers' | 'tokens'>('officers');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({ name: '', designation: '' });
  const [editToken, setEditToken] = useState<any | null>(null);
  const [filterOfficer, setFilterOfficer] = useState('all');
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);

  const load = async () => {
    const [o, t, s] = await Promise.all([
      api.getOfficers(),
      api.getCommissionTokens(),
      api.getCustomization()
    ]);
    setOfficers(o || []);
    setSettings(s);
    const sortedTokens = (t || []).sort((a: any, b: any) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return (b.id || '').localeCompare(a.id || '');
    });
    setTokens(sortedTokens);
  };

  const viewInvoice = async (orderId: string) => {
    const order = await api.getOrder(orderId);
    if (!order) return showError('Order not found');
    setViewingOrder(order);
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setForm({ name: '', designation: '' });
    setModal(true);
  };

  const openEdit = (o: Officer) => {
    setForm({ ...o });
    setModal(true);
  };

  const save = async () => {
    if (!form.name?.trim()) return showError('Officer name is required');

    const officerId = form.id || `OFF-${Date.now()}`;
    const existing = officers.find(o => o.id === officerId);
    await api.saveOfficer({
      id: officerId,
      name: form.name.trim(),
      designation: form.designation || '',
      phone: existing?.phone || form.phone || '',
      commissionBalance: existing?.commissionBalance || form.commissionBalance || 0,
      clearanceHistory: existing?.clearanceHistory || form.clearanceHistory || [],
      commissionTokens: existing?.commissionTokens || form.commissionTokens || []
    });

    setModal(false);
    await load();
    showSuccess('Officer saved');
  };

  const del = async (id: string) => {
    if (!confirm('Delete officer?')) return;
    await api.deleteOfficer(id);
    await load();
  };

  const disburse = async (token: any) => {
    if (!confirm(`Mark ${token.amount.toLocaleString()} as disbursed to ${token.officerName}?`)) return;
    await api.disburseCommissionToken(token.officerId, token.id);
    await load();
  };

  const undoDisburse = async (token: any) => {
    if (!confirm('Undo disbursement?')) return;
    await api.undoCommissionTokenDisbursement(token.officerId, token.id);
    await load();
  };

  const saveEditToken = async () => {
    await api.updateCommissionToken(editToken.officerId, editToken.id, {
      amount: Number(editToken.amount) || 0
    });
    setEditToken(null);
    await load();
  };

  const deleteToken = async (token: any) => {
    if (!confirm('Delete this token?')) return;
    await api.deleteCommissionToken(token.officerId, token.id);
    await load();
  };

  const filtered = filterOfficer === 'all' ? (Array.isArray(tokens) ? tokens : []) : (Array.isArray(tokens) ? tokens : []).filter(t => t && t.officerId === filterOfficer);
  const pendingTotal = filtered.filter(t => t && t.status === 'pending').reduce((s, t) => s + (t.amount || 0), 0);
  const disbursedTotal = filtered.filter(t => t && t.status === 'disbursed').reduce((s, t) => s + (t.amount || 0), 0);

  const officerSummary = useMemo(() => (Array.isArray(officers) ? officers : []).map(o => {
    if (!o) return null;
    const safeTokens = Array.isArray(tokens) ? tokens : [];
    const oTokens = safeTokens.filter(t => t && t.officerId === o.id);
    const pending = oTokens.filter(t => t && t.status === 'pending').reduce((s, t) => s + (t.amount || 0), 0);
    const disbursed = oTokens.filter(t => t && t.status === 'disbursed').reduce((s, t) => s + (t.amount || 0), 0);
    return { ...o, pendingCommission: pending, disbursedCommission: disbursed, tokenCount: oTokens.length };
  }).filter(Boolean), [officers, tokens]);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Officers</h1>
          {tab === 'officers' && <Button onClick={openAdd}>+ Add Officer</Button>}
        </div>

        <div className="flex gap-1 bg-white rounded-lg shadow-sm p-1 w-fit">
          <button onClick={() => setTab('officers')} className={`px-4 py-2 rounded text-sm font-medium ${tab === 'officers' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>Officers</button>
          <button onClick={() => setTab('tokens')} className={`px-4 py-2 rounded text-sm font-medium ${tab === 'tokens' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>Commission Tokens</button>
        </div>

        {tab === 'officers' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(Array.isArray(officerSummary) ? officerSummary : []).map(o => (
              <Card key={o?.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{o?.name}</CardTitle>
                  <p className="text-xs text-slate-500">{o?.designation}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-amber-50 p-2 rounded text-center text-xs">Pending: {(o?.pendingCommission || 0).toLocaleString()}</div>
                    <div className="bg-green-50 p-2 rounded text-center text-xs">Disbursed: {(o?.disbursedCommission || 0).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(o)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => del(o?.id)}>Del</Button>
                    {!!o?.tokenCount && <Button size="sm" variant="ghost" onClick={() => { setFilterOfficer(o?.id); setTab('tokens'); }}>Tokens</Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {tab === 'tokens' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <select value={filterOfficer} onChange={e => setFilterOfficer(e.target.value)} className="border rounded px-2 py-1">
                <option value="all">All Officers</option>
                {(Array.isArray(officers) ? officers : []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <div className="ml-auto text-sm">Pending: {pendingTotal.toLocaleString()} | Disbursed: {disbursedTotal.toLocaleString()}</div>
            </div>
            {(Array.isArray(filtered) ? filtered : []).map(token => (
              <div key={token?.id} className={`bg-white rounded-xl border-l-4 p-4 ${token?.status === 'disbursed' ? 'border-green-400' : 'border-amber-400'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{token?.officerName} <span className="text-xs text-slate-500">#{token?.orderId}</span></p>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => viewInvoice(token.orderId)}>
                        <Eye className="w-3 h-3 text-slate-400" />
                      </Button>
                    </div>
                    {token?.dealerName && <p className="text-xs font-semibold text-blue-600 mt-0.5">{token.dealerName}</p>}
                    <p className="text-xs text-slate-500">Token: {token?.date}</p>
                    {token?.status === 'disbursed' && token?.disbursedDate && (
                      <p className="text-xs text-green-600 font-medium">Disbursed: {token?.disbursedDate}</p>
                    )}
                  </div>
                  <p className="font-bold text-amber-700">{(token?.amount || 0).toLocaleString()}</p>
                </div>
                <div className="mt-2 flex gap-2">
                  {token?.status === 'pending' ? (
                    <Button size="sm" onClick={() => disburse(token)}>Disburse</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => undoDisburse(token)}>Undo</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setEditToken(token)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteToken(token)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={modal} onOpenChange={setModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? 'Edit' : 'Add'} Officer</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Designation</Label><Input value={form.designation || ''} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} /></div>
              <Button onClick={save}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editToken} onOpenChange={(open) => !open && setEditToken(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Commission Token</DialogTitle></DialogHeader>
            {editToken && (
              <div className="space-y-3">
                <div><Label>Amount</Label><Input type="number" value={editToken.amount} onChange={e => setEditToken((t: any) => ({ ...t, amount: e.target.value }))} /></div>
                <Button onClick={saveEditToken}>Save</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewingOrder} onOpenChange={(open) => !open && setViewingOrder(null)}>
          <DialogContent className="max-w-full max-h-[90vh] overflow-auto p-0">
            <DialogHeader className="p-4 border-b">
              <DialogTitle className="flex justify-between items-center w-full pr-8">
                <span className="text-sm font-black uppercase tracking-tight">Invoice: {viewingOrder?.id}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-slate-500">{viewingOrder?.customerName}</span>
                  <span className="text-sm font-black text-blue-600">{viewingOrder?.netTotal?.toLocaleString()}</span>
                </div>
              </DialogTitle>
            </DialogHeader>
            {viewingOrder && (
              <div className="p-4 bg-white border rounded min-w-full overflow-auto">
                <div className="mx-auto w-[210mm] origin-top md:scale-100 scale-[0.55]">
                  <div dangerouslySetInnerHTML={{ __html: generateInvoiceHtml(viewingOrder, false, settings) }} />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Officers;
