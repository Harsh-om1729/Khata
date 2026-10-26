# Khata

Khata is an offline-first billing PWA for a hardware shop in Bihar. Three staff on shared, cheap Android phones make bills by tapping item pictures or speaking an order in Hindi/English mix, and the app speaks the total in Hindi. It keeps an udhaar (credit) ledger with small repayments, and the owner watches sales, udhaar, cash and UPI live from his own phone. Data is stored on the phone first and synced to the cloud, which is the only real backup.
Core Idea is make for the shopkeeper who dont have much knowledge of computer and smartphone.

## Tech stack
TypeScript, Vite, Preact, Dexie (IndexedDB), vite-plugin-pwa (Workbox), Supabase (Postgres, Auth, Realtime, Storage), Cloudflare Pages, SheetJS (Excel), Vitest, Playwright.

## Folder structure
Planned. Folders are created as tasks need them, starting at M0.
```
specs/        SPEC.md, DATA-SAFETY.md, UI-VOICE.md, PLAN.md, tasks.md, products-template.xlsx
src/
  screens/    full screens (billing, udhaar, dashboard, items)
  components/ shared UI pieces
  db/         Dexie schema, outbox, queries
  sync/       push/pull, heartbeat, retry
  voice/      speech input and spoken total
  excel/      template, import preview, export
  i18n/       all UI text (Hindi default, English)
tests/        unit and e2e tests
supabase/     migrations and row-level security rules
public/       icons, manifest
```

## Rules
1. Always read `specs/` before starting any task.
2. Work on only ONE task from `specs/tasks.md` at a time.
3. If code needs to differ from the spec, stop and ask me to update the spec first.
4. Write tests for every feature.
5. After finishing a task, tick it in `specs/tasks.md` and suggest a git commit message.

## Guardrails from the specs
- Money is stored as integer paise, never floats.
- Bills, payments, price changes and voids are append-only. Never edit or delete them. A void is a new record.
- Udhaar balance is always computed from payment records, never stored as an editable number.
- Every record gets a UUID made on the phone, so syncing the same record twice never duplicates it.
- Show "Safe in cloud" only after the server confirms. Never call local storage a backup.
- No secrets or service keys in the app or the repository.

## Coding style
- TypeScript strict mode. No `any`.
- Function components with hooks. Named exports. Small files, one job each.
- All UI text goes through `src/i18n/`. Hindi is the default. No hardcoded strings in components.
- Touch targets at least 48px. Pictures and icons over text. Never rely on colour alone.
- Keep the bundle small. Do not add a heavy dependency without checking it against the 2 GB phone target.
- Comments only for non-obvious reasons, not for what the code does.

## Commands
These scripts are created in task M0-1 and do not exist until then.
```
npm run dev        # dev server
npm test           # unit tests (Vitest)
npm run test:e2e   # end-to-end tests (Playwright)
npm run build      # production build
npm run preview    # serve the production build locally
```
