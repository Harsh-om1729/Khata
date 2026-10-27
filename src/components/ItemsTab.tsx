import type { ItemRow, Listed } from '../db';
import { useI18n } from '../i18n';
import { EmptyState } from './EmptyState';
import { ItemListRow } from './ItemListRow';

interface Props {
  listed: Listed[];
  searching: boolean;
  archived: boolean;
  onOpen: (item: ItemRow) => void;
  onRestore: (item: ItemRow) => void;
}

export function ItemsTab({ listed, searching, archived, onOpen, onRestore }: Props) {
  const { t } = useI18n();
  if (listed.length === 0) {
    return <EmptyState icon="box" text={searching ? t.searchNone : archived ? t.removedNone : t.itemsNone} />;
  }
  return (
    <ul class="item-list">
      {listed.map((entry) => (
        <ItemListRow
          key={entry.item.id}
          listed={entry}
          onOpen={() => onOpen(entry.item)}
          onRestore={archived ? () => onRestore(entry.item) : undefined}
        />
      ))}
    </ul>
  );
}
