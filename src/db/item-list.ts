import type { CompanyRow, ItemRow, Unit } from './types';

export type ItemSort = 'name' | 'priceLow' | 'priceHigh';

export interface ItemFilter {
  companyId: string | null;
  /** null shows every category; '' shows items with no category. */
  category: string | null;
  sort: ItemSort;
  /** Shows what was removed (archived) instead of what is on sale. */
  archived: boolean;
}

export const defaultItemFilter: ItemFilter = { companyId: null, category: null, sort: 'name', archived: false };

export interface Listed {
  item: ItemRow;
  company: CompanyRow | undefined;
}

const words = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);

/** On sale means the item and its company are both active, the same rule billing uses. */
function onSale(item: ItemRow, company: CompanyRow | undefined): boolean {
  return !item.archived && company !== undefined && !company.archived;
}

export function listItems(
  companies: CompanyRow[],
  items: ItemRow[],
  query: string,
  filter: ItemFilter,
  nameOf: (item: ItemRow) => string,
): Listed[] {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const typed = words(query);
  const listed: Listed[] = [];
  for (const item of items) {
    const company = byId.get(item.company_id);
    if (onSale(item, company) === filter.archived) continue;
    if (filter.companyId !== null && item.company_id !== filter.companyId) continue;
    if (filter.category !== null && item.category !== filter.category) continue;
    const text = [item.name_hi, item.name_en, item.size, company?.name ?? '', item.category].join(' ').toLowerCase();
    if (typed.every((w) => text.includes(w))) listed.push({ item, company });
  }
  const byName = (a: Listed, b: Listed) =>
    nameOf(a.item).localeCompare(nameOf(b.item)) ||
    a.item.size.localeCompare(b.item.size) ||
    (a.company?.name ?? '').localeCompare(b.company?.name ?? '');
  const direction = filter.sort === 'priceHigh' ? -1 : 1;
  return listed.sort((a, b) =>
    filter.sort === 'name' ? byName(a, b) : direction * (a.item.price_paise - b.item.price_paise) || byName(a, b),
  );
}

export function listCompanies(companies: CompanyRow[], query: string, archived: boolean): CompanyRow[] {
  const typed = words(query);
  return companies
    .filter((c) => c.archived === archived && typed.every((w) => c.name.toLowerCase().includes(w)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface CategoryCount {
  category: string;
  count: number;
}

/** Categories of items on sale, with "no category" ('') last. */
export function categoryCounts(companies: CompanyRow[], items: ItemRow[]): CategoryCount[] {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const counts = new Map<string, number>();
  for (const item of items) {
    if (onSale(item, byId.get(item.company_id))) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  return [...counts]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => (a.category === '' ? 1 : b.category === '' ? -1 : a.category.localeCompare(b.category)));
}

export function unitCounts(companies: CompanyRow[], items: ItemRow[]): Record<Unit, number> {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const counts: Record<Unit, number> = { piece: 0, kg: 0, metre: 0, bag: 0 };
  for (const item of items) if (onSale(item, byId.get(item.company_id))) counts[item.unit] += 1;
  return counts;
}
