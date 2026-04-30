/**
 * Frete por defeito (€) quando o utilizador não definiu outro valor.
 * Definir em `.env`: NEXT_PUBLIC_DEFAULT_SHIPPING_EUR=4.5
 * (números com vírgula ou ponto; valores inválidos ou negativos caem no fallback.)
 */
const FALLBACK_EUR = 5;

export function getDefaultShippingFeeEur(): number {
  const raw = process.env.NEXT_PUBLIC_DEFAULT_SHIPPING_EUR;
  if (raw == null || String(raw).trim() === '') return FALLBACK_EUR;
  const n = Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return FALLBACK_EUR;
  return n;
}
