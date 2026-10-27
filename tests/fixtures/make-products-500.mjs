// Makes tests/fixtures/products-500.xlsx: a filled-in template with 500 realistic shop rows.
// Run: node tests/fixtures/make-products-500.mjs
import { writeFileSync } from 'node:fs';
import { utils, write } from 'xlsx';

const HEADERS = ['Company / कंपनी', 'Item name (Hindi) / सामान का नाम', 'Item name (English)', 'Size / साइज़', 'Unit / इकाई', 'Price (Rs) / दाम', 'Category / प्रकार'];

const families = [
  { companies: ['Ultratech', 'ACC', 'Ambuja', 'Dalmia', 'Konark'], hi: 'सीमेंट', en: 'Cement', sizes: ['50kg', '25kg'], unit: 'bag', base: 380, category: 'Cement' },
  { companies: ['Tata Tiscon', 'Jindal', 'SAIL', 'Kamdhenu'], hi: 'सरिया', en: 'TMT Bar', sizes: ['8mm', '10mm', '12mm', '16mm', '20mm'], unit: 'kg', base: 62, category: 'Steel' },
  { companies: ['Supreme', 'Finolex', 'Astral', 'Prince'], hi: 'पीवीसी पाइप', en: 'PVC Pipe', sizes: ['1/2 inch', '3/4 inch', '1 inch', '1.5 inch', '2 inch', '3 inch', '4 inch'], unit: 'piece', base: 90, category: 'Pipes' },
  { companies: ['Supreme', 'Finolex', 'Astral', 'Prince'], hi: 'एल्बो', en: 'Elbow', sizes: ['1/2 inch', '3/4 inch', '1 inch', '2 inch'], unit: 'piece', base: 12, category: 'Fittings' },
  { companies: ['Supreme', 'Finolex', 'Astral', 'Prince'], hi: 'टी', en: 'Tee', sizes: ['1/2 inch', '3/4 inch', '1 inch', '2 inch'], unit: 'piece', base: 15, category: 'Fittings' },
  { companies: ['Asian Paints', 'Berger', 'Nerolac', 'Indigo'], hi: 'इमल्शन पेंट', en: 'Emulsion Paint', sizes: ['1 litre', '4 litre', '10 litre', '20 litre'], unit: 'piece', base: 260, category: 'Paint' },
  { companies: ['Asian Paints', 'Berger', 'Nerolac', 'Indigo'], hi: 'प्राइमर', en: 'Primer', sizes: ['1 litre', '4 litre', '10 litre'], unit: 'piece', base: 180, category: 'Paint' },
  { companies: ['Havells', 'Finolex Cables', 'Polycab', 'Anchor'], hi: 'तार', en: 'Wire', sizes: ['0.75 sqmm', '1 sqmm', '1.5 sqmm', '2.5 sqmm', '4 sqmm'], unit: 'metre', base: 14, category: 'Electrical' },
  { companies: ['Havells', 'Anchor', 'Legrand', 'GM'], hi: 'स्विच', en: 'Switch', sizes: ['6A', '16A'], unit: 'piece', base: 35, category: 'Electrical' },
  { companies: ['Pidilite', 'Dr Fixit', 'Araldite'], hi: 'फेविकोल', en: 'Adhesive', sizes: ['50g', '250g', '500g', '1kg', '5kg'], unit: 'piece', base: 40, category: 'Adhesive' },
  { companies: ['Local', 'Bihar Hardware', 'Patna Steel'], hi: 'कील', en: 'Nails', sizes: ['1 inch', '1.5 inch', '2 inch', '2.5 inch', '3 inch', '4 inch'], unit: 'kg', base: 80, category: 'Nails' },
  { companies: ['Godrej', 'Link', 'Harrison', 'Europa'], hi: 'ताला', en: 'Lock', sizes: ['40mm', '50mm', '65mm', '75mm'], unit: 'piece', base: 150, category: 'Locks' },
  { companies: ['Taparia', 'Stanley', 'Jhalani'], hi: 'पेचकस', en: 'Screwdriver', sizes: ['4 inch', '6 inch', '8 inch', '10 inch'], unit: 'piece', base: 70, category: 'Tools' },
  { companies: ['Local', 'Bihar Hardware'], hi: 'बालू', en: 'Sand', sizes: ['fine', 'coarse'], unit: 'bag', base: 45, category: 'Sand' },
  { companies: ['Tata Pipes', 'Jindal', 'Surya', 'Apollo'], hi: 'जीआई पाइप', en: 'GI Pipe', sizes: ['1/2 inch', '3/4 inch', '1 inch', '1.25 inch', '1.5 inch', '2 inch'], unit: 'piece', base: 450, category: 'Pipes' },
  { companies: ['Astral', 'Ashirvad', 'Supreme', 'Finolex'], hi: 'सीपीवीसी पाइप', en: 'CPVC Pipe', sizes: ['1/2 inch', '3/4 inch', '1 inch', '1.25 inch', '1.5 inch', '2 inch'], unit: 'piece', base: 160, category: 'Pipes' },
  { companies: ['Zoloto', 'Leader', 'Sant'], hi: 'बॉल वाल्व', en: 'Ball Valve', sizes: ['1/2 inch', '3/4 inch', '1 inch', '1.5 inch', '2 inch'], unit: 'piece', base: 180, category: 'Fittings' },
  { companies: ['Jaquar', 'Hindware', 'Parryware', 'Cera'], hi: 'नल', en: 'Bib Cock', sizes: ['short', 'long', '2-way'], unit: 'piece', base: 350, category: 'Sanitary' },
  { companies: ['Havells', 'Anchor', 'Legrand', 'Schneider'], hi: 'एमसीबी', en: 'MCB', sizes: ['6A', '10A', '16A', '20A', '32A', '40A'], unit: 'piece', base: 180, category: 'Electrical' },
  { companies: ['Philips', 'Syska', 'Havells', 'Wipro', 'Bajaj'], hi: 'एलईडी बल्ब', en: 'LED Bulb', sizes: ['5W', '9W', '12W', '15W', '20W'], unit: 'piece', base: 70, category: 'Electrical' },
  { companies: ['Birla White', 'JK White', 'Asian Paints'], hi: 'वॉल पुट्टी', en: 'Wall Putty', sizes: ['5kg', '20kg', '40kg'], unit: 'bag', base: 150, category: 'Paint' },
  { companies: ['Asian Paints', 'Berger', 'Nerolac', 'Indigo', 'Shalimar'], hi: 'इनेमल पेंट', en: 'Enamel Paint', sizes: ['100ml', '200ml', '500ml', '1 litre', '4 litre'], unit: 'piece', base: 60, category: 'Paint' },
  { companies: ['Local', 'Bihar Hardware', 'Patna Steel'], hi: 'पेंच', en: 'Screw', sizes: ['1/2 inch', '3/4 inch', '1 inch', '1.5 inch', '2 inch', '2.5 inch', '3 inch'], unit: 'kg', base: 140, category: 'Nails' },
  { companies: ['Godrej', 'Hettich', 'Ebco', 'Local'], hi: 'कब्ज़ा', en: 'Hinge', sizes: ['3 inch', '4 inch', '5 inch'], unit: 'piece', base: 25, category: 'Door fittings' },
  { companies: ['Godrej', 'Hettich', 'Ebco', 'Local'], hi: 'टावर बोल्ट', en: 'Tower Bolt', sizes: ['4 inch', '6 inch', '8 inch'], unit: 'piece', base: 30, category: 'Door fittings' },
  { companies: ['Tata Wiron', 'Local', 'Bihar Hardware'], hi: 'बाइंडिंग तार', en: 'Binding Wire', sizes: ['18 gauge', '20 gauge', '22 gauge'], unit: 'kg', base: 85, category: 'Steel' },
  { companies: ['Sintex', 'Supreme', 'Vectus'], hi: 'पानी टंकी', en: 'Water Tank', sizes: ['500 L', '750 L', '1000 L', '1500 L', '2000 L'], unit: 'piece', base: 3200, category: 'Tanks' },
  { companies: ['Everest', 'Visaka', 'Ramco'], hi: 'सीमेंट चादर', en: 'Roofing Sheet', sizes: ['6 ft', '8 ft', '10 ft', '12 ft'], unit: 'piece', base: 420, category: 'Roofing' },
  { companies: ['Asian Paints', 'Berger', 'Local'], hi: 'ब्रश', en: 'Paint Brush', sizes: ['1 inch', '2 inch', '3 inch', '4 inch', '5 inch'], unit: 'piece', base: 30, category: 'Paint' },
  { companies: ['Norton', 'Cumi', 'Local'], hi: 'रेगमाल', en: 'Sandpaper', sizes: ['60 grit', '80 grit', '100 grit', '120 grit', '150 grit', '220 grit'], unit: 'piece', base: 10, category: 'Tools' },
  { companies: ['Taparia', 'Stanley', 'Jhalani'], hi: 'हथौड़ा', en: 'Hammer', sizes: ['250g', '500g', '1kg'], unit: 'piece', base: 180, category: 'Tools' },
  { companies: ['Taparia', 'Stanley', 'Jhalani'], hi: 'प्लास', en: 'Pliers', sizes: ['6 inch', '8 inch'], unit: 'piece', base: 160, category: 'Tools' },
  { companies: ['Local', 'Tata Agrico'], hi: 'बेलचा', en: 'Shovel', sizes: ['small', 'big'], unit: 'piece', base: 250, category: 'Tools' },
];

const rows = [];
for (const family of families) {
  for (const [ci, company] of family.companies.entries()) {
    for (const [si, size] of family.sizes.entries()) {
      const price = family.base * (si + 1) + ci * 3 + (si % 2 ? 0.5 : 0);
      rows.push([company, family.hi, family.en, size, family.unit, price, family.category]);
    }
  }
}
if (rows.length < 500) throw new Error(`only ${rows.length} rows; add more families`);
rows.length = 500;

const book = utils.book_new();
utils.book_append_sheet(book, utils.aoa_to_sheet([HEADERS, ...rows]), 'Products');
writeFileSync(new URL('./products-500.xlsx', import.meta.url), write(book, { type: 'buffer', bookType: 'xlsx', compression: true }));
console.log(`wrote ${rows.length} rows`);
