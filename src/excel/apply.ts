import type { Author, CompanyRow, ItemRow, KhataDb, PriceChangeRow } from '../db';
import { putWithOutbox, type Write } from '../db/outbox';
import { stampRecord } from '../staff/stamp';
import { countPlan, planImport, type RawRow } from './plan';

/**
 * Saves an upload in one transaction. The plan is worked out again inside it, so a change made
 * since the preview (e.g. the same item added by hand) can never cause a duplicate.
 */
export async function applyImport(db: KhataDb, author: Author, rows: RawRow[]) {
  stampRecord(author.staff, author.deviceId);
  return db.transaction('rw', db.allTables(), async () => {
    const companies = await db.companies.toArray();
    const plan = planImport(rows, companies, await db.items.toArray());
    const byName = new Map(companies.map((c) => [c.name.toLowerCase(), c]));
    const writes: Write[] = [];

    const companyFor = (name: string): CompanyRow => {
      const found = byName.get(name.toLowerCase());
      if (found) return found;
      const company: CompanyRow = { ...stampRecord(author.staff, author.deviceId), server_at: null, name, picture: null, archived: false };
      byName.set(name.toLowerCase(), company);
      writes.push({ table: 'companies', row: company });
      return company;
    };

    for (const planned of plan.planned) {
      if (planned.kind === 'skip') continue;
      if (planned.kind === 'update') {
        if (planned.next.price_paise !== planned.item.price_paise) {
          const change: PriceChangeRow = {
            ...stampRecord(author.staff, author.deviceId),
            server_at: null,
            item_id: planned.item.id,
            old_paise: planned.item.price_paise,
            new_paise: planned.next.price_paise,
          };
          writes.push({ table: 'price_changes', row: change });
        }
        writes.push({ table: 'items', row: planned.next });
        continue;
      }
      const { row } = planned;
      const item: ItemRow = {
        ...stampRecord(author.staff, author.deviceId),
        server_at: null,
        company_id: companyFor(row.company).id,
        name_hi: row.name_hi,
        name_en: row.name_en,
        size: row.size,
        unit: row.unit,
        price_paise: row.price_paise,
        category: row.category,
        picture: null,
        // Same rule as adding by hand (SPEC §3.1A.5).
        needs_review: !author.staff?.is_owner,
        archived: false,
      };
      writes.push({ table: 'items', row: item });
    }
    await putWithOutbox(db, writes);
    return countPlan(plan);
  });
}
