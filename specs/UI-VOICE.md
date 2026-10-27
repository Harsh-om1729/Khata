# UI and voice spec

## 1. UI principles
- Hindi first, English second. Pictures and icons over text.
- Very large buttons, high contrast, readable in sunlight, minimal screens.
- One main action per screen. The running total and a clear "Save bill" button are always visible.
- Confirm before anything irreversible. Undo for the last added line.
- Colour is never the only signal.
- Light and fast on a cheap Android phone with about 2 GB RAM and a slow network.

## 2. Main screens
1. Staff picker + PIN
2. Company grid with a **+ Company** tile. Tapping a company opens its item grid (picture tiles, search) with a **+ Item** tile, and a bill strip at the bottom. A "Not in list? Add new" button is always reachable during billing.
2a. Excel upload / export screen: download template, upload, preview with row errors, confirm
2b. UPI QR screen: full-screen shop QR, then a "Payment received" button
3. Bill review: lines, quantities, prices, customer, payment
4. Total screen: large digits, spoken total, Save
5. Udhaar: customer list, balances, add repayment
6. Live dashboard for everyone, plus the owner log (see `SPEC.md` section 6)
7. Price list editor
8. Sync status / export
9. Settings: shop profile (SPEC §2.1: shop name, GSTIN optional, two phones, address, pincode, state, with a "Profile X% complete" bar and a fixed Save/Cancel bar; Cancel warns about unsaved changes), overdue days. UPI QR upload is owner-only.
10. Side menu (☰ on every main screen): one big icon + Hindi label per screen above (Bill, Items, Udhaar, Dashboard, Old bills, Excel, Shop profile, Sync status, Owner). Rows with sub-screens expand, one at a time. It slides over a dimmed background; tapping the background or swiping closes it. Screens not built yet open a "coming soon" page.
11. Items screen: tabs Companies | Items | Categories | Units (units are the fixed list, read only), one live search box, a picture empty state with one clear sentence, and a floating "+ Add" button on Companies and Items whose label follows the tab (a category exists only on items, and units are fixed, so those tabs have none; categories are set through Excel). A filter sheet filters by company and category and sorts by name or price. Removing an item or company archives it after a confirmation; an "Archived" filter shows them with Restore.

## 3. Voice input
- Staff speak an order in Hindi/English mix, e.g. "do bori cement, paanch kilo keel".
- Results appear as a checklist that staff confirm. Voice never adds to a bill silently.
- On Android Chrome, speech recognition normally needs internet. **Voice may not work offline.** Picture-tap and search always work offline.
- Shop words (sizes, brands) will sometimes be misheard. Plan a custom word list mapping spoken terms to item IDs.

## 4. Spoken total
- Uses the phone's Hindi text-to-speech. The Hindi voice may need to be installed on each phone.
- Amounts are spoken in Hindi words ("एक हज़ार दो सौ पचास रुपये").
- The total is always shown in large digits too, so a missing voice never blocks a sale.

## 5. Must test on the real shop phones before promising
- Hindi voice recognition accuracy with shop vocabulary and counter noise
- Offline behaviour of speech recognition and text-to-speech
- Speed of the 500-item grid on the cheapest phone
