import type { Unit } from '../db';
import type { Messages } from './types';

export function unitLabel(t: Messages, unit: Unit): string {
  return { piece: t.unitPiece, kg: t.unitKg, metre: t.unitMetre, bag: t.unitBag }[unit];
}
