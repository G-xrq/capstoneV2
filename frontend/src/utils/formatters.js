/**
 * BBDRTS Standard Formatters
 * Enforces Philippine mobile number convention: 09XX XXX XXXX (4 digits, space, 3 digits, space, 4 digits).
 * Safely normalizes +639XXXXXXXXX / 639XXXXXXXXX (12 digits) -> 09XXXXXXXXX (11 digits) before slicing
 * so the trailing digit is never truncated.
 */

function normalizePhPhoneDigits(val) {
  if (!val) return '';
  let digits = String(val).replace(/\D/g, '');
  if (digits.startsWith('639')) {
    digits = '0' + digits.slice(2);
  } else if (digits.length === 10 && digits.startsWith('9')) {
    digits = '0' + digits;
  }
  return digits.slice(0, 11);
}

export function formatPhoneNumber(val) {
  if (!val) return '';
  const raw = String(val).trim();
  if (/[*•●·]/.test(raw)) return raw;
  const digits = normalizePhPhoneDigits(raw);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

export function cleanPhoneNumber(val) {
  if (!val) return '';
  return normalizePhPhoneDigits(val);
}
