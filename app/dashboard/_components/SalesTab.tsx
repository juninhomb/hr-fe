'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, RefreshCw, Check, X,
  Clock, MessageCircle, Store, AlertCircle, Package, ArrowLeft,
  TrendingUp, Euro, Calendar, Filter, Eye, MoreHorizontal, Send,
  MapPin, Mail, Phone,
} from 'lucide-react';
import api from '../../../lib/api';

// =============================================================
// Tipos
// =============================================================
type Variant = {
  id: number;
  name: string;
  price: number | string;
  sku: string;
  color?: string;
  size?: string;
  stock: number;
};

type CartLine = {
  sku: string;
  name: string;
  color?: string;
  size?: string;
  unit_price: number;
  quantity: number;
  max_stock: number;
};

type Customer = {
  id: number;
  full_name?: string;
  whatsapp_number: string;
  email?: string;
  address?: string;
};

type OrderItem = {
  id: number;
  sku: string;
  product_name?: string;
  color?: string;
  size?: string;
  quantity: number;
  unit_price?: number | string | null;
  stock_quantity?: number;
};

type Order = {
  id: number;
  customer_id: number | null;
  full_name?: string;
  whatsapp_number?: string;
  email?: string;
  address?: string;
  total_amount: number | string;
  status: string;
  origin?: string;
  payment_method?: string;
  created_at: string;
  items: OrderItem[];
};

// =============================================================
// Toast helper
// =============================================================
type Toast = { id: number; type: 'success' | 'error'; msg: string };

function ToastStack({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  return (
    <div className="fixed top-6 right-6 z-[100] space-y-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`min-w-[280px] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg border text-sm font-bold animate-in slide-in-from-right-4 ${
            t.type === 'success'
              ? 'bg-emerald-500 border-emerald-600 text-white'
              : 'bg-red-500 border-red-600 text-white'
          }`}
        >
          {t.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span className="flex-1">{t.msg}</span>
          <button onClick={() => onClose(t.id)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (type: 'success' | 'error', msg: string) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };
  const close = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));
  return { toasts, push, close };
}

// =============================================================
// Componente principal
// =============================================================
type View = 'overview' | 'pdv' | 'pending';

export default function SalesTab() {
  const [view, setView] = useState<View>('overview');
  const { toasts, push, close } = useToasts();

  return (
    <div className="animate-in slide-in-from-bottom-4">
      <ToastStack toasts={toasts} onClose={close} />
      {view === 'overview' && <OverviewPanel onChangeView={setView} toast={push} />}
      {view === 'pdv' && <PDVPanel onBack={() => setView('overview')} toast={push} />}
      {view === 'pending' && <PendingOrdersPanel onBack={() => setView('overview')} toast={push} />}
    </div>
  );
}

// =============================================================
// OVERVIEW — Resumo de vendas (vista default)
// =============================================================
function OverviewPanel({
  onChangeView, toast,
}: { onChangeView: (v: View) => void; toast: (t: 'success' | 'error', m: string) => void }) {
  const [history, setHistory] = useState<Order[]>([]);
  const [pending, setPending] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [detailsId, setDetailsId] = useState<number | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [h, p] = await Promise.all([api.get('/history'), api.get('/pending')]);
      setHistory(Array.isArray(h.data) ? h.data : []);
      setPending(Array.isArray(p.data) ? p.data : []);
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Erro ao carregar vendas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // ---- Ações (em conjunto com backend) ----
  const handleConfirm = async (o: Order) => {
    if (o.status !== 'aguardando_pagamento') {
      toast('error', 'Apenas pedidos pendentes podem ser confirmados.');
      return;
    }
    if (!o.items || o.items.length === 0) {
      toast('error', 'Pedido sem itens. Abre "Pedidos Pendentes" para adicionar antes de confirmar.');
      return;
    }
    setActionId(o.id);
    try {
      await api.post('/confirm', { orderId: o.id });
      toast('success', `Pedido #${o.id} confirmado — stock atualizado.`);
      fetchAll();
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Erro ao confirmar');
    } finally {
      setActionId(null);
    }
  };

  const handleShip = async (o: Order) => {
    if (o.status !== 'pago') {
      toast('error', 'Só pedidos pagos podem ser enviados.');
      return;
    }
    setActionId(o.id);
    try {
      await api.post(`/${o.id}/ship`);
      toast('success', `Pedido #${o.id} marcado como enviado (CTT).`);
      fetchAll();
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Erro ao marcar envio');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (o: Order) => {
    const willRestoreStock = o.status !== 'cancelado';
    const msg = willRestoreStock
      ? `Eliminar pedido #${o.id}? O stock será DEVOLVIDO ao inventário.`
      : `Eliminar pedido #${o.id}?`;
    if (!window.confirm(msg)) return;
    setActionId(o.id);
    try {
      const res = await api.delete(`/${o.id}`);
      toast('success',
        res.data?.stockRestored
          ? `Pedido #${o.id} eliminado e stock devolvido.`
          : `Pedido #${o.id} eliminado.`);
      fetchAll();
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Erro ao eliminar');
    } finally {
      setActionId(null);
    }
  };

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayOrders = history.filter(o => new Date(o.created_at) >= today);
    const paidToday = todayOrders.filter(o => o.status === 'pago' || o.status === 'enviado' || o.status === 'entregue');
    const revenueToday = paidToday.reduce((a, o) => a + Number(o.total_amount || 0), 0);
    const totalRevenue = history
      .filter(o => o.status !== 'cancelado' && o.status !== 'aguardando_pagamento')
      .reduce((a, o) => a + Number(o.total_amount || 0), 0);
    const toShip = history.filter(
      o => o.status === 'pago' && o.origin === 'whatsapp'
    );
    return {
      todayCount: todayOrders.length,
      revenueToday,
      pendingCount: pending.length,
      totalRevenue,
      toShipCount: toShip.length,
      toShipValue: toShip.reduce((a, o) => a + Number(o.total_amount || 0), 0),
    };
  }, [history, pending]);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="Vendas hoje"
          value={String(stats.todayCount)}
          tone="black"
        />
        <KpiCard
          icon={<Euro size={18} />}
          label="Receita hoje"
          value={`€ ${stats.revenueToday.toFixed(2)}`}
          tone="emerald"
        />
        <KpiCard
          icon={<Clock size={18} />}
          label="Pendentes"
          value={String(stats.pendingCount)}
          tone={stats.pendingCount > 0 ? 'amber' : 'zinc'}
          onClick={() => onChangeView('pending')}
        />
        <KpiCard
          icon={<Send size={18} />}
          label="A enviar (CTT)"
          value={String(stats.toShipCount)}
          tone={stats.toShipCount > 0 ? 'blue' : 'zinc'}
        />
        <KpiCard
          icon={<Euro size={18} />}
          label="Receita total"
          value={`€ ${stats.totalRevenue.toFixed(2)}`}
          tone="zinc"
        />
      </div>

      {/* Action bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => onChangeView('pdv')}
          className="flex-1 bg-black text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition shadow-lg shadow-black/10"
        >
          <Plus size={20} />
          Nova Venda (PDV)
        </button>
        <button
          onClick={() => onChangeView('pending')}
          className="flex-1 bg-white border border-gray-100 text-black px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:border-black transition"
        >
          <Clock size={20} />
          Pedidos Pendentes
          {stats.pendingCount > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-black rounded-full px-2 py-0.5">
              {stats.pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={fetchAll}
          className={`bg-white border border-gray-100 text-zinc-500 px-5 py-4 rounded-2xl ${loading ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Histórico recente */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-visible">
        <div className="p-6 border-b border-gray-50 flex items-center gap-2">
          <h3 className="font-bold text-lg flex-1">Vendas recentes</h3>
          <span className="text-xs text-zinc-400">{history.length} registos</span>
        </div>
        <OrdersTable
          orders={history.slice(0, 15)}
          loading={loading}
          actionId={actionId}
          onConfirm={handleConfirm}
          onShip={handleShip}
          onDelete={handleDelete}
          onView={(o) => setDetailsId(o.id)}
        />
      </div>

      {detailsId !== null && (
        <OrderDetailsModal orderId={detailsId} onClose={() => setDetailsId(null)} />
      )}
    </div>
  );
}

function KpiCard({
  icon, label, value, tone, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'black' | 'emerald' | 'amber' | 'zinc' | 'blue';
  onClick?: () => void;
}) {
  const toneMap: Record<string, string> = {
    black: 'bg-black text-white',
    emerald: 'bg-emerald-500 text-white',
    amber: 'bg-amber-500 text-white',
    blue: 'bg-blue-500 text-white',
    zinc: 'bg-white text-black border border-gray-100',
  };
  const Wrap: any = onClick ? 'button' : 'div';
  return (
    <Wrap
      onClick={onClick}
      className={`${toneMap[tone]} rounded-3xl p-5 ${onClick ? 'hover:opacity-90 transition cursor-pointer text-left' : ''}`}
    >
      <div className="flex items-center gap-2 opacity-80 mb-2">
        {icon}
        <span className="text-[10px] uppercase font-bold tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-black font-mono">{value}</p>
    </Wrap>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pago: 'bg-emerald-50 text-emerald-700',
    enviado: 'bg-blue-50 text-blue-700',
    entregue: 'bg-emerald-50 text-emerald-700',
    aguardando_pagamento: 'bg-amber-50 text-amber-700',
    cancelado: 'bg-red-50 text-red-700',
  };
  return map[status] || 'bg-zinc-100 text-zinc-700';
}

function OrdersTable({
  orders, loading, actionId, onConfirm, onShip, onDelete, onView,
}: {
  orders: Order[];
  loading: boolean;
  actionId: number | null;
  onConfirm: (o: Order) => void;
  onShip: (o: Order) => void;
  onDelete: (o: Order) => void;
  onView: (o: Order) => void;
}) {
  const [openMenu, setOpenMenu] = useState<{ id: number; top: number; right: number } | null>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [openMenu]);

  if (!loading && orders.length === 0) {
    return <p className="text-center text-zinc-400 text-sm py-12">Sem vendas ainda.</p>;
  }
  const current = openMenu ? orders.find(o => o.id === openMenu.id) : null;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50/50 text-[10px] uppercase font-bold text-zinc-400">
            <tr>
              <th className="px-6 py-4 text-black">#</th>
              <th className="px-6 py-4 text-black">Cliente</th>
              <th className="px-6 py-4 text-black">Origem</th>
              <th className="px-6 py-4 text-black">Items</th>
              <th className="px-6 py-4 text-black text-right">Total</th>
              <th className="px-6 py-4 text-black text-center">Status</th>
              <th className="px-6 py-4 text-black text-right">Data</th>
              <th className="px-6 py-4 text-black text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.map(o => {
              const needsShipping = o.status === 'pago' && o.origin === 'whatsapp';
              return (
              <tr
                key={o.id}
                onClick={() => onView(o)}
                className={`transition cursor-pointer ${
                  needsShipping
                    ? 'bg-blue-50/60 hover:bg-blue-100/60 border-l-4 border-l-blue-500'
                    : 'hover:bg-gray-50/40'
                }`}
              >
                <td className="px-6 py-4 font-mono text-xs font-black">#{o.id}</td>
                <td className="px-6 py-4 text-sm">
                  <p className="font-bold">{o.full_name || '—'}</p>
                  {o.whatsapp_number && <p className="text-[10px] text-zinc-400 font-mono">{o.whatsapp_number}</p>}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-zinc-500">{o.origin || '—'}</span>
                    {needsShipping && (
                      <span
                        title="Pago — pronto para enviar via CTT"
                        className="text-[9px] font-black bg-blue-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1"
                      >
                        <Send size={9} /> CTT
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-xs text-zinc-500">{o.items?.length || 0}</td>
                <td className="px-6 py-4 font-mono font-black text-right">€ {Number(o.total_amount).toFixed(2)}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${statusBadge(o.status)}`}>
                    {o.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-[11px] text-zinc-400">
                  {new Date(o.created_at).toLocaleString('pt-PT')}
                </td>
                <td
                  className="px-6 py-4 text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onView(o); }}
                      title="Ver detalhes"
                      className="hover:text-black transition p-1 rounded-lg hover:bg-zinc-100 text-zinc-400"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      disabled={actionId === o.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setOpenMenu(
                          openMenu?.id === o.id
                            ? null
                            : { id: o.id, top: rect.bottom + 4, right: window.innerWidth - rect.right }
                        );
                      }}
                      className="hover:text-black transition p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 disabled:opacity-40"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dropdown fixed */}
      {openMenu && current && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: openMenu.top, right: openMenu.right, zIndex: 50 }}
          className="bg-white border border-gray-100 rounded-2xl shadow-xl py-1 w-56 animate-in fade-in slide-in-from-top-2"
        >
          <DropItem
            icon={<Eye size={14} />}
            label="Ver Detalhes"
            onClick={() => { setOpenMenu(null); onView(current); }}
          />
          <div className="border-t border-gray-100 my-1" />
          <DropItem
            icon={<Check size={14} />}
            label="Confirmar Pagamento"
            disabled={current.status !== 'aguardando_pagamento'}
            onClick={() => { setOpenMenu(null); onConfirm(current); }}
          />
          <DropItem
            icon={<Send size={14} />}
            label="Enviar via CTT"
            disabled={current.status !== 'pago'}
            onClick={() => { setOpenMenu(null); onShip(current); }}
          />
          <div className="border-t border-gray-100 my-1" />
          <DropItem
            icon={<Trash2 size={14} />}
            label="Excluir Pedido"
            danger
            onClick={() => { setOpenMenu(null); onDelete(current); }}
          />
        </div>
      )}
    </>
  );
}

function DropItem({
  icon, label, onClick, disabled, danger, badge,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-2 flex items-center gap-2 text-xs font-bold transition ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : danger
            ? 'text-red-600 hover:bg-red-50'
            : 'text-zinc-700 hover:bg-zinc-50'
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[9px] uppercase font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
          {badge}
        </span>
      )}
    </button>
  );
}

// =============================================================
// PDV — Nova Venda
// =============================================================
function PDVPanel({
  onBack, toast,
}: { onBack: () => void; toast: (t: 'success' | 'error', m: string) => void }) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'mbway' | 'cartao'>('dinheiro');
  const [markAsUnpaid, setMarkAsUnpaid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchVariants = async (q = search) => {
    setLoading(true);
    try {
      const res = await api.get(`/products${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setVariants(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async (q = '') => {
    try {
      const res = await api.get(`/customers${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setCustomers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    }
  };

  useEffect(() => { fetchVariants(); fetchCustomers(); }, []);
  useEffect(() => {
    const t = setTimeout(() => fetchVariants(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    const t = setTimeout(() => fetchCustomers(customerQuery), 300);
    return () => clearTimeout(t);
  }, [customerQuery]);

  const addToCart = (v: Variant) => {
    if (Number(v.stock) <= 0) return;
    setCart(prev => {
      const idx = prev.findIndex(l => l.sku === v.sku);
      if (idx >= 0) {
        const u = [...prev];
        if (u[idx].quantity >= Number(v.stock)) return prev;
        u[idx] = { ...u[idx], quantity: u[idx].quantity + 1 };
        return u;
      }
      return [
        ...prev,
        { sku: v.sku, name: v.name, color: v.color, size: v.size,
          unit_price: Number(v.price) || 0, quantity: 1, max_stock: Number(v.stock) },
      ];
    });
  };

  const updateQty = (sku: string, delta: number) => {
    setCart(prev =>
      prev.map(l => l.sku === sku
        ? { ...l, quantity: Math.max(0, Math.min(l.max_stock, l.quantity + delta)) } : l)
        .filter(l => l.quantity > 0));
  };

  const removeLine = (sku: string) => setCart(prev => prev.filter(l => l.sku !== sku));

  const total = useMemo(
    () => cart.reduce((acc, l) => acc + l.unit_price * l.quantity, 0),
    [cart]
  );

  const finalize = async () => {
    if (cart.length === 0) {
      toast('error', 'Carrinho vazio.');
      return;
    }
    if (!selectedCustomer) {
      toast('error', 'Seleciona um cliente para registar a venda.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/create', {
        customer_id: selectedCustomer?.id ?? null,
        items: cart.map(l => ({ sku: l.sku, quantity: l.quantity, unit_price: l.unit_price })),
        total_amount: total,
        payment_method: paymentMethod,
        status: markAsUnpaid ? 'aguardando_pagamento' : 'pago',
        origin: 'loja_fisica',
      });
      const wasUnpaid = markAsUnpaid;
      toast(
        'success',
        wasUnpaid
          ? `Pedido #${res.data.orderId} criado como PENDENTE — stock reservado até confirmação.`
          : `Venda #${res.data.orderId} registada — € ${total.toFixed(2)} (stock atualizado).`
      );
      setCart([]);
      setSelectedCustomer(null);
      setMarkAsUnpaid(false);
      fetchVariants();
      setTimeout(() => onBack(), 800);
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Erro ao registar venda');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2.5 bg-white border border-gray-100 rounded-xl hover:bg-zinc-50"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h3 className="font-black text-xl">Nova Venda — PDV</h3>
          <p className="text-xs text-zinc-500">Adiciona produtos, escolhe cliente e finaliza.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Catálogo */}
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center gap-3">
            <h3 className="font-bold text-lg flex-1">Catálogo</h3>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar nome ou SKU..."
                className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black w-72"
              />
            </div>
            <button
              onClick={() => fetchVariants()}
              className={`p-2 bg-zinc-50 rounded-xl border border-gray-100 ${loading ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-6 max-h-[600px] overflow-y-auto">
            {variants.map(v => {
              const stock = Number(v.stock);
              const out = stock <= 0;
              return (
                <button
                  key={v.id || v.sku}
                  onClick={() => addToCart(v)}
                  disabled={out}
                  className={`text-left p-4 rounded-2xl border transition ${
                    out
                      ? 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'
                      : 'bg-white border-gray-100 hover:border-black hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <Package size={18} className="text-zinc-400" />
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      stock <= 5 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {stock} un.
                    </span>
                  </div>
                  <p className="font-bold text-sm text-black truncate">{v.name}</p>
                  <p className="text-[10px] text-zinc-400 uppercase font-medium mt-0.5">
                    {v.color || '—'} | {v.size || '—'}
                  </p>
                  <code className="text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600 mt-2 inline-block">
                    {v.sku}
                  </code>
                  <p className="font-mono font-black text-black mt-2">€ {Number(v.price || 0).toFixed(2)}</p>
                </button>
              );
            })}
            {variants.length === 0 && !loading && (
              <p className="col-span-full text-center text-zinc-400 text-sm py-12">Nenhum produto encontrado.</p>
            )}
          </div>
        </div>

        {/* Carrinho */}
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm flex flex-col max-h-[700px]">
          <div className="p-6 border-b border-gray-50 flex items-center gap-2">
            <ShoppingCart size={18} />
            <h3 className="font-bold text-lg">Carrinho</h3>
            <span className="ml-auto text-xs text-zinc-400 font-bold">{cart.length} itens</span>
          </div>

          <div className="p-6 border-b border-gray-50 space-y-2">
            <label className="text-[10px] uppercase font-bold text-zinc-400">
              Cliente <span className="text-red-500">*</span>
            </label>
            <CustomerCombobox
              customers={customers}
              query={customerQuery}
              setQuery={setCustomerQuery}
              selected={selectedCustomer}
              onSelect={(c) => { setSelectedCustomer(c); setCustomerQuery(''); }}
              onClear={() => setSelectedCustomer(null)}
            />
            {!selectedCustomer && (
              <p className="text-[11px] text-red-500 font-bold flex items-center gap-1">
                <AlertCircle size={11} /> Cliente obrigatório para registar venda.
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.length === 0 && (
              <p className="text-center text-zinc-400 text-sm py-12">Carrinho vazio. Clica num produto.</p>
            )}
            {cart.map(line => (
              <div key={line.sku} className="bg-zinc-50 rounded-2xl p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{line.name}</p>
                    <p className="text-[10px] text-zinc-400 uppercase">{line.color} | {line.size}</p>
                    <code className="text-[10px] text-zinc-500">{line.sku}</code>
                  </div>
                  <button onClick={() => removeLine(line.sku)} className="text-zinc-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(line.sku, -1)} className="p-1 rounded-lg bg-white border border-gray-200 hover:border-black">
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-black w-6 text-center">{line.quantity}</span>
                    <button
                      onClick={() => updateQty(line.sku, +1)}
                      disabled={line.quantity >= line.max_stock}
                      className="p-1 rounded-lg bg-white border border-gray-200 hover:border-black disabled:opacity-30"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="text-sm font-mono font-black">€ {(line.unit_price * line.quantity).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 border-t border-gray-50 space-y-3">
            <div className="flex gap-2">
              {(['dinheiro', 'mbway', 'cartao'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold uppercase ${
                    paymentMethod === m ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-500'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500 font-bold">Total</span>
              <span className="text-2xl font-black font-mono">€ {total.toFixed(2)}</span>
            </div>

            <label className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border transition ${
              markAsUnpaid ? 'bg-amber-50 border-amber-300' : 'bg-zinc-50 border-transparent hover:border-zinc-200'
            }`}>
              <input
                type="checkbox"
                checked={markAsUnpaid}
                onChange={e => setMarkAsUnpaid(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-xs font-bold text-zinc-700">
                Marcar como <span className="text-amber-600">não paga</span>
              </span>
              <span className="ml-auto text-[10px] text-zinc-500">stock reservado</span>
            </label>

            <button
              onClick={finalize}
              disabled={submitting || cart.length === 0 || !selectedCustomer}
              className={`w-full py-3 rounded-xl font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${
                markAsUnpaid
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-black text-white hover:bg-zinc-800'
              }`}
            >
              {submitting
                ? 'A registar...'
                : !selectedCustomer
                  ? 'Selecione um cliente'
                  : markAsUnpaid
                    ? 'Criar Pedido Pendente'
                    : 'Finalizar Venda'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// PENDENTES (WhatsApp / IA / PDV não pago) — com filtros
// =============================================================
function PendingOrdersPanel({
  onBack, toast,
}: { onBack: () => void; toast: (t: 'success' | 'error', m: string) => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [filterOrigin, setFilterOrigin] = useState<'all' | 'whatsapp' | 'website' | 'loja_fisica'>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [filterItems, setFilterItems] = useState<'all' | 'with' | 'without'>('all');

  const [completing, setCompleting] = useState<Order | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await api.get('/pending');
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Erro ao carregar pendentes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (filterOrigin !== 'all' && (o.origin || '') !== filterOrigin) return false;
      if (filterPayment !== 'all' && (o.payment_method || '') !== filterPayment) return false;
      if (filterItems === 'with' && (!o.items || o.items.length === 0)) return false;
      if (filterItems === 'without' && o.items && o.items.length > 0) return false;
      if (filterDate !== 'all') {
        const d = new Date(o.created_at);
        const now = new Date();
        if (filterDate === 'today') {
          const t = new Date(); t.setHours(0, 0, 0, 0);
          if (d < t) return false;
        } else if (filterDate === '7d') {
          if (d < new Date(now.getTime() - 7 * 86400000)) return false;
        } else if (filterDate === '30d') {
          if (d < new Date(now.getTime() - 30 * 86400000)) return false;
        }
      }
      if (search) {
        const s = search.toLowerCase();
        const hit = (o.full_name || '').toLowerCase().includes(s)
          || (o.whatsapp_number || '').includes(s)
          || String(o.id).includes(s)
          || (o.items || []).some(it => (it.sku || '').toLowerCase().includes(s));
        if (!hit) return false;
      }
      return true;
    });
  }, [orders, filterOrigin, filterPayment, filterDate, filterItems, search]);

  const paymentOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => o.payment_method && set.add(o.payment_method));
    return Array.from(set);
  }, [orders]);

  const totalAmount = filtered.reduce((a, o) => a + Number(o.total_amount || 0), 0);

  const confirmOrder = async (order: Order, items?: any[]) => {
    setActionId(order.id);
    try {
      await api.post('/confirm', { orderId: order.id, items: items || undefined });
      toast('success', `Pedido #${order.id} confirmado — stock atualizado.`);
      setCompleting(null);
      fetchPending();
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Erro ao confirmar pedido');
    } finally {
      setActionId(null);
    }
  };

  const cancelOrder = async (order: Order) => {
    if (!window.confirm(`Eliminar pedido #${order.id}? O stock reservado será devolvido ao inventário.`)) return;
    setActionId(order.id);
    try {
      const res = await api.delete(`/${order.id}`);
      toast('success',
        res.data?.stockRestored
          ? `Pedido #${order.id} eliminado — stock devolvido ao inventário.`
          : `Pedido #${order.id} eliminado.`);
      fetchPending();
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Erro ao eliminar');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2.5 bg-white border border-gray-100 rounded-xl hover:bg-zinc-50"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h3 className="font-black text-xl">Pedidos a aguardar pagamento</h3>
          <p className="text-xs text-zinc-500">Inclui pedidos do bot WhatsApp e vendas de loja física marcadas como não pagas.</p>
        </div>
        <button
          onClick={fetchPending}
          className={`p-2.5 bg-white border border-gray-100 rounded-xl ${loading ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* KPI faixa */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-[10px] uppercase font-bold text-zinc-400">Total pendentes</p>
          <p className="text-2xl font-black font-mono mt-1">{orders.length}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-[10px] uppercase font-bold text-zinc-400">Filtrados</p>
          <p className="text-2xl font-black font-mono mt-1">{filtered.length}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-[10px] uppercase font-bold text-zinc-400">Sem itens</p>
          <p className="text-2xl font-black font-mono mt-1 text-amber-600">
            {orders.filter(o => !o.items || o.items.length === 0).length}
          </p>
        </div>
        <div className="bg-emerald-500 text-white rounded-2xl p-4">
          <p className="text-[10px] uppercase font-bold opacity-80">Valor filtrado</p>
          <p className="text-2xl font-black font-mono mt-1">€ {totalAmount.toFixed(2)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-[24px] border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-zinc-500">
          <Filter size={14} />
          <span className="text-[10px] uppercase font-bold">Filtros</span>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ID, nome, whatsapp ou SKU..."
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <Select label="Origem" value={filterOrigin} onChange={setFilterOrigin as any} options={[
          { v: 'all', l: 'Todas' },
          { v: 'whatsapp', l: 'WhatsApp' },
          { v: 'website', l: 'Website' },
          { v: 'loja_fisica', l: 'Loja Física' },
        ]} />

        <Select label="Pagamento" value={filterPayment} onChange={setFilterPayment} options={[
          { v: 'all', l: 'Todos' },
          ...paymentOptions.map(p => ({ v: p, l: p })),
        ]} />

        <Select label="Data" value={filterDate} onChange={setFilterDate as any} options={[
          { v: 'all', l: 'Sempre' },
          { v: 'today', l: 'Hoje' },
          { v: '7d', l: 'Últimos 7d' },
          { v: '30d', l: 'Últimos 30d' },
        ]} />

        <Select label="Itens" value={filterItems} onChange={setFilterItems as any} options={[
          { v: 'all', l: 'Todos' },
          { v: 'with', l: 'Com items' },
          { v: 'without', l: 'Sem items' },
        ]} />

        {(search || filterOrigin !== 'all' || filterPayment !== 'all' || filterDate !== 'all' || filterItems !== 'all') && (
          <button
            onClick={() => { setSearch(''); setFilterOrigin('all'); setFilterPayment('all'); setFilterDate('all'); setFilterItems('all'); }}
            className="text-xs text-zinc-500 hover:text-black flex items-center gap-1"
          >
            <X size={12} /> limpar
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
        {filtered.length === 0 && !loading && (
          <p className="text-center text-zinc-400 text-sm py-16">
            {orders.length === 0 ? 'Nenhum pedido pendente.' : 'Nenhum pedido coincide com os filtros.'}
          </p>
        )}
        {filtered.map(o => {
          const noItems = !o.items || o.items.length === 0;
          return (
            <div key={o.id} className="p-6 flex flex-col md:flex-row gap-4 md:items-center">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-black bg-zinc-100 px-2 py-0.5 rounded">#{o.id}</span>
                  <span className="text-[10px] uppercase font-bold text-zinc-400">{o.origin || 'whatsapp'}</span>
                  <span className="text-[10px] uppercase font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                    {o.payment_method || '—'}
                  </span>
                  {noItems && (
                    <span className="text-[10px] uppercase font-bold bg-red-50 text-red-700 px-2 py-0.5 rounded-full">
                      sem items
                    </span>
                  )}
                </div>
                <p className="font-bold">{o.full_name || 'Cliente sem nome'}</p>
                <p className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                  <Phone size={11} /> {o.whatsapp_number || '—'}
                </p>

                {/* Bloco de envio CTT (só quando origem = whatsapp) */}
                {o.origin === 'whatsapp' && (
                  <div className="mt-2 p-2 rounded-lg bg-blue-50/50 border border-blue-100 space-y-1">
                    <p className="text-[10px] uppercase font-black text-blue-700 flex items-center gap-1">
                      <Send size={10} /> Dados de envio (CTT)
                    </p>
                    <p className="text-[11px] text-zinc-600 flex items-center gap-1">
                      <Mail size={10} className="text-zinc-400" />
                      {o.email || <span className="text-red-500 italic">sem email</span>}
                    </p>
                    <p className="text-[11px] text-zinc-600 flex items-start gap-1">
                      <MapPin size={10} className="text-zinc-400 mt-0.5" />
                      {o.address || <span className="text-red-500 italic">sem morada — não é possível enviar</span>}
                    </p>
                  </div>
                )}

                {!noItems && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {o.items.map(it => (
                      <span key={it.id} className="text-[11px] bg-zinc-50 border border-gray-100 px-2 py-1 rounded-lg">
                        <strong>{it.quantity}×</strong> {it.sku}
                        {typeof it.stock_quantity === 'number' && it.stock_quantity < it.quantity && (
                          <span className="text-red-500 ml-1">(stock {it.stock_quantity})</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-right md:min-w-[120px]">
                <p className="text-xs text-zinc-400">Total</p>
                <p className="text-xl font-black font-mono">€ {Number(o.total_amount).toFixed(2)}</p>
                <p className="text-[10px] text-zinc-400 mt-1">{new Date(o.created_at).toLocaleString('pt-PT')}</p>
              </div>

              <div className="flex gap-2 shrink-0">
                {noItems ? (
                  <button
                    onClick={() => setCompleting(o)}
                    disabled={actionId === o.id}
                    className="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition disabled:opacity-40"
                  >
                    Adicionar Itens
                  </button>
                ) : (
                  <button
                    onClick={() => confirmOrder(o)}
                    disabled={actionId === o.id}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition disabled:opacity-40 flex items-center gap-1"
                  >
                    <Check size={13} /> Confirmar
                  </button>
                )}
                <button
                  onClick={() => cancelOrder(o)}
                  disabled={actionId === o.id}
                  className="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition disabled:opacity-40 flex items-center gap-1"
                >
                  <Trash2 size={13} /> Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {completing && (
        <CompleteItemsModal
          order={completing}
          onClose={() => setCompleting(null)}
          onConfirm={(items) => confirmOrder(completing, items)}
          isSubmitting={actionId === completing.id}
        />
      )}
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase font-bold text-zinc-400">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-black"
      >
        {options.map(o => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </div>
  );
}

function CompleteItemsModal({
  order, onClose, onConfirm, isSubmitting,
}: {
  order: Order;
  onClose: () => void;
  onConfirm: (items: any[]) => void;
  isSubmitting: boolean;
}) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<CartLine[]>([]);

  useEffect(() => {
    api.get(`/products${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      .then(r => setVariants(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, [search]);

  const add = (v: Variant) => {
    if (Number(v.stock) <= 0) return;
    setPicked(prev => {
      const idx = prev.findIndex(p => p.sku === v.sku);
      if (idx >= 0) {
        const u = [...prev];
        if (u[idx].quantity >= Number(v.stock)) return prev;
        u[idx] = { ...u[idx], quantity: u[idx].quantity + 1 };
        return u;
      }
      return [
        ...prev,
        { sku: v.sku, name: v.name, color: v.color, size: v.size,
          unit_price: Number(v.price) || 0, quantity: 1, max_stock: Number(v.stock) },
      ];
    });
  };

  const total = picked.reduce((a, l) => a + l.unit_price * l.quantity, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[32px] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Completar itens — Pedido #{order.id}</h3>
            <p className="text-xs text-zinc-500">Total declarado: € {Number(order.total_amount).toFixed(2)}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-black"><X size={18} /></button>
        </div>

        <div className="p-6 border-b border-gray-50">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar produto..."
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-6 overflow-y-auto flex-1">
          {variants.slice(0, 30).map(v => {
            const out = Number(v.stock) <= 0;
            return (
              <button
                key={v.id || v.sku}
                disabled={out}
                onClick={() => add(v)}
                className={`text-left p-3 rounded-xl border text-xs ${
                  out ? 'opacity-40 cursor-not-allowed' : 'hover:border-black border-gray-100'
                }`}
              >
                <p className="font-bold truncate">{v.name}</p>
                <p className="text-[10px] text-zinc-400">{v.color} | {v.size}</p>
                <p className="font-mono font-black mt-1">€ {Number(v.price || 0).toFixed(2)}</p>
                <p className="text-[10px] text-zinc-500">stock {v.stock}</p>
              </button>
            );
          })}
        </div>

        <div className="border-t border-gray-50 p-6 space-y-2 max-h-60 overflow-y-auto">
          {picked.length === 0 && <p className="text-xs text-zinc-400">Adiciona pelo menos 1 item.</p>}
          {picked.map(l => (
            <div key={l.sku} className="flex items-center gap-2 text-sm">
              <span className="flex-1">
                <strong>{l.name}</strong> <span className="text-zinc-400">({l.sku})</span>
              </span>
              <input
                type="number"
                min={1}
                max={l.max_stock}
                value={l.quantity}
                onChange={e =>
                  setPicked(prev =>
                    prev.map(p =>
                      p.sku === l.sku
                        ? { ...p, quantity: Math.min(l.max_stock, Math.max(1, parseInt(e.target.value) || 1)) }
                        : p
                    )
                  )
                }
                className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm"
              />
              <span className="font-mono font-bold w-20 text-right">€ {(l.unit_price * l.quantity).toFixed(2)}</span>
              <button onClick={() => setPicked(prev => prev.filter(p => p.sku !== l.sku))} className="text-zinc-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-50 p-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-400">Total calculado</p>
            <p className="text-xl font-black font-mono">€ {total.toFixed(2)}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-zinc-100 text-sm font-bold">Cancelar</button>
            <button
              disabled={picked.length === 0 || isSubmitting}
              onClick={() => onConfirm(picked.map(l => ({ sku: l.sku, quantity: l.quantity, unit_price: l.unit_price })))}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-40"
            >
              {isSubmitting ? 'A confirmar...' : 'Confirmar Pagamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// CustomerCombobox — dropdown com pesquisa
// =============================================================
function CustomerCombobox({
  customers, query, setQuery, selected, onSelect, onClear,
}: {
  customers: Customer[];
  query: string;
  setQuery: (q: string) => void;
  selected: Customer | null;
  onSelect: (c: Customer) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClickOutside);
    return () => window.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      (c.full_name || '').toLowerCase().includes(q)
      || (c.whatsapp_number || '').toLowerCase().includes(q)
      || (c.email || '').toLowerCase().includes(q)
    );
  }, [customers, query]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm transition ${
          selected ? 'bg-zinc-50 border-gray-200' : 'bg-white border-gray-200 hover:border-black'
        }`}
      >
        {selected ? (
          <div className="flex-1 text-left min-w-0">
            <p className="font-bold truncate">{selected.full_name || 'Sem nome'}</p>
            <p className="text-xs text-zinc-500 font-mono truncate">{selected.whatsapp_number}</p>
          </div>
        ) : (
          <span className="text-zinc-400">Selecionar cliente…</span>
        )}
        {selected ? (
          <X
            size={14}
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="text-zinc-400 hover:text-black shrink-0"
          />
        ) : (
          <span className="text-zinc-400 text-xs shrink-0">▼</span>
        )}
      </button>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Procurar por nome, número ou email…"
                className="w-full pl-7 pr-2 py-2 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">Nenhum cliente encontrado.</p>
            ) : filtered.map(c => (
              <button
                key={c.id}
                onClick={() => { onSelect(c); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 border-b last:border-b-0 border-gray-100 ${
                  selected?.id === c.id ? 'bg-emerald-50' : ''
                }`}
              >
                <p className="font-bold truncate">{c.full_name || 'Sem nome'}</p>
                <p className="text-[11px] text-zinc-500 font-mono">{c.whatsapp_number}</p>
                {c.email && <p className="text-[11px] text-zinc-400 truncate">{c.email}</p>}
              </button>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-gray-100 bg-zinc-50/50 text-[10px] text-zinc-500 flex justify-between">
            <span>{filtered.length} de {customers.length}</span>
            <span>Cliente é obrigatório</span>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// OrderDetailsModal — visualização completa do pedido
// =============================================================
function OrderDetailsModal({
  orderId, onClose,
}: {
  orderId: number;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(`/${orderId}`)
      .then(res => { if (alive) setOrder(res.data); })
      .catch(err => { if (alive) setError(err?.response?.data?.error || 'Erro ao carregar pedido'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [orderId]);

  const itemsTotal = useMemo(() => {
    if (!order?.items) return 0;
    return order.items.reduce(
      (acc, it) => acc + Number(it.unit_price || 0) * Number(it.quantity || 0), 0
    );
  }, [order]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-[32px] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95"
      >
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h3 className="font-black text-xl">Pedido #{orderId}</h3>
            <p className="text-xs text-zinc-500">Detalhes completos do pedido</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-black p-2 rounded-lg hover:bg-zinc-50">
            <X size={20} />
          </button>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center py-16">
            <RefreshCw className="animate-spin text-zinc-400" size={24} />
          </div>
        )}

        {error && (
          <div className="p-8 text-center">
            <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
            <p className="text-sm text-red-600 font-bold">{error}</p>
          </div>
        )}

        {order && !loading && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Status + meta */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${statusBadge(order.status)}`}>
                {order.status.replace('_', ' ')}
              </span>
              <span className="text-[10px] uppercase font-bold bg-zinc-100 text-zinc-600 px-2 py-1 rounded-full">
                {order.origin || 'manual'}
              </span>
              <span className="text-[10px] uppercase font-bold bg-zinc-100 text-zinc-600 px-2 py-1 rounded-full">
                {order.payment_method || '—'}
              </span>
              <span className="text-[11px] text-zinc-500 ml-auto flex items-center gap-1">
                <Calendar size={12} />
                {new Date(order.created_at).toLocaleString('pt-PT')}
              </span>
            </div>

            {/* Cliente */}
            <div className="bg-zinc-50 rounded-2xl p-4 space-y-1">
              <p className="text-[10px] uppercase font-black text-zinc-500 mb-2">Cliente</p>
              <p className="font-bold">{order.full_name || '— sem nome —'}</p>
              {order.whatsapp_number && (
                <p className="text-xs text-zinc-600 font-mono flex items-center gap-1.5">
                  <Phone size={11} className="text-zinc-400" /> {order.whatsapp_number}
                </p>
              )}
              {order.email && (
                <p className="text-xs text-zinc-600 flex items-center gap-1.5">
                  <Mail size={11} className="text-zinc-400" /> {order.email}
                </p>
              )}
              {order.address && (
                <p className="text-xs text-zinc-600 flex items-start gap-1.5">
                  <MapPin size={11} className="text-zinc-400 mt-0.5" /> {order.address}
                </p>
              )}
            </div>

            {/* Items */}
            <div>
              <p className="text-[10px] uppercase font-black text-zinc-500 mb-2">
                Itens ({order.items?.length || 0})
              </p>
              {(!order.items || order.items.length === 0) ? (
                <p className="text-sm text-zinc-400 italic py-4 text-center bg-zinc-50 rounded-xl">
                  Pedido sem itens registados.
                </p>
              ) : (
                <div className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-50">
                  {order.items.map(it => (
                    <div key={it.id} className="p-3 flex items-center gap-3">
                      <Package size={16} className="text-zinc-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">
                          {it.product_name || it.sku}
                        </p>
                        <p className="text-[10px] text-zinc-400 uppercase">
                          {it.color || '—'} | {it.size || '—'} • <code className="font-mono">{it.sku}</code>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-mono font-black">{it.quantity}×</p>
                        <p className="text-[11px] text-zinc-500">€ {Number(it.unit_price || 0).toFixed(2)}</p>
                      </div>
                      <div className="w-20 text-right shrink-0">
                        <p className="text-sm font-mono font-black">
                          € {(Number(it.unit_price || 0) * Number(it.quantity || 0)).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totais */}
            <div className="bg-black text-white rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold opacity-60">Total do pedido</p>
                {Math.abs(Number(order.total_amount) - itemsTotal) > 0.01 && (
                  <p className="text-[10px] text-amber-300 mt-1">
                    ⚠ Soma dos itens (€ {itemsTotal.toFixed(2)}) difere do total declarado.
                  </p>
                )}
              </div>
              <p className="text-3xl font-black font-mono">€ {Number(order.total_amount).toFixed(2)}</p>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-zinc-100 text-sm font-bold hover:bg-zinc-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
