/* Sample invoices: one spec renders to both a text layer and an HTML (-> PDF) page. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Samples = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const V = {
    sharma: { name: 'Sharma Steel Industries Pvt Ltd', addr: 'Plot 14, Site-IV, Kanpur, UP', gstin: '09AABCS1234F1Z5', bank: 'HDFC Bank', b4: '4521' },
    bharat: { name: 'Bharat Packaging Co.', addr: '22 MIDC Bhosari, Pune, MH', gstin: '27AAACB5678K1Z2', bank: 'ICICI Bank', b4: '8890' },
    nexa: { name: 'Nexa Office Supplies LLP', addr: '8 Nehru Place, New Delhi', gstin: '07AAFFN4321M1Z9', bank: 'SBI', b4: '1177' },
    kaveri: { name: 'Kaveri Logistics Pvt Ltd', addr: '3rd Floor, Hosur Rd, Bengaluru', gstin: '29AABCK9876L1Z3', bank: 'Axis Bank', b4: '6023' },
    apex: { name: 'Apex Fasteners Traders', addr: 'Sector 7, Faridabad, HR', gstin: '06AAHFA7654Q1Z4', bank: 'Kotak Bank', b4: '7741' }
  };
  const L = {
    angle: { desc: 'MS Angle 40x40 (per tonne)', qty: 10, price: 58000 },
    tmt: { desc: 'TMT Bar 12mm (per tonne)', qty: 5, price: 61000 }
  };
  const SAMPLES = [
    { id: 's01', title: '01 Clean match', note: 'Happy path: everything lines up with PO-4501.', expect: 'APPROVED',
      v: V.sharma, inv: 'INV-2026-0814', date: '02-Nov-2026', po: 'PO-4501', lines: [L.angle, L.tmt] },
    { id: 's02', title: '02 Small price drift', note: 'Bubble wrap billed at 346 vs PO 340 (+1.8%): inside the 2% tolerance, approve with a note.', expect: 'APPROVED',
      v: V.bharat, inv: 'BP-2198', date: '03-Nov-2026', po: 'PO-4502', lines: [{ desc: 'Corrugated Box 5-ply', qty: 4000, price: 22.5 }, { desc: 'Bubble Wrap Roll', qty: 50, price: 346 }] },
    { id: 's03', title: '03 Price variance 4.7%', note: 'Toner billed at 3,560 vs PO 3,400. Over 2%, under 5%: a person decides.', expect: 'NEEDS_REVIEW',
      v: V.nexa, inv: 'NX/1187', date: '04-Nov-2026', po: 'PO-4503', lines: [{ desc: 'A4 Paper Ream 75gsm', qty: 500, price: 285 }, { desc: 'Toner Cartridge 12A', qty: 20, price: 3560 }] },
    { id: 's04', title: '04 Split PO, part 1 of 2', note: 'Edge case: invoice covers 7 of 12 trips on PO-4504. Approve and track the balance.', expect: 'APPROVED',
      v: V.kaveri, inv: 'KL/26/311', date: '05-Nov-2026', po: 'PO-4504', lines: [{ desc: 'Freight Delhi-Mumbai FTL trip', qty: 7, price: 41500 }] },
    { id: 's05', title: '05 Split PO, part 2 of 2', note: 'The remaining 5 trips. Closes the PO.', expect: 'APPROVED',
      v: V.kaveri, inv: 'KL/26/342', date: '12-Nov-2026', po: 'PO-4504', lines: [{ desc: 'Freight Delhi-Mumbai FTL trip', qty: 5, price: 41500 }] },
    { id: 's06', title: '06 Over-bill on closed PO', note: 'Edge case: a third invoice for 2 more trips after the PO is fully billed.', expect: 'REJECTED',
      v: V.kaveri, inv: 'KL/26/355', date: '14-Nov-2026', po: 'PO-4504', lines: [{ desc: 'Freight Delhi-Mumbai FTL trip', qty: 2, price: 41500 }] },
    { id: 's07', title: '07 GST bundled into prices', note: 'Edge case: no tax line, "inclusive of GST". Backs the tax out and still matches PO-4505.', expect: 'APPROVED',
      v: V.bharat, inv: 'BP-2210', date: '06-Nov-2026', po: 'PO-4505', inclusive: true, lines: [{ desc: 'Corrugated Box 5-ply', qty: 4000, price: 26.55 }, { desc: 'Bubble Wrap Roll', qty: 50, price: 401.2 }] },
    { id: 's08', title: '08 Missing number and date', note: 'Edge case: no invoice number, no date. Hold and draft an email asking the vendor.', expect: 'PENDING_INFO',
      v: V.nexa, inv: null, date: null, po: 'PO-4503', lines: [{ desc: 'A4 Paper Ream 75gsm', qty: 500, price: 285 }, { desc: 'Toner Cartridge 12A', qty: 20, price: 3400 }] },
    { id: 's09', title: '09 Duplicate, new number', note: 'Edge case: same lines, date and amount as invoice 01 but the number has a "-A" suffix.', expect: 'REJECTED',
      v: V.sharma, inv: 'INV-2026-0814-A', date: '02-Nov-2026', po: 'PO-4501', lines: [L.angle, L.tmt] },
    { id: 's10', title: '10 Bank account changed', note: 'Edge case: clean invoice, but the bank account differs from the vendor master.', expect: 'NEEDS_REVIEW',
      v: Object.assign({}, V.sharma, { b4: '9902', bank: 'Yes Bank' }), inv: 'INV-2026-0831', date: '09-Nov-2026', po: 'PO-4506', lines: [{ desc: 'Welding Rod E6013 (per carton)', qty: 40, price: 1850 }] },
    { id: 's11', title: '11 Unknown vendor, no PO', note: 'Vendor is not in the master and there is no PO.', expect: 'REJECTED',
      v: V.apex, inv: 'AF-0042', date: '10-Nov-2026', po: null, lines: [{ desc: 'Hex Bolt M12 (box of 100)', qty: 30, price: 640 }] },
    { id: 's12', title: '12 PO number implied', note: 'Edge case: no PO written on the invoice. Lines match exactly one open PO, so infer it and ask a person to confirm.', expect: 'NEEDS_REVIEW',
      v: V.nexa, inv: 'NX/1201', date: '11-Nov-2026', po: null, lines: [{ desc: 'A4 Paper Ream 75gsm', qty: 500, price: 285 }, { desc: 'Toner Cartridge 12A', qty: 20, price: 3400 }] }
  ];

  function r2(n) { return Math.round(n * 100) / 100; }
  function f(n) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function figures(s) {
    const amounts = s.lines.map(l => r2(l.qty * l.price));
    const sum = r2(amounts.reduce((a, b) => a + b, 0));
    if (s.inclusive) return { amounts, sub: null, tax: null, total: sum };
    const tax = r2(sum * 0.18); return { amounts, sub: sum, tax, total: r2(sum + tax) };
  }
  function toText(s) {
    const g = figures(s); const o = [];
    o.push(s.v.name, s.v.addr, 'GSTIN: ' + s.v.gstin, 'TAX INVOICE');
    if (s.inv) o.push('Invoice No: ' + s.inv);
    if (s.date) o.push('Invoice Date: ' + s.date);
    if (s.po) o.push('PO Ref: ' + s.po);
    o.push('Bill To: Meridian Engineering Works Pvt Ltd, Kanpur');
    o.push('# Description Qty Rate Amount');
    s.lines.forEach((l, i) => o.push(`${i + 1} ${l.desc} ${l.qty} ${f(l.price)} ${f(g.amounts[i])}`));
    if (s.inclusive) o.push('Prices inclusive of GST', 'Total ' + f(g.total));
    else o.push('Subtotal ' + f(g.sub), 'GST @ 18% ' + f(g.tax), 'Total ' + f(g.total));
    o.push(`Bank: ${s.v.bank}, A/c ending ${s.v.b4}`);
    return o.join('\n');
  }
  function toHtml(s) {
    const g = figures(s); const e = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const rows = s.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${e(l.desc)}</td><td class=n>${l.qty}</td><td class=n>${f(l.price)}</td><td class=n>${f(g.amounts[i])}</td></tr>`).join('');
    const tot = s.inclusive ? `<tr><td colspan=4>Prices inclusive of GST</td><td></td></tr><tr class=t><td colspan=4>Total</td><td class=n>${f(g.total)}</td></tr>`
      : `<tr><td colspan=4>Subtotal</td><td class=n>${f(g.sub)}</td></tr><tr><td colspan=4>GST @ 18%</td><td class=n>${f(g.tax)}</td></tr><tr class=t><td colspan=4>Total</td><td class=n>${f(g.total)}</td></tr>`;
    return `<!doctype html><meta charset=utf-8><title>${e(s.title)}</title><style>
body{font:13px Arial,sans-serif;margin:48px;color:#111}h1{font-size:20px;margin:0}.top{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:10px}
.meta{margin:18px 0;line-height:1.7}table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #bbb;padding:6px 8px;text-align:left}th{background:#eee}.n{text-align:right}.t td{font-weight:bold}.bank{margin-top:22px;color:#333}</style>
<div class=top><div><h1>${e(s.v.name)}</h1><div>${e(s.v.addr)}</div><div>GSTIN: ${s.v.gstin}</div></div><div><h1>TAX INVOICE</h1></div></div>
<div class=meta>${s.inv ? `<div>Invoice No: ${e(s.inv)}</div>` : ''}${s.date ? `<div>Invoice Date: ${s.date}</div>` : ''}${s.po ? `<div>PO Ref: ${s.po}</div>` : ''}<div>Bill To: Meridian Engineering Works Pvt Ltd, Kanpur</div></div>
<table><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>${rows}${tot}</table>
<div class=bank>Bank: ${s.v.bank}, A/c ending ${s.v.b4}</div>`;
  }
  return { SAMPLES, toText, toHtml };
});
