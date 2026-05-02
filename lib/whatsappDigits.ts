/** Alinhado com hrstore-backend/src/utils/whatsappNormalize.js */

export function sanitizeWhatsappDigits(raw: string, maxLen = 15): string {
  return String(raw).replace(/\D/g, '').slice(0, maxLen);
}

export function canonicalWhatsappForApi(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  while (digits.startsWith('00') && digits.length > 10) {
    digits = digits.slice(2);
  }
  if (digits.length === 9 && /^9[0-9]{8}$/.test(digits)) {
    digits = `351${digits}`;
  }
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}
