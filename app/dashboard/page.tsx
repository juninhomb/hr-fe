'use client';
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Package, ShoppingCart, Users, Bell, 
  Plus, TrendingUp, AlertCircle, ArrowRight, RefreshCw, MoreHorizontal 
} from 'lucide-react';
import api from '../../lib/api';

export default function FullAppPrototype() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const res = await api.get('/dashboard/stats');
        setStats(res.data);
      } else if (activeTab === 'inventory') {
        const res = await api.get('/products');
        setProducts(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-black text-white p-6 flex flex-col hidden md:flex shrink-0">
        <div className="mb-10 text-center md:text-left">
          <h1 className="text-2xl font-black italic tracking-tighter uppercase">HR STORE</h1>
          <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Admin Suite</p>
        </div>

        <nav className="space-y-2 flex-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'inventory', icon: Package, label: 'Inventário' },
            { id: 'sales', icon: ShoppingCart, label: 'Vendas & PDV' },
            { id: 'customers', icon: Users, label: 'Clientes' },
          ].map((item) => (
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

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight capitalize">{activeTab}</h2>
            <p className="text-zinc-500 text-sm">Sincronizado com o Banco PostgreSQL</p>
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={fetchData} className={`p-2 bg-white rounded-full shadow-sm border border-gray-100 ${loading ? 'animate-spin' : ''}`}>
              <RefreshCw size={20} />
            </button>
            <div className="h-10 w-10 rounded-full bg-zinc-900 flex items-center justify-center font-bold text-white">HR</div>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in">
            <StatCard label="Faturamento Hoje" value={stats?.revenue_today ? `€ ${Number(stats.revenue_today).toFixed(2)}` : "€ 0.00"} icon={TrendingUp} trend="Hoje" color="text-emerald-500" bg="bg-emerald-50" />
            <StatCard label="Pedidos Hoje" value={stats?.sales_today || "0"} icon={ShoppingCart} trend="Vendas" color="text-blue-500" bg="bg-blue-50" />
            <StatCard label="Stock Baixo" value={stats?.low_stock_count || "0"} icon={AlertCircle} trend="Atenção" color="text-red-500" bg="bg-red-50" />
            <StatCard label="Total Clientes" value={stats?.total_customers || "0"} icon={Users} trend="Base" color="text-purple-500" bg="bg-purple-50" />
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-xl">Inventário Completo</h3>
              <button className="bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center space-x-2">
                <Plus size={18} />
                <span>Novo Item</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 text-[10px] uppercase font-bold text-zinc-400">
                  <tr>
                    <th className="px-8 py-5 text-black">Produto / Variação</th>
                    <th className="px-8 py-5 text-black">SKU</th>
                    <th className="px-8 py-5 text-black text-right">Preço</th>
                    <th className="px-8 py-5 text-black text-center">Stock</th>
                    <th className="px-8 py-5 text-black text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/30 transition group">
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-black">{item.name || 'Produto Base'}</span>
                          <span className="text-[10px] text-zinc-400 uppercase font-medium">{item.color} | {item.size}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <code className="text-[11px] bg-zinc-100 px-2 py-1 rounded font-bold text-zinc-600">{item.sku}</code>
                      </td>
                      <td className="px-8 py-5 text-sm font-mono text-right font-black text-black">
                        € {Number(item.price || 0).toFixed(2)}
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[11px] font-black ${
                          Number(item.stock) <= 5 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {item.stock} UN.
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center text-zinc-300">
                        <button className="hover:text-black transition"><MoreHorizontal size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, trend, color, bg }: any) {
  return (
    <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${bg} ${color} group-hover:scale-110 transition-transform`}>
          <Icon size={22} />
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${bg} ${color}`}>{trend}</span>
      </div>
      <div>
        <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}