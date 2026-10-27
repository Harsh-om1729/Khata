// Only this file imports SheetJS, and it is loaded on demand, so the library is not in the app's start-up code.
import { read, utils, write, writeFile, type WorkBook } from 'xlsx/dist/xlsx.mini.min';
import { EXAMPLE_ROWS, HEADERS, INSTRUCTIONS, PRODUCTS_SHEET } from './columns';
import type { CompanyRow, ItemRow } from '../db';
import type { RawRow } from './plan';
import { priceListFileName, priceListRows } from './price-list';

export const TEMPLATE_FILE = 'khata-products-template.xlsx';

export function makeTemplate(): WorkBook {
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet(INSTRUCTIONS.map((line) => [line])), 'Instructions');
  utils.book_append_sheet(book, utils.aoa_to_sheet([[...HEADERS]]), PRODUCTS_SHEET);
  utils.book_append_sheet(book, utils.aoa_to_sheet([[...HEADERS], ...EXAMPLE_ROWS]), 'Example');
  return book;
}

export function downloadTemplate(): void {
  writeFile(makeTemplate(), TEMPLATE_FILE);
}

export function templateBytes(): ArrayBuffer {
  return write(makeTemplate(), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

/** The current price list in the template's format, so it can be edited and uploaded again. */
export function makePriceList(companies: CompanyRow[], items: ItemRow[]): WorkBook {
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet(INSTRUCTIONS.map((line) => [line])), 'Instructions');
  const sheet = utils.aoa_to_sheet([[...HEADERS], ...priceListRows(companies, items)]);
  sheet['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 14 }];
  utils.book_append_sheet(book, sheet, PRODUCTS_SHEET);
  return book;
}

export function downloadPriceList(companies: CompanyRow[], items: ItemRow[]): void {
  writeFile(makePriceList(companies, items), priceListFileName());
}

export function priceListBytes(companies: CompanyRow[], items: ItemRow[]): ArrayBuffer {
  return write(makePriceList(companies, items), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

const normal = (value: unknown) => String(value ?? '').trim().toLowerCase();

/** The Products sheet's data rows, or null when the file is not a filled-in template. */
export function readProducts(bytes: ArrayBuffer): RawRow[] | null {
  let book: WorkBook;
  try {
    book = read(bytes, { type: 'array' });
  } catch {
    return null;
  }
  const sheet = book.Sheets[PRODUCTS_SHEET];
  if (!sheet) return null;
  const [header, ...rows] = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: true, raw: true });
  if (!header || HEADERS.some((title, i) => normal(header[i]) !== normal(title))) return null;
  return rows.map((cells, i) => ({ row: i + 2, cells }));
}
