'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, CreditCard, Loader2 } from 'lucide-react';
import { API_BASE } from '../../../lib/api';

const SESSION_RE = /^cs_[A-Za-z0-9_]+$/;

type Phase = 'idle' | 'working' | 'error';

/**
 * Após pagamento Stripe iniciado no PDV: verifica a sessão (como o site)
 * e envia o staff de volta ao separador Vendas com toast adequado.
 */
export default function PdvStripeReturnPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const canceled = params.get('canceled') === '1';
    const sessionId = params.get('session_id')?.trim() ?? '';

    if (canceled) {
      try {
        sessionStorage.setItem(
          'hrstore-pdv-stripe-toast',
          JSON.stringify({ kind: 'canceled' }),
        );
      } catch {
        /* noop */
      }
      window.location.replace('/dashboard?tab=sales');
      return;
    }

    if (!sessionId || !SESSION_RE.test(sessionId)) {
      setPhase('error');
      setError('Link de retorno inválido ou incompleto.');
      return;
    }

    setPhase('working');
    void fetch(`${API_BASE}/api/public/orders/stripe-session-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          updated?: boolean;
          order_id?: number | null;
          reason?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || 'Não foi possível confirmar o pagamento.');
        }
        if (data.updated === false && data.reason === 'not_paid') {
          setPhase('error');
          setError(
            'O Stripe ainda não confirmou o pagamento neste momento. Consulta o estado do pedido em Vendas & PDV ou tenta outra vez em alguns segundos.',
          );
          return;
        }
        if (data.updated === false && data.reason === 'amount_mismatch') {
          setPhase('error');
          setError(
            'O valor pago no Stripe não coincide com o pedido. Verifica o pedido nas vendas ou contacta o suporte.',
          );
          return;
        }
        try {
          sessionStorage.setItem(
            'hrstore-pdv-stripe-toast',
            JSON.stringify({
              kind: 'paid',
              orderId: data.order_id ?? null,
              updated: data.updated !== false,
              reason: data.reason ?? null,
            }),
          );
        } catch {
          /* noop */
        }
        window.location.replace('/dashboard?tab=sales');
      })
      .catch((e: unknown) => {
        setPhase('error');
        setError(e instanceof Error ? e.message : 'Erro ao confirmar o pagamento.');
      });
  }, []);

  if (phase === 'error' && error) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm max-w-md w-full p-8 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <AlertCircle size={28} />
          </div>
          <h1 className="text-xl font-black">Não foi possível confirmar</h1>
          <p className="text-sm text-zinc-600">{error}</p>
          <p className="text-xs text-zinc-400">
            O pedido pode continuar pendente. Verifica em <strong>Vendas &amp; PDV</strong> ou espera pelo webhook Stripe.
          </p>
          <Link
            href="/dashboard?tab=sales"
            className="inline-flex items-center justify-center w-full py-3 rounded-xl bg-black text-white font-bold text-sm"
          >
            Voltar às vendas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm max-w-md w-full p-8 text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center">
          {phase === 'working' ? (
            <Loader2 size={28} className="animate-spin" />
          ) : (
            <CreditCard size={28} />
          )}
        </div>
        <h1 className="text-xl font-black flex items-center justify-center gap-2">
          <Check size={22} className="text-emerald-600" />
          A confirmar pagamento…
        </h1>
        <p className="text-sm text-zinc-500">
          Aguarda um momento. Vais ser redireccionado para <strong>Vendas &amp; PDV</strong>.
        </p>
      </div>
    </div>
  );
}
