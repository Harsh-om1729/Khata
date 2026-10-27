// The template is one bilingual file for everyone, so its text lives here rather than in i18n.
// It must match the reference copy in specs/products-template.xlsx (checked by a test).

export const PRODUCTS_SHEET = 'Products';

export const HEADERS = [
  'Company / कंपनी',
  'Item name (Hindi) / सामान का नाम',
  'Item name (English)',
  'Size / साइज़',
  'Unit / इकाई',
  'Price (Rs) / दाम',
  'Category / प्रकार',
] as const;

export const INSTRUCTIONS = [
  'How to fill / कैसे भरें',
  "1. Fill the 'Products' sheet only. One row = one item in one size. / सिर्फ 'Products' शीट भरें। एक लाइन = एक सामान, एक साइज़।",
  '2. Same item in 3 sizes = 3 rows. / एक सामान के 3 साइज़ हों तो 3 लाइन।',
  '3. Company, Item name (Hindi or English), Unit and Price are required. / कंपनी, नाम, इकाई और दाम ज़रूरी हैं।',
  '4. Price is a number only (no Rs sign or comma). / दाम सिर्फ़ संख्या में लिखें।',
  '5. Do not change the column headings or their order. / ऊपर की हेडिंग मत बदलें।',
  '6. Upload will show a preview first. Nothing is saved until you confirm. / अपलोड पर पहले प्रीव्यू दिखेगा, मंज़ूरी के बाद ही सेव होगा।',
  '7. Re-uploading updates items with the same Company + Item name + Size. It will not make duplicates.',
  '8. Pictures are added inside the app, not in Excel.',
] as const;

export const EXAMPLE_ROWS: (string | number)[][] = [
  ['(company name)', '(Hindi name)', '(English name)', '50kg', 'bag', 0, 'Cement'],
  ['(company name)', '(Hindi name)', '(English name)', '1 inch', 'piece', 0, 'Pipes'],
  ['(company name)', '(Hindi name)', '(English name)', '2 inch', 'piece', 0, 'Nails'],
  ['', '', '', '', '', '', ''],
  ["This sheet only shows the format. It is NOT uploaded. Fill the 'Products' sheet.", '', '', '', '', '', ''],
];
