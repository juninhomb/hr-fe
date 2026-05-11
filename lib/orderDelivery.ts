/** Alinhado ao tipo `Order` do dashboard — só o campo necessário. */
export type OrderDeliveryFields = {
  is_delivery?: boolean | number | string;
};

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
