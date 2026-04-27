'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, ShoppingCart, AlertCircle, Users, RefreshCw,
  Clock, Package, Euro, ArrowRight, MessageCircle, Store, Globe,
  Crown, Phone,
} from 'lucide-react';
import api from '../../../lib/api';

// =============================================================
// Tipos
// =============================================================
type TabId = 'dashboard' | 'inventory' | 'sales' | 'customers';

type DashboardStats = {
  sales_today: number;
  revenue_today: number;
  revenue_7d: number;
  revenue_30d: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_customers: number;
  pending_count: number;
  pending_value: number;
  total_stock: number;
  total_products: number;
  revenue_series: { dia: string; revenue: number; orders_count: number }[];
  top_products: { name: string; qty_sold: number; revenue: number }[];
  sales_by_origin: { origin: string; count: number; revenue: number }[];
  low_stock: { sku: string; color?: string; size?: string; stock_quantity: number; name?: string }[];
  recent_pending: {
    id: number; total_amount: number; origin: string;
    created_at: string; full_name?: string; whatsapp_number?: string;
  }[];
  top_customers: {
    id: number; full_name?: string; whatsapp_number?: string;
    orders_count: number; total_spent: number;
  }[];
};

// =============================================================
// Componente principal
// =============================================================
export default function DashboardTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
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

  const go = (tab: TabId) => onNavigate?.(tab);

  return (
    <div className="animate-in fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500">Visão geral do negócio em tempo real.</p>
        </div>
        <button
          onClick={fetchStats}
          className={`p-2 bg-white rounded-full shadow-sm border border-gray-100 hover:border-black transition ${loading ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* KPI cards (clicáveis) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard
          label="Faturamento Hoje"
          value={`€ ${Number(stats?.revenue_today || 0).toFixed(2)}`}
          icon={TrendingUp}
          tone="emerald"
          subtitle={stats ? `7 dias: € ${Number(stats.revenue_7d).toFixed(2)}` : ''}
          onClick={() => go('sales')}
        />
        <KpiCard
          label="Pedidos Hoje"
          value={String(stats?.sales_today ?? '0')}
          icon={ShoppingCart}
          tone="blue"
          subtitle="Ver vendas →"
          onClick={() => go('sales')}
        />
        <KpiCard
          label="Stock Crítico"
          value={String((stats?.low_stock_count ?? 0) + (stats?.out_of_stock_count ?? 0))}
          icon={AlertCircle}
          tone={((stats?.low_stock_count ?? 0) + (stats?.out_of_stock_count ?? 0)) > 0 ? 'red' : 'zinc'}
          subtitle={
            stats
              ? `${stats.out_of_stock_count} esgotadas · ${stats.low_stock_count} com 1 un.`
              : 'A carregar…'
          }
          onClick={() => go('inventory')}
        />
        <KpiCard
          label="Total Clientes"
          value={String(stats?.total_customers ?? '0')}
          icon={Users}
          tone="purple"
          subtitle="Ver clientes →"
          onClick={() => go('customers')}
        />
      </div>

      {/* Quick links secundários */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickStat
          icon={Clock}
          label="Pendentes"
          value={String(stats?.pending_count ?? 0)}
          extra={stats ? `€ ${Number(stats.pending_value).toFixed(2)}` : '€ 0.00'}
          tone="amber"
          onClick={() => go('sales')}
        />
        <QuickStat
          icon={Package}
          label="Stock total"
          value={String(stats?.total_stock ?? 0)}
          extra={`${stats?.total_products ?? 0} produtos`}
          tone="zinc"
          onClick={() => go('inventory')}
        />
        <QuickStat
          icon={Euro}
          label="Receita 30d"
          value={`€ ${Number(stats?.revenue_30d || 0).toFixed(2)}`}
          extra="Últimos 30 dias"
          tone="emerald"
          onClick={() => go('sales')}
        />
      </div>

      {/* Receita 14 dias + Origem (lado a lado) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-[28px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base">Receita — últimos 14 dias</h3>
              <p className="text-[11px] text-zinc-500">Pedidos pagos, enviados e entregues</p>
            </div>
            <span className="text-[10px] uppercase font-black bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">
              € {Number(stats?.revenue_7d || 0).toFixed(2)} / 7d
            </span>
          </div>
          <RevenueLineChart data={stats?.revenue_series || []} />
        </div>

        <div className="bg-white border border-gray-100 rounded-[28px] p-6 shadow-sm">
          <h3 className="font-bold text-base mb-1">Vendas por origem</h3>
          <p className="text-[11px] text-zinc-500 mb-4">Distribuição da receita</p>
          <OriginDonut data={stats?.sales_by_origin || []} />
        </div>
      </div>

      {/* Top produtos + Top clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-100 rounded-[28px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base">Produtos mais vendidos</h3>
              <p className="text-[11px] text-zinc-500">Top 5 por unidades</p>
            </div>
            <button onClick={() => go('inventory')} className="text-[11px] text-zinc-500 hover:text-black flex items-center gap-1">
              Inventário <ArrowRight size={12} />
            </button>
          </div>
          <TopProductsBars data={stats?.top_products || []} />
        </div>

        <div className="bg-white border border-gray-100 rounded-[28px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base">Top Clientes</h3>
              <p className="text-[11px] text-zinc-500">Por receita gerada</p>
            </div>
            <button onClick={() => go('customers')} className="text-[11px] text-zinc-500 hover:text-black flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </button>
          </div>
          <TopCustomersList data={stats?.top_customers || []} />
        </div>
      </div>

      {/* Stock baixo + Pendentes recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-100 rounded-[28px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500" /> Stock crítico
              </h3>
              <p className="text-[11px] text-zinc-500">Esgotadas e com apenas 1 unidade</p>
            </div>
            <button onClick={() => go('inventory')} className="text-[11px] text-zinc-500 hover:text-black flex items-center gap-1">
              Repor <ArrowRight size={12} />
            </button>
          </div>
          <LowStockList data={stats?.low_stock || []} />
        </div>

        <div className="bg-white border border-gray-100 rounded-[28px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <Clock size={16} className="text-amber-500" /> Pendentes recentes
              </h3>
              <p className="text-[11px] text-zinc-500">A aguardar pagamento</p>
            </div>
            <button onClick={() => go('sales')} className="text-[11px] text-zinc-500 hover:text-black flex items-center gap-1">
              Gerir <ArrowRight size={12} />
            </button>
          </div>
          <PendingList data={stats?.recent_pending || []} />
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Cards
// =============================================================
function KpiCard({
  label, value, icon: Icon, tone, subtitle, onClick,
}: {
  label: string;
  value: string;
  icon: any;
  tone: 'emerald' | 'blue' | 'red' | 'purple' | 'amber' | 'zinc';
  subtitle?: string;
  onClick?: () => void;
}) {
  const toneMap: Record<string, { bg: string; text: string; pill: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', pill: 'bg-emerald-50 text-emerald-700' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    pill: 'bg-blue-50 text-blue-700' },
    red:     { bg: 'bg-red-50',     text: 'text-red-600',     pill: 'bg-red-50 text-red-700' },
    purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  pill: 'bg-purple-50 text-purple-700' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   pill: 'bg-amber-50 text-amber-700' },
    zinc:    { bg: 'bg-zinc-100',   text: 'text-zinc-600',    pill: 'bg-zinc-100 text-zinc-700' },
  };
  const c = toneMap[tone];
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="group bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm text-left transition hover:border-black hover:shadow-md disabled:hover:border-gray-100 disabled:hover:shadow-sm"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${c.bg} ${c.text} group-hover:scale-110 transition-transform`}>
          <Icon size={22} />
        </div>
        {onClick && (
          <ArrowRight size={14} className="text-zinc-300 group-hover:text-black transition" />
        )}
      </div>
      <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 font-mono">{value}</p>
      {subtitle && <p className="text-[11px] text-zinc-500 mt-1">{subtitle}</p>}
    </button>
  );
}

function QuickStat({
  icon: Icon, label, value, extra, tone, onClick,
}: {
  icon: any;
  label: string;
  value: string;
  extra?: string;
  tone: 'amber' | 'zinc' | 'emerald';
  onClick?: () => void;
}) {
  const map: Record<string, string> = {
    amber: 'text-amber-600 bg-amber-50',
    zinc: 'text-zinc-600 bg-zinc-100',
    emerald: 'text-emerald-600 bg-emerald-50',
  };
  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:border-black transition text-left"
    >
      <div className={`p-2.5 rounded-xl ${map[tone]}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1">
        <p className="text-[10px] uppercase font-bold text-zinc-400">{label}</p>
        <p className="text-lg font-black font-mono">{value}</p>
        {extra && <p className="text-[10px] text-zinc-500">{extra}</p>}
      </div>
      <ArrowRight size={14} className="text-zinc-300" />
    </button>
  );
}

// =============================================================
// SVG Charts
// =============================================================
function RevenueLineChart({ data }: { data: { dia: string; revenue: number; orders_count: number }[] }) {
  const W = 700; const H = 200; const PAD = { top: 16, right: 16, bottom: 28, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const max = Math.max(1, ...data.map(d => Number(d.revenue) || 0));
  const niceMax = Math.ceil(max / 10) * 10 || 10;
  const step = innerW / Math.max(data.length - 1, 1);

  const points = data.map((d, i) => {
    const x = PAD.left + i * step;
    const y = PAD.top + innerH - (Number(d.revenue) / niceMax) * innerH;
    return { x, y, d };
  });

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = points.length
    ? `${path} L ${points[points.length - 1].x} ${PAD.top + innerH} L ${points[0].x} ${PAD.top + innerH} Z`
    : '';

  const [hover, setHover] = useState<number | null>(null);

  if (!data.length) {
    return <p className="text-center text-xs text-zinc-400 py-12">Sem dados de receita.</p>;
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16,185,129)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="rgb(16,185,129)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = PAD.top + innerH - t * innerH;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={PAD.left + innerW} y1={y} y2={y} stroke="#f3f4f6" />
              <text x={PAD.left - 8} y={y + 3} fontSize="9" fill="#9ca3af" textAnchor="end">
                € {Math.round(niceMax * t)}
              </text>
            </g>
          );
        })}

        {/* Área */}
        <path d={area} fill="url(#revGrad)" />
        {/* Linha */}
        <path d={path} fill="none" stroke="rgb(16,185,129)" strokeWidth="2" strokeLinejoin="round" />

        {/* Pontos + hover */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={hover === i ? 4 : 3} fill="white" stroke="rgb(16,185,129)" strokeWidth="2" />
            <rect
              x={p.x - step / 2} y={PAD.top}
              width={step} height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}

        {/* X labels (a cada 3 dias) */}
        {points.map((p, i) => (
          (i === 0 || i === points.length - 1 || i % 3 === 0) && (
            <text key={i} x={p.x} y={H - 8} fontSize="9" fill="#9ca3af" textAnchor="middle">
              {new Date(p.d.dia).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
            </text>
          )
        ))}

        {/* Tooltip */}
        {hover !== null && points[hover] && (
          <g>
            <line
              x1={points[hover].x} x2={points[hover].x}
              y1={PAD.top} y2={PAD.top + innerH}
              stroke="#000" strokeDasharray="2 2" opacity="0.3"
            />
          </g>
        )}
      </svg>

      {hover !== null && points[hover] && (
        <div
          className="absolute pointer-events-none bg-black text-white text-xs rounded-lg px-2 py-1 -translate-x-1/2 -translate-y-full"
          style={{
            left: `${(points[hover].x / W) * 100}%`,
            top: `${(points[hover].y / H) * 100}%`,
          }}
        >
          <p className="font-mono font-black">€ {Number(points[hover].d.revenue).toFixed(2)}</p>
          <p className="text-[10px] opacity-70">
            {new Date(points[hover].d.dia).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
            {' · '}{points[hover].d.orders_count} pedido(s)
          </p>
        </div>
      )}
    </div>
  );
}

function TopProductsBars({ data }: { data: { name: string; qty_sold: number; revenue: number }[] }) {
  if (!data.length) {
    return <p className="text-center text-xs text-zinc-400 py-12">Sem vendas registadas.</p>;
  }
  const max = Math.max(...data.map(d => d.qty_sold), 1);
  return (
    <div className="space-y-3">
      {data.map((p, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-bold truncate flex-1 mr-2">{p.name}</span>
            <span className="font-mono text-zinc-500 shrink-0">
              {p.qty_sold} un · € {Number(p.revenue).toFixed(2)}
            </span>
          </div>
          <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-black to-zinc-700 rounded-full transition-all"
              style={{ width: `${(p.qty_sold / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function OriginDonut({ data }: { data: { origin: string; count: number; revenue: number }[] }) {
  if (!data.length) {
    return <p className="text-center text-xs text-zinc-400 py-12">Sem dados.</p>;
  }
  const total = data.reduce((a, d) => a + d.revenue, 0) || 1;
  const colors: Record<string, string> = {
    whatsapp: '#10b981',
    loja_fisica: '#000000',
    website: '#3b82f6',
    sem_origem: '#a1a1aa',
  };
  const icons: Record<string, any> = {
    whatsapp: MessageCircle, loja_fisica: Store, website: Globe,
  };

  // Donut paths
  const R = 60; const r = 40; const cx = 90; const cy = 90;
  let acc = 0;
  const segments = data.map(d => {
    const fraction = d.revenue / total;
    const start = acc * 2 * Math.PI;
    const end = (acc + fraction) * 2 * Math.PI;
    acc += fraction;

    const x1 = cx + R * Math.sin(start);
    const y1 = cy - R * Math.cos(start);
    const x2 = cx + R * Math.sin(end);
    const y2 = cy - R * Math.cos(end);
    const x3 = cx + r * Math.sin(end);
    const y3 = cy - r * Math.cos(end);
    const x4 = cx + r * Math.sin(start);
    const y4 = cy - r * Math.cos(start);
    const large = fraction > 0.5 ? 1 : 0;
    return {
      d: `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`,
      color: colors[d.origin] || '#a1a1aa',
      origin: d.origin,
      revenue: d.revenue,
      count: d.count,
      fraction,
    };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 180 180" className="w-40 h-40">
        {segments.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} />
        ))}
        <text x="90" y="86" textAnchor="middle" fontSize="10" fill="#71717a" fontWeight="bold">TOTAL</text>
        <text x="90" y="102" textAnchor="middle" fontSize="13" fontWeight="900" fill="#000">
          € {total.toFixed(0)}
        </text>
      </svg>
      <div className="w-full space-y-1.5">
        {segments.map((s, i) => {
          const Icon = icons[s.origin] || Store;
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
              <Icon size={11} className="text-zinc-400" />
              <span className="capitalize flex-1">{s.origin.replace('_', ' ')}</span>
              <span className="font-mono font-bold">{(s.fraction * 100).toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================
// Listas
// =============================================================
function TopCustomersList({ data }: { data: DashboardStats['top_customers'] }) {
  if (!data.length) {
    return <p className="text-center text-xs text-zinc-400 py-8">Sem clientes registados.</p>;
  }
  return (
    <div className="space-y-2">
      {data.map((c, i) => (
        <div key={c.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-50 transition">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ${
            i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-500'
          }`}>
            {i === 0 ? <Crown size={13} /> : i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{c.full_name || 'Sem nome'}</p>
            <p className="text-[10px] text-zinc-500 font-mono truncate">{c.whatsapp_number}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-mono font-black">€ {Number(c.total_spent).toFixed(2)}</p>
            <p className="text-[10px] text-zinc-500">{c.orders_count} pedido(s)</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function LowStockList({ data }: { data: DashboardStats['low_stock'] }) {
  if (!data.length) {
    return <p className="text-center text-xs text-emerald-600 py-8">✓ Stock OK em todas as variantes.</p>;
  }
  return (
    <div className="space-y-2">
      {data.map((s, i) => (
        <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-50 transition">
          <Package size={16} className="text-zinc-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{s.name || s.sku}</p>
            <p className="text-[10px] text-zinc-500 font-mono truncate">
              {s.color || '—'} · {s.size || '—'} · {s.sku}
            </p>
          </div>
          <span className={`text-xs font-black px-2 py-1 rounded-full shrink-0 ${
            s.stock_quantity === 0
              ? 'bg-red-100 text-red-700'
              : s.stock_quantity <= 1
                ? 'bg-red-50 text-red-600'
                : 'bg-amber-50 text-amber-700'
          }`}>
            {s.stock_quantity} un.
          </span>
        </div>
      ))}
    </div>
  );
}

function PendingList({ data }: { data: DashboardStats['recent_pending'] }) {
  if (!data.length) {
    return <p className="text-center text-xs text-emerald-600 py-8">✓ Sem pedidos pendentes.</p>;
  }
  return (
    <div className="space-y-2">
      {data.map(p => (
        <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-50 transition">
          <span className="text-[10px] font-mono font-black bg-zinc-100 px-2 py-1 rounded shrink-0">
            #{p.id}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{p.full_name || 'Sem nome'}</p>
            <p className="text-[10px] text-zinc-500 flex items-center gap-1 truncate">
              <Phone size={9} /> {p.whatsapp_number || '—'} · {p.origin}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-mono font-black">€ {Number(p.total_amount).toFixed(2)}</p>
            <p className="text-[10px] text-zinc-500">{new Date(p.created_at).toLocaleDateString('pt-PT')}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
