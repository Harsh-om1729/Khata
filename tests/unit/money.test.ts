import { describe, expect, it } from 'vitest';
import { formatRupees, parseRupees } from '../../src/money';

describe('rupees and paise', () => {
  it.each([
    ['420', 42_000],
    ['420.5', 42_050],
    ['420.50', 42_050],
    [' 1,250.75 ', 125_075],
    ['0', 0],
    ['0.10', 10],
  ])('reads "%s" as %i paise without float rounding', (text, paise) => {
    expect(parseRupees(text)).toBe(paise);
  });

  it.each(['', 'abc', '-5', '4.205', '1e3', '.5', '12.'])('refuses "%s"', (text) => {
    expect(parseRupees(text)).toBeNull();
  });

  it('shows paise as rupees, with paise only when there are some', () => {
    expect(formatRupees(42_000)).toBe('₹420');
    expect(formatRupees(42_050)).toBe('₹420.50');
    expect(formatRupees(125_075)).toBe('₹1,250.75');
    expect(formatRupees(5)).toBe('₹0.05');
  });
});
