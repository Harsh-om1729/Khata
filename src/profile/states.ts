/** GST state codes (the first two digits of a GSTIN) for every state and union territory. 25 merged into 26 in 2020. */
export const STATE_CODES = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18',
  '19', '20', '21', '22', '23', '24', '26', '27', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38',
] as const;

export type StateCode = (typeof STATE_CODES)[number];

export function isStateCode(value: string): value is StateCode {
  return (STATE_CODES as readonly string[]).includes(value);
}
