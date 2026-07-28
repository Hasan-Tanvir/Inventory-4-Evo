"use client";

import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { Customization, User, Notification } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, ShoppingCart, ClipboardList, Users, Package, BadgePercent, 
  CreditCard, Scale, Warehouse, Search, UserSquare2, BarChart3, Settings,
  FileText, Bell, LogOut, Target, Gift, Menu, CalendarDays
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [config, setConfig] = useState<Customization | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

  const themeStyle = config ? {
    '--main-color': config.mainColor,
    '--sidebar-color': config.sidebarColor,
  } as React.CSSProperties : undefined;

  useEffect(() => {
    const loadData = async () => {
      const currentUser = api.getCurrentUser();
      if (!currentUser) {
        navigate('/login');
        return;
      }
      setUser(currentUser);
      setConfig(await api.getConfig());
      const ns = await api.getNotifications(currentUser.id);
      setNotifications(Array.isArray(ns) ? ns : []);
      const memberTabs = currentUser.role === 'member' ? (currentUser.allowedTabs || []) : [];
      if (memberTabs.length > 0 && !memberTabs.includes(location.pathname)) {
        navigate(memberTabs[0]);
      }
    };
    loadData();
  }, [navigate, location.pathname]);

  if (!config || !user) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-slate-500 font-semibold">Loading...</p>
      </div>
    </div>
  );

  const menuItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'member'] },
    { label: 'New Order', path: '/new-order', icon: ShoppingCart, roles: ['admin', 'member'] },
    { label: 'Orders', path: '/orders', icon: ClipboardList, roles: ['admin', 'member'] },
    { label: 'Quotations', path: '/quotes', icon: FileText, roles: ['admin', 'member'] },
    { label: 'Invoices', path: '/invoices', icon: FileText, roles: ['admin', 'member'] },
    { label: 'Dealers', path: '/dealers', icon: Users, roles: ['admin', 'member'] },
    { label: 'Dealer Balance', path: '/balance', icon: Scale, roles: ['admin', 'member'] },
    { label: 'Calendar', path: '/calendar', icon: CalendarDays, roles: ['admin', 'member'] },
    { label: 'Targets', path: '/targets', icon: Target, roles: ['admin'] },
    { label: 'Rewards', path: '/rewards', icon: Gift, roles: ['admin'] },
    { label: 'Products', path: '/products', icon: Package, roles: ['admin'] },
    { label: 'Retail Sales', path: '/retail-sales', icon: BadgePercent, roles: ['admin'] },
    { label: 'Payments', path: '/payments', icon: CreditCard, roles: ['admin'] },
    { label: 'Stock Balance', path: '/stock-balance', icon: Warehouse, roles: ['admin'] },
    { label: 'Serial Search', path: '/serial-search', icon: Search, roles: ['admin', 'member'] },
    { label: 'Officers', path: '/officers', icon: UserSquare2, roles: ['admin'] },
    { label: 'Reports', path: '/reports', icon: BarChart3, roles: ['admin'] },
    { label: 'Customization', path: '/customization', icon: Settings, roles: ['admin'] },
  ];

  const filteredMenu = menuItems.filter(item => {
    if (!item.roles.includes(user.role)) return false;
    if (user.role !== 'member') return true;
    if (!user.allowedTabs || user.allowedTabs.length === 0) return true;
    return user.allowedTabs.includes(item.path);
  });

  const defaultMobileQuickPaths = ['/', '/new-order', '/orders', '/invoices', '/balance'];
  const mobileQuickPaths = user.mobileQuickTabs?.length ? user.mobileQuickTabs : defaultMobileQuickPaths;
  // Build mobile menu with prioritized paths, filling with defaults if needed
  let mobileQuickMenu: typeof menuItems = [];
  // First add items from selected paths that are in filtered menu
  mobileQuickPaths.forEach(path => {
    const item = filteredMenu.find(i => i.path === path);
    if (item && !mobileQuickMenu.some(m => m.path === item.path)) {
      mobileQuickMenu.push(item);
    }
  });
  // If we don't have 5 items yet, fill with defaults in order
  if (mobileQuickMenu.length < 5) {
    defaultMobileQuickPaths.forEach(path => {
      const item = filteredMenu.find(i => i.path === path);
      if (item && !mobileQuickMenu.some(m => m.path === item.path)) {
        mobileQuickMenu.push(item);
      }
    });
  }
  // Still not enough? Add any available menu items
  if (mobileQuickMenu.length < 5) {
    filteredMenu.forEach(item => {
      if (!mobileQuickMenu.some(m => m.path === item.path)) {
        mobileQuickMenu.push(item);
      }
    });
  }
  // Take only first 5
  mobileQuickMenu = mobileQuickMenu.slice(0, 5);
  const unreadCount = notifications.filter(n => !n.read).length;
  const shouldHideMobileSidebar = user.role === 'member' && filteredMenu.length < 6;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" style={themeStyle}>
      <div 
        className="w-64 flex-shrink-0 text-white transition-all duration-300 shadow-xl z-20 hidden lg:flex flex-col"
        style={{ backgroundColor: config.sidebarColor || '#4169E1' }}
      >
        
        <nav className="flex-1 mt-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredMenu.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 group",
                location.pathname === item.path 
                  ? "bg-white/10 text-white shadow-lg" 
                  : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className={cn("w-4 h-4", location.pathname === item.path ? "text-blue-400" : "text-white/30 group-hover:text-white/60")} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-black">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[10px] font-black truncate">{user.name}</p>
              <p className="text-[8px] font-bold uppercase opacity-40">{user.role}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { api.logout(); navigate('/login'); }} className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-8 shadow-sm z-10">
          <div className="flex items-center gap-2">
            {!shouldHideMobileSidebar && <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <div className="h-full flex flex-col" style={{ backgroundColor: config.sidebarColor }}>
                  <div className="p-4 text-white border-b border-white/10">
                    <h1 className="text-xs font-black uppercase tracking-wider">{config.title}</h1>
                  </div>
                  <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                    {filteredMenu.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold",
                          location.pathname === item.path ? "bg-white/10 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                        )}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="p-3 border-t border-white/10">
                    <Button variant="ghost" onClick={() => { api.logout(); navigate('/login'); }} className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
                      <LogOut className="w-4 h-4 mr-2" /> Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>}
            <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider sm:tracking-widest">
              {menuItems.find(i => i.path === location.pathname)?.label || 'Page'}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <p className="text-[11px] sm:text-xs font-bold text-slate-600">
              Hello, {user.name}
            </p>            <Button variant="ghost" size="icon" onClick={() => { api.logout(); navigate('/login'); }} className="h-10 w-10 rounded-xl hover:bg-slate-50 lg:hidden">
              <LogOut className="w-5 h-5 text-slate-400" />
            </Button>            <Popover onOpenChange={async (open) => {
              if (open && unreadCount > 0) {
                await api.markNotificationsRead(user.id);
                const ns = await api.getNotifications(user.id);
                setNotifications(Array.isArray(ns) ? ns : []);
              }
            }}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl hover:bg-slate-50">
                  <Bell className="w-5 h-5 text-slate-400" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 border-none shadow-2xl" align="end">
                <div className="p-4 border-b bg-slate-50 rounded-t-xl flex justify-between items-center">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">Notifications</p>
                  {notifications.length > 0 && (
                    <Button 
                      variant="ghost" 
                      className="h-6 px-2 text-[10px] font-black uppercase text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        await api.clearAllNotifications(user.id);
                        setNotifications([]);
                      }}
                    >
                      Clear All
                    </Button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? [...notifications].sort((a, b) => {
                    const aTime = a && a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const bTime = b && b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime);
                  }).map(n => (
                    <div key={n.id} className={cn("p-4 border-b hover:bg-slate-50 transition-colors cursor-pointer", !n.read && "bg-blue-50/30")}>
                      <p className="text-xs font-bold text-slate-800">{n.title}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{n.message}</p>
                      <p className="text-[8px] text-slate-400 mt-2 uppercase font-bold">
                        {n.timestamp ? `${new Date(n.timestamp).toLocaleDateString('en-GB')} ${new Date(n.timestamp).toLocaleTimeString()}` : 'No date'}
                      </p>
                    </div>
                  )) : (
                    <div className="p-8 text-center text-slate-400 text-xs italic">No notifications</div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-4 pb-24 lg:pb-6 bg-slate-50/50">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
      {/* Mobile quick bar: can be hidden by adding 'hide-mobile-bottom-bar' to document.body */}
      <div className="mobile-quick-bar lg:hidden fixed bottom-0 left-0 right-0 z-[100] border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="grid grid-cols-5 gap-1 px-1 py-2">
          {mobileQuickMenu.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg py-1.5 text-[10px] font-bold transition-colors",
                location.pathname === item.path ? "text-blue-600 bg-blue-50" : "text-slate-500"
              )}
            >
              <item.icon className={cn("w-4 h-4 mb-1", location.pathname === item.path ? "text-blue-600" : "text-slate-400")} />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
      
    </div>
  );
};

export default Layout;
