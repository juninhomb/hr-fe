'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { XCircle } from 'lucide-react';

/** Cliente abandonou ou cancelou no Checkout Stripe (link PDV). */
export default function PagamentoCanceladoPage() {
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
        <div className="mx-auto h-16 w-16 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center">
          <XCircle size={36} strokeWidth={2.25} />
        </div>
        <div>
          <h1 className="text-xl font-black text-zinc-900">Pagamento não concluído</h1>
          <p className="text-sm text-zinc-600 mt-3 leading-relaxed">
            Saiu‑se do checkout sem finalizar ou o pagamento foi cancelado. Para tentar de novo,
            usa o mesmo link ou pede um novo à loja / WhatsApp.
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
              Voltar a Vendas &amp; PDV
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
