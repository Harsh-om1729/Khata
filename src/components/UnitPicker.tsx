import type { Unit } from '../db';
import { useI18n } from '../i18n';

const UNITS: Unit[] = ['piece', 'kg', 'metre', 'bag'];

export function UnitPicker({ value, onChange }: { value: Unit; onChange: (unit: Unit) => void }) {
  const { t } = useI18n();
  const label: Record<Unit, string> = { piece: t.unitPiece, kg: t.unitKg, metre: t.unitMetre, bag: t.unitBag };
  return (
    <fieldset class="units">
      <legend>{t.itemUnit}</legend>
      {UNITS.map((unit) => (
        <label key={unit} class="unit">
          <input type="radio" name="unit" checked={value === unit} onChange={() => onChange(unit)} />
          {label[unit]}
        </label>
      ))}
    </fieldset>
  );
}
