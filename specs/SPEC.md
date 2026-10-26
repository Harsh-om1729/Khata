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
| Staff | 3 | Shared cheap Android phones | Make bills, record udhaar and repayments, change price in a sale |
| Owner | 1 | Own phone | All staff actions, plus dashboard, price list edits, void bills, manage staff and devices |

Phones are shared, so every sale records which staff member made it (staff tile + 4-digit PIN, auto-lock). See `DATA-SAFETY.md` for device login.

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

**B. Bulk upload from Excel (owner)**
1. The owner downloads an Excel template (`specs/products-template.xlsx` is the reference copy) with the columns Company, Item name (Hindi), Item name (English), Size, Unit, Price, Category.
2. The owner fills in or edits it on a computer, then uploads it in the app.
3. The app shows a preview (how many items will be added, updated or skipped, and any errors by row) before saving anything.
4. Re-uploading updates existing items instead of duplicating them. Matching is by Company + Item name + Size.
5. The owner can also export the current price list to Excel, change many prices at once, and upload it again.
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

Corrections: a saved bill is never edited or erased. It can only be voided, which needs the owner PIN and a reason. A voided bill stays visible in history.

Returns (assumed): a return is a separate negative bill, linked to the original, with owner approval.

## 5. Udhaar
- Customer ledger: name, phone (required for udhaar, so the owner can call), running balance.
- An udhaar sale adds to the balance. A repayment (cash/UPI, any amount, any day) reduces it. Both are separate dated records.
- The balance is always computed from the records, never typed as a number.
- Opening balances (assumed): the owner enters each customer's notebook balance once as a dated "opening balance" record.
- Overdue: no repayment for N days (owner sets N, default 30).
- No credit limit and no in-app reminders in v1. The overdue list is built for the owner's phone calls: name, tap-to-call, balance, days since last payment.

## 6. Owner dashboard (live)
- Today's total sales
- Live sales feed: staff, items, amount, payment method
- Udhaar: total outstanding, per-customer balances, overdue list
- Cash and UPI received today, including udhaar repayments
- Alerts: price changed more than X% from default, bill voided or cancelled, a device has unsynced sales for more than N minutes
- Always shows "last updated at", so stale data is never mistaken for live data

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
| Returns and refunds | Simple return as owner-approved negative bill |
| Opening udhaar balances | Owner enters as dated opening records |
| Customer phone for udhaar | Required |
| Who can void a bill | Needs owner PIN |

Still open (needs your answer):
Decided: the shopkeeper (owner) fills the Excel list with items and prices and takes the item pictures. Staff do not do this setup. Pictures are taken with the phone camera inside the app, one item at a time, so item setup can continue gradually after the shop test starts.

Also decided: UPI shows the shop's QR code only (section 4.1). Items can be added by the in-app "+" and by Excel upload (section 3.1).

## 9. Success criteria for the shop test
- 1 full week of real use with zero lost and zero duplicated sales.
- Udhaar balances match the paper notebook at the end of the week.
- A new staff member makes a correct bill after 10 minutes of training.
- The owner sees a sale on his phone within 10 seconds when online, and sees an "unsynced" warning when not.
