import type { ItemRow } from '../db';
import type { Lang } from './types';

/** The item's name in the chosen language, falling back to the other one. */
export function itemName(item: Pick<ItemRow, 'name_hi' | 'name_en'>, lang: Lang): string {
  return lang === 'hi' ? item.name_hi || item.name_en : item.name_en || item.name_hi;
}
