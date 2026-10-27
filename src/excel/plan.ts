import type { CompanyRow, ItemRow, Unit } from '../db';
import { parseRupees } from '../money';

/** One data row as read from the sheet; `row` is the Excel row number people see. */
export interface RawRow {
  row: number;
  cells: unknown[];
}

export interface CleanRow {
  row: number;
  company: string;
  name_hi: string;
  name_en: string;
  size: string;
  unit: Unit;
  price_paise: number;
  category: string;
}

export type Problem = 'company' | 'name' | 'unit' | 'price' | 'repeat' | 'tooLong';

export interface RowError {
  row: number;
  problem: Problem;
  /** For 'repeat': the earlier row with the same Company + Item name + Size. */
  firstRow?: number;
}

export type Planned =
  | { kind: 'add'; row: CleanRow }
  | { kind: 'update'; row: CleanRow; item: ItemRow; next: ItemRow }
  | { kind: 'skip'; row: CleanRow; item: ItemRow };

export interface ImportPlan {
  planned: Planned[];
  errors: RowError[];
  newCompanies: string[];
}

const MAX_NAME = 80;

const UNIT_WORDS: Record<string, Unit> = {
  piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece', 'पीस': 'piece', 'नग': 'piece',
  kg: 'kg', kgs: 'kg', kilo: 'kg', 'किलो': 'kg', 'किग्रा': 'kg',
  metre: 'metre', meter: 'metre', m: 'metre', mtr: 'metre', 'मीटर': 'metre',
  bag: 'bag', bags: 'bag', bori: 'bag', 'बोरी': 'bag', 'बैग': 'bag',
};

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

export function readUnit(value: unknown): Unit | null {
  return UNIT_WORDS[text(value).toLowerCase().replace(/\.$/, '')] ?? null;
}

// Cells may hold numbers or text; either way the price goes through the text parser, never float maths.
export function readPrice(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return parseRupees(text(value));
}

/** Same rule as the server's unique index, keyed by company name so new companies can be matched too. */
function key(company: string, name_hi: string, name_en: string, size: string): string {
  return [company.toLowerCase(), (name_en !== '' ? name_en : name_hi).toLowerCase(), size.toLowerCase()].join('\u0000');
}

function clean(raw: RawRow): CleanRow | RowError {
  const [company, name_hi, name_en, size, unit, price, category] = raw.cells.map(text);
  const row = raw.row;
  if (!company) return { row, problem: 'company' };
  if (!name_hi && !name_en) return { row, problem: 'name' };
  if (company.length > MAX_NAME || (name_hi ?? '').length > MAX_NAME || (name_en ?? '').length > MAX_NAME) {
    return { row, problem: 'tooLong' };
  }
  const goodUnit = readUnit(unit);
  if (!goodUnit) return { row, problem: 'unit' };
  const paise = readPrice(raw.cells[5] ?? price);
  if (paise === null) return { row, problem: 'price' };
  return { row, company, name_hi: name_hi ?? '', name_en: name_en ?? '', size: size ?? '', unit: goodUnit, price_paise: paise, category: category ?? '' };
}

/** Works out what an upload would do, without saving anything. */
export function planImport(rows: RawRow[], companies: CompanyRow[], items: ItemRow[]): ImportPlan {
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const known = new Set(companies.map((c) => c.name.toLowerCase()));
  const existing = new Map<string, ItemRow>();
  for (const item of items) {
    const company = companyById.get(item.company_id);
    if (company) existing.set(key(company.name, item.name_hi, item.name_en, item.size), item);
  }

  const plan: ImportPlan = { planned: [], errors: [], newCompanies: [] };
  const seen = new Map<string, number>();
  for (const raw of rows) {
    if (raw.cells.every((cell) => text(cell) === '')) continue;
    const row = clean(raw);
    if ('problem' in row) {
      plan.errors.push(row);
      continue;
    }
    const k = key(row.company, row.name_hi, row.name_en, row.size);
    const firstRow = seen.get(k);
    if (firstRow !== undefined) {
      plan.errors.push({ row: row.row, problem: 'repeat', firstRow });
      continue;
    }
    seen.set(k, row.row);

    const item = existing.get(k);
    if (!item) {
      const lower = row.company.toLowerCase();
      if (!known.has(lower)) {
        known.add(lower);
        plan.newCompanies.push(row.company);
      }
      plan.planned.push({ kind: 'add', row });
      continue;
    }
    // A blank optional cell never erases what the item already has.
    const next: ItemRow = {
      ...item,
      name_hi: row.name_hi || item.name_hi,
      name_en: row.name_en || item.name_en,
      unit: row.unit,
      price_paise: row.price_paise,
      category: row.category || item.category,
      server_at: null,
    };
    const changed =
      next.name_hi !== item.name_hi || next.name_en !== item.name_en || next.unit !== item.unit ||
      next.price_paise !== item.price_paise || next.category !== item.category;
    plan.planned.push(changed ? { kind: 'update', row, item, next } : { kind: 'skip', row, item });
  }
  return plan;
}

export function countPlan(plan: ImportPlan): { add: number; update: number; skip: number; errors: number } {
  const count = (kind: Planned['kind']) => plan.planned.filter((p) => p.kind === kind).length;
  return { add: count('add'), update: count('update'), skip: count('skip'), errors: plan.errors.length };
}
