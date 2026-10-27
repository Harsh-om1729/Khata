import type { IconName } from './Icon';
import { Icon } from './Icon';

interface Props {
  label: string;
  onClick?: () => void;
  icon?: IconName;
  primary?: boolean;
  type?: 'button' | 'submit';
  disabled?: boolean;
}

export function PillButton({ label, onClick, icon, primary = false, type = 'button', disabled = false }: Props) {
  return (
    <button type={type} class={primary ? 'pill pill--primary' : 'pill'} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} />}
      {label}
    </button>
  );
}
