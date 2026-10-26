# Data safety spec

Principle: **browser storage is a working copy, not a backup.** A backup exists only once data reaches the cloud. The app must never present local storage as a backup.

## 1. Local storage
- IndexedDB, not localStorage.
- Request persistent storage (`navigator.storage.persist()`) so Android does not evict data. Warn the user if refused.
- Append-only: sales, repayments, price changes and voids are new records, never overwrites.
- Every record has a client-generated UUID, device ID, staff ID and timestamp.
- Each sale shows a sync status: "Saved on this phone" or "Safe in cloud".
- Warn when unsynced data is old, because clearing browser data or losing the phone destroys unsynced sales.
- Manual "export today's data" button (file for WhatsApp or Drive) as a last-resort backup during testing.

## 2. Authentication
- The owner has a real account (email or phone OTP).
- Each phone is registered as a device and approved by the owner. The owner can revoke a lost phone.
- Staff identity (tile + PIN) is separate from device login and is recorded on every record.
- No shared public key that lets anyone write to the database.
- Access rules in the database: staff devices can add records and read what they need. Only the owner can void, read everything, and manage staff and devices.

## 3. Cloud sync
- Idempotent: re-sending a record with the same UUID never creates a duplicate.
- Records are queued locally and retried automatically with backoff.
- Sales and repayments never conflict, because each is its own record.
- Price list: last write wins, plus a change log.
- The server keeps its own timestamp. If a phone clock is wrong, server time orders records and the difference is flagged.
- Automatic daily database backups, plus a periodic export the owner can download.
- Suggested stack, to confirm in the plan: a Postgres backend with built-in auth and realtime, such as Supabase.

## 4. Tests required before shop use
1. Kill the app mid-sale: nothing half-saved.
2. Airplane mode for a full day, then reconnect: every sale arrives exactly once.
3. Two phones sell offline at once: no bill-number clash, balances correct after sync.
4. Clear browser data on a phone with unsynced sales: the warning was shown beforehand, and the loss is understood.
5. Revoke a device: it can no longer read or write.
6. Restore from a cloud backup into a fresh database: totals and udhaar balances match.
