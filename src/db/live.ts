import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';

export interface Live<T> {
  value: T | undefined;
  failed: boolean;
}

/** Re-runs the query whenever the tables it reads change, so screens stay current after any save or sync. */
export function useLiveQuery<T>(query: () => Promise<T>, deps: unknown[]): Live<T> {
  const [state, setState] = useState<Live<T>>({ value: undefined, failed: false });
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (value) => setState({ value, failed: false }),
      error: () => setState((prev) => ({ ...prev, failed: true })),
    });
    return () => subscription.unsubscribe();
  }, deps);
  return state;
}
