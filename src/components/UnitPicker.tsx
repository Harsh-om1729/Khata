import type { Unit } from '../db';
import { useI18n } from '../i18n';
import { unitLabel } from '../i18n/unit-label';

const UNITS: Unit[] = ['piece', 'kg', 'metre', 'bag'];

export function UnitPicker({ value, onChange }: { value: Unit; onChange: (unit: Unit) => void }) {
  const { t } = useI18n();
  return (
    <fieldset class="units">
      <legend>{t.itemUnit}</legend>
      {UNITS.map((unit) => (
        <label key={unit} class="unit">
          <input type="radio" name="unit" checked={value === unit} onChange={() => onChange(unit)} />
          {unitLabel(t, unit)}
        </label>
      ))}
    </fieldset>
  );
}
