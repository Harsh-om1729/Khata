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
2a. Excel upload / export screen (owner): download template, upload, preview with row errors, confirm
2b. UPI QR screen: full-screen shop QR, then a "Payment received" button
3. Bill review: lines, quantities, prices, customer, payment
4. Total screen: large digits, spoken total, Save
5. Udhaar: customer list, balances, add repayment
6. Owner dashboard (see `SPEC.md` section 6)
7. Price list editor
8. Sync status / export

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
