const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// Same pattern as the server's check on settings.gstin.
const FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** The 15th character of a GSTIN, computed from the first 14 (base-36, alternating weights 1 and 2). */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = CHARS.indexOf(first14.charAt(i)) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARS.charAt((36 - (sum % 36)) % 36);
}

/** Expects an upper-case, trimmed value. The server checks only the format; the check character also catches most typing mistakes. */
export function isValidGstin(gstin: string): boolean {
  return FORMAT.test(gstin) && gstinCheckChar(gstin.slice(0, 14)) === gstin.charAt(14);
}
