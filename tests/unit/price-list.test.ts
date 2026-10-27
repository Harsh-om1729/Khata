import { afterEach, describe, expect, it } from 'vitest';
import { read, utils, write } from 'xlsx/dist/xlsx.mini.min';
import sample500 from '../fixtures/products-500.xlsx?inline';
import { KhataDb, createCompany, createItem, priceHistory, setArchived, type Author } from '../../src/db';
import { applyImport } from '../../src/excel/apply';
import { HEADERS, PRODUCTS_SHEET } from '../../src/excel/columns';
import { priceListFileName, priceListRows } from '../../src/excel/price-list';
import { priceListBytes, readProducts } from '../../src/excel/workbook';
import { parseRupees, rupeesNumber } from '../../src/money';
import type { StaffMember } from '../../src/staff/types';

const owner: StaffMember = { id: 'staff-owner', name: 'Harsh', photo: null, is_owner: true, active: true, pin_version: 1, removed_at: null };
const ramesh: StaffMember = { ...owner, id: 'staff-ramesh', name: 'Ramesh', is_owner: false };
const asOwner: Author = { staff: owner, deviceId: 'device-1' };
const asStaff: Author = { staff: ramesh, deviceId: 'device-2' };

function bytesOf(dataUrl: string): ArrayBuffer {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer;
}

/** Opens a workbook, lets a test change the Products rows like a person in Excel would, and saves it. */
function editProducts(bytes: ArrayBuffer, edit: (rows: unknown[][]) => void): ArrayBuffer {
  const book = read(bytes, { type: 'array' });
  const sheet = book.Sheets[PRODUCTS_SHEET];
  if (!sheet) throw new Error('no Products sheet');
  const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  edit(rows);
  book.Sheets[PRODUCTS_SHEET] = utils.aoa_to_sheet(rows);
  return write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

const opened: KhataDb[] = [];
async function shopWith500() {
  const db = new KhataDb(`test-${crypto.randomUUID()}`);
  opened.push(db);
  await applyImport(db, asOwner, readProducts(bytesOf(sample500)) ?? []);
  return db;
}
afterEach(async () => {
  for (const db of opened.splice(0)) await db.delete();
});

describe('paise in spreadsheet cells', () => {
  it('every paise amount up to ₹10,000 reads back to exactly the same paise', () => {
    for (let paise = 0; paise <= 1_000_000; paise++) {
      if (parseRupees(String(rupeesNumber(paise))) !== paise) throw new Error(`${paise} did not round-trip`);
    }
  });

  it('large prices too', () => {
    for (const paise of [123_456_789, 9_999_999_999, 100_000_000_001]) {
      expect(parseRupees(String(rupeesNumber(paise)))).toBe(paise);
    }
  });
});

describe('price list export (M1-6)', () => {
  it('lists active items in template columns, sorted by company, name and size, without archived ones', async () => {
    const db = new KhataDb(`test-${crypto.randomUUID()}`);
    opened.push(db);
    const tata = await createCompany(db, asOwner, { name: 'Tata' });
    const acc = await createCompany(db, asOwner, { name: 'ACC' });
    const gone = await createCompany(db, asOwner, { name: 'Old Brand' });
    await createItem(db, asOwner, { company_id: tata.id, name_en: 'Rod', size: '12mm', unit: 'kg', price_paise: 6_250 });
    await createItem(db, asOwner, { company_id: tata.id, name_en: 'Rod', size: '8mm', unit: 'kg', price_paise: 6_400 });
    await createItem(db, asOwner, { company_id: acc.id, name_hi: 'सीमेंट', size: '50kg', unit: 'bag', price_paise: 37_000, category: 'Cement' });
    const old = await createItem(db, asOwner, { company_id: acc.id, name_en: 'Old Cement', price_paise: 100 });
    await setArchived(db, 'items', old.id, true);
    await createItem(db, asOwner, { company_id: gone.id, name_en: 'Thing', price_paise: 100 });
    await setArchived(db, 'companies', gone.id, true);

    expect(priceListRows(await db.companies.toArray(), await db.items.toArray())).toEqual([
      ['ACC', 'सीमेंट', '', '50kg', 'bag', 370, 'Cement'],
      ['Tata', '', 'Rod', '8mm', 'kg', 64, ''],
      ['Tata', '', 'Rod', '12mm', 'kg', 62.5, ''],
    ]);
  });

  it('names the file with the date', () => {
    expect(priceListFileName(new Date(2026, 9, 7))).toBe('khata-price-list-2026-10-07.xlsx');
  });

  it('the exported file has the template headings and uploads again with no changes', async () => {
    const db = await shopWith500();
    const bytes = priceListBytes(await db.companies.toArray(), await db.items.toArray());
    const rows = readProducts(bytes);
    expect(rows).toHaveLength(500);
    const book = read(bytes, { type: 'array' });
    expect(book.SheetNames).toEqual(['Instructions', PRODUCTS_SHEET]);
    expect(utils.sheet_to_json<unknown[]>(book.Sheets[PRODUCTS_SHEET] ?? {}, { header: 1 })[0]).toEqual([...HEADERS]);

    const before = await db.outbox.count();
    expect(await applyImport(db, asOwner, rows ?? [])).toEqual({ add: 0, update: 0, skip: 500, errors: 0 });
    expect(await db.outbox.count()).toBe(before);
  });

  it('export, change many prices in Excel, upload: only those prices change, each one logged', async () => {
    const db = await shopWith500();
    const exported = priceListBytes(await db.companies.toArray(), await db.items.toArray());

    // Raise every Ultratech price by ₹10, as a shopkeeper would after a rate change.
    const edited = editProducts(exported, (rows) => {
      for (const row of rows.slice(1)) if (row[0] === 'Ultratech') row[5] = Number(row[5]) + 10;
    });
    const result = await applyImport(db, asStaff, readProducts(edited) ?? []);
    expect(result).toEqual({ add: 0, update: 2, skip: 498, errors: 0 });

    const ultratech = (await db.companies.toArray()).find((c) => c.name === 'Ultratech');
    const items = await db.items.where('company_id').equals(ultratech?.id ?? '').toArray();
    expect(items.map((i) => [i.size, i.price_paise]).sort()).toEqual([['25kg', 77_050], ['50kg', 39_000]]);
    for (const item of items) {
      const [change] = await priceHistory(db, item.id);
      expect(change).toMatchObject({ old_paise: item.price_paise - 1_000, new_paise: item.price_paise, staff_id: 'staff-ramesh' });
    }
    expect(await db.items.count()).toBe(500);
    expect(await db.price_changes.count()).toBe(2);
  });

  it('a row added to the exported file becomes a new item; a broken price is reported by row', async () => {
    const db = await shopWith500();
    const exported = priceListBytes(await db.companies.toArray(), await db.items.toArray());
    const edited = editProducts(exported, (rows) => {
      const second = rows[2];
      if (second) second[5] = 'abc';
      rows.push(['Ultratech', 'सीमेंट', 'Cement', '10kg', 'bag', 90, 'Cement']);
    });
    const result = await applyImport(db, asOwner, readProducts(edited) ?? []);
    expect(result).toEqual({ add: 1, update: 0, skip: 499, errors: 1 });
    expect(await db.items.count()).toBe(501);
  });
});
