/**
 * BBDRTS Standard Formatters
 * Enforces Philippine mobile number convention: 09XX XXX XXXX (4 digits, space, 3 digits, space, 4 digits).
 */

export function formatPhoneNumber(val) {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

export function cleanPhoneNumber(val) {
  if (!val) return '';
  return String(val).replace(/\D/g, '').slice(0, 11);
}
