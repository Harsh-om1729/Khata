import type { CategoryCount } from '../db';
import { useI18n } from '../i18n';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';

export function CategoriesTab({ categories, searching, onPick }: { categories: CategoryCount[]; searching: boolean; onPick: (category: string) => void }) {
  const { t } = useI18n();
  // Items with no category alone do not make a category list worth showing.
  if (categories.every((c) => c.category === '')) {
    return <EmptyState icon="tag" text={searching ? t.searchNone : t.categoriesNone} />;
  }
  return (
    <ul class="item-list">
      {categories.map(({ category, count }) => (
        <li key={category}>
          <button type="button" class="list-button" onClick={() => onPick(category)}>
            <Icon name="tag" />
            <span class="list-button__label">{category || t.noCategory}</span>
            <span class="tag">
              {count} {t.countItems}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
