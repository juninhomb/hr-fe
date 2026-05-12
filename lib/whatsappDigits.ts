/** Alinhado com hrstore-backend/src/utils/whatsappNormalize.js */

import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import type { CountryCode } from 'libphonenumber-js';

function digitsOnly(s: string): string {
  return String(s).replace(/\D/g, '');
}

function countryCode(defaultCountry: string): CountryCode {
  return (String(defaultCountry || 'PT').trim().toUpperCase().slice(0, 2) || 'PT') as CountryCode;
}

function parseFirstValid(trimmed: string, defaultCountry: string) {
  const cc = countryCode(defaultCountry);
  let p = parsePhoneNumberFromString(trimmed);
  if (p?.isValid()) return p;
  const d = digitsOnly(trimmed);
  if (d.length >= 10 && d.length <= 15) {
    p = parsePhoneNumberFromString(`+${d}`);
    if (p?.isValid()) return p;
  }
  p = parsePhoneNumberFromString(trimmed, cc);
  if (p?.isValid()) return p;
  return undefined;
}

/** Dígitos e um '+' opcional no início (máx. `maxDigits` dígitos). */
export function sanitizeWhatsappDigits(raw: string, maxDigits = 15): string {
  const s0 = String(raw).replace(/[^\d+]/g, '');
  let lead = '';
  let rest = s0;
  if (rest.startsWith('+')) {
    lead = '+';
    rest = rest.slice(1).replace(/\+/g, '');
  } else {
    rest = rest.replace(/\+/g, '');
  }
  const d = rest.replace(/\D/g, '').slice(0, maxDigits);
  return `${lead}${d}`;
}

export function canonicalWhatsappForApi(
  raw: string | null | undefined,
  defaultCountry: string = 'PT',
): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const parsed = parseFirstValid(trimmed, defaultCountry);
  if (parsed) {
    return String(parsed.number.replace('+', '')).replace(/\D/g, '');
  }

  let d = digitsOnly(trimmed);
  while (d.startsWith('00') && d.length > 2) d = d.slice(2);

  const dc = countryCode(defaultCountry);
  if (dc === 'PT' && /^9\d{8}$/.test(d)) {
    d = `351${d}`;
  }

  if (d.length < 10 || d.length > 15) return null;
  return d;
}
