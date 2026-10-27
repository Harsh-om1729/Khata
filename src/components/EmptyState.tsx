import type { ComponentChildren } from 'preact';
import type { IconName } from './Icon';
import { Icon } from './Icon';

/** A big picture and one plain sentence, for screens with nothing to show yet. */
export function EmptyState({ icon, text, children }: { icon: IconName; text: string; children?: ComponentChildren }) {
  return (
    <div class="empty-state">
      <span class="empty-state__picture" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <p class="empty-state__text">{text}</p>
      {children}
    </div>
  );
}
