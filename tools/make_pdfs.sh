#!/bin/sh
# Usage: sh tools/make_pdfs.sh   (macOS, needs Google Chrome)
cd "$(dirname "$0")/.." || exit 1
node tools/make_samples.js
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for f in samples/s*.html; do
  b="${f%.html}"
  "$C" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="$b.pdf" "file://$PWD/$f" >/dev/null 2>&1
done
rm -f samples/*.html
ls samples/*.pdf | wc -l
