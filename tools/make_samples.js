// Renders each sample spec to HTML; tools/make_pdfs.sh turns them into text-layer PDFs with headless Chrome.
const fs = require('fs'), path = require('path');
const { SAMPLES, toHtml } = require('../src/samples.js');
const dir = path.join(__dirname, '..', 'samples');
SAMPLES.forEach(s => fs.writeFileSync(path.join(dir, s.id + '.html'), toHtml(s)));
console.log('wrote', SAMPLES.length, 'html files');
