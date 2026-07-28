"use client";

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Customization, User, Officer } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { getTodayISO } from '@/utils/date';
import { Settings, Users, Trash2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const CustomizationPage = () => {
  const [config, setConfig] = useState<Customization | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [newUser, setNewUser] = useState<Partial<User>>({ role: 'member' });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [driveFolderLink, setDriveFolderLink] = useState('https://drive.google.com/drive/folders/1fHMRSYz2htngjpAsq8Mh73O7CGR5hyEn?usp=sharing');
  const allTabPermissions = [
    { path: '/', label: 'Dashboard' },
    { path: '/new-order', label: 'New Order' },
    { path: '/orders', label: 'Orders' },
    { path: '/invoices', label: 'Invoices' },
    { path: '/dealers', label: 'Dealers' },
    { path: '/balance', label: 'Dealer Balance' },
    { path: '/targets', label: 'Targets' },
    { path: '/rewards', label: 'Rewards' },
    { path: '/products', label: 'Products' },
    { path: '/retail-sales', label: 'Retail Sales' },
    { path: '/payments', label: 'Payments' },
    { path: '/stock-balance', label: 'Stock Balance' },
    { path: '/serial-search', label: 'Serial Search' },
    { path: '/officers', label: 'Officers' },
    { path: '/reports', label: 'Reports' },
    { path: '/customization', label: 'Customization' },
  ];
  const defaultMobileTabs = ['/', '/new-order', '/orders', '/invoices', '/balance'];
  const mobileTabCandidates = allTabPermissions;

  useEffect(() => {
    const loadData = async () => {
      setConfig(await api.getCustomization());
      setUsers(await api.getUsers() || []);
      setOfficers(await api.getOfficers() || []);
    };
    loadData();
  }, []);

  const handleSaveConfig = async () => {
    if (config) {
      await api.saveCustomization(config);
      showSuccess("Settings saved");
      window.location.reload();
    }
  };

  const getOfficerDisplayName = (id?: string) => {
    if (!id) return '-';
    const safeOfficers = Array.isArray(officers) ? officers : [];
    return safeOfficers.find(o => o && o.id === id)?.name || id;
  };

  const handleAddUser = async () => {
    if (!newUser.id || !newUser.email || !newUser.name || !newUser.password) return showError("Fill all fields");
    const allowedTabs = newUser.role === 'member' ? (newUser.allowedTabs || allTabPermissions.map(t => t.path)) : [];
    await api.saveUser({
      ...newUser,
      notificationsEnabled: true,
      allowedTabs,
      mobileQuickTabs: newUser.role === 'member'
        ? ((newUser.mobileQuickTabs?.length ? newUser.mobileQuickTabs : defaultMobileTabs).slice(0, 5))
        : defaultMobileTabs,
      officerId: newUser.officerId || undefined
    } as User);
    setUsers(await api.getUsers() || []);
    setNewUser({ role: 'member' });
    showSuccess("User created");
  };
  const updateUserMobileTabs = async (userId: string, path: string, enabled: boolean) => {
    const safeUsers = Array.isArray(users) ? users : [];
    const targetUser = safeUsers.find(u => u && u.id === userId);
    if (!targetUser) return;
    const currentTabs = targetUser.mobileQuickTabs?.length ? targetUser.mobileQuickTabs : defaultMobileTabs;
    const nextTabs = enabled
      ? Array.from(new Set([...currentTabs, path])).slice(0, 5)
      : currentTabs.filter(tabPath => tabPath !== path);
    await api.saveUser({ ...targetUser, mobileQuickTabs: nextTabs });
    setUsers(await api.getUsers() || []);
  };
  const saveEditedUser = async () => {
    if (!editingUser) return;
    await api.saveUser(editingUser);
    const isCurrent = api.getCurrentUser()?.id === editingUser.id;
    if (isCurrent) await api.login(editingUser.id, editingUser.password || '');
    setUsers(await api.getUsers() || []);
    setEditingUser(null);
    showSuccess("User updated");
  };
  const downloadBackup = () => {
    const payload = api.exportAllData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bicycle-backup-${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('Backup downloaded');
  };
  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    try {
      const parsed = JSON.parse(raw);
      const result = api.importAllData(parsed);
      if (!result.success) return showError(result.message || 'Import failed');
      showSuccess('Backup imported');
      window.location.reload();
    } catch {
      showError('Invalid backup file');
    }
  };
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !config) return;
    const reader = new FileReader();
    reader.onload = () => setConfig({ ...config, logo: String(reader.result || '') });
    reader.readAsDataURL(file);
  };

  if (!config) return null;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <Tabs defaultValue="general">
          <TabsList className="bg-white border shadow-sm p-1 rounded-xl mb-6 h-auto flex-wrap justify-start">
            <TabsTrigger value="general" className="gap-2"><Settings className="w-4 h-4" /> General Settings</TabsTrigger>
            <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> User Management</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Software Identity</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Software Title</Label><Input value={config.title} onChange={e => setConfig({...config, title: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Logo URL</Label><Input value={config.logo} onChange={e => setConfig({...config, logo: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Order Serial Initial Seed</Label>
                    <Input value={config.orderSerialSeed || 'R00001'} onChange={e => setConfig({ ...config, orderSerialSeed: e.target.value })} placeholder="R00035" />
                  </div>
                  <div className="space-y-2">
                    <Label>Quote Serial Initial Seed</Label>
                    <Input value={config.quoteSerialSeed || 'Q00001'} onChange={e => setConfig({ ...config, quoteSerialSeed: e.target.value })} placeholder="Q00010" />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Ref Initial Seed</Label>
                    <Input value={config.paymentReferenceSeed || 'P00001'} onChange={e => setConfig({ ...config, paymentReferenceSeed: e.target.value })} placeholder="P00040" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Or Upload Logo</Label>
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} />
                </div>
                <div className="space-y-2">
                  <Label>Custom Detail HTML (supports per-line link, bold, italic)</Label>
                  <Textarea
                    value={config.customDetailHtml || config.customDetailText || ''}
                    onChange={e => setConfig({ ...config, customDetailHtml: e.target.value, customDetailText: e.target.value })}
                    placeholder={'Example:\n<div><b>Line 1 Bold</b></div>\n<div><i>Line 2 Italic</i></div>\n<div><a href="https://example.com">Line 3 Link</a></div>'}
                  />
                  <div className="flex gap-4 text-xs">
                    <label className="flex items-center gap-2"><Checkbox checked={!!config.customDetailBold} onCheckedChange={(v: any) => setConfig({ ...config, customDetailBold: !!v })} />Bold</label>
                    <label className="flex items-center gap-2"><Checkbox checked={!!config.customDetailItalic} onCheckedChange={(v: any) => setConfig({ ...config, customDetailItalic: !!v })} />Italic</label>
                    <label className="flex items-center gap-2"><Checkbox checked={config.customDetailBoxed !== false} onCheckedChange={(v: any) => setConfig({ ...config, customDetailBoxed: !!v })} />Boxed</label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Sidebar Color</Label><Input type="color" value={config.sidebarColor} onChange={e => setConfig({...config, sidebarColor: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Main Theme Color</Label><Input type="color" value={config.mainColor} onChange={e => setConfig({...config, mainColor: e.target.value})} /></div>
                </div>
                <div className="border rounded-xl p-4 space-y-3">
                  <Label className="text-sm font-bold">Backup & Restore</Label>
                  <Input value={driveFolderLink} onChange={e => setDriveFolderLink(e.target.value)} />
                  <p className="text-xs text-slate-500">
                    Download daily JSON backup and import from file. For Google Drive auto-backup, provide an upload endpoint (Apps Script/Webhook) later.
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={downloadBackup}>Download Backup</Button>
                    <Button type="button" variant="outline" onClick={() => window.open(driveFolderLink, '_blank')}>Open Drive Folder</Button>
                    <Input type="file" accept=".json,application/json" onChange={importBackup} />
                  </div>
                </div>
                <Button onClick={handleSaveConfig} className="w-full bg-slate-900">Save Identity Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader><CardTitle className="text-sm font-bold uppercase">Create New User</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>User ID</Label><Input value={newUser.id || ''} onChange={e => setNewUser({...newUser, id: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Email</Label><Input value={newUser.email || ''} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="user@example.com" /></div>
                  <div className="space-y-2"><Label>Full Name</Label><Input value={newUser.name || ''} onChange={e => setNewUser({...newUser, name: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Password</Label><Input type="password" value={newUser.password || ''} onChange={e => setNewUser({...newUser, password: e.target.value})} /></div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={newUser.role} onValueChange={(v: any) => setNewUser({...newUser, role: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrator (Full Access)</SelectItem>
                        <SelectItem value="member">Member (Limited Access)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Officer Mapping (optional)</Label>
                    <Select value={newUser.officerId || '_none_'} onValueChange={(v: any) => setNewUser({ ...newUser, officerId: v === '_none_' ? undefined : v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose officer (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none_">None</SelectItem>
                        {officers.map(o => (
                          <SelectItem key={o.id} value={o.id}>{o.name} - {o.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">Choose an existing officer account for this user. This links the user to officer-owned dealer visibility.</p>
                  </div>
                  {newUser.role === 'member' && (
                    <div className="space-y-2">
                      <Label>Allowed Tabs</Label>
                      <div className="border rounded p-2 max-h-40 overflow-auto space-y-1">
                        {allTabPermissions.map(tab => (
                          <label key={tab.path} className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={(newUser.allowedTabs || []).includes(tab.path)}
                              onCheckedChange={(checked: any) => {
                                const tabs = newUser.allowedTabs || [];
                                setNewUser({
                                  ...newUser,
                                  allowedTabs: checked ? [...tabs, tab.path] : tabs.filter(t => t !== tab.path)
                                });
                              }}
                            />
                            {tab.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {newUser.role === 'member' && (
                    <div className="space-y-2">
                      <Label>Mobile Bottom Menu (max 5)</Label>
                      <div className="border rounded p-2 max-h-40 overflow-auto space-y-1">
                        {mobileTabCandidates.map(tab => (
                          <label key={tab.path} className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={(newUser.mobileQuickTabs?.length ? newUser.mobileQuickTabs : defaultMobileTabs).includes(tab.path)}
                              onCheckedChange={(checked: any) => {
                                const tabs = newUser.mobileQuickTabs?.length ? newUser.mobileQuickTabs : defaultMobileTabs;
                                const nextTabs = checked
                                  ? Array.from(new Set([...tabs, tab.path])).slice(0, 5)
                                  : tabs.filter(t => t !== tab.path);
                                setNewUser({ ...newUser, mobileQuickTabs: nextTabs });
                              }}
                            />
                            {tab.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button onClick={handleAddUser} className="w-full bg-slate-900 gap-2"><Plus className="w-4 h-4" /> Create User</Button>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-sm font-bold uppercase">System Users</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User ID</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Officer ID</TableHead>
                          <TableHead>Mobile Menu Tabs</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map(u => (
                        <TableRow key={u.id}>
                          <TableCell className="font-bold">{u.id}</TableCell>
                          <TableCell>{u.email || '-'}</TableCell>
                          <TableCell>{u.name}</TableCell>
                          <TableCell>
                            <Badge className={u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}>
                              {u.role.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>{getOfficerDisplayName(u.officerId)}</TableCell>
                          <TableCell>
                            {true ? (
                              <div className="flex flex-wrap gap-2">
                                {mobileTabCandidates.map(tab => (
                                  <label key={`${u.id}-${tab.path}`} className="flex items-center gap-1 text-[10px]">
                                    <Checkbox
                                      checked={(u.mobileQuickTabs?.length ? u.mobileQuickTabs : defaultMobileTabs).includes(tab.path)}
                                      onCheckedChange={(checked: any) => updateUserMobileTabs(u.id, tab.path, Boolean(checked))}
                                    />
                                    {tab.label}
                                  </label>
                                ))}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setEditingUser(u)}>Edit</Button>
                              <Button variant="ghost" size="icon" className="text-red-400" onClick={async () => { if(confirm('Delete?')) { await api.deleteUser(u.id); setUsers(await api.getUsers() || []); } }} disabled={u.id === 'admin'}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>User ID</Label>
                <Input value={editingUser.id} onChange={e => setEditingUser({ ...editingUser, id: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={editingUser.email || ''} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} placeholder="user@example.com" />
              </div>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Password</Label>
                <Input value={editingUser.password || ''} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Officer Mapping</Label>
                <Select value={editingUser.officerId || '_none_'} onValueChange={(v: any) => setEditingUser({ ...editingUser, officerId: v === '_none_' ? undefined : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose officer (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">None</SelectItem>
                    {officers.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name} - {o.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editingUser.role === 'member' && (
                <div className="space-y-2">
                  <Label>Mobile Bottom Menu (max 5)</Label>
                  <div className="border rounded p-2 max-h-40 overflow-auto space-y-1">
                    {mobileTabCandidates.map(tab => (
                      <label key={tab.path} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={(editingUser.mobileQuickTabs?.length ? editingUser.mobileQuickTabs : defaultMobileTabs).includes(tab.path)}
                          onCheckedChange={(checked: any) => {
                            const tabs = editingUser.mobileQuickTabs?.length ? editingUser.mobileQuickTabs : defaultMobileTabs;
                            const nextTabs = checked
                              ? Array.from(new Set([...tabs, tab.path])).slice(0, 5)
                              : tabs.filter(t => t !== tab.path);
                            setEditingUser({ ...editingUser, mobileQuickTabs: nextTabs });
                          }}
                        />
                        {tab.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <Button className="w-full" onClick={saveEditedUser}>Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default CustomizationPage;
