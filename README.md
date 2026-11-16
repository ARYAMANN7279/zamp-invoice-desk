# Invoice Desk: Zamp AI Solutions Analyst case study (PS-1, Finance / AP)

A working process that takes a vendor invoice (PDF, pasted text or JSON) and returns a decision with reasons:
**Approved / Needs review / Hold (info needed) / Rejected**. It shows each stage as it runs and keeps a dashboard of past runs.

- Deadline: **Mon 23 Nov 2026, 10:00 AM** (Zamp form, IIT Kanpur). Submission form needs: entry number, institute email, LinkedIn or full name, link to the live process, link to the demo video (max 5 min, own voice), optional other links.
- Problem chosen: **PS-1, invoice processing from PDF to decision** (Zamp case guide, 7 pages).

## Run it
```bash
cd zamp-asa-case
python3 -m http.server 8765        # then open http://localhost:8765
node tests/run.js                  # 12 samples x 2 input paths + 3 extra cases, all must pass
```
No keys, no backend, no install. PDFs are parsed in the browser with pdf.js (loaded from cdnjs), so the page needs internet for that one script.

## Live link (needs you)
It is a static site, so any static host works. The simplest is GitHub Pages from a repo under your account:
1. Push this folder to a new public repo on `ARYAMANN7279` (I have not pushed anything).
2. Settings > Pages > Deploy from branch `main` / root.
3. The URL is `https://aryamann7279.github.io/<repo>/`. Open it, click "Run all 12 samples in order" to confirm it works, then paste it in the form.
Netlify Drop (drag the folder onto app.netlify.com/drop) also works but needs an account.

## How it works
| Stage | What happens |
|---|---|
| Ingest | PDF text layer read with pdf.js, or pasted text, or JSON. |
| Extract | Rules pull vendor, GSTIN, invoice no, date, PO ref, line items, subtotal, GST, total, bank account tail. Handles Indian number grouping and "inclusive of GST" invoices. |
| Validate | R1 required fields, R2 arithmetic, R3 date sanity, R4 vendor master + GSTIN format/match, R5 bank account vs master, R6 duplicates (same number, or same vendor/date/amount under a new number). |
| Match PO | R7 PO found (cited, or inferred from lines), R8 lines and quantities against what is left on the PO, R9 unit prices, R10 amount and PO balance. |
| Decide | Worst check wins: reject > hold > review > approve. Tolerances: within 2% approve, 2 to 5% review, over 5% reject. |
| Notify | Drafts the email to the vendor or the note to the AP approver. Nothing is sent. |

The logic is deliberately rule-based, not an LLM call. A finance process has to give the same answer every run and explain itself; AI is used where it helps (building the process, generating test inputs), not as the decision-maker. If extraction from messy scanned PDFs were needed, an OCR/LLM step would slot in at Extract and its output would still pass through the same checks.

## Test inputs (all made up, in `samples/`)
12 invoices, real PDFs. Run them in order, since PO balances and duplicate detection use the history.
Edge cases I chose: split PO billed in two parts then over-billed; GST bundled into unit prices; missing invoice number and date; duplicate resubmitted under a new number; bank account changed; PO number implied; plus unknown vendor, price variance and small drift.

## Assumptions and limits (say these in the interview)
- Vendor master, POs and tolerances are made-up stand-ins for the procurement system. GST is assumed to be 18% when it has to be backed out.
- Only PDFs with a text layer are read. A scanned image has no text, so it is routed to a person (tested with an empty document). OCR is the obvious next step.
- Dashboard history lives in the browser (localStorage). A real version would write to a database and the ERP.
- Nothing is emailed or paid; the drafts are the output.
