'use client';
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Package, ShoppingCart, Users } from 'lucide-react';
import DashboardTab from './_components/DashboardTab';
import InventoryTab from './_components/InventoryTab';
import CustomersTab from './_components/CustomersTab';
import SalesTab from './_components/SalesTab';
import ProfileMenu from './_components/ProfileMenu';

const NAV_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'inventory', icon: Package, label: 'Inventário' },
  { id: 'sales', icon: ShoppingCart, label: 'Vendas & PDV' },
  { id: 'customers', icon: Users, label: 'Clientes' },
];

const TAB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  inventory: 'Inventário',
  sales: 'Vendas & PDV',
  customers: 'Clientes',
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-black text-white p-6 flex flex-col hidden md:flex shrink-0">
        <div className="mb-10">
          <h1 className="text-2xl font-black italic tracking-tighter uppercase">HR STORE</h1>
          <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Admin Suite</p>
        </div>
        <nav className="space-y-2 flex-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-white text-black shadow-lg shadow-white/5'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <item.icon size={20} />
              <span className="font-semibold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{TAB_LABELS[activeTab] ?? activeTab}</h2>
          </div>
          <ProfileMenu />
        </header>

        {activeTab === 'dashboard' && <DashboardTab onNavigate={setActiveTab} />}
        {activeTab === 'inventory' && <InventoryTab />}
        {activeTab === 'sales' && <SalesTab />}
        {activeTab === 'customers' && <CustomersTab />}
      </main>
    </div>
  );
}

