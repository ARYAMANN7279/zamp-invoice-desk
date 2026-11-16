// Runs all 12 samples in order (history accumulates, like the live dashboard), from two sources:
//   1) the text rendering of each spec  2) pdftotext of the real sample PDFs
const { execFileSync } = require('child_process'), path = require('path'), fs = require('fs');
const E = require('../src/engine.js'), S = require('../src/samples.js');
const NOW = '2026-11-16T10:00:00Z';
let fail = 0;
function pass(label, getText) {
  const history = [];
  console.log('\n== ' + label);
  S.SAMPLES.forEach(s => {
    const r = E.process(getText(s), { history, now: NOW, source: s.id });
    history.push(r.record);
    const ok = r.status === s.expect; if (!ok) fail++;
    console.log((ok ? 'PASS ' : 'FAIL ') + s.title.padEnd(30) + ' -> ' + r.status.padEnd(13) + (ok ? '' : ' expected ' + s.expect));
    if (!ok) r.checks.filter(c => c.level !== 'pass').forEach(c => console.log('     ', c.id, c.level, c.detail));
  });
}
pass('text rendering', s => S.toText(s));
pass('pdftotext of sample PDFs', s => execFileSync('pdftotext', ['-layout', path.join(__dirname, '..', 'samples', s.id + '.pdf'), '-']).toString());
// extra edge cases not in the samples
const empty = E.process('', { history: [], now: NOW });
console.log('\nempty doc ->', empty.status, empty.status === 'NEEDS_REVIEW' ? 'PASS' : 'FAIL'); if (empty.status !== 'NEEDS_REVIEW') fail++;
const json = E.process({ vendor_name: 'Nexa Office Supplies LLP', gstin: '07AAFFN4321M1Z9', invoice_no: 'NX/9', date: '2026-11-10', po_ref: 'PO-4503',
  lines: [{ desc: 'A4 Paper Ream 75gsm', qty: 500, price: 285, amount: 142500 }, { desc: 'Toner Cartridge 12A', qty: 20, price: 3400, amount: 68000 }], subtotal: 210500, tax: 37890, total: 248390 }, { history: [], now: NOW });
console.log('structured JSON ->', json.status, json.status === 'APPROVED' ? 'PASS' : 'FAIL'); if (json.status !== 'APPROVED') fail++;
const badG = E.process(S.toText(S.SAMPLES[0]).replace('09AABCS1234F1Z5', '09AABCS1234F1Z'), { history: [], now: NOW });
console.log('malformed GSTIN ->', badG.status, badG.status === 'NEEDS_REVIEW' ? 'PASS' : 'FAIL'); if (badG.status !== 'NEEDS_REVIEW') fail++;
console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED'); process.exit(fail ? 1 : 0);
