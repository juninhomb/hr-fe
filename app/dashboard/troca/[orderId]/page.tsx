'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Search, Plus, Minus, Trash2, RefreshCw, AlertCircle, Check,
  RotateCcw, ShoppingBag, CreditCard, Banknote, MessageCircle, Printer,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '../../../../lib/api';
import { openExpedicaoPdfTab } from '../../../../lib/orderDelivery';

type OriginalItem = {
  id: number;
  sku: string;
  product_name?: string;
  color?: string | null;
  size?: string | null;
  quantity: number;
  unit_price: number | string;
};

type OriginalOrder = {
  id: number;
  customer_id: number | null;
  full_name?: string;
  whatsapp_number?: string;
  email?: string;
  total_amount: number | string;
  status: string;
  origin?: string;
  created_at: string;
  items: OriginalItem[];
};

type Variant = {
  id: number;
  name: string;
  price: number | string;
  sku: string;
  color?: string | null;
  size?: string | null;
  stock: number | string;
};

type ReturnedRow = {
  sku: string;
  productName: string;
  color: string | null;
  size: string | null;
  unit_price: number;
  maxAllowed: number;
  quantity: number;
};

type NewLine = {
  sku: string;
  name: string;
  color?: string | null;
  size?: string | null;
  unit_price: number;
  quantity: number;
  max_stock: number;
};

type Payment = 'dinheiro' | 'stripe' | 'a_definir';

const ELIGIBLE_STATUSES = new Set(['pago', 'expedido', 'enviado', 'entregue']);

function fmtEur(n: number) {
  return `€ ${n.toFixed(2)}`;
}

export default function TrocaPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();

  const [original, setOriginal] = useState<OriginalOrder | null>(null);
  const [alreadyReturned, setAlreadyReturned] = useState<Record<string, number>>({});
  const [returnedRows, setReturnedRows] = useState<ReturnedRow[]>([]);

  const [variants, setVariants] = useState<Variant[]>([]);
  const [search, setSearch] = useState('');
  const [newLines, setNewLines] = useState<NewLine[]>([]);

  const [payment, setPayment] = useState<Payment>('dinheiro');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Fetch original order + already-returned summary
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [oRes, sRes] = await Promise.all([
          api.get<OriginalOrder>(`/${orderId}`),
          api.get<Record<string, number>>(`/troca/${orderId}/returned-summary`),
        ]);
        if (!alive) return;
        const ord = oRes.data;
        if (!ELIGIBLE_STATUSES.has(String(ord.status))) {
          setError(
            `Pedido #${ord.id} está «${ord.status}» — só é possível trocar pedidos pagos, expedidos, enviados ou entregues.`,
          );
        }
        if (String(ord.origin || '').toLowerCase() === 'troca') {
          setError('Não é possível criar troca de uma troca.');
        }
        setOriginal(ord);
        setAlreadyReturned(sRes.data || {});
        // Pré-popula com a quantidade máxima disponível para devolver
        // (cliente normalmente devolve tudo o que comprou; pode ajustar depois).
        const ret: ReturnedRow[] = (ord.items || []).map((it) => {
          const already = (sRes.data || {})[it.sku] || 0;
          const maxAllowed = Math.max(0, Number(it.quantity) - already);
          return {
            sku: it.sku,
            productName: it.product_name || it.sku,
            color: it.color ?? null,
            size: it.size ?? null,
            unit_price: Number(it.unit_price),
            maxAllowed,
            quantity: maxAllowed,
          };
        });
        setReturnedRows(ret);
      } catch (err: any) {
        if (!alive) return;
        setError(err?.response?.data?.error || 'Erro ao carregar pedido.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [orderId]);

  // Search variants (debounce simples)
  useEffect(() => {
    const t = setTimeout(() => {
      api.get<Variant[]>(`/products${search ? `?search=${encodeURIComponent(search)}` : ''}`)
        .then((r) => setVariants(Array.isArray(r.data) ? r.data : []))
        .catch(() => setVariants([]));
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  const returnedTotal = useMemo(
    () => returnedRows.reduce((a, r) => a + r.unit_price * r.quantity, 0),
    [returnedRows],
  );
  const newTotal = useMemo(
    () => newLines.reduce((a, l) => a + l.unit_price * l.quantity, 0),
    [newLines],
  );
  const diff = useMemo(() => Math.round((newTotal - returnedTotal) * 100) / 100, [newTotal, returnedTotal]);

  const canConfirm =
    !loading &&
    !error &&
    !submitting &&
    returnedRows.some((r) => r.quantity > 0) &&
    newLines.length > 0 &&
    diff >= 0;

  const addVariant = (v: Variant) => {
    const stock = Number(v.stock);
    if (stock <= 0) return;
    setNewLines((prev) => {
      const idx = prev.findIndex((p) => p.sku === v.sku);
      if (idx >= 0) {
        const u = [...prev];
        if (u[idx].quantity >= stock) return prev;
        u[idx] = { ...u[idx], quantity: u[idx].quantity + 1 };
        return u;
      }
      return [
        ...prev,
        {
          sku: v.sku,
          name: v.name,
          color: v.color ?? null,
          size: v.size ?? null,
          unit_price: Number(v.price) || 0,
          quantity: 1,
          max_stock: stock,
        },
      ];
    });
  };

  const updateReturnedQty = (sku: string, q: number) => {
    setReturnedRows((prev) =>
      prev.map((r) =>
        r.sku === sku ? { ...r, quantity: Math.max(0, Math.min(r.maxAllowed, q)) } : r,
      ),
    );
  };

  const updateNewQty = (sku: string, q: number) => {
    setNewLines((prev) =>
      prev
        .map((l) => (l.sku === sku ? { ...l, quantity: Math.max(0, Math.min(l.max_stock, q)) } : l))
        .filter((l) => l.quantity > 0),
    );
  };

  const removeNew = (sku: string) =>
    setNewLines((prev) => prev.filter((l) => l.sku !== sku));

  const confirmTroca = async () => {
    if (!original || !canConfirm) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = {
        original_order_id: original.id,
        returned: returnedRows
          .filter((r) => r.quantity > 0)
          .map((r) => ({ sku: r.sku, quantity: r.quantity })),
        new_items: newLines.map((l) => ({ sku: l.sku, quantity: l.quantity })),
        payment_method: payment,
        notes: notes.trim() || undefined,
      };
      const res = await api.post<{
        orderId: number;
        diff: number;
        status: string;
        payment_method: string;
      }>('/troca', payload);

      setFeedback({
        type: 'success',
        msg: `Troca registada — pedido #${res.data.orderId} criado. Estado: ${res.data.status}. Diferença: ${fmtEur(res.data.diff)}.`,
      });
      // Abre sempre preview PDF (sem fallback HTML para manter comportamento único).
      const openedPdf = openExpedicaoPdfTab(res.data.orderId);
      if (!openedPdf) {
        throw new Error('Não foi possível abrir preview PDF do recibo.');
      }
      // Volta ao dashboard depois de 2s
      setTimeout(() => router.push('/dashboard'), 1800);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        msg: err?.response?.data?.error || 'Erro ao criar troca.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-500">
          <RefreshCw size={18} className="animate-spin" /> A carregar pedido…
        </div>
      </div>
    );
  }

  if (error || !original) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
          <AlertCircle className="mx-auto text-red-500 mb-3" size={32} />
          <p className="font-black text-lg">{error || 'Pedido não encontrado.'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-zinc-700 hover:text-black"
          >
            <ArrowLeft size={14} /> Voltar ao dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-600"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black tracking-tight">
              <RotateCcw size={18} className="inline -mt-1 mr-2 text-violet-600" />
              Troca · Pedido #{original.id}
            </h1>
            <p className="text-xs text-zinc-500">
              Cliente: <span className="font-bold text-zinc-800">{original.full_name || '—'}</span>
              {original.whatsapp_number && (
                <span className="font-mono ml-2">· {original.whatsapp_number}</span>
              )}
              <span className="ml-3 px-2 py-0.5 rounded-full bg-zinc-100 text-[10px] uppercase font-bold tracking-wider">
                {original.status}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COL LEFT — Devolver */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <header className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
            <RotateCcw size={16} className="text-amber-600" />
            <h2 className="font-black text-base flex-1">Devolver</h2>
            <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">
              Pedido original
            </span>
          </header>

          <div className="p-4 space-y-2 flex-1">
            {returnedRows.length === 0 && (
              <p className="text-sm text-zinc-400 text-center py-6">Sem itens no pedido original.</p>
            )}
            {returnedRows.map((r) => {
              const already = alreadyReturned[r.sku] || 0;
              const totalOrig = r.maxAllowed + already;
              const fully = r.maxAllowed === 0;
              return (
                <div
                  key={r.sku}
                  className={`flex items-center gap-3 p-3 rounded-2xl border ${
                    r.quantity > 0
                      ? 'border-amber-300 bg-amber-50/60'
                      : 'border-gray-100 bg-zinc-50/40'
                  } ${fully ? 'opacity-50' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{r.productName}</p>
                    <p className="text-[11px] text-zinc-500">
                      {(r.color || '—')} · {(r.size || '—')} · <span className="font-mono">{r.sku}</span>
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {fmtEur(r.unit_price)} cada · {totalOrig} vendid{totalOrig > 1 ? 'os' : 'o'}
                      {already > 0 && <span className="text-rose-600"> · {already} já devolvid{already > 1 ? 'os' : 'o'}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateReturnedQty(r.sku, r.quantity - 1)}
                      disabled={r.quantity <= 0}
                      className="h-8 w-8 rounded-lg border border-gray-200 hover:bg-zinc-100 disabled:opacity-30 inline-flex items-center justify-center"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={r.maxAllowed}
                      value={r.quantity}
                      onChange={(e) => updateReturnedQty(r.sku, parseInt(e.target.value || '0', 10))}
                      disabled={fully}
                      className="w-14 px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-bold text-center disabled:opacity-50"
                    />
                    <button
                      onClick={() => updateReturnedQty(r.sku, r.quantity + 1)}
                      disabled={r.quantity >= r.maxAllowed}
                      className="h-8 w-8 rounded-lg border border-gray-200 hover:bg-zinc-100 disabled:opacity-30 inline-flex items-center justify-center"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <footer className="px-6 py-4 border-t border-gray-50 bg-zinc-50/40 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-zinc-500">
              Subtotal devolvido
            </span>
            <span className="font-mono font-black text-lg">{fmtEur(returnedTotal)}</span>
          </footer>
        </section>

        {/* COL RIGHT — Novos artigos */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <header className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
            <ShoppingBag size={16} className="text-emerald-600" />
            <h2 className="font-black text-base flex-1">Novos artigos</h2>
          </header>

          {/* Search */}
          <div className="p-4 border-b border-gray-50">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar SKU, nome, cor…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
          </div>

          {/* Picker grid */}
          <div className="p-4 grid grid-cols-2 gap-2 max-h-72 overflow-y-auto border-b border-gray-50">
            {variants.slice(0, 24).map((v) => {
              const stock = Number(v.stock);
              const out = stock <= 0;
              return (
                <button
                  key={v.id || v.sku}
                  disabled={out}
                  onClick={() => addVariant(v)}
                  className={`text-left p-3 rounded-xl border text-xs transition ${
                    out
                      ? 'opacity-40 cursor-not-allowed border-gray-100'
                      : 'border-gray-100 hover:border-black hover:bg-zinc-50/60'
                  }`}
                >
                  <p className="font-bold truncate">{v.name}</p>
                  <p className="text-[10px] text-zinc-500 truncate">
                    {(v.color || '—')} · {(v.size || '—')}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="font-mono font-black">{fmtEur(Number(v.price) || 0)}</span>
                    <span className="text-[10px] text-zinc-400">stock {stock}</span>
                  </div>
                </button>
              );
            })}
            {variants.length === 0 && (
              <p className="col-span-2 text-xs text-zinc-400 text-center py-4">
                Sem resultados.
              </p>
            )}
          </div>

          {/* Cart */}
          <div className="p-4 space-y-2 flex-1 min-h-[120px]">
            {newLines.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-4">
                Selecciona artigos acima para esta troca.
              </p>
            )}
            {newLines.map((l) => (
              <div
                key={l.sku}
                className="flex items-center gap-3 p-3 rounded-2xl border border-emerald-200 bg-emerald-50/60"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{l.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {(l.color || '—')} · {(l.size || '—')} · <span className="font-mono">{l.sku}</span>
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{fmtEur(l.unit_price)} cada</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateNewQty(l.sku, l.quantity - 1)}
                    className="h-8 w-8 rounded-lg border border-gray-200 hover:bg-zinc-100 inline-flex items-center justify-center"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-10 text-center font-bold">{l.quantity}</span>
                  <button
                    onClick={() => updateNewQty(l.sku, l.quantity + 1)}
                    disabled={l.quantity >= l.max_stock}
                    className="h-8 w-8 rounded-lg border border-gray-200 hover:bg-zinc-100 disabled:opacity-30 inline-flex items-center justify-center"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => removeNew(l.sku)}
                    className="ml-1 text-zinc-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <footer className="px-6 py-4 border-t border-gray-50 bg-zinc-50/40 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-zinc-500">
              Subtotal novos
            </span>
            <span className="font-mono font-black text-lg">{fmtEur(newTotal)}</span>
          </footer>
        </section>
      </div>

      {/* Footer fixo */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center gap-4">
          {/* Diff */}
          <div className="flex-1 min-w-[200px]">
            <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Diferença</p>
            <p
              className={`text-2xl font-black font-mono ${
                diff < 0 ? 'text-rose-600' : diff > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {diff < 0 ? '−' : ''}
              {fmtEur(Math.abs(diff))}
            </p>
            {diff < 0 && (
              <p className="text-[11px] font-bold text-rose-600 mt-0.5">
                Reembolso não suportado — gerir manualmente.
              </p>
            )}
            {diff > 0 && (
              <p className="text-[11px] text-amber-700 mt-0.5">Cliente paga {fmtEur(diff)}.</p>
            )}
            {diff === 0 && newLines.length > 0 && returnedRows.some((r) => r.quantity > 0) && (
              <p className="text-[11px] text-emerald-700 mt-0.5">Swap directo, sem pagamento.</p>
            )}
          </div>

          {/* Payment */}
          <div className="flex items-center gap-2">
            {(
              [
                { v: 'dinheiro' as const, l: 'Dinheiro', icon: <Banknote size={14} /> },
                { v: 'stripe' as const, l: 'Stripe', icon: <CreditCard size={14} /> },
                { v: 'a_definir' as const, l: 'MB Way / transf.', icon: <MessageCircle size={14} /> },
              ]
            ).map((p) => {
              const active = payment === p.v;
              const disabled = diff === 0; // se diff = 0 não cobra
              return (
                <button
                  key={p.v}
                  type="button"
                  disabled={disabled}
                  onClick={() => setPayment(p.v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                    active && !disabled
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-zinc-700 border-gray-200 hover:border-black'
                  } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {p.icon}
                  {p.l}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2.5 rounded-xl bg-zinc-100 text-sm font-bold hover:bg-zinc-200"
            >
              Cancelar
            </button>
            <button
              disabled={!canConfirm}
              onClick={confirmTroca}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> A confirmar…
                </>
              ) : (
                <>
                  <Printer size={14} /> Confirmar troca
                </>
              )}
            </button>
          </div>
        </div>

        {feedback && (
          <div className="max-w-7xl mx-auto px-6 pb-3">
            <div
              className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-full ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {feedback.type === 'success' ? <Check size={12} /> : <AlertCircle size={12} />}
              {feedback.msg}
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-6 pb-4">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas internas (opcional)…"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
      </div>
    </div>
  );
}
