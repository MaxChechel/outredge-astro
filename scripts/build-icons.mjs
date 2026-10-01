#!/usr/bin/env node
// Generates the site's icons into public/ from the brand mark in
// src/assets/brand/icon.svg.
//
// SAME PATTERN AS scripts/subset-fonts.py: a committed script produces committed
// files, and the files ship. Not a build step — these change when the brand
// changes, which is roughly never, and a build step that re-derives identical
// bytes on every deploy is machinery earning nothing. Run it by hand when the
// mark or the ink primitives change:
//
//     node scripts/build-icons.mjs
//
// PROJECT: replace src/assets/brand/icon.svg with the client's mark — ONE path,
// square viewBox, the mark only (not the wordmark) — and run this.
//
// WHY public/ AND NOT src/assets/. Everything under src/assets gets a
// fingerprinted filename. These need STABLE paths: a browser requests
// /favicon.ico on its own and iOS requests /apple-touch-icon.png on its own,
// neither asking the HTML first. public/ copies verbatim to the site root.
//
// `sharp` is Astro's own image dependency, already in node_modules: this adds
// nothing to the tree, and nothing here ships to a browser.

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'src/assets/brand/icon.svg';
const OUT = 'public';

const source = readFileSync(SOURCE, 'utf8');
const paths = [...source.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
const viewBox = /viewBox="([^"]+)"/.exec(source)?.[1];
if (paths.length !== 1 || !viewBox) {
  throw new Error(`build-icons: ${SOURCE} must be one <path> in an <svg> with a viewBox (found ${paths.length} paths).`);
}
const [, , vw, vh] = viewBox.split(/[\s,]+/).map(Number);
if (Math.abs(vw - vh) > 0.01) throw new Error(`build-icons: ${SOURCE} viewBox is ${vw}×${vh}; an icon is square.`);
const d = paths[0];

/* The ink is the primitive each theme's --text-primary points at, read from the
   stylesheet so a rebrand of the ramp is a rebrand of the icon. */
const css = readFileSync('src/styles/global.css', 'utf8');
const primitive = (name) => {
  const hex = new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)?.[1];
  if (!hex) throw new Error(`build-icons: ${name} is not a hex primitive in global.css`);
  return hex;
};
const INK = primitive('--gray-950'); // light theme --text-primary
const INK_ON_DARK = primitive('--gray-50'); // dark theme --text-primary
const PAPER = primitive('--gray-0');

/* --- favicon.svg -----------------------------------------------------------
   ONE FILE THAT ANSWERS BOTH THEMES. A `media` attribute on <link rel="icon"> is
   not reliably honoured, so the switch lives INSIDE the SVG as a
   prefers-color-scheme rule, which Chrome, Firefox and Safari all apply to an SVG
   favicon: dark ink on a light tab strip, light ink on a dark one. */
const faviconSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">` +
  `<style>path{fill:${INK}}@media (prefers-color-scheme:dark){path{fill:${INK_ON_DARK}}}</style>` +
  `<path d="${d}"/></svg>\n`;
writeFileSync(`${OUT}/favicon.svg`, faviconSvg);

/**
 * The raster icons, which can neither adapt nor be transparent: iOS composites
 * an apple-touch-icon onto its own rounded square and renders ALPHA AS BLACK, so
 * a transparent ground would put dark ink on black. Flattened onto paper, with
 * the mark inset so iOS's corner mask never reaches it.
 */
const raster = async (size, inset) => {
  const mark = Math.round(size * (1 - 2 * inset));
  const glyph = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path d="${d}" fill="${INK}"/></svg>`))
    .resize(mark, mark)
    .png()
    .toBuffer();
  /* Two passes on purpose: sharp runs `composite` LAST whatever order the calls
     are written in, so a flatten chained after it flattens the empty canvas and
     the composite brings the alpha channel back. */
  const placed = await sharp({ create: { width: size, height: size, channels: 4, background: PAPER } })
    .composite([{ input: glyph, gravity: 'centre' }])
    .png()
    .toBuffer();
  return sharp(placed).flatten({ background: PAPER }).png({ compressionLevel: 9 }).toBuffer();
};

const touch = await raster(180, 0.18);
writeFileSync(`${OUT}/apple-touch-icon.png`, touch);

/* --- favicon.ico -----------------------------------------------------------
   sharp does not write ICO. The container is a 6-byte header, a 16-byte
   directory entry and the image — which, since Vista, may be a PNG verbatim, and
   that is what every current browser reads. Writing 22 bytes beats a dependency.
   32×32 only: the size a tab renders. */
const icoPng = await raster(32, 0.06);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
const entry = Buffer.alloc(16);
entry.writeUInt8(32, 0); // width
entry.writeUInt8(32, 1); // height
entry.writeUInt8(0, 2); // no palette
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // colour planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(icoPng.length, 8); // image bytes
entry.writeUInt32LE(22, 12); // offset: 6 + 16
const ico = Buffer.concat([header, entry, icoPng]);
writeFileSync(`${OUT}/favicon.ico`, ico);

for (const [name, bytes] of [
  ['favicon.svg', Buffer.byteLength(faviconSvg)],
  ['favicon.ico', ico.length],
  ['apple-touch-icon.png', touch.length],
]) {
  console.log(`  ${name.padEnd(24)} ${bytes} B`);
}
