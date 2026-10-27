import { afterEach, describe, expect, it } from 'vitest';
import { read, utils, write } from 'xlsx/dist/xlsx.mini.min';
import referenceTemplate from '../../specs/products-template.xlsx?inline';
import sample500 from '../fixtures/products-500.xlsx?inline';
import { KhataDb, createCompany, createItem, priceHistory, type Author } from '../../src/db';
import { applyImport } from '../../src/excel/apply';
import { HEADERS } from '../../src/excel/columns';
import { countPlan, planImport } from '../../src/excel/plan';
import { readProducts, templateBytes } from '../../src/excel/workbook';
import type { StaffMember } from '../../src/staff/types';

const owner: StaffMember = { id: 'staff-owner', name: 'Harsh', photo: null, is_owner: true, active: true, pin_version: 1, removed_at: null };
const ramesh: StaffMember = { ...owner, id: 'staff-ramesh', name: 'Ramesh', is_owner: false };
const asOwner: Author = { staff: owner, deviceId: 'device-1' };
const asStaff: Author = { staff: ramesh, deviceId: 'device-2' };

function bytesOf(dataUrl: string): ArrayBuffer {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer;
}

function sheetFile(rows: unknown[][], sheet = 'Products', headers: readonly string[] = HEADERS): ArrayBuffer {
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet([[...headers], ...rows]), sheet);
  return write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

function sheets(bytes: ArrayBuffer) {
  const book = read(bytes, { type: 'array' });
  return book.SheetNames.map((name) => {
    const sheet = book.Sheets[name];
    return [name, sheet ? utils.sheet_to_json(sheet, { header: 1, defval: '' }) : []];
  });
}

const opened: KhataDb[] = [];
function freshDb() {
  const db = new KhataDb(`test-${crypto.randomUUID()}`);
  opened.push(db);
  return db;
}
afterEach(async () => {
  for (const db of opened.splice(0)) await db.delete();
});

describe('Excel template (M1-5)', () => {
  it('the downloaded template has the same sheets and text as specs/products-template.xlsx', () => {
    expect(sheets(templateBytes())).toEqual(sheets(bytesOf(referenceTemplate)));
  });

  it('a blank template reads as zero rows; the Example sheet is never imported', () => {
    expect(readProducts(templateBytes())).toEqual([]);
  });

  it('refuses files that are not a filled-in template', () => {
    expect(readProducts(new TextEncoder().encode('not excel').buffer)).toBeNull();
    expect(readProducts(sheetFile([], 'Sheet1'))).toBeNull();
    expect(readProducts(sheetFile([], 'Products', ['Name', 'Price']))).toBeNull();
  });

  it('keeps the Excel row numbers people see, counting blank rows', () => {
    const rows = readProducts(sheetFile([['ACC', '', 'Cement', '50kg', 'bag', 370, ''], [], ['ACC', '', 'Cement', '25kg', 'bag', 190, '']]));
    expect(rows?.filter((r) => r.cells.some((c) => c !== '')).map((r) => r.row)).toEqual([2, 4]);
  });
});

describe('Excel import (M1-5 done check)', () => {
  it('the 500-row sample imports, and uploading it again creates no duplicates', async () => {
    const db = freshDb();
    const rows = readProducts(bytesOf(sample500));
    expect(rows).toHaveLength(500);

    const preview = planImport(rows ?? [], [], []);
    expect(countPlan(preview)).toEqual({ add: 500, update: 0, skip: 0, errors: 0 });

    expect(await applyImport(db, asOwner, rows ?? [])).toEqual({ add: 500, update: 0, skip: 0, errors: 0 });
    expect(await db.items.count()).toBe(500);
    const companies = await db.companies.count();
    expect(companies).toBe(preview.newCompanies.length);

    expect(await applyImport(db, asOwner, rows ?? [])).toEqual({ add: 0, update: 0, skip: 500, errors: 0 });
    expect(await db.items.count()).toBe(500);
    expect(await db.companies.count()).toBe(companies);
    expect(await db.outbox.count()).toBe(500 + companies);
  });

  it('uses existing companies and items made by hand, and logs every price change', async () => {
    const db = freshDb();
    const acc = await createCompany(db, asOwner, { name: 'ACC' });
    const cement = await createItem(db, asOwner, { company_id: acc.id, name_en: 'Cement', size: '50kg', unit: 'bag', price_paise: 37_000 });
    const rows = readProducts(sheetFile([['acc', 'सीमेंट', 'CEMENT', '50KG', 'bag', 385.5, 'Cement'], ['ACC', '', 'Cement', '25kg', 'bag', 190, '']])) ?? [];

    expect(await applyImport(db, asStaff, rows)).toEqual({ add: 1, update: 1, skip: 0, errors: 0 });
    expect(await db.companies.count()).toBe(1);
    expect(await db.items.get(cement.id)).toMatchObject({ price_paise: 38_550, name_hi: 'सीमेंट', category: 'Cement', needs_review: false });
    expect(await priceHistory(db, cement.id)).toMatchObject([{ old_paise: 37_000, new_paise: 38_550, staff_id: 'staff-ramesh' }]);
    const added = (await db.items.toArray()).find((i) => i.size === '25kg');
    expect(added).toMatchObject({ company_id: acc.id, staff_id: 'staff-ramesh', needs_review: true, price_paise: 19_000 });
  });

  it('skips rows with errors and saves the rest', async () => {
    const db = freshDb();
    const rows = readProducts(sheetFile([['ACC', '', 'Cement', '50kg', 'dozen', 370, ''], ['ACC', '', 'Cement', '25kg', 'bag', 190, '']])) ?? [];
    expect(await applyImport(db, asOwner, rows)).toEqual({ add: 1, update: 0, skip: 0, errors: 1 });
    expect(await db.items.count()).toBe(1);
  });

  it('saves nothing if any write fails', async () => {
    const db = freshDb();
    db.outbox.hook('creating', () => {
      throw new Error('disk full');
    });
    await expect(applyImport(db, asOwner, readProducts(bytesOf(sample500)) ?? [])).rejects.toThrow();
    expect(await db.items.count()).toBe(0);
    expect(await db.companies.count()).toBe(0);
  });

  it('refuses when no staff member is unlocked', async () => {
    await expect(applyImport(freshDb(), { staff: null, deviceId: 'device-1' }, [])).rejects.toThrow();
  });
});
