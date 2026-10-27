import { describe, expect, it } from 'vitest';
import type { CompanyRow, ItemRow } from '../../src/db';
import { countPlan, planImport, readPrice, readUnit, type RawRow } from '../../src/excel/plan';

const stamp = { device_id: 'd', staff_id: 's', created_at: '2026-10-27T00:00:00Z', server_at: 'x' };
const ultratech: CompanyRow = { ...stamp, id: 'c1', name: 'Ultratech', picture: null, archived: false };
const cement: ItemRow = {
  ...stamp, id: 'i1', company_id: 'c1', name_hi: 'सीमेंट', name_en: 'Cement', size: '50kg', unit: 'bag',
  price_paise: 38_000, category: 'Cement', picture: null, needs_review: false, archived: false,
};

let n = 1;
const row = (...cells: unknown[]): RawRow => ({ row: ++n, cells });

describe('reading cells', () => {
  it.each([
    ['piece', 'piece'], ['PCS', 'piece'], ['पीस', 'piece'], ['नग', 'piece'],
    ['kg', 'kg'], ['Kg.', 'kg'], ['किलो', 'kg'],
    ['metre', 'metre'], ['Meter', 'metre'], ['मीटर', 'metre'],
    ['bag', 'bag'], ['bori', 'bag'], ['बोरी', 'bag'],
  ])('unit "%s" is %s', (text, unit) => {
    expect(readUnit(text)).toBe(unit);
  });

  it('refuses unknown units', () => {
    expect(readUnit('dozen')).toBeNull();
    expect(readUnit('')).toBeNull();
  });

  it('reads prices from number or text cells into paise', () => {
    expect(readPrice(420)).toBe(42_000);
    expect(readPrice(420.5)).toBe(42_050);
    expect(readPrice('1,250')).toBe(125_000);
    expect(readPrice('Rs 420')).toBeNull();
    expect(readPrice(-5)).toBeNull();
    expect(readPrice('')).toBeNull();
    expect(readPrice(Number.NaN)).toBeNull();
  });
});

describe('import preview (M1-5)', () => {
  it('sorts rows into added, updated and skipped, matching by Company + Item name + Size ignoring case', () => {
    const plan = planImport(
      [row('ULTRATECH', '', 'Cement', '50KG', 'bag', 380, ''), row('Ultratech', '', 'Cement', '25kg', 'bag', 200, 'Cement')],
      [ultratech],
      [cement],
    );
    expect(countPlan(plan)).toEqual({ add: 1, update: 0, skip: 1, errors: 0 });
    expect(plan.newCompanies).toEqual([]);

    const changed = planImport([row('Ultratech', 'सीमेंट', 'Cement', '50kg', 'bag', 400, 'Cement')], [ultratech], [cement]);
    expect(countPlan(changed)).toEqual({ add: 0, update: 1, skip: 0, errors: 0 });
    expect(changed.planned[0]).toMatchObject({ kind: 'update', next: { id: 'i1', price_paise: 40_000, server_at: null } });
  });

  it('never erases a name or category with a blank cell', () => {
    const plan = planImport([row('Ultratech', '', 'Cement', '50kg', 'bag', 380, '')], [ultratech], [cement]);
    expect(countPlan(plan).skip).toBe(1);
  });

  it('lists new companies once each', () => {
    const plan = planImport(
      [row('ACC', '', 'Cement', '50kg', 'bag', 370, ''), row('acc', '', 'Cement', '25kg', 'bag', 190, ''), row('Ambuja', 'सीमेंट', '', '', 'bag', 375, '')],
      [ultratech],
      [],
    );
    expect(plan.newCompanies).toEqual(['ACC', 'Ambuja']);
    expect(countPlan(plan).add).toBe(3);
  });

  it('gives every bad row its Excel row number and reason, and ignores blank rows', () => {
    const plan = planImport(
      [
        { row: 2, cells: ['', 'सीमेंट', '', '50kg', 'bag', 380, ''] },
        { row: 3, cells: ['ACC', '', '', '50kg', 'bag', 380, ''] },
        { row: 4, cells: ['ACC', 'सीमेंट', '', '50kg', 'dozen', 380, ''] },
        { row: 5, cells: ['ACC', 'सीमेंट', '', '50kg', 'bag', 'Rs 380', ''] },
        { row: 6, cells: ['', '', '', '', '', '', ''] },
        { row: 7, cells: ['ACC', 'सीमेंट', '', '25kg', 'bag', 200, ''] },
        { row: 8, cells: ['acc', 'सीमेंट', '', '25KG', 'bag', 210, ''] },
        { row: 9, cells: ['ACC', 'x'.repeat(81), '', '', 'bag', 1, ''] },
        { row: 10, cells: ['ACC', 'सीमेंट', '', '50kg', 'bag', '', ''] },
      ],
      [],
      [],
    );
    expect(plan.errors).toEqual([
      { row: 2, problem: 'company' },
      { row: 3, problem: 'name' },
      { row: 4, problem: 'unit' },
      { row: 5, problem: 'price' },
      { row: 8, problem: 'repeat', firstRow: 7 },
      { row: 9, problem: 'tooLong' },
      { row: 10, problem: 'price' },
    ]);
    expect(countPlan(plan).add).toBe(1);
  });
});
