#!/usr/bin/env node
/**
 * generate-pwa-icons.js
 *
 * Reads `public/icons/vite.svg` and writes PNG icons to `public/icons/pwa/`
 * using sharp. If sharp is not installed, prints an installation hint.
 *
 * Usage: node scripts/generate-pwa-icons.js
 */

import fs from 'fs';
import path from 'path';

const SRC = path.resolve(process.cwd(), 'public', 'icons', 'vite.svg');
const OUT_DIR = path.resolve(process.cwd(), 'public', 'icons', 'pwa');
const SIZES = [48, 72, 96, 128, 144, 152, 192, 256, 384, 512];

function exitWith(msg) {
  console.error(msg);
  process.exit(1);
}

if (!fs.existsSync(SRC)) {
  exitWith(`Source SVG not found at ${SRC}. Place your SVG there and retry.`);
}

let sharp;
try {
  // dynamic import so script can still run to print instructions if sharp is missing
  // eslint-disable-next-line import/no-extraneous-dependencies
  sharp = await import('sharp');
} catch (err) {
  console.log('Optional dependency `sharp` is not installed.');
  console.log('Install it with:');
  console.log('\n  npm install --save-dev sharp\n');
  console.log('Once installed, re-run this script to generate PNG icons.');
  process.exit(0);
}

await fs.promises.mkdir(OUT_DIR, { recursive: true });
const svgBuffer = await fs.promises.readFile(SRC);

for (const size of SIZES) {
  const out = path.join(OUT_DIR, `icon-${size}x${size}.png`);
  await sharp.default(svgBuffer)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 90 })
    .toFile(out);
  console.log(`Wrote ${out}`);
}

// Also write a manifest snippet file to help the developer copy-paste into manifest
const manifestEntries = SIZES.map(s => ({ src: `icons/pwa/icon-${s}x${s}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'any' }));
const manifestOut = path.join(OUT_DIR, 'manifest-icons.json');
await fs.promises.writeFile(manifestOut, JSON.stringify(manifestEntries, null, 2));
console.log(`Wrote manifest icons snippet to ${manifestOut}`);
console.log('Done.');
