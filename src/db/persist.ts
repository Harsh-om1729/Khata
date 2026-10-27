export interface StorageGuard {
  /** True only when the browser has promised not to clear this app's data to free space. */
  persist(): Promise<boolean>;
}

type StorageLike = Pick<StorageManager, 'persist' | 'persisted'>;

/** Asks once per app start (DATA-SAFETY §1). Android usually agrees only for apps installed to the home screen. */
export function createStorageGuard(storage: Partial<StorageLike> | undefined = globalThis.navigator?.storage): StorageGuard {
  return {
    async persist() {
      try {
        if (!storage?.persist) return false;
        if (storage.persisted && (await storage.persisted())) return true;
        return await storage.persist();
      } catch {
        return false;
      }
    },
  };
}
