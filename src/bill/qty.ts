export const ONE = 1000;
const MAX_QTY_MILLI = 9_999_999_999; // numeric(10, 3) on the server

/** "2", "2.5", "0.125" → thousandths. Parsed as text, like prices. */
export function parseQty(text: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(text.trim());
  if (!match?.[1]) return null;
  const milli = Number(match[1]) * ONE + Number((match[2] ?? '').padEnd(3, '0'));
  return milli > 0 && milli <= MAX_QTY_MILLI ? milli : null;
}

/** 2500 → "2.5", 3000 → "3". */
export function formatQty(milli: number): string {
  const whole = Math.trunc(milli / ONE);
  const rest = String(Math.abs(milli % ONE)).padStart(3, '0').replace(/0+$/, '');
  return rest ? `${whole}.${rest}` : String(whole);
}

/** Price × quantity in whole paise, half a paisa rounding away from zero. Integer maths only. */
export function lineTotal(unitPricePaise: number, qtyMilli: number): number {
  const exact = unitPricePaise * Math.abs(qtyMilli);
  if (!Number.isSafeInteger(exact)) throw new Error('line total too large');
  return Math.sign(qtyMilli) * Math.floor((exact + ONE / 2) / ONE);
}
