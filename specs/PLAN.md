# Technical plan v1

Turns `SPEC.md`, `DATA-SAFETY.md` and `UI-VOICE.md` into build decisions. No code yet. Items marked **(confirm)** are my recommendation and need your OK before building.

## 1. Stack (confirm)
| Part | Choice | Why |
|---|---|---|
| App | TypeScript + Vite + Preact | Small bundle, fast on 2 GB Android phones |
| Local DB | IndexedDB through Dexie | Reliable, queryable, works offline |
| Offline | Service worker via vite-plugin-pwa (Workbox) | Installable app, cached screens and images |
| Cloud | Supabase (Postgres, Auth, Realtime, Storage) | One service gives login, row-level security, live updates, daily backups |
| Hosting | Cloudflare Pages (free tier) | Fast static hosting, HTTPS (required for PWA, camera, mic) |
| Excel | SheetJS in the browser | Parse and export `.xlsx` with no server |
| Voice | Browser SpeechRecognition (hi-IN) and SpeechSynthesis | No cost; limits in `UI-VOICE.md` |
| Tests | Vitest for logic, Playwright for flows, manual checklist on real phones | |

Cost for 4 users: expected to be within free tiers. Check Supabase free-tier limits (database pausing, backup retention) before the shop test. Backups on the free tier may be limited, so a paid plan or the scheduled export in section 5 may be needed.

## 2. Architecture
```
Phone (PWA)                                  Supabase
 UI -> local store (IndexedDB) -> outbox  ->  Postgres (RLS)  -> Realtime -> Owner phone
        ^  reads always local                 Auth, Storage (pictures, QR)
```
- Every screen reads and writes the local store only. The app is fully usable offline.
- A sync loop pushes the outbox to the cloud and pulls changes down (price list, staff, customers).
- The owner's dashboard reads from the cloud (live), and shows its own device's local data when offline.

## 3. Data model (append-only events)
All tables have `id` (UUID made on the phone), `device_id`, `created_at` (device time), `server_at` (set by the server).

| Table | Key fields | Notes |
|---|---|---|
| devices | name, status (pending/approved/revoked), last_seen, unsynced_count | One per phone |
| staff | name, photo, pin_hash, active | PIN synced to devices |
| companies | name, picture | |
| items | company_id, name_hi, name_en, size, unit, price, category, picture, needs_review | Natural key: company + name + size |
| price_changes | item_id, old, new, staff_id | Log of every change |
| customers | name, phone | |
| bills | bill_no, staff_id, customer_id?, total, status (active/voided), kind (sale/return), linked_bill_id? | Never edited |
| bill_lines | bill_id, item_id, name snapshot, qty, unit price, line total | Snapshot, so later price changes do not alter old bills |
| payments | bill_id?, customer_id?, method (cash/upi/udhaar), amount, type (sale/repayment/opening) | Every money movement is one row |
| voids | bill_id, staff_id, reason, approved_by | Bill stays visible |
| alerts | type, ref_id, seen | Created by the app and by DB rules |

Rules:
- **Udhaar balance** = opening + udhaar sales - repayments, always computed from `payments`. Never stored as an editable number.
- **Bill number** = device code + date + per-device counter, e.g. `A-261026-007`. No two phones can clash.
- **Totals** are integers in paise to avoid rounding errors.
- A void is a new row, not a delete.

## 4. Sync design
1. Writing a record also writes an outbox entry in one IndexedDB transaction (all or nothing).
2. The sync loop sends outbox rows in batches, using "insert, ignore if the UUID exists". This makes retries safe.
3. A row is marked "Safe in cloud" only after the server confirms it.
4. Pull: price list, items, staff and customers come down using a `server_at` cursor.
5. Triggers: app start, coming back online, every 30 seconds when online, and after every save.
6. Retries use backoff. Failures never block the counter.
7. Heartbeat: each device reports `last_seen` and `unsynced_count`. A device that is offline cannot report, so the owner's dashboard raises "device silent" when `last_seen` is older than N minutes during shop hours. This is how "unsynced" is detected honestly.

## 5. Security
- Owner signs in with email magic link or password. Phone OTP costs per SMS, so avoid it unless wanted.
- A staff phone shows a short registration code. The owner approves it in the app. The phone then gets its own limited login. The owner can revoke a lost phone at once.
- Row-level rules: a device can insert records and read the shared data it needs. It cannot update or delete bills or payments, and cannot read other devices' private settings. Only the owner role can approve voids and manage staff and devices.
- **The staff PIN is for attribution and to stop casual mistakes. It is not strong security**, because the PIN hashes live on the phones. Real protection is device approval and revocation. This is stated in the app's help text for the owner.
- The service key is never in the app. No secrets in the repository.
- Backups: Supabase automatic backups, plus a scheduled export of all tables to a file the owner can download from the app.

## 6. Build order (each step ends with something testable)
| Step | Deliverable | Done when |
|---|---|---|
| M0 | Project setup, PWA shell, Supabase project, device registration and owner login | A phone installs the app and the owner approves it |
| M1 | Items: companies, items, "+" add, Excel import and export, photos | 500-item Excel imports with preview and no duplicates on re-upload |
| M2 | Billing on the local store: grid, search, lines, price override, cash, save, bill numbers | A bill is made with airplane mode on and survives killing the app |
| M3 | Sync: outbox, push, pull, sync status labels, heartbeat | Offline-day test passes with no loss and no duplicates |
| M4 | Customers and udhaar: udhaar sales, repayments, opening balances, overdue list with tap-to-call, UPI QR screen | Balances match a hand-calculated set |
| M5 | Owner dashboard: totals, live feed, cash and UPI, udhaar, alerts, void and return | Sale on one phone appears on the owner's phone within 10 seconds |
| M6 | Voice input with confirm checklist and spoken Hindi total | Tested on the actual shop phones, with a go/no-go decision |
| M7 | Hardening: backup/restore drill, performance on the cheapest phone, Hindi UI review with real staff | `DATA-SAFETY.md` tests 1 to 6 all pass |
| Pilot | One week at the shop, running beside the paper notebook | Success criteria in `SPEC.md` section 9 |

Voice is deliberately after the money-critical parts (M2 to M5). If voice proves unreliable, the app is still fully usable.

## 7. Risks
| Risk | Effect | Mitigation |
|---|---|---|
| Android clears browser data | Unsynced sales lost | Persistent storage request, warnings, install as PWA, export button, sync often |
| Hindi voice recognition is weak or online-only | Voice is slow or fails | Confirm checklist, custom word list, taps always work, decide at M6 |
| Hindi TTS voice missing on a phone | No spoken total | Large digits always shown; test and install voices on each phone |
| Staff confuse the two sync states | Think data is safe when not | Clear "Saved on this phone" vs "Safe in cloud" labels, trained at pilot |
| Wrong phone clock | Misordered records | Server time used for ordering, discrepancy flagged |
| Owner enters 500 items slowly | Staff cannot find items | Start with the top 100 sellers, add the rest as sales happen via "Not in list? Add new" |
| Free-tier limits | Pause or lost backups | Check limits at M0, plan for a low-cost paid tier |

## 8. Decisions needed from you
1. **Stack OK?** (Preact + Dexie + Supabase + Cloudflare Pages), or do you prefer something else?
2. **Owner login:** email magic link / password (recommended), or phone OTP?
3. **Who builds it?** You, a developer, or me step by step? This changes how detailed the next documents should be.
4. **Do you have the shop's UPI QR image, and a few staff and phone models for M6 testing?**
