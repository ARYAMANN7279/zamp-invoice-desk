/* Invoice-to-decision engine (PS-1). Pure JS, no dependencies.
   Works in the browser (window.Engine) and in Node (module.exports) so the same logic is tested and demoed. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // ---------- reference data (stand-in for the procurement system) ----------
  const DATA = {
    tolerance: { auto: 0.02, review: 0.05 }, // <=2% auto-approve, 2-5% human review, >5% reject
    gstRate: 0.18,
    staleDays: 90,
    vendors: [
      { id: 'V001', name: 'Sharma Steel Industries Pvt Ltd', gstin: '09AABCS1234F1Z5', bankLast4: '4521', status: 'approved', contact: 'accounts@sharmasteel.example' },
      { id: 'V002', name: 'Bharat Packaging Co.', gstin: '27AAACB5678K1Z2', bankLast4: '8890', status: 'approved', contact: 'billing@bharatpack.example' },
      { id: 'V003', name: 'Nexa Office Supplies LLP', gstin: '07AAFFN4321M1Z9', bankLast4: '1177', status: 'approved', contact: 'ar@nexaoffice.example' },
      { id: 'V004', name: 'Kaveri Logistics Pvt Ltd', gstin: '29AABCK9876L1Z3', bankLast4: '6023', status: 'approved', contact: 'finance@kaverilogistics.example' },
      { id: 'V005', name: 'Orion Cleaning Services', gstin: '33AAECO2468P1Z8', bankLast4: '3310', status: 'blocked', contact: 'info@orioncleaning.example' }
    ],
    pos: [
      { id: 'PO-4501', vendorId: 'V001', lines: [
        { desc: 'MS Angle 40x40 (per tonne)', qty: 10, price: 58000 },
        { desc: 'TMT Bar 12mm (per tonne)', qty: 5, price: 61000 }] },
      { id: 'PO-4502', vendorId: 'V002', lines: [
        { desc: 'Corrugated Box 5-ply', qty: 4000, price: 22.5 },
        { desc: 'Bubble Wrap Roll', qty: 50, price: 340 }] },
      { id: 'PO-4503', vendorId: 'V003', lines: [
        { desc: 'A4 Paper Ream 75gsm', qty: 500, price: 285 },
        { desc: 'Toner Cartridge 12A', qty: 20, price: 3400 }] },
      { id: 'PO-4504', vendorId: 'V004', lines: [
        { desc: 'Freight Delhi-Mumbai FTL trip', qty: 12, price: 41500 }] },
      { id: 'PO-4505', vendorId: 'V002', lines: [
        { desc: 'Corrugated Box 5-ply', qty: 4000, price: 22.5 },
        { desc: 'Bubble Wrap Roll', qty: 50, price: 340 }] },
      { id: 'PO-4506', vendorId: 'V001', lines: [
        { desc: 'Welding Rod E6013 (per carton)', qty: 40, price: 1850 }] }
    ]
  };
  DATA.pos.forEach(p => {
    p.subtotal = round2(p.lines.reduce((s, l) => s + l.qty * l.price, 0));
    p.total = round2(p.subtotal * (1 + DATA.gstRate));
  });

  // ---------- helpers ----------
  function round2(n) { return Math.round(n * 100) / 100; }
  function money(n) { return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pct(n) { return (n * 100).toFixed(1) + '%'; }
  function num(s) { return parseFloat(String(s).replace(/,/g, '')); }
  function norm(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\b(pvt|private|ltd|limited|llp|co|company|industries|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function lev(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function sim(a, b) {
    const x = norm(a), y = norm(b); if (!x || !y) return 0;
    return 1 - lev(x, y) / Math.max(x.length, y.length);
  }
  function descSim(a, b) {
    const x = norm(a), y = norm(b);
    const tx = new Set(x.split(' ')), ty = new Set(y.split(' '));
    const inter = [...tx].filter(t => ty.has(t)).length;
    const jac = inter / (tx.size + ty.size - inter || 1);
    return Math.max(jac, sim(a, b));
  }
  const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function parseDate(s) {
    if (!s) return null; s = s.trim(); let m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return s;
    if ((m = s.match(/^(\d{1,2})[\s\-\/.]([A-Za-z]{3,9})[\s\-\/.,]*(\d{2,4})$/))) {
      const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]; if (!mo) return null;
      const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      return `${y}-${String(mo).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
    }
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  }

  // ---------- stage 1: extraction (text -> structured invoice) ----------
  const MONEY_G = /\d[\d,]*\.\d{2}/g;
  function lastMoney(line) { const m = line.match(MONEY_G); return m ? num(m[m.length - 1]) : null; }

  function extract(text) {
    const out = { vendor_name: null, gstin: null, invoice_no: null, date: null, po_ref: null, lines: [],
      subtotal: null, tax: null, total: null, tax_inclusive: false, bank_last4: null, notes: [] };
    const raw = (text || '').replace(/\r/g, '');
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { out.notes.push('No text could be read from the document (empty or image-only PDF).'); return out; }

    const vend = raw.match(/(?:^|\n)\s*(?:vendor|from|supplier)\s*[:\-]\s*(.+)/i);
    const heads = lines.map(l => l.replace(/tax\s*invoice/ig, '').trim()).filter(l => /[A-Za-z]{3}/.test(l));
    out.vendor_name = vend ? vend[1].trim() : (heads[0] || null);
    let m;
    if ((m = raw.match(/GSTIN\s*(?:of\s*supplier)?\s*[:\-]?\s*([0-9A-Z]{8,15})/i))) out.gstin = m[1].toUpperCase();
    if ((m = raw.match(/invoice\s*(?:no|number|#)\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\/\-]{2,})/i))) out.invoice_no = m[1];
    if ((m = raw.match(/invoice\s*date\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\s\-\/.][A-Za-z]{3,9}[\s\-\/.,]*\d{2,4}|\d{1,2}\/\d{1,2}\/\d{4})/i))) out.date = parseDate(m[1]);
    if ((m = raw.match(/\bPO[\s\-#:]*([0-9]{4,})\b/i))) out.po_ref = 'PO-' + m[1];
    if ((m = raw.match(/(?:a\/c|account)[^\n]*?(\d{4})\s*$/im))) out.bank_last4 = m[1];
    out.tax_inclusive = /inclusive\s+of\s+(?:gst|tax)|incl\.?\s+gst|prices\s+include\s+(?:gst|tax)/i.test(raw);

    for (const l of lines) {
      const low = l.toLowerCase();
      if (/^sub\s*-?\s*total/.test(low)) { out.subtotal = lastMoney(l); continue; }
      if (/^(grand\s+total|total\s+payable|amount\s+payable|total)\b/.test(low) && !/in words/.test(low)) { const v = lastMoney(l); if (v !== null) out.total = v; continue; }
      if (/^(igst|cgst|sgst|gst|tax)\b/.test(low)) { const v = lastMoney(l); if (v !== null) out.tax = round2((out.tax || 0) + v); continue; }
      const r = l.match(/^(?:\d{1,2}\s+)?(.+?)\s+(\d[\d,]*(?:\.\d+)?)\s+(?:₹|Rs\.?)?\s*(\d[\d,]*\.\d{2})\s+(?:₹|Rs\.?)?\s*(\d[\d,]*\.\d{2})$/);
      if (r && !/invoice|date|gstin|a\/c/i.test(r[1])) out.lines.push({ desc: r[1].trim(), qty: num(r[2]), price: num(r[3]), amount: num(r[4]) });
    }
    return out;
  }

  // accept structured input (form / JSON) in the same shape
  function fromJSON(o) {
    return Object.assign({ vendor_name: null, gstin: null, invoice_no: null, date: null, po_ref: null, lines: [],
      subtotal: null, tax: null, total: null, tax_inclusive: false, bank_last4: null, notes: [] }, o, { date: o.date ? (parseDate(o.date) || o.date) : null });
  }

  // ---------- stages 2-4: validate, match, decide ----------
  const SEV = { pass: 0, info: 0, review: 1, pending: 2, reject: 3 };
  function runChecks(inv, ctx) {
    const history = ctx.history || [];
    const now = ctx.now ? new Date(ctx.now) : new Date();
    const checks = []; const add = (id, label, level, detail) => checks.push({ id, label, level, detail });
    const info = { vendor: null, po: null, expected_total: null, billed_before: 0, remaining: null };

    // R1 required fields
    const missing = [];
    if (!inv.invoice_no) missing.push('invoice number');
    if (!inv.date) missing.push('invoice date');
    if (!inv.vendor_name && !inv.gstin) missing.push('vendor name / GSTIN');
    if (inv.total == null) missing.push('total amount');
    if (!inv.lines.length) missing.push('line items');
    if (inv.notes.length && !inv.lines.length && inv.total == null) {
      add('R1', 'Readable document', 'review', inv.notes[0] + ' Route to a person for manual keying.');
      return { checks, info };
    } else if (missing.length) add('R1', 'Required fields', 'pending', 'Missing: ' + missing.join(', ') + '. Ask the vendor to resend.');
    else add('R1', 'Required fields', 'pass', 'Invoice number, date, vendor, lines and total all present.');

    // R2 arithmetic
    let subtotal = inv.subtotal, tax = inv.tax, derived = false;
    const lineSum = round2(inv.lines.reduce((s, l) => s + (l.amount != null ? l.amount : l.qty * l.price), 0));
    if (inv.lines.length && inv.total != null) {
      if (subtotal == null && tax == null && inv.tax_inclusive) {
        subtotal = round2(inv.total / (1 + DATA.gstRate)); tax = round2(inv.total - subtotal); derived = true;
        const diff = Math.abs(lineSum - inv.total);
        if (diff > 1) add('R2', 'Arithmetic', 'review', `Lines add up to ${money(lineSum)} but invoice total is ${money(inv.total)}.`);
        else add('R2', 'Arithmetic', 'info', `Tax is bundled into unit prices ("inclusive of GST"). Backed out ${money(tax)} GST at ${pct(DATA.gstRate)}; pre-tax value ${money(subtotal)}.`);
      } else {
        if (subtotal == null) subtotal = lineSum;
        if (tax == null) tax = round2(inv.total - subtotal);
        const bad = [];
        if (Math.abs(lineSum - subtotal) > 1) bad.push(`lines sum to ${money(lineSum)} but subtotal says ${money(subtotal)}`);
        if (Math.abs(subtotal + tax - inv.total) > 1) bad.push(`subtotal + tax = ${money(subtotal + tax)} but total says ${money(inv.total)}`);
        if (bad.length) add('R2', 'Arithmetic', 'review', 'Does not add up: ' + bad.join('; ') + '.');
        else add('R2', 'Arithmetic', 'pass', `Lines ${money(lineSum)} + GST ${money(tax)} = ${money(inv.total)}.`);
      }
    } else add('R2', 'Arithmetic', 'info', 'Skipped: not enough figures extracted.');

    // R3 date
    if (inv.date) {
      const d = new Date(inv.date + 'T00:00:00Z'), age = (now - d) / 86400000;
      if (isNaN(d)) add('R3', 'Invoice date', 'pending', `Could not read date "${inv.date}".`);
      else if (age < -1) add('R3', 'Invoice date', 'review', `Invoice is dated in the future (${inv.date}).`);
      else if (age > DATA.staleDays) add('R3', 'Invoice date', 'review', `Invoice is ${Math.floor(age)} days old (limit ${DATA.staleDays}); check for late or re-submitted billing.`);
      else add('R3', 'Invoice date', 'pass', `${inv.date} is within the last ${DATA.staleDays} days.`);
    }

    // R4 vendor identity
    let vendor = null, how = '';
    if (inv.gstin) { vendor = DATA.vendors.find(v => v.gstin === inv.gstin) || null; if (vendor) how = 'GSTIN'; }
    let nameSim = 0;
    if (!vendor && inv.vendor_name) {
      const best = DATA.vendors.map(v => ({ v, s: sim(v.name, inv.vendor_name) })).sort((a, b) => b.s - a.s)[0];
      if (best && best.s >= 0.8) { vendor = best.v; how = `name similarity ${pct(best.s)}`; }
    }
    if (vendor && inv.vendor_name) nameSim = sim(vendor.name, inv.vendor_name);
    info.vendor = vendor;
    if (!vendor) {
      add('R4', 'Vendor master', 'reject', `"${inv.vendor_name || 'unknown'}"${inv.gstin ? ' (GSTIN ' + inv.gstin + ')' : ''} is not in the approved vendor list.`);
    } else if (vendor.status !== 'approved') {
      add('R4', 'Vendor master', 'reject', `${vendor.name} is ${vendor.status.toUpperCase()} in the vendor master. Do not pay.`);
    } else {
      const probs = [];
      if (inv.gstin && !GSTIN_RE.test(inv.gstin)) probs.push(`GSTIN "${inv.gstin}" is not a valid format`);
      else if (inv.gstin && inv.gstin !== vendor.gstin) probs.push(`GSTIN ${inv.gstin} differs from master ${vendor.gstin}`);
      if (!inv.gstin) probs.push('no GSTIN on invoice');
      if (nameSim < 1 && nameSim >= 0.8) probs.push(`name "${inv.vendor_name}" is a near-match, not exact`);
      if (probs.some(p => /GSTIN/.test(p) && !/no GSTIN/.test(p))) add('R4', 'Vendor master', 'review', `${vendor.name} (matched by ${how}); ` + probs.join('; ') + '.');
      else add('R4', 'Vendor master', probs.length ? 'info' : 'pass', `${vendor.name} (${vendor.id}) matched by ${how}` + (probs.length ? '; ' + probs.join('; ') : '; approved, GSTIN valid.'));
    }

    // R5 bank
    if (vendor && inv.bank_last4) {
      if (inv.bank_last4 !== vendor.bankLast4) add('R5', 'Bank details', 'review', `Invoice account ends ${inv.bank_last4} but master has ${vendor.bankLast4}. Possible payment-fraud pattern: confirm by phoning a known contact before paying.`);
      else add('R5', 'Bank details', 'pass', `Account ending ${inv.bank_last4} matches vendor master.`);
    } else if (vendor) add('R5', 'Bank details', 'info', 'No bank details on invoice; will pay to master account.');

    // R6 duplicates
    if (vendor) {
      const same = history.find(h => h.vendorId === vendor.id && h.invoice_no && inv.invoice_no && h.invoice_no === inv.invoice_no);
      const alike = history.find(h => h.vendorId === vendor.id && h.invoice_no !== inv.invoice_no && h.total != null && inv.total != null &&
        Math.abs(h.total - inv.total) < 0.5 && h.date === inv.date && h.status !== 'REJECTED');
      if (same) add('R6', 'Duplicate check', 'reject', `Invoice ${inv.invoice_no} from ${vendor.name} was already processed (${same.status}).`);
      else if (alike) add('R6', 'Duplicate check', 'reject', `Same vendor, date and amount as ${alike.invoice_no} but a different invoice number. Likely re-submission under a new number.`);
      else add('R6', 'Duplicate check', 'pass', 'No earlier invoice with the same number, or same vendor/date/amount.');
    }

    // R7 PO lookup
    let po = null, poHow = '';
    if (inv.po_ref) {
      po = DATA.pos.find(p => p.id === inv.po_ref) || null;
      if (!po) add('R7', 'PO lookup', 'reject', `Invoice cites ${inv.po_ref}, which does not exist.`);
      else if (vendor && po.vendorId !== vendor.id) { add('R7', 'PO lookup', 'reject', `${po.id} belongs to ${DATA.vendors.find(v => v.id === po.vendorId).name}, not ${vendor.name}.`); po = null; }
      else poHow = 'cited on invoice';
    } else if (vendor && inv.lines.length) {
      const cands = DATA.pos.filter(p => p.vendorId === vendor.id).map(p => {
        const hit = inv.lines.filter(il => p.lines.some(pl => descSim(il.desc, pl.desc) >= 0.6)).length;
        return { p, score: hit / inv.lines.length };
      }).filter(c => c.score >= 0.99);
      if (cands.length === 1) { po = cands[0].p; poHow = 'inferred from vendor and line items'; add('R7', 'PO lookup', 'review', `No PO number on the invoice. All lines match ${po.id} for this vendor, so it is inferred; a person should confirm.`); }
      else add('R7', 'PO lookup', 'reject', cands.length ? 'No PO number and more than one PO could match.' : 'No PO number on invoice and no open PO for this vendor matches its lines.');
    } else if (!vendor) add('R7', 'PO lookup', 'info', 'Skipped: vendor unknown.');
    info.po = po;
    if (po && vendor && poHow === 'cited on invoice') add('R7', 'PO lookup', 'pass', `${po.id} found for ${vendor.name} (cited on invoice).`);

    // R8-R10 against PO
    if (po && inv.lines.length) {
      const billed = history.filter(h => h.po === po.id && h.status === 'APPROVED');
      const billedVal = round2(billed.reduce((s, h) => s + (h.total || 0), 0));
      const billedQty = {}; billed.forEach(h => Object.entries(h.linesBilled || {}).forEach(([k, q]) => { billedQty[k] = (billedQty[k] || 0) + q; }));
      info.billed_before = billedVal; info.remaining = round2(po.total - billedVal);

      let expSub = 0, unmatched = [], qtyIssues = [], priceNotes = [], priceWorst = 0; const linesBilled = {};
      inv.lines.forEach(il => {
        let bi = -1, bs = 0; po.lines.forEach((pl, i) => { const s = descSim(il.desc, pl.desc); if (s > bs) { bs = s; bi = i; } });
        if (bs < 0.6) { unmatched.push(il.desc); return; }
        const pl = po.lines[bi]; linesBilled[bi] = (linesBilled[bi] || 0) + il.qty;
        const left = pl.qty - (billedQty[bi] || 0);
        if (il.qty > left + 1e-9) qtyIssues.push(`"${pl.desc}": billing ${il.qty} but only ${left} left on ${po.id}`);
        const unit = il.price != null ? il.price : il.amount / il.qty;
        const eff = derived ? unit / (1 + DATA.gstRate) : unit;
        const v = (eff - pl.price) / pl.price; priceWorst = Math.max(priceWorst, Math.abs(v));
        if (Math.abs(v) > 0.0005) priceNotes.push(`"${pl.desc}" ${money(eff)} vs PO ${money(pl.price)} (${v > 0 ? '+' : ''}${pct(v)})`);
        expSub += il.qty * pl.price;
      });
      if (unmatched.length) add('R8', 'Line items vs PO', 'reject', `Not on ${po.id}: ${unmatched.map(u => '"' + u + '"').join(', ')}.`);
      else if (qtyIssues.length) add('R8', 'Line items vs PO', 'reject', 'Over-billing: ' + qtyIssues.join('; ') + '.');
      else add('R8', 'Line items vs PO', 'pass', `All ${inv.lines.length} line(s) map to ${po.id} and quantities are within what is left to bill.`);

      if (!unmatched.length) {
        if (priceWorst > DATA.tolerance.review) add('R9', 'Unit prices vs PO', 'reject', 'Price variance above ' + pct(DATA.tolerance.review) + ': ' + priceNotes.join('; ') + '.');
        else if (priceWorst > DATA.tolerance.auto) add('R9', 'Unit prices vs PO', 'review', 'Price variance above ' + pct(DATA.tolerance.auto) + ': ' + priceNotes.join('; ') + '.');
        else if (priceNotes.length) add('R9', 'Unit prices vs PO', 'info', 'Small price drift within ' + pct(DATA.tolerance.auto) + ': ' + priceNotes.join('; ') + '.');
        else add('R9', 'Unit prices vs PO', 'pass', 'Unit prices equal PO prices.');
        const expTotal = round2(expSub * (1 + DATA.gstRate)); info.expected_total = expTotal;
        const tot = inv.total != null ? inv.total : null;
        if (tot != null) {
          const v = (tot - expTotal) / expTotal;
          if (tot > info.remaining * (1 + DATA.tolerance.auto) + 0.5) add('R10', 'Amount and PO balance', 'reject', `Invoice ${money(tot)} exceeds the balance left on ${po.id} (${money(info.remaining)} of ${money(po.total)}; ${money(billedVal)} already billed).`);
          else if (Math.abs(v) > DATA.tolerance.review) add('R10', 'Amount and PO balance', 'reject', `Total ${money(tot)} is ${pct(Math.abs(v))} ${v > 0 ? 'above' : 'below'} the PO-based expectation ${money(expTotal)}.`);
          else if (Math.abs(v) > DATA.tolerance.auto) add('R10', 'Amount and PO balance', 'review', `Total ${money(tot)} is ${pct(Math.abs(v))} ${v > 0 ? 'above' : 'below'} the PO-based expectation ${money(expTotal)}.`);
          else add('R10', 'Amount and PO balance', 'pass', `Total ${money(tot)} vs expected ${money(expTotal)} (${v >= 0 ? '+' : ''}${pct(v)}); ${money(info.remaining - tot)} would remain on ${po.id}${tot < po.total * 0.999 ? ' (partial invoice)' : ''}.`);
        }
      }
      info.linesBilled = linesBilled;
    }
    return { checks, info };
  }

  function decide(checks) {
    const worst = checks.reduce((m, c) => Math.max(m, SEV[c.level]), 0);
    const status = ['APPROVED', 'NEEDS_REVIEW', 'PENDING_INFO', 'REJECTED'][worst];
    return status;
  }

  function draft(status, inv, checks, vendor) {
    const issues = checks.filter(c => SEV[c.level] >= 1);
    const to = vendor ? vendor.contact : 'the vendor';
    const ref = inv.invoice_no || '(no number)';
    if (status === 'APPROVED') return { kind: 'ap-note', to: 'AP queue', text: `Approved for payment. ${checks.filter(c => c.level === 'info').map(c => c.detail).join(' ')}`.trim() };
    if (status === 'PENDING_INFO') return { kind: 'vendor-email', to, text: `Subject: Invoice ${ref}: information needed\n\nHello,\n\nWe could not process your invoice because: ${issues.map(c => c.detail).join(' ')}\n\nPlease resend a corrected invoice. We will pick it up as soon as it arrives.\n\nAccounts Payable` };
    if (status === 'REJECTED') return { kind: 'vendor-email', to, text: `Subject: Invoice ${ref}: not accepted\n\nHello,\n\nWe are unable to process this invoice:\n${issues.map(c => '- ' + c.detail).join('\n')}\n\nIf you believe this is wrong, reply with your PO and delivery proof.\n\nAccounts Payable` };
    return { kind: 'reviewer-note', to: 'AP approver', text: `Needs a human decision on invoice ${ref}:\n${issues.map(c => '- ' + c.detail).join('\n')}` };
  }

  // ---------- public: process one invoice end to end ----------
  function process(input, ctx) {
    ctx = ctx || {};
    const t0 = Date.now(); const stages = [];
    const isText = typeof input === 'string';
    stages.push({ name: 'Ingest', status: 'ok', summary: isText ? `${input.split('\n').filter(l => l.trim()).length} text lines read` : 'Structured input received' });
    const inv = isText ? extract(input) : fromJSON(input);
    const got = ['vendor_name', 'gstin', 'invoice_no', 'date', 'po_ref', 'total'].filter(k => inv[k] != null && inv[k] !== '').length;
    stages.push({ name: 'Extract', status: got >= 4 ? 'ok' : (got ? 'warn' : 'fail'), summary: `${got}/6 header fields, ${inv.lines.length} line item(s)` });
    const { checks, info } = runChecks(inv, ctx);
    const fails = checks.filter(c => SEV[c.level] >= 1 && ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].includes(c.id));
    stages.push({ name: 'Validate', status: fails.length ? 'warn' : 'ok', summary: fails.length ? `${fails.length} issue(s): ${fails.map(f => f.id).join(', ')}` : 'Fields, arithmetic, vendor, bank, duplicates all clear' });
    const poChecks = checks.filter(c => ['R7', 'R8', 'R9', 'R10'].includes(c.id));
    const poBad = poChecks.filter(c => SEV[c.level] >= 1);
    stages.push({ name: 'Match PO', status: info.po ? (poBad.length ? 'warn' : 'ok') : 'fail', summary: info.po ? `${info.po.id}: ${poBad.length ? poBad.length + ' issue(s)' : 'matched'}` : 'No usable PO' });
    const status = decide(checks);
    stages.push({ name: 'Decide', status: status === 'APPROVED' ? 'ok' : (status === 'REJECTED' ? 'fail' : 'warn'), summary: status });
    const message = draft(status, inv, checks, info.vendor);
    stages.push({ name: 'Notify', status: 'ok', summary: message.kind + ' → ' + message.to });
    const record = {
      id: ctx.runId || ('run-' + Date.now().toString(36)), ts: (ctx.now ? new Date(ctx.now) : new Date()).toISOString(), source: ctx.source || 'input',
      vendorId: info.vendor ? info.vendor.id : null, vendor: info.vendor ? info.vendor.name : (inv.vendor_name || 'unknown'),
      invoice_no: inv.invoice_no, date: inv.date, po: info.po ? info.po.id : (inv.po_ref || null), total: inv.total, status,
      linesBilled: status === 'APPROVED' ? info.linesBilled : undefined, reasons: checks.filter(c => SEV[c.level] >= 1).map(c => c.id + ': ' + c.detail),
      ms: Date.now() - t0
    };
    return { invoice: inv, checks, stages, status, message, info: { vendor: info.vendor && info.vendor.name, po: info.po && info.po.id, expected_total: info.expected_total, remaining: info.remaining }, record };
  }

  return { DATA, extract, process, parseDate, money, round2 };
});
