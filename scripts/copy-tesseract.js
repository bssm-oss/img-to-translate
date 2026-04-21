const fs = require('fs');
const path = require('path');

const srcFiles = [
  'node_modules/tesseract.js/dist/tesseract.min.js',
  'node_modules/tesseract.js/dist/worker.min.js',
  'node_modules/tesseract.js-core/tesseract-core.wasm.js'
];

const destDir = path.join(__dirname, '../tesseract');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

srcFiles.forEach(file => {
  const src = path.join(__dirname, '..', file);
  const dest = path.join(destDir, path.basename(file));
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${path.basename(file)} from node_modules to tesseract/`);
  } else {
    console.error(`Warning: Source file not found: ${src}`);
  }
});
