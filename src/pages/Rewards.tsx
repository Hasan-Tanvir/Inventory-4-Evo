"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Officer, TargetReward } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { showError, showSuccess } from '@/utils/toast';
import { formatDisplayDate, getTodayISO } from '@/utils/date';

const Rewards = () => {
  const [rewards, setRewards] = useState<TargetReward[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [editingReward, setEditingReward] = useState<TargetReward | null>(null);
  const [editOfficerId, setEditOfficerId] = useState('');
  const [editAmount, setEditAmount] = useState<number | string>('');
  const [editDate, setEditDate] = useState(getTodayISO());
  const [editNote, setEditNote] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setRewards(await api.getTargetRewards() || []);
      setOfficers(await api.getOfficers() || []);
    };
    loadData();
  }, []);

  const sortedRewards = useMemo(
    () => [...rewards].sort((a, b) => b.date.localeCompare(a.date)),
    [rewards]
  );

  const openEdit = (reward: TargetReward) => {
    setEditingReward(reward);
    setEditOfficerId(reward.officerId || 'none');
    setEditAmount(reward.amount);
    setEditDate(reward.date || getTodayISO());
    setEditNote(reward.note || '');
  };

  const handleUpdateReward = async () => {
    if (!editingReward) return;
    const result = await api.updateTargetReward(editingReward.id, {
      officerId: editOfficerId === 'none' ? undefined : editOfficerId,
      amount: Number(editAmount || 0),
      date: editDate,
      note: editNote
    });
    if (!result || (result as any).success === false) return showError((result as any).message || 'Failed to update reward');
    setRewards(await api.getTargetRewards() || []);
    setEditingReward(null);
    showSuccess('Dealer reward updated');
  };

  const handleUndo = async (rewardId: string) => {
    if (!confirm('Undo this reward? Dealer balance and target cycle will be reverted.')) return;
    const result = await api.undoTargetReward(rewardId);
    if (!result || (result as any).success === false) return showError((result as any).message || 'Failed to undo reward');
    setRewards(await api.getTargetRewards() || []);
    showSuccess('Reward undone');
  };

  return (
    <Layout>
      <div className="space-y-6">
        <Card className="border-none shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">
              Reward Ledger
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[70vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/30">
                    <TableHead className="text-xs font-bold uppercase">Ref</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Target</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Dealer</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Officer</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Date</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Cycles</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Amount</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Status</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRewards.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-black">{r.rewardRef}</TableCell>
                      <TableCell className="text-xs">{r.targetName}</TableCell>
                      <TableCell className="text-xs">{r.dealerName}</TableCell>
                      <TableCell className="text-xs">{r.officerName || '-'}</TableCell>
                      <TableCell className="text-xs">{formatDisplayDate(r.date)}</TableCell>
                      <TableCell className="text-xs">{r.cycles}</TableCell>
                      <TableCell className="text-xs font-bold">{r.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-xs uppercase font-bold">{r.status}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px]"
                          disabled={r.status !== 'active'}
                          onClick={() => openEdit(r)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-[10px]"
                          disabled={r.status !== 'active'}
                          onClick={() => handleUndo(r.id)}
                        >
                          Undo
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedRewards.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-xs text-slate-400 py-8">
                        No reward history found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingReward} onOpenChange={(open) => !open && setEditingReward(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Dealer Reward</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-500">Officer</Label>
              <Select value={editOfficerId} onValueChange={setEditOfficerId}>
                <SelectTrigger><SelectValue placeholder="Select officer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Officer</SelectItem>
                  {officers.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-500">Amount</Label>
              <Input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-500">Date</Label>
              <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-500">Note</Label>
              <Input value={editNote} onChange={e => setEditNote(e.target.value)} />
            </div>
            <Button className="w-full bg-slate-900" onClick={handleUpdateReward}>Update Reward</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Rewards;
