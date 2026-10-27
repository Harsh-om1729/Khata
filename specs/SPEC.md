# Khata — Spec v1.1 (main)

Billing PWA for a hardware shop in Bihar. Spec only. No code yet.

Related files:
- `DATA-SAFETY.md`: local storage, cloud sync, auth, tests
- `UI-VOICE.md`: screens, Hindi UI, voice input, spoken total

## 1. Goals
- Staff with low literacy make a bill in under 30 seconds by tapping pictures or speaking.
- Udhaar is never lost: every sale and every repayment is recorded.
- The owner sees the shop live from his own phone while away.
- Works with no internet and syncs when internet returns.
- Reliable enough for real shop testing with real money.

## 2. Users
| Role | Count | Device | Can do |
|---|---|---|---|
| Staff | 3 | Shared cheap Android phones | Everything in section 2.1 except approving or removing phones |
| Owner | 1 | Own phone | Everything staff can do, plus approving and removing phones, managing staff and the UPI QR (section 2.1) |

Phones are shared, so every sale records which staff member made it (staff tile + 4-digit PIN). Auto-lock: the phone goes back to the staff tiles after every saved bill, and whenever the app is closed. See `DATA-SAFETY.md` for device login.

### 2.1 Permissions
- Owner and staff have the **same permissions**. Everyone can make bills, record udhaar and payments, change prices, void bills, and change shop and GST settings.
- **Owner-only exceptions**, each enforced in the database's row-level security (RLS) and covered by tests:
  - Approving or removing phones. A turned-off phone is never deleted, because bills reference it, and its bill letter is never reused.
  - Staff management: adding or removing staff and resetting PINs.
  - The UPI QR code. Any QR change shows an alert on the owner's phone.
- Staff can change their own PIN. The server checks the old PIN before saving the new one.
- PIN unlock offline: a staff member's first login on a phone needs internet, because the server checks the PIN. After that, the phone can unlock that staff member offline. 5 wrong tries offline lock the PIN screen for 5 minutes.
- PIN changes and staff removal reach a phone when it syncs. Bills by a removed staff member made after the removal time are flagged in the owner's log.
- GST settings hold only an optional GSTIN, shown on the bill. No tax rates or tax calculation (GST invoices stay out of scope, section 7).
- Shop profile (part of settings): shop name (required), optional GSTIN, two phone numbers, address, pincode and state. It is printed at the top of the on-screen bill. The screen shows "Profile X% complete" from how many of these 7 fields are filled.
- Items and companies are archived, never deleted. Archived items are hidden from billing and can be restored.
- Every change records which phone and which person made it.
- The owner can see a log of voids, returns, opening balances, price changes and settings changes.

## 3. Items and prices
- About 500 items, many are size variants.
- Items are grouped by **company** (brand), then item. Example: Company "Ultratech" → "Cement 50kg".
- Per item: company, Hindi name, English name, picture, unit (piece/kg/metre/bag), default price, category.

### 3.1 Two ways to add companies and items
Both ways must exist.

**A. Add inside the app with a "+" button (owner and staff)**
1. On the home grid, a **+ Company** tile adds a new company (name, optional picture).
2. Tapping a company opens its items, with a **+ Item** tile at the top.
3. Add-item form is short: name (Hindi/English), size, unit, price, optional picture. Everything else has a default.
4. While billing, if staff cannot find an item, a **"Not in list? Add new"** button appears. It adds the item and puts it on the current bill in one step.
5. New items added by staff are marked "new, check" for the owner to review. The owner can fix the name or price later.
6. Items and companies can be archived (hidden from billing) and restored. They are never deleted.

**B. Bulk upload from Excel**
1. Anyone (section 2.1) downloads an Excel template (`specs/products-template.xlsx` is the reference copy) with the columns Company, Item name (Hindi), Item name (English), Size, Unit, Price, Category.
2. They fill in or edit it on a computer, then upload it in the app.
3. The app shows a preview (how many items will be added, updated or skipped, and any errors by row) before saving anything.
4. Re-uploading updates existing items instead of duplicating them. Matching is by Company + Item name + Size.
5. Anyone can also export the current price list to Excel, change many prices at once, and upload it again.
6. Pictures are added separately in the app, because Excel is not used for photos in v1.
- Price follows the market. Owner and staff can both change the default price.
- In a sale, staff can override a line's price. It applies to that sale only unless they choose "make this the new default".
- Every price change is logged (who, when, old, new).

## 4. Billing flow
1. Pick staff, enter PIN.
2. Add items by tapping pictures, search, or voice.
3. Edit quantity or price per line.
4. Pick customer (optional for cash, required for udhaar).
5. Pick payment: cash, UPI, udhaar, or part-paid (e.g. 500 cash, rest udhaar). Choosing UPI shows the shop's **UPI QR code** full-screen for the customer to scan (see 4.1).
6. App speaks the total and shows it in large digits.
7. Save. Each bill has a unique ID and a per-device-per-day bill number, so devices never clash.
8. Receipt is optional (customer asks): an on-screen bill to show or screenshot. No printer in v1.

### 4.1 UPI: QR only
- The app only **shows** the shop's QR code. It does not connect to UPI, does not confirm that money arrived, and does not read the customer's payment.
- The QR is the shop's own QR (image uploaded once by the owner). It works offline because it is a stored image.
- Because the app cannot confirm payment, staff or the owner confirm it by looking at the shop's UPI app notification, then tap "Payment received". Only then is the sale marked UPI-paid.
- The owner's dashboard counts UPI as "marked received by staff", which is a staff entry, not bank proof.

Corrections: a saved bill is never edited or erased. It can only be voided, by anyone (section 2.1), with a reason. The void records who did it and shows in the owner's log. A voided bill stays visible in history.

Returns (assumed): a return is a separate negative bill, linked to the original, made by anyone with a reason. Returns show in the owner's log.

## 5. Udhaar
- Customer ledger: name, phone (required for udhaar, so the owner can call), running balance.
- An udhaar sale adds to the balance. A repayment (cash/UPI, any amount, any day) reduces it. Both are separate dated records.
- The balance is always computed from the records, never typed as a number.
- Opening balances (assumed): anyone enters each customer's notebook balance once as a dated "opening balance" record. Opening balances show in the owner's log.
- Overdue: no repayment for N days (N is a shop setting, default 30).
- No credit limit and no in-app reminders in v1. The overdue list is built for the owner's phone calls: name, tap-to-call, balance, days since last payment.

## 6. Live dashboard
Everyone can see the live dashboard (section 2.1).
- Today's total sales
- Live sales feed: staff, items, amount, payment method
- Udhaar: total outstanding, per-customer balances, overdue list
- Cash and UPI received today, including udhaar repayments
- Alerts: price changed more than X% from default, bill voided or cancelled, a device has unsynced sales for more than N minutes
- Always shows "last updated at", so stale data is never mistaken for live data
- Owner log (owner only): voids, returns, opening balances, price changes and settings changes, each with phone, person and time

## 7. Out of scope for v1
- Stock and inventory counts
- GST invoices and tax reports
- Printing
- Staff salary and attendance
- Supplier purchases and payables (assumed)
- Credit limits and automatic reminders
- WhatsApp bill sharing (assumed, planned for later)

## 8. Decisions
Assumed defaults (change any by telling me):
| Question | Assumed |
|---|---|
| WhatsApp bill sharing | Later, not v1 |
| Returns and refunds | Simple return as a negative bill, by anyone, with a reason |
| Opening udhaar balances | Entered as dated opening records |
| Customer phone for udhaar | Required |
| Who can void a bill | Anyone, with a reason; logged for the owner (section 2.1) |

Still open (needs your answer):
Decided: in practice the shopkeeper (owner) fills the Excel list with items and prices and takes the item pictures; the app allows anyone to (section 2.1). Pictures are taken with the phone camera inside the app, one item at a time, so item setup can continue gradually after the shop test starts.

Also decided: UPI shows the shop's QR code only (section 4.1). Items can be added by the in-app "+" and by Excel upload (section 3.1).

## 9. Success criteria for the shop test
- 1 full week of real use with zero lost and zero duplicated sales.
- Udhaar balances match the paper notebook at the end of the week.
- A new staff member makes a correct bill after 10 minutes of training.
- The owner sees a sale on his phone within 10 seconds when online, and sees an "unsynced" warning when not.
