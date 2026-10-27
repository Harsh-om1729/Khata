import { describe, expect, it } from 'vitest';
import type { CompanyRow, ItemRow } from '../../src/db';
import { searchItems } from '../../src/db/search';

const stamp = { device_id: 'd', staff_id: 's', created_at: '2026-10-27T00:00:00Z', server_at: null };
const company = (id: string, name: string, archived = false): CompanyRow => ({ ...stamp, id, name, picture: null, archived });
const item = (id: string, company_id: string, extra: Partial<ItemRow>): ItemRow => ({
  ...stamp, id, company_id, name_hi: '', name_en: '', size: '', unit: 'piece', price_paise: 100,
  category: '', picture: null, needs_review: false, archived: false, ...extra,
});

const companies = [company('u', 'Ultratech'), company('a', 'ACC'), company('old', 'Old Brand', true)];
const items = [
  item('u50', 'u', { name_hi: 'सीमेंट', name_en: 'Cement', size: '50kg', category: 'Cement' }),
  item('u25', 'u', { name_hi: 'सीमेंट', name_en: 'Cement', size: '25kg', category: 'Cement' }),
  item('a50', 'a', { name_hi: 'सीमेंट', name_en: 'Cement', size: '50kg' }),
  item('nail', 'a', { name_hi: 'कील', name_en: 'Nails', size: '2 inch', category: 'Hardware' }),
  item('gone', 'a', { name_en: 'Cement Old', archived: true }),
  item('hidden', 'old', { name_en: 'Cement Hidden' }),
];
const ids = (query: string) => searchItems(companies, items, query).map((f) => f.item.id).sort();

describe('item search (M2-2)', () => {
  it('finds by English or Hindi name, ignoring case', () => {
    expect(ids('CEMENT')).toEqual(['a50', 'u25', 'u50']);
    expect(ids('कील')).toEqual(['nail']);
  });

  it('needs every typed word to match, across name, size, company and category', () => {
    expect(ids('cement 50')).toEqual(['a50', 'u50']);
    expect(ids('ultratech 25')).toEqual(['u25']);
    expect(ids('acc सीमेंट')).toEqual(['a50']);
    expect(ids('hardware')).toEqual(['nail']);
  });

  it('never shows archived items or items of archived companies', () => {
    expect(ids('old')).toEqual([]);
    expect(ids('hidden')).toEqual([]);
  });

  it('an empty search finds nothing, and results are capped', () => {
    expect(ids('   ')).toEqual([]);
    expect(searchItems(companies, items, 'cement', 2)).toHaveLength(2);
  });

  it('returns the company with each item', () => {
    expect(searchItems(companies, items, 'nails')[0]?.company.name).toBe('ACC');
  });
});
