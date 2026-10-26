/** Short code a staff phone shows so the owner approves the right phone, e.g. "3F9 A2C". */
export function registrationCode(deviceId: string): string {
  const hex = deviceId.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `${hex.slice(0, 3)} ${hex.slice(3)}`;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Next free bill-number letter for an approved phone: A…Z, then A1…Z9 (DB allows ^[A-Z][A-Z0-9]{0,2}$). */
export function nextFreeCode(used: Iterable<string>): string {
  const taken = new Set(used);
  for (const letter of LETTERS) if (!taken.has(letter)) return letter;
  for (let n = 1; n <= 9; n++) {
    for (const letter of LETTERS) if (!taken.has(`${letter}${n}`)) return `${letter}${n}`;
  }
  throw new Error('no free device code left');
}
