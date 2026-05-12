'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, CreditCard, Loader2 } from 'lucide-react';
import publicApi from '../../../lib/publicApi';

const SESSION_RE = /^cs_[A-Za-z0-9_]+$/;

function hasStaffToken(): boolean {
  try {
    return Boolean(typeof window !== 'undefined' && window.localStorage.getItem('hrstore-token'));
  } catch {
    return false;
  }
}

function redirectAfterStripeOutcome(kind: 'paid' | 'canceled') {
  window.location.replace(kind === 'canceled' ? '/pagamento-cancelado' : '/pagamento-obrigado');
}

type Phase = 'idle' | 'working' | 'error';

/**
 * Retorno Stripe após Checkout do PDV (`STRIPE_ADMIN_PUBLIC_ORIGIN`).
 *
 * Confirma a sessão em `/api/public/orders/stripe-session-verify` (com `NEXT_PUBLIC_PUBLIC_API_TOKEN`).
 * Após pagamento: **sempre** `/pagamento-obrigado` ou `/pagamento-cancelado` (cliente não vê vendas admin).
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
        if (hasStaffToken()) {
          sessionStorage.setItem(
            'hrstore-pdv-stripe-toast',
            JSON.stringify({ kind: 'canceled' }),
          );
        }
      } catch {
        /* noop */
      }
      redirectAfterStripeOutcome('canceled');
      return;
    }

    if (!sessionId || !SESSION_RE.test(sessionId)) {
      setPhase('error');
      setError('Link de retorno inválido ou incompleto.');
      return;
    }

    setPhase('working');
    void publicApi
      .post<{ error?: string; updated?: boolean; order_id?: number | null; reason?: string }>(
        '/orders/stripe-session-verify',
        { session_id: sessionId },
      )
      .then((response) => {
        const data = response.data ?? {};
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
          if (hasStaffToken()) {
            sessionStorage.setItem(
              'hrstore-pdv-stripe-toast',
              JSON.stringify({
                kind: 'paid',
                orderId: data.order_id ?? null,
                updated: data.updated !== false,
                reason: data.reason ?? null,
              }),
            );
          }
        } catch {
          /* noop */
        }
        redirectAfterStripeOutcome('paid');
      })
      .catch((e: unknown) => {
        setPhase('error');
        let msg =
          e && typeof e === 'object' && 'message' in e && typeof e.message === 'string'
            ? e.message
            : 'Erro ao confirmar o pagamento.';
        const ax = e as {
          response?: { status?: number; data?: { error?: string } };
          message?: string;
        };
        const status = ax.response?.status;
        const backendErr = ax.response?.data?.error?.trim();
        if (backendErr) msg = backendErr;
        if (status === 403 && backendErr?.includes('API pública')) {
          msg +=
            ' Na build do dashboard, define NEXT_PUBLIC_PUBLIC_API_TOKEN com o mesmo valor que PUBLIC_API_TOKEN no servidor (como no site público).';
        }
        setError(msg);
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
            O pagamento pode ter sido registado mesmo assim (webhook). Se és cliente e precisares de ajuda,
            usa o WhatsApp habitual da HR Store.
          </p>
          <div className="flex flex-col gap-2 w-full">
            <a
              href="https://hrstorept.com"
              className="inline-flex items-center justify-center w-full py-3 rounded-xl border border-gray-200 text-zinc-800 font-bold text-sm hover:bg-zinc-50 transition"
            >
              Ir para hrstorept.com
            </a>
            <Link
              href="/dashboard?tab=sales"
              className="inline-flex items-center justify-center w-full py-3 rounded-xl bg-black text-white font-bold text-sm"
            >
              Sou da equipa — Vendas &amp; PDV
            </Link>
          </div>
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
          Aguarda um momento. Vais ver a página de confirmação do pagamento.
        </p>
      </div>
    </div>
  );
}
