import type { CompanyRow, ItemRow } from '../db';
import { rupeesNumber } from '../money';

/** Every item on sale, as Products-sheet rows, sorted by company, name and size. Archived ones are left out. */
export function priceListRows(companies: CompanyRow[], items: ItemRow[]): (string | number)[][] {
  const active = new Map(companies.filter((c) => !c.archived).map((c) => [c.id, c]));
  const rows: { company: string; item: ItemRow }[] = [];
  for (const item of items) {
    const company = active.get(item.company_id);
    if (company && !item.archived) rows.push({ company: company.name, item });
  }
  const name = (item: ItemRow) => item.name_en || item.name_hi;
  rows.sort(
    (a, b) =>
      a.company.localeCompare(b.company) ||
      name(a.item).localeCompare(name(b.item)) ||
      a.item.size.localeCompare(b.item.size, undefined, { numeric: true }),
  );
  return rows.map(({ company, item }) => [
    company, item.name_hi, item.name_en, item.size, item.unit, rupeesNumber(item.price_paise), item.category,
  ]);
}

export function priceListFileName(now = new Date()): string {
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
  return `khata-price-list-${day}.xlsx`;
}
