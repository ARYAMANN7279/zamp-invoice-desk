/* UI glue: reads PDFs, runs Engine.process, animates the stages, keeps a dashboard of runs in localStorage. */
(function () {
  const $ = s => document.querySelector(s);
  const KEY = 'invoicedesk.runs.v1';
  const { DATA, process: run, money } = Engine;
  let history = [];
  try { history = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { history = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(history)); } catch (e) { /* storage blocked: dashboard lasts for this tab only */ } };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const LABEL = { APPROVED: 'Approved', NEEDS_REVIEW: 'Needs review', PENDING_INFO: 'Hold: info needed', REJECTED: 'Rejected' };
  const HEAD = {
    APPROVED: 'Approved for payment', NEEDS_REVIEW: 'Sent to a person for a decision',
    PENDING_INFO: 'On hold: waiting on the vendor', REJECTED: 'Rejected'
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let busy = false;

  // ----- reading input -----
  async function pdfText(buf) {
    if (!window.pdfjsLib) throw new Error('pdf.js not loaded');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise; const out = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const tc = await (await pdf.getPage(p)).getTextContent(); const rows = {};
      tc.items.forEach(it => { if (!it.str.trim()) return; const y = Math.round(it.transform[5] / 3); (rows[y] = rows[y] || []).push({ x: it.transform[4], s: it.str }); });
      Object.keys(rows).map(Number).sort((a, b) => b - a).forEach(y => out.push(rows[y].sort((a, b) => a.x - b.x).map(i => i.s).join('  ')));
    }
    return out.join('\n');
  }
  async function loadSample(s) {
    try {
      const buf = await (await fetch('samples/' + s.id + '.pdf')).arrayBuffer();
      return { text: await pdfText(buf), via: 'PDF read with pdf.js' };
    } catch (e) { return { text: Samples.toText(s), via: 'built-in text copy (PDF could not be loaded here)' }; }
  }

  // ----- rendering -----
  function renderStagesEmpty() {
    $('#stages').innerHTML = ['Ingest', 'Extract', 'Validate', 'Match PO', 'Decide', 'Notify'].map(n => `<li data-n="${n}"><b>${n}</b><span>waiting</span></li>`).join('');
  }
  async function animate(stages) {
    renderStagesEmpty();
    for (const st of stages) {
      const li = document.querySelector(`#stages li[data-n="${st.name}"]`); li.className = 'run'; li.querySelector('span').textContent = 'running…';
      await sleep(320); li.className = st.status; li.querySelector('span').textContent = st.summary;
    }
  }
  function renderResult(res, via) {
    const inv = res.invoice;
    $('#result').hidden = false;
    $('#banner').className = 'banner s-' + res.status;
    const sub = res.status === 'APPROVED' ? (res.info.po ? `Matched ${res.info.po}; ${money(inv.total)}` : '') : (res.checks.filter(c => ['review', 'pending', 'reject'].includes(c.level))[0] || {}).detail || '';
    $('#banner').innerHTML = `${esc(HEAD[res.status])}<small>${esc(sub)}</small>`;
    const rows = [['Vendor', inv.vendor_name], ['GSTIN', inv.gstin], ['Invoice no.', inv.invoice_no], ['Invoice date', inv.date], ['PO reference', inv.po_ref || '(none on invoice)'],
      ['Line items', inv.lines.map(l => `${l.qty} × ${l.desc} @ ${l.price}`).join('<br>') || null], ['Subtotal', inv.subtotal != null ? money(inv.subtotal) : (inv.tax_inclusive ? 'not shown (GST inclusive)' : null)],
      ['GST', inv.tax != null ? money(inv.tax) : null], ['Total', inv.total != null ? money(inv.total) : null], ['Bank a/c ends', inv.bank_last4]];
    $('#fields').innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v == null || v === '' ? '<span class="pill l-pending">not found</span>' : (k === 'Line items' ? v : esc(v))}</td></tr>`).join('');
    $('#checks').innerHTML = res.checks.map(c => `<li><span class="pill l-${c.level}">${c.level === 'pass' ? 'PASS' : c.level.toUpperCase()}</span><span class="lab"><b>${c.id}</b> ${esc(c.label)}</span><span>${esc(c.detail)}</span></li>`).join('');
    $('#msgTitle').textContent = { 'vendor-email': 'Email drafted to vendor (not sent)', 'reviewer-note': 'Note routed to AP approver', 'ap-note': 'Note to AP queue' }[res.message.kind];
    $('#message').textContent = `To: ${res.message.to}\n\n${res.message.text}`;
    $('#source').textContent = via;
  }
  function renderDash() {
    const c = { APPROVED: 0, NEEDS_REVIEW: 0, PENDING_INFO: 0, REJECTED: 0 }; history.forEach(h => c[h.status]++);
    $('#counts').innerHTML = Object.keys(c).map(k => `<div class="count s-${k}"><b>${c[k]}</b>${LABEL[k]}</div>`).join('') + `<div class="count" style="background:var(--bg)"><b>${history.length}</b>Total runs</div>`;
    $('#empty').hidden = history.length > 0;
    $('#runs tbody').innerHTML = history.slice().reverse().map(h => `<tr data-id="${h.id}"><td>${new Date(h.ts).toLocaleTimeString()}</td><td>${esc(h.source)}</td><td>${esc(h.vendor)}</td><td>${esc(h.invoice_no || '-')}</td><td>${esc(h.po || '-')}</td><td class="r">${h.total != null ? money(h.total) : '-'}</td><td><span class="pill s-${h.status}">${LABEL[h.status]}</span></td><td class="r">${h.ms}</td></tr>`).join('');
    $('#poTable').innerHTML = '<tr><th>PO</th><th>Vendor</th><th class="r">Total</th><th class="r">Billed</th><th class="r">Left</th></tr>' + DATA.pos.map(p => {
      const b = history.filter(h => h.po === p.id && h.status === 'APPROVED').reduce((s, h) => s + (h.total || 0), 0);
      return `<tr><td>${p.id}</td><td>${esc(DATA.vendors.find(v => v.id === p.vendorId).name)}</td><td class="r">${money(p.total)}</td><td class="r">${money(b)}</td><td class="r">${money(p.total - b)}</td></tr>`;
    }).join('');
    $('#vTable').innerHTML = '<tr><th>ID</th><th>Name</th><th>Status</th><th>Bank ends</th></tr>' + DATA.vendors.map(v => `<tr><td>${v.id}</td><td>${esc(v.name)}</td><td>${v.status}</td><td>${v.bankLast4}</td></tr>`).join('');
  }

  // ----- run one -----
  async function execute(input, source, via) {
    if (busy) return null; busy = true;
    try {
      const res = run(input, { history, source });
      $('#source').textContent = `Reading ${source} (${via})…`; $('#result').hidden = true;
      await animate(res.stages);
      history.push(res.record); save(); renderResult(res, `${source}: ${via}`); renderDash();
      return res;
    } finally { busy = false; }
  }
  async function runSample(s) { const { text, via } = await loadSample(s); return execute(text, s.title, via); }

  // ----- wiring -----
  $('#samples').innerHTML = Samples.SAMPLES.map(s => `<button class="sbtn" data-id="${s.id}">${esc(s.title)}<small>${esc(s.note)}</small></button>`).join('');
  $('#samples').addEventListener('click', e => { const b = e.target.closest('.sbtn'); if (b) runSample(Samples.SAMPLES.find(s => s.id === b.dataset.id)); });
  $('#file').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      if (/\.pdf$/i.test(f.name)) { const text = await pdfText(await f.arrayBuffer()); await execute(text, f.name, text.trim() ? 'PDF read with pdf.js' : 'PDF has no text layer (scanned?)'); }
      else { const t = await f.text(); let inp = t; if (/\.json$/i.test(f.name)) inp = JSON.parse(t); await execute(inp, f.name, 'file'); }
    } catch (err) { $('#source').textContent = 'Could not read that file: ' + err.message; }
    e.target.value = '';
  });
  $('#runPaste').addEventListener('click', () => {
    const t = $('#paste').value.trim(); if (!t) return;
    let inp = t; if (t[0] === '{') { try { inp = JSON.parse(t); } catch (e) { /* treat as text */ } }
    execute(inp, 'pasted input', typeof inp === 'string' ? 'text' : 'JSON');
  });
  $('#runAll').addEventListener('click', async () => { for (const s of Samples.SAMPLES) { await runSample(s); await sleep(250); } });
  $('#reset').addEventListener('click', () => { history = []; save(); renderDash(); $('#result').hidden = true; renderStagesEmpty(); $('#source').textContent = 'History cleared.'; });
  $('#runs tbody').addEventListener('click', e => {
    const tr = e.target.closest('tr'); if (!tr) return; const h = history.find(x => x.id === tr.dataset.id);
    if (h) { $('#result').hidden = false; $('#banner').className = 'banner s-' + h.status; $('#banner').innerHTML = `${esc(HEAD[h.status])}<small>${esc(h.invoice_no || 'no invoice number')} from ${esc(h.vendor)}</small>`;
      $('#fields').innerHTML = ''; $('#checks').innerHTML = (h.reasons.length ? h.reasons : ['All checks passed']).map(r => `<li><span class="pill l-info">LOG</span><span></span><span>${esc(r)}</span></li>`).join(''); $('#msgTitle').textContent = ''; $('#message').textContent = ''; }
  });
  renderStagesEmpty(); renderDash();
})();
