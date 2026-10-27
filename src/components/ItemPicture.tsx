import { useMemo } from 'preact/hooks';
import { useLiveQuery } from '../db/live';
import { useObjectUrl } from '../pictures/use-object-url';
import { useServices } from '../services';

/** The item's photo, or its first letter when it has none (or the photo is not on this phone yet). */
export function ItemPicture({ path, name }: { path: string | null; name: string }) {
  const { db } = useServices();
  const picture = useLiveQuery(async () => (path ? ((await db.pictures.get(path)) ?? null) : null), [db, path]);
  const row = picture.value;
  const blob = useMemo(() => (row ? new Blob([row.bytes], { type: row.type }) : null), [row]);
  const url = useObjectUrl(blob);
  if (url) return <img class="tile__photo" src={url} alt="" />;
  return (
    <span class="tile__avatar" aria-hidden="true">
      {name.charAt(0)}
    </span>
  );
}
