'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

/** Confirmação após Stripe (link PDV) — sempre vista pelo pagador antes de qualquer ecrã interno de vendas. */
export default function PagamentoObrigadoPage() {
  const [staff, setStaff] = useState(false);

  useEffect(() => {
    try {
      setStaff(Boolean(typeof window !== 'undefined' && window.localStorage.getItem('hrstore-token')));
    } catch {
      /* noop */
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm max-w-md w-full p-8 text-center space-y-5">
        <div className="mx-auto h-16 w-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <CheckCircle2 size={36} strokeWidth={2.25} />
        </div>
        <div>
          <h1 className="text-xl font-black text-zinc-900">Pagamento recebido</h1>
          <p className="text-sm text-zinc-600 mt-3 leading-relaxed">
            O pagamento foi processado com sucesso. A HR Store será notificada; podes fechar esta página quando
            quiseres.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <a
            href="https://hrstorept.com"
            className="inline-flex items-center justify-center w-full py-3 rounded-xl border border-gray-200 text-zinc-800 font-bold text-sm hover:bg-zinc-50 transition"
          >
            Visitar hrstorept.com
          </a>
          {staff ? (
            <Link
              href="/dashboard?tab=sales"
              className="inline-flex items-center justify-center w-full py-3 rounded-xl bg-black text-white font-bold text-sm"
            >
              Continuar para Vendas &amp; PDV (equipa)
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
