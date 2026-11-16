# Demo video script (max 5 minutes, your own voice, no slides)
Open the live URL. Click "Clear history" first so the dashboard starts empty.

**0:00 Intro (20s)** "This is Invoice Desk for the invoice problem. An invoice comes in as a PDF, and it returns approve, review, hold or reject, with the reasons. It runs in the browser and every decision is rule based so it is explainable."

**0:20 Happy path (60s)** Click `01 Clean match`. Point at the six stages lighting up, the extracted fields, then the checks R1 to R10 all PASS and the approved banner. "It matched PO-4501, prices equal the PO, total within tolerance."

**1:20 Edge 1: split PO (60s)** Click 04, then 05, then 06. "Invoice 04 bills 7 of 12 trips, approved. 05 bills the last 5, approved. 06 tries 2 more trips after the PO is fully billed, so it is rejected. Open the PO table under the dashboard to show balance Rs 0 left."

**2:20 Edge 2: duplicate under a new number (45s)** Click 09. "Same vendor, date, lines and amount as 01, only the invoice number has an -A. A number-only duplicate check would miss it; this one is rejected."

**3:05 Edge 3: bank account changed (40s)** Click 10. "Everything else is clean, but the account ends 9902 and the vendor master says 4521. That is a classic payment-fraud pattern, so it goes to a person, not auto-approved."

**3:45 Edge 4: tax bundled / missing fields (40s)** Click 07 ("inclusive of GST", it backs the tax out and still matches). Then 08 (no invoice number or date): "hold, and it drafts the email to the vendor."

**4:25 Dashboard + close (30s)** Scroll to the dashboard: counts, run list, click a row. "Design choices: rules for decisions, tolerances of 2 and 5 percent, nothing is sent or paid. Next step would be OCR for scanned PDFs and writing to the ERP."

Tip: if you run out of time, drop 07/08. Do a dry run first so the order is smooth.
