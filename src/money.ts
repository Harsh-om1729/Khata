/** "420", "420.5", "1,250.75" → paise. Parsed as text so no float rounding ever touches money. */
export function parseRupees(text: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim().replace(/,/g, ''));
  if (!match?.[1]) return null;
  const paise = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(paise) ? paise : null;
}

/** 42000 → "₹420", 42050 → "₹420.50". */
export function formatRupees(paise: number): string {
  const rupees = Math.trunc(paise / 100);
  const rest = paise % 100;
  const whole = rupees.toLocaleString('en-IN');
  return rest === 0 ? `₹${whole}` : `₹${whole}.${String(rest).padStart(2, '0')}`;
}

/** 42050 → 420.5, for spreadsheet cells. Built from the paise digits, so it reads back to exactly the same paise. */
export function rupeesNumber(paise: number): number {
  return Number(`${Math.trunc(paise / 100)}.${String(paise % 100).padStart(2, '0')}`);
}
