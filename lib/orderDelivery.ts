/** Alinhado ao tipo `Order` do dashboard — só o campo necessário. */
export type OrderDeliveryFields = {
  is_delivery?: boolean | number | string;
  status?: string;
};

/** Estados em que o admin pode imprimir o recibo de expedição. */
export const ORDER_STATUSES_PRINTABLE = [
  'pago',
  'expedido',
  'enviado',
  'entregue',
] as const;

export function canExpedirOrPrintOrder(o: OrderDeliveryFields): boolean {
  const s = String(o.status || '').trim();
  return (ORDER_STATUSES_PRINTABLE as readonly string[]).includes(s);
}

/**
 * Pedido com entrega ao domicílio (WhatsApp, site ou PDV).
 * `isWebsiteStorePickup` é o caso website sem entrega.
 */
export function isHomeDeliveryOrder(o: OrderDeliveryFields): boolean {
  return (
    o.is_delivery === true
    || o.is_delivery === 'true'
    || o.is_delivery === 1
    || o.is_delivery === '1'
  );
}

function receiptPaperContentFromEnv(): { paperMm?: number; contentMm?: number } {
  const paperMm = Number(String(process.env.NEXT_PUBLIC_RECEIPT_PAPER_MM ?? '').trim());
  const contentMm = Number(String(process.env.NEXT_PUBLIC_RECEIPT_CONTENT_MM ?? '').trim());
  return {
    ...(Number.isFinite(paperMm) && paperMm > 0 ? { paperMm } : {}),
    ...(Number.isFinite(contentMm) && contentMm > 0 ? { contentMm } : {}),
  };
}

/**
 * Página interna do admin: carrega o PDF com JWT e mostra preview + botão Imprimir.
 * Abre em nova aba no clique (sem about:blank / sem bloqueio de popup).
 */
export function receiptPdfPreviewPath(
  orderId: number,
  opts?: { paperMm?: number; contentMm?: number },
): string {
  const q = new URLSearchParams({ orderId: String(orderId) });
  const env = receiptPaperContentFromEnv();
  const paper = opts?.paperMm ?? env.paperMm;
  const content = opts?.contentMm ?? env.contentMm;
  if (paper) q.set('paper', String(paper));
  if (content) q.set('content', String(content));
  return `/dashboard/receipt-pdf?${q.toString()}`;
}

/** Rota legada HTML (fallback manual). */
export function expedicaoPrintPath(
  orderId: number,
  opts?: { kiosk?: boolean; autoPrint?: boolean; paperMm?: number; contentMm?: number },
): string {
  const q = new URLSearchParams({ orderId: String(orderId) });
  if (opts?.kiosk) q.set('kiosk', '1');
  if (opts?.autoPrint) q.set('auto', '1');
  if (Number.isFinite(opts?.paperMm) && Number(opts?.paperMm) > 0) {
    q.set('paper', String(Number(opts.paperMm)));
  }
  if (Number.isFinite(opts?.contentMm) && Number(opts?.contentMm) > 0) {
    q.set('content', String(Number(opts.contentMm)));
  }
  return `/dashboard/expedicao-print?${q.toString()}`;
}

/**
 * Abre preview PDF numa nova aba (expedição ou reimpressão simples).
 * Síncrono no clique — não usa about:blank.
 */
export function openExpedicaoPdfTab(
  orderId: number,
  opts?: { paperMm?: number; contentMm?: number },
): boolean {
  if (typeof window === 'undefined') return false;
  const path = receiptPdfPreviewPath(orderId, opts);
  const absUrl = `${window.location.origin}${path.startsWith('/') ? '' : '/'}${path}`;
  const w = window.open(absUrl, '_blank');
  return w != null;
}

/** @deprecated Usa openExpedicaoPdfTab. Mantido para referências antigas. */
export function openExpedicaoPrintTab(orderId: number): void {
  openExpedicaoPdfTab(orderId);
}

export function shouldUsePdfReceipt(): boolean {
  const raw = String(process.env.NEXT_PUBLIC_RECEIPT_USE_PDF || '').trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return true;
}
