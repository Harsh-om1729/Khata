// Only this file imports SheetJS, and it is loaded on demand, so the library is not in the app's start-up code.
import { read, utils, write, writeFile, type WorkBook } from 'xlsx/dist/xlsx.mini.min';
import { EXAMPLE_ROWS, HEADERS, INSTRUCTIONS, PRODUCTS_SHEET } from './columns';
import type { RawRow } from './plan';

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
