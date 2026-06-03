'use client';

import {
  Suspense, useCallback, useEffect, useRef, useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Printer, RefreshCw } from 'lucide-react';
import { API_BASE } from '../../../lib/api';

function num(v: string | null, fallback: number): number {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function ReceiptPdfInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = parseInt(searchParams.get('orderId') || '', 10);
  const paperMm = num(searchParams.get('paper'), num(process.env.NEXT_PUBLIC_RECEIPT_PAPER_MM, 58));
  const contentMm = num(searchParams.get('content'), num(process.env.NEXT_PUBLIC_RECEIPT_CONTENT_MM, 48));
  /** Altura de página fixa (mm) para casar com o papel do driver (ex.: POS-80 → 210). */
  const pageHeightMm = num(searchParams.get('pageh'), num(process.env.NEXT_PUBLIC_RECEIPT_PAGE_MM, 0));
  const previewWidthMm = Math.min(contentMm, paperMm);
  /** Preview por defeito; só auto-imprime com ?auto=1 (evita loop no Windows). */
  const autoPrint = searchParams.get('auto') === '1';

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const autoPrintDoneRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);

  const triggerPrint = useCallback(() => {
    const frame = iframeRef.current;
    const blobUrl = blobUrlRef.current;
    if (!frame || !blobUrl) return;
    if (frame.contentWindow) {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        return;
      } catch {
        window.open(blobUrl, '_blank');
      }
    }
  }, []);

  const scheduleAutoPrint = useCallback(() => {
    if (!autoPrint || autoPrintDoneRef.current) return;
    autoPrintDoneRef.current = true;
    window.setTimeout(() => triggerPrint(), 600);
  }, [autoPrint, triggerPrint]);

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
    const token = localStorage.getItem('hrstore-token');
    if (!token) {
      setLoading(false);
      setError('Sessão expirada. Faz login novamente.');
      return;
    }

    const q = new URLSearchParams({
      paper: String(paperMm),
      content: String(contentMm),
    });
    if (pageHeightMm > 0) q.set('pageh', String(pageHeightMm));
    const url = `${API_BASE}/api/orders/${orderId}/receipt.pdf?${q.toString()}`;

    setLoading(true);
    setError(null);
    setPdfReady(false);
    autoPrintDoneRef.current = false;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) {
          let msg = `Erro ${res.status} ao gerar PDF.`;
          try {
            const body = await res.json();
            if (body?.error) msg = String(body.error);
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }
        const blob = await res.blob();
        if (!blob || blob.size === 0) {
          throw new Error('PDF vazio — confirma se o backend tem pdfkit instalado.');
        }
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        if (iframeRef.current) {
          iframeRef.current.src = blobUrl;
        }
        setPdfReady(true);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const msg = err instanceof Error ? err.message : 'Não foi possível carregar o PDF.';
        setError(msg);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [orderId, paperMm, contentMm, pageHeightMm]);

  const handleIframeLoad = () => {
    if (blobUrlRef.current) scheduleAutoPrint();
  };

  useEffect(() => {
    if (!pdfReady || !autoPrint) return;
    const t = window.setTimeout(() => scheduleAutoPrint(), 900);
    return () => clearTimeout(t);
  }, [pdfReady, autoPrint, scheduleAutoPrint]);

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col">
      <header className="exp-no-print shrink-0 bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap print:hidden">
        <Link href="/?tab=sales" className="text-sm font-bold text-zinc-600 hover:text-black">
          ← Voltar ao dashboard
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            Pedido #{Number.isFinite(orderId) ? orderId : '—'} · PDF {previewWidthMm} mm (rolo {paperMm} mm)
          </span>
          <button
            type="button"
            onClick={triggerPrint}
            disabled={!pdfReady || loading || Boolean(error)}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-40"
          >
            <Printer size={16} />
            Imprimir recibo
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 p-2 sm:p-4 print:hidden">
        {loading && (
          <div className="flex flex-1 items-center justify-center gap-2 text-zinc-500 text-sm">
            <RefreshCw className="animate-spin shrink-0" size={18} />
            A gerar PDF do recibo…
          </div>
        )}
        {error && !loading && (
          <div className="max-w-lg mx-auto mt-8 rounded-2xl bg-red-50 border border-red-200 p-4 flex gap-2 text-red-800 text-sm">
            <AlertCircle className="shrink-0" size={20} />
            <div>
              <p className="font-bold">Não foi possível abrir o recibo</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}
        <div
          className={`flex flex-1 justify-center min-h-0 ${loading || error ? 'hidden' : 'flex'}`}
        >
          <iframe
            ref={iframeRef}
            title={`Recibo pedido ${orderId}`}
            onLoad={handleIframeLoad}
            style={{ width: `${previewWidthMm}mm`, maxWidth: '100%' }}
            className="min-h-[70vh] bg-white border border-zinc-200 rounded-lg shadow-sm"
          />
        </div>
      </main>
    </div>
  );
}

export default function ReceiptPdfPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm">
          A carregar…
        </div>
      }
    >
      <ReceiptPdfInner />
    </Suspense>
  );
}
