'use client';

import {
  Suspense, useEffect, useMemo, useState,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Printer, RefreshCw } from 'lucide-react';
import api from '../../../lib/api';

type OrderItem = {
  id: number;
  sku: string;
  product_name?: string;
  color?: string;
  size?: string;
  quantity: number;
  unit_price?: number | string | null;
};

type ReturnedItem = {
  sku: string;
  quantity: number | string;
  unit_price: number | string;
  source_order_item_id?: number;
};

type OrderPayload = {
  id: number;
  status: string;
  origin?: string;
  payment_method?: string;
  created_at: string;
  full_name?: string;
  whatsapp_number?: string;
  email?: string;
  address?: string;
  customer_notes?: string | null;
  items?: OrderItem[];
  total_amount: number | string;
  shipping_fee?: number | string;
  is_delivery?: boolean | number | string;
  discount_amount?: number | string | null;
  coupon_code?: string | null;
  parent_order_id?: number | null;
  returned_items?: ReturnedItem[] | null;
};

function num(v: string | null | undefined, fallback: number): number {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function formatPtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-PT');
  } catch {
    return iso;
  }
}

function ExpedicaoPrintInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdRaw = searchParams.get('orderId');
  const orderId = orderIdRaw ? parseInt(orderIdRaw, 10) : NaN;

  const paperMm = num(
    searchParams.get('paper'),
    num(process.env.NEXT_PUBLIC_RECEIPT_PAPER_MM, 80),
  );
  const contentMm = num(
    searchParams.get('content'),
    num(process.env.NEXT_PUBLIC_RECEIPT_CONTENT_MM, 72),
  );

  const [order, setOrder] = useState<OrderPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Remove parâmetros legados (kiosk/auto) que causam loop no Windows. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const u = new URL(window.location.href);
    let changed = false;
    if (u.searchParams.has('kiosk')) {
      u.searchParams.delete('kiosk');
      changed = true;
    }
    if (u.searchParams.get('auto') === '1') {
      u.searchParams.delete('auto');
      changed = true;
    }
    if (changed) {
      window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('hrstore-token')) {
      router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    if (!Number.isFinite(orderId) || orderId < 1) {
      setLoading(false);
      setError('ID de pedido inválido.');
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .get<OrderPayload>(`/${orderId}`)
      .then((res) => {
        if (!alive) return;
        setOrder(res.data);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.response?.data?.error || 'Não foi possível carregar o pedido.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [orderId]);

  const itemsTotal = useMemo(() => {
    if (!order?.items?.length) return 0;
    return order.items.reduce(
      (acc, it) => acc + Number(it.unit_price || 0) * Number(it.quantity || 0),
      0,
    );
  }, [order]);

  const isTroca = String(order?.origin || '').toLowerCase() === 'troca';

  const returnedItems: ReturnedItem[] = useMemo(() => {
    if (!order?.returned_items) return [];
    if (Array.isArray(order.returned_items)) return order.returned_items;
    try {
      const parsed = JSON.parse(order.returned_items as unknown as string);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [order]);

  const returnedTotal = useMemo(
    () => returnedItems.reduce(
      (a, r) => a + Number(r.unit_price || 0) * Number(r.quantity || 0),
      0,
    ),
    [returnedItems],
  );

  const isDelivery =
    order &&
    (order.is_delivery === true
      || order.is_delivery === 'true'
      || order.is_delivery === 1
      || order.is_delivery === '1');

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  return (
    <div className="min-h-screen bg-zinc-100 text-black">
      <style jsx global>{`
        :root {
          --exp-paper-w: ${contentMm}mm;
        }
        @page {
          margin: 0;
        }
        @media print {
          html,
          body,
          #__next,
          body > div {
            width: var(--exp-paper-w) !important;
            max-width: var(--exp-paper-w) !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .exp-no-print {
            display: none !important;
          }
          .exp-receipt-wrap,
          .exp-receipt-outer {
            display: block !important;
            width: var(--exp-paper-w) !important;
            max-width: var(--exp-paper-w) !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            box-shadow: none !important;
          }
          .exp-receipt {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 1mm 1.5mm !important;
            font-size: 12px;
            line-height: 1.3;
            color: #000 !important;
          }
          .exp-delivery-badge {
            background: #000 !important;
            color: #fff !important;
          }
          .exp-receipt > *:last-child {
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
            border-bottom: 0 !important;
          }
        }
        @media screen {
          .exp-receipt-outer {
            width: var(--exp-paper-w);
            max-width: var(--exp-paper-w);
            margin: 0 auto;
            box-sizing: border-box;
            background: #fff;
            box-shadow:
              0 0 0 1px rgba(0, 0, 0, 0.08),
              0 8px 24px rgba(0, 0, 0, 0.12);
          }
          .exp-receipt-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 1rem 0.5rem 2rem;
            box-sizing: border-box;
          }
        }
        .exp-receipt {
          font-family: ui-monospace, 'Cascadia Code', 'Segoe UI Mono', monospace;
          box-sizing: border-box;
          width: 100%;
          max-width: var(--exp-paper-w);
          margin: 0 auto;
          font-size: 11px;
          line-height: 1.3;
          color: #000;
          word-break: break-word;
        }
        .exp-receipt h1 {
          font-size: 12px;
          font-weight: 900;
          text-align: center;
          margin: 0 0 6px 0;
          letter-spacing: 0.02em;
        }
        .exp-delivery-badge {
          display: block;
          width: 100%;
          box-sizing: border-box;
          margin: 0 0 8px 0;
          padding: 5px 6px;
          background: #000;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          text-align: center;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          line-height: 1.25;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .exp-receipt .rule {
          border: none;
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .exp-receipt .row {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          margin: 2px 0;
        }
        .exp-receipt .muted {
          font-size: 9px;
          opacity: 0.85;
        }
        .exp-line {
          margin: 4px 0;
          padding-bottom: 4px;
          border-bottom: 1px dotted #ccc;
        }
      `}</style>

      <header className="exp-no-print sticky top-0 z-10 border-b border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <Link
            href="/?tab=sales"
            className="text-sm font-bold text-zinc-600 hover:text-black"
          >
            ← Dashboard
          </Link>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!order || loading || Boolean(error)}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-40"
          >
            <Printer size={16} />
            Imprimir ({paperMm}&nbsp;mm)
          </button>
        </div>
      </header>

      <main className="exp-no-print mx-auto max-w-lg px-4 py-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500">
            <RefreshCw className="animate-spin shrink-0" size={20} />
            A carregar recibo…
          </div>
        )}
        {error && !loading && (
          <div className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="shrink-0" size={20} />
            {error}
          </div>
        )}
        {!loading && !error && order && (
          <p className="mb-3 text-center text-xs text-zinc-500">
            Confirma o recibo abaixo e clica <strong>Imprimir</strong>.
            No diálogo: impressora térmica, papel tipo recibo/roll (não altura fixa).
          </p>
        )}
      </main>

      {order && !loading && !error && (
        <div className="exp-receipt-wrap print:!min-h-0 print:!p-0 print:!bg-white">
          <div className="exp-receipt-outer rounded-none overflow-hidden print:!rounded-none">
            <div className="exp-receipt bg-white px-1 py-2">
              <h1>{isTroca ? 'RECIBO DE TROCA' : 'EXPEDIÇÃO'}</h1>
              {!isTroca && (
                <p className="exp-delivery-badge">
                  {isDelivery ? 'CTT — ENVIO AO DOMICÍLIO' : 'RECOLHA NA LOJA'}
                </p>
              )}
              <p className="text-center font-black mt-0 mb-1">
                {isTroca ? `Troca #${order.id}` : `Pedido #${order.id}`}
              </p>
              {isTroca && order.parent_order_id != null && (
                <p className="muted text-center">do pedido #{order.parent_order_id}</p>
              )}
              <p className="muted text-center">{formatPtDate(order.created_at)}</p>
              <p className="muted text-center">
                {(order.origin || '—').toUpperCase()} · {order.payment_method || '—'}
              </p>
              <p className="muted text-center">
                Estado: <strong>{String(order.status || '').replace('_', ' ')}</strong>
              </p>

              <hr className="rule" />

              <p className="font-black text-[10px] uppercase tracking-wide mt-1 mb-1">Cliente</p>
              <p>{order.full_name || '—'}</p>
              {order.whatsapp_number && <p className="muted">{order.whatsapp_number}</p>}
              {order.email && <p className="muted">{order.email}</p>}

              {!isTroca && (
                <>
                  <hr className="rule" />
                  <p className="font-black text-[10px] uppercase tracking-wide mt-1 mb-1">Envio</p>
                  <p>{order.address?.trim() || '— sem morada —'}</p>
                  {order.customer_notes?.trim() && (
                    <>
                      <p className="font-black text-[10px] uppercase mt-2 mb-0">Notas</p>
                      <p className="muted whitespace-pre-wrap">{order.customer_notes.trim()}</p>
                    </>
                  )}
                </>
              )}

              {isTroca && returnedItems.length > 0 && (
                <>
                  <hr className="rule" />
                  <p className="font-black text-[10px] uppercase tracking-wide mb-1">Devolvidos</p>
                  {returnedItems.map((r, idx) => (
                    <div key={`${r.sku}-${idx}`} className="exp-line">
                      <p className="font-bold">
                        {r.quantity}× <span className="font-mono">{r.sku}</span>
                      </p>
                      <div className="row font-mono text-[10px]">
                        <span />
                        <span>
                          − € {(Number(r.unit_price || 0) * Number(r.quantity || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="row font-mono">
                    <span>Subtotal devolvido</span>
                    <span>− € {returnedTotal.toFixed(2)}</span>
                  </div>
                </>
              )}

              <hr className="rule" />

              <p className="font-black text-[10px] uppercase tracking-wide mb-1">
                {isTroca ? 'Novos artigos' : 'Artigos'}
              </p>
              {(order.items || []).map((it) => (
                <div key={it.id} className="exp-line">
                  <p className="font-bold">
                    {it.quantity}× {it.product_name || it.sku}
                  </p>
                  <p className="muted text-[9px]">
                    {[it.color, it.size].filter(Boolean).join(' · ') || '—'}
                    {' · '}
                    <span className="font-mono">{it.sku}</span>
                  </p>
                  <div className="row font-mono text-[10px]">
                    <span />
                    <span>
                      € {(Number(it.unit_price || 0) * Number(it.quantity || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}

              <hr className="rule" />

              {isTroca ? (
                <>
                  <div className="row font-mono">
                    <span>Subtotal novos</span>
                    <span>€ {itemsTotal.toFixed(2)}</span>
                  </div>
                  <div className="row font-mono">
                    <span>Devolvido</span>
                    <span>− € {returnedTotal.toFixed(2)}</span>
                  </div>
                  <div className="row font-black mt-2 text-[12px]">
                    <span>DIFERENÇA</span>
                    <span>€ {Number(order.total_amount || 0).toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="row font-mono">
                    <span>Subtotal</span>
                    <span>€ {itemsTotal.toFixed(2)}</span>
                  </div>
                  {Number(order.discount_amount || 0) > 0.004 && (
                    <div className="row font-mono">
                      <span>Desc.{order.coupon_code ? ` (${order.coupon_code})` : ''}</span>
                      <span>− € {Number(order.discount_amount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(order.shipping_fee || 0) > 0.004 && (
                    <div className="row font-mono">
                      <span>Portes</span>
                      <span>€ {Number(order.shipping_fee || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="row font-black mt-2 text-[12px]">
                    <span>TOTAL</span>
                    <span>€ {Number(order.total_amount || 0).toFixed(2)}</span>
                  </div>
                </>
              )}

              <hr className="rule" />
              <p className="muted text-[8px] text-center mt-2 px-1">
                {isTroca
                  ? 'Recibo de troca — controlo interno.'
                  : 'Controlo interno — após embalar, marcar «Enviar via CTT» no admin.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExpedicaoPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm">
          A carregar…
        </div>
      }
    >
      <ExpedicaoPrintInner />
    </Suspense>
  );
}
