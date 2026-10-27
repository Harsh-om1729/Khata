import { describe, expect, it } from 'vitest';
import { categoryCounts, defaultItemFilter, listCompanies, listItems, unitCounts, type CompanyRow, type ItemFilter, type ItemRow } from '../../src/db';

const stamp = { device_id: 'd', staff_id: 's', created_at: '2026-10-28T00:00:00Z', server_at: null };
const company = (id: string, name: string, archived = false): CompanyRow => ({ ...stamp, id, name, picture: null, archived });
const item = (id: string, company_id: string, name_en: string, price_paise: number, extra: Partial<ItemRow> = {}): ItemRow => ({
  ...stamp, id, company_id, name_hi: '', name_en, size: '', unit: 'piece', price_paise, category: '', picture: null,
  needs_review: false, archived: false, ...extra,
});

const companies = [company('u', 'Ultratech'), company('a', 'ACC'), company('old', 'Old Brand', true)];
const items = [
  item('c50', 'u', 'Cement', 38_000, { size: '50kg', unit: 'bag', category: 'Cement' }),
  item('c25', 'u', 'Cement', 20_000, { size: '25kg', unit: 'bag', category: 'Cement' }),
  item('nail', 'a', 'Nails', 8_050, { unit: 'kg', category: 'Hardware' }),
  item('wire', 'a', 'Wire', 1_500, { unit: 'metre' }),
  item('gone', 'a', 'Bucket', 9_000, { archived: true }),
  item('orphan', 'old', 'Paint', 50_000, { category: 'Paint' }),
];
const ids = (query: string, filter: Partial<ItemFilter> = {}) =>
  listItems(companies, items, query, { ...defaultItemFilter, ...filter }, (i) => i.name_en).map((l) => l.item.id);

describe('items list (U-3)', () => {
  it('shows items on sale, sorted by name then size', () => {
    expect(ids('')).toEqual(['c25', 'c50', 'nail', 'wire']);
  });

  it('the same item and size from several companies goes by company name', () => {
    const twins = [item('x', 'u', 'Paint', 100), item('y', 'a', 'Paint', 100)];
    expect(listItems(companies, twins, '', defaultItemFilter, (i) => i.name_en).map((l) => l.company?.name)).toEqual(['ACC', 'Ultratech']);
  });

  it('removed items, and items of a removed company, only show with the removed filter', () => {
    expect(ids('', { archived: true })).toEqual(['gone', 'orphan']);
  });

  it('search matches every typed word across name, size, company and category', () => {
    expect(ids('cement 50')).toEqual(['c50']);
    expect(ids('ULTRATECH')).toEqual(['c25', 'c50']);
    expect(ids('hardware')).toEqual(['nail']);
    expect(ids('cement acc')).toEqual([]);
  });

  it('filters by company and category, with "" meaning no category', () => {
    expect(ids('', { companyId: 'a' })).toEqual(['nail', 'wire']);
    expect(ids('', { category: 'Cement' })).toEqual(['c25', 'c50']);
    expect(ids('', { category: '' })).toEqual(['wire']);
  });

  it('sorts by price both ways', () => {
    expect(ids('', { sort: 'priceLow' })).toEqual(['wire', 'nail', 'c25', 'c50']);
    expect(ids('', { sort: 'priceHigh' })).toEqual(['c50', 'c25', 'nail', 'wire']);
  });
});

describe('companies, categories and units (U-3)', () => {
  it('lists companies by name, searched, on sale or removed', () => {
    expect(listCompanies(companies, '', false).map((c) => c.name)).toEqual(['ACC', 'Ultratech']);
    expect(listCompanies(companies, 'ultra', false).map((c) => c.name)).toEqual(['Ultratech']);
    expect(listCompanies(companies, '', true).map((c) => c.name)).toEqual(['Old Brand']);
  });

  it('counts categories of items on sale, with no category last', () => {
    expect(categoryCounts(companies, items)).toEqual([
      { category: 'Cement', count: 2 },
      { category: 'Hardware', count: 1 },
      { category: '', count: 1 },
    ]);
  });

  it('counts items on sale per unit', () => {
    expect(unitCounts(companies, items)).toEqual({ piece: 0, kg: 1, metre: 1, bag: 2 });
  });
});
