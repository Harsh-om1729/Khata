# Tasks

Work on ONE task at a time, in order. Tick `[x]` when done and its tests pass.
Each task lists the spec it implements and what "done" means.

## M0 Setup
- [x] M0-1 Project scaffold: Vite + Preact + TypeScript strict, Vitest, Playwright, and the npm scripts in CLAUDE.md. *Done:* `npm run dev`, `npm test`, `npm run build` all run.
- [ ] M0-2 PWA shell: manifest, icons, service worker, installable, works offline after first load. *PLAN §1–2.* *Done:* installs on an Android phone and opens in airplane mode.
- [ ] M0-3 i18n setup with Hindi default and English. *UI-VOICE §1.* *Done:* a test screen switches language.
- [ ] M0-4 Supabase project, schema migrations for all tables, row-level security. *PLAN §3, §5.* *Done:* a device cannot update or delete bills or payments (tested).
- [ ] M0-5 Owner login (email). *PLAN §5.* *Done:* the owner signs in and out.
- [ ] M0-6 Device registration and owner approval/revoke. *DATA-SAFETY §2.* *Done:* a new phone is approved, then revoked and loses access.
- [ ] M0-7 Staff tiles + PIN + auto-lock; staff recorded on records. *SPEC §2.* *Done:* the active staff ID is attached to a test record.

## M1 Items
- [ ] M1-1 Dexie schema for companies and items, with UUIDs and the outbox table. *PLAN §3–4.*
- [ ] M1-2 Company grid with **+ Company**, company page with **+ Item**, short add form. *SPEC §3.1A.* *Done:* add a company and an item in under 30 seconds.
- [ ] M1-3 Item pictures from the phone camera, compressed. *SPEC §8.* *Done:* an item with and without a picture both render.
- [ ] M1-4 Price change with a log (who, when, old, new). *SPEC §3.*
- [ ] M1-5 Excel template download and import with preview (added/updated/skipped, row errors). *SPEC §3.1B.* *Done:* the 500-row sample imports; re-upload creates no duplicates.
- [ ] M1-6 Excel export of the price list and re-import of edited prices.

## M2 Billing (local only)
- [ ] M2-1 Bill model: lines with name and price snapshot, totals in paise. *PLAN §3.*
- [ ] M2-2 Item grid + search + running total strip. *SPEC §4.*
- [ ] M2-3 Quantity edit, line price override, "make this the new default". *SPEC §3.*
- [ ] M2-4 Bill numbers per device per day. *PLAN §3.* *Done:* two devices never clash (tested).
- [ ] M2-5 Cash payment, save, atomic write with outbox. *DATA-SAFETY §1.* *Done:* killing the app mid-save leaves no half bill.
- [ ] M2-6 "Not in list? Add new" during billing, marked "new, check". *SPEC §3.1A.*
- [ ] M2-7 Persistent storage request and warnings. *DATA-SAFETY §1.*
- [ ] M2-8 Bill history list and on-screen bill view.

## M3 Sync
- [ ] M3-1 Outbox push with idempotent insert and retry/backoff. *PLAN §4.*
- [ ] M3-2 Sync status labels "Saved on this phone" / "Safe in cloud". *DATA-SAFETY §1.*
- [ ] M3-3 Pull of items, staff and customers using the `server_at` cursor.
- [ ] M3-4 Heartbeat (`last_seen`, `unsynced_count`) and clock-drift flag.
- [ ] M3-5 Offline-day test: a full day offline then reconnect gives every sale once. *DATA-SAFETY §4 test 2, 3.*

## M4 Udhaar and UPI
- [ ] M4-1 Customers with name and phone (required for udhaar). *SPEC §5.*
- [ ] M4-2 Udhaar and part-paid payments on a bill.
- [ ] M4-3 Repayments (any amount, any day). *Done:* the balance equals the hand-calculated set.
- [ ] M4-4 Opening balances entered as dated records.
- [ ] M4-5 Overdue list with tap-to-call, balance, days since last payment; N days setting.
- [ ] M4-6 UPI QR upload (owner) and full-screen QR with "Payment received". *SPEC §4.1.*

## M5 Owner dashboard
- [ ] M5-1 Today's totals and cash/UPI received including repayments. *SPEC §6.*
- [ ] M5-2 Live sales feed over Realtime. *Done:* a sale shows on the owner's phone within 10 seconds.
- [ ] M5-3 Udhaar totals and per-customer balances.
- [ ] M5-4 Alerts: unusual price change, void, device silent. Show "last updated at".
- [ ] M5-5 Void flow with owner PIN and reason; simple return as a negative bill. *SPEC §4.*
- [ ] M5-6 Scheduled data export the owner can download. *PLAN §5.*

## M6 Voice
- [ ] M6-1 Speech input (hi-IN) producing a confirm checklist; never auto-adds. *UI-VOICE §3.*
- [ ] M6-2 Custom word list mapping spoken terms to item IDs.
- [ ] M6-3 Spoken total in Hindi words, with large digits always shown. *UI-VOICE §4.*
- [ ] M6-4 Test on the actual shop phones and make a go/no-go decision. *UI-VOICE §5.*

## M7 Hardening
- [ ] M7-1 Backup and restore drill into a fresh database. *DATA-SAFETY §4 test 6.*
- [ ] M7-2 Performance on the cheapest phone with 500 items.
- [ ] M7-3 Hindi UI review with real staff; fix confusing screens.
- [ ] M7-4 Run DATA-SAFETY tests 1 to 6 and record the results.

## Pilot
- [ ] P-1 One week at the shop beside the paper notebook; check the success criteria in SPEC §9.
