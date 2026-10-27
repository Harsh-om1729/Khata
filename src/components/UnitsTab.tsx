import type { Unit } from '../db';
import { useI18n } from '../i18n';
import { unitLabel } from '../i18n/unit-label';
import { Icon } from './Icon';

const units: Unit[] = ['piece', 'kg', 'metre', 'bag'];

/** Units are a fixed list (SPEC §3), so this tab only shows them. */
export function UnitsTab({ counts }: { counts: Record<Unit, number> }) {
  const { t } = useI18n();
  return (
    <>
      <p class="hint">{t.unitsHint}</p>
      <ul class="item-list">
        {units.map((unit) => (
          <li key={unit} class="list-button">
            <Icon name="ruler" />
            <span class="list-button__label">{unitLabel(t, unit)}</span>
            <span class="tag">
              {counts[unit]} {t.countItems}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
