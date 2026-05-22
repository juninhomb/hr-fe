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

/** Rota do admin para impressão térmica. `kiosk=1`: só o recibo (aberto a partir de «Expedir»). */
export function expedicaoPrintPath(
  orderId: number,
  opts?: { kiosk?: boolean },
): string {
  const q = new URLSearchParams({ orderId: String(orderId) });
  if (opts?.kiosk) q.set('kiosk', '1');
  return `/dashboard/expedicao-print?${q.toString()}`;
}

/** Abre o romaneio num novo separador (fluxo «Expedir» / reimpressão). */
export function openExpedicaoPrintTab(orderId: number): void {
  if (typeof window === 'undefined') return;
  const path = expedicaoPrintPath(orderId, { kiosk: true });
  const absUrl = `${window.location.origin}${path.startsWith('/') ? '' : '/'}${path}`;
  window.open(absUrl, '_blank', 'noopener,noreferrer');
}
