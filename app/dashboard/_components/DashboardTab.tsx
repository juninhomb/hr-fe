'use client';
import React, { useState, useEffect } from 'react';
import { TrendingUp, ShoppingCart, AlertCircle, Users, RefreshCw } from 'lucide-react';
import api from '../../../lib/api';

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

export default function DashboardTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Erro ao carregar stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  return (
    <div className="animate-in fade-in">
      <div className="flex justify-end mb-6">
        <button
          onClick={fetchStats}
          className={`p-2 bg-white rounded-full shadow-sm border border-gray-100 ${loading ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Faturamento Hoje" value={stats?.revenue_today ? `€ ${Number(stats.revenue_today).toFixed(2)}` : '€ 0.00'} icon={TrendingUp} trend="Hoje" color="text-emerald-500" bg="bg-emerald-50" />
        <StatCard label="Pedidos Hoje" value={stats?.sales_today || '0'} icon={ShoppingCart} trend="Vendas" color="text-blue-500" bg="bg-blue-50" />
        <StatCard label="Stock Baixo" value={stats?.low_stock_count || '0'} icon={AlertCircle} trend="Atenção" color="text-red-500" bg="bg-red-50" />
        <StatCard label="Total Clientes" value={stats?.total_customers || '0'} icon={Users} trend="Base" color="text-purple-500" bg="bg-purple-50" />
      </div>
    </div>
  );
}
