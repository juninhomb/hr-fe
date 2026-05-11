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
};

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
  /** Separador aberto pelo admin após «Expedir»: só recibo + diálogo de impressão. */
  const kiosk = searchParams.get('kiosk') === '1';

  const [order, setOrder] = useState<OrderPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!kiosk || !order || error) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (!cancelled) window.print();
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [kiosk, order, error]);

  const itemsTotal = useMemo(() => {
    if (!order?.items?.length) return 0;
    return order.items.reduce(
      (acc, it) => acc + Number(it.unit_price || 0) * Number(it.quantity || 0),
      0,
    );
  }, [order]);

  const isDelivery =
    order &&
    (order.is_delivery === true
      || order.is_delivery === 'true'
      || order.is_delivery === 1
      || order.is_delivery === '1');

  return (
    <div className={kiosk ? 'exp-kiosk' : undefined}>
      <style jsx global>{`
        /* Largura física do rolo (térmica ~55 mm) — folha = conteúdo */
        :root {
          --exp-paper-w: 55mm;
        }
        /* Página de impressão / PDF com a mesma largura do recibo */
        @page {
          size: 55mm auto;
          margin: 2mm;
        }
        @media print {
          html {
            width: var(--exp-paper-w);
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            width: var(--exp-paper-w) !important;
            max-width: var(--exp-paper-w) !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          body > div,
          #__next {
            width: var(--exp-paper-w) !important;
            max-width: var(--exp-paper-w) !important;
            margin: 0 !important;
            padding: 0 !important;
            min-height: 0 !important;
            background: transparent !important;
          }
          .exp-no-print {
            display: none !important;
          }
          .exp-receipt-outer {
            width: var(--exp-paper-w) !important;
            max-width: var(--exp-paper-w) !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            box-shadow: none !important;
          }
          .exp-receipt-wrap {
            width: var(--exp-paper-w) !important;
            max-width: var(--exp-paper-w) !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
          }
          .exp-receipt {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 1mm 0 !important;
            font-size: 9.5px;
            line-height: 1.25;
          }
        }
        /* Ecrã: folha com a mesma largura que vai imprimir */
        @media screen {
          .exp-receipt-outer {
            width: var(--exp-paper-w);
            max-width: var(--exp-paper-w);
            margin: 0 auto 1.5rem;
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
            background: #d4d4d8;
            padding: 1.25rem 0.5rem;
            min-height: 100vh;
            box-sizing: border-box;
          }
          .exp-kiosk .exp-receipt-wrap {
            background: #fff;
            min-height: auto;
            padding: 0.75rem 0;
          }
          .exp-kiosk .exp-receipt-outer {
            box-shadow: none;
            margin-bottom: 0;
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

      {!kiosk && (
      <div className="min-h-screen bg-zinc-100 text-black exp-no-print">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Link
              href="/?tab=sales"
              className="text-sm font-bold text-zinc-600 hover:text-black"
            >
              ← Voltar ao dashboard
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!order || loading || Boolean(error)}
              className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-40"
            >
              <Printer size={16} />
              Imprimir (55&nbsp;mm)
            </button>
          </div>
          <p className="text-xs text-zinc-600 leading-snug">
            O pedido deve estar <strong>Expedido</strong> no sistema (botão «Expedir pedido» nas vendas).
            Depois usa <strong>Enviar via CTT</strong> para marcar como enviado.
            A folha branca de baixo tem <strong>55&nbsp;mm</strong> de largura (como no PDF).
            No diálogo de impressão, se ainda vês A4, abre <strong>Mais definições</strong> e procura tamanho/escala compatível com a térmica ou imprime directamente na impressora 58&nbsp;mm.
          </p>
          {loading && (
            <div className="flex items-center gap-2 text-zinc-500 py-8 justify-center">
              <RefreshCw className="animate-spin" size={20} />
              A carregar pedido…
            </div>
          )}
          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex gap-2 text-red-800 text-sm">
              <AlertCircle className="shrink-0" size={20} />
              {error}
            </div>
          )}
        </div>
      </div>
      )}

      {kiosk && loading && (
        <div className="exp-no-print flex min-h-[50vh] items-center justify-center gap-2 bg-white px-4 text-sm text-zinc-500">
          <RefreshCw className="animate-spin shrink-0" size={18} />
          A preparar recibo…
        </div>
      )}
      {kiosk && error && !loading && (
        <div className="exp-no-print mx-auto max-w-sm p-6 text-center text-sm">
          <AlertCircle className="mx-auto mb-2 text-red-500" size={28} />
          <p className="font-bold text-red-800">{error}</p>
          <p className="mt-3 text-zinc-500">Podes fechar este separador e voltar ao admin.</p>
        </div>
      )}

      {order && !loading && !error && (
        <div className="exp-receipt-wrap print:!min-h-0 print:!p-0 print:!bg-white">
          {!isDelivery && (
            <p className="exp-no-print w-full max-w-md mx-auto px-2 text-center text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              Este pedido não está marcado como entrega ao domicílio — confirma no pedido se o documento faz sentido.
            </p>
          )}
          <div className="exp-receipt-outer rounded-none overflow-hidden print:!rounded-none">
          <div className="exp-receipt bg-white print:bg-white px-1 py-2 rounded-none">
            <h1>EXPEDIÇÃO</h1>
            <p className="text-center font-black mt-0 mb-1">Pedido #{order.id}</p>
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

            <hr className="rule" />

            <p className="font-black text-[10px] uppercase tracking-wide mt-1 mb-1">Envio</p>
            <p>{order.address?.trim() || '— sem morada —'}</p>
            {order.customer_notes?.trim() && (
              <>
                <p className="font-black text-[10px] uppercase mt-2 mb-0">Notas</p>
                <p className="muted whitespace-pre-wrap">{order.customer_notes.trim()}</p>
              </>
            )}

            <hr className="rule" />

            <p className="font-black text-[10px] uppercase tracking-wide mb-1">Artigos</p>
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

            <hr className="rule" />
            <p className="muted text-[8px] text-center mt-2 px-1">
              Controlo interno — após embalar, marcar «Enviar via CTT» no admin.
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
