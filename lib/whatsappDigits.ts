/** Chave de cliente no backend: só dígitos (10–15), sem '+'. */
export function sanitizeWhatsappDigits(raw: string, maxLen = 15): string {
  return String(raw).replace(/\D/g, '').slice(0, maxLen);
}
