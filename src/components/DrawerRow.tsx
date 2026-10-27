import type { IconName } from './Icon';
import { Icon } from './Icon';

interface Props {
  icon: IconName;
  label: string;
  onClick: () => void;
  /** The screen showing now. */
  current?: boolean;
  /** Set only on rows that open into sub-rows. */
  expanded?: boolean;
  sub?: boolean;
}

export function DrawerRow({ icon, label, onClick, current = false, expanded, sub = false }: Props) {
  const classes = ['drawer-row', sub && 'drawer-row--sub', current && 'drawer-row--current'].filter(Boolean).join(' ');
  return (
    <button type="button" class={classes} onClick={onClick} aria-current={current ? 'page' : undefined} aria-expanded={expanded}>
      <span class="drawer-row__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <span class="drawer-row__label">{label}</span>
      {expanded !== undefined && (
        <span class="drawer-row__chevron" aria-hidden="true">
          <Icon name="chevron" />
        </span>
      )}
    </button>
  );
}
