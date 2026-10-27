import type { CompanyRow, ItemRow } from './types';

export interface Found {
  item: ItemRow;
  company: CompanyRow;
}

/** Active items whose name (Hindi or English), size, company or category contain every typed word. */
export function searchItems(companies: CompanyRow[], items: ItemRow[], query: string, limit = 60): Found[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const active = new Map(companies.filter((c) => !c.archived).map((c) => [c.id, c]));
  const found: Found[] = [];
  for (const item of items) {
    const company = active.get(item.company_id);
    if (!company || item.archived) continue;
    const text = [item.name_hi, item.name_en, item.size, company.name, item.category].join(' ').toLowerCase();
    if (words.every((w) => text.includes(w))) found.push({ item, company });
    if (found.length >= limit) break;
  }
  return found;
}
