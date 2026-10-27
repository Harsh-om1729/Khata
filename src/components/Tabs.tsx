import type { IconName } from './Icon';
import { Icon } from './Icon';

export interface TabSpec<K extends string> {
  key: K;
  label: string;
  icon: IconName;
}

/** The chosen tab is bold and underlined, so it never depends on colour alone. */
export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: TabSpec<K>[]; value: K; onChange: (key: K) => void }) {
  return (
    <div class="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.key} type="button" role="tab" class="tabs__tab" aria-selected={tab.key === value} onClick={() => onChange(tab.key)}>
          <Icon name={tab.icon} />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
