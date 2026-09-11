// §9 rendered checks: horizontal overflow, exactly one h1, zero heading skips,
// and every image carrying dimensions and a non-null alt — at all seven widths,
// on every page.
//
// Run through `npm run verify`, or on its own against a running preview:
//   npm run build:styleguide && npm run preview &  →  node scripts/verify/sweep.mjs

import { connect, PAGES, WIDTHS, BASE } from './lib/cdp.mjs';
import { result, line, passed } from './lib/report.mjs';

/**
 * Runs in the page.
 *
 * TWO FILTERS ON THE OVERFLOW LIST, both paid for:
 *
 *  1. `checkVisibility()`. A closed <details> hides its contents through
 *     `content-visibility`, which removes them from rendering and from the
 *     document's scroll extent but leaves getBoundingClientRect() returning their
 *     LAST LAID-OUT geometry. Without this filter every mobile menu on the site
 *     reports five phantom offenders at 390px while the document does not scroll
 *     at all — and a sweep nobody believes is a sweep nobody reads.
 *
 *  2. An ancestor that clips. A wide table or code block inside its own
 *     `overflow-x: auto` container is the correct way to handle wide content, not
 *     a defect. Only content that pushes the DOCUMENT is a defect.
 */
const PROBE = `(() => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.right <= vw + 0.5) continue;
    let clipped = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowX)) { clipped = true; break; }
    }
    if (!clipped) {
      const cls = String(el.className.baseVal ?? el.className).trim().split(/\\s+/)[0] || '';
      offenders.push(el.tagName.toLowerCase() + (cls ? '.' + cls : ''));
    }
  }
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const skips = [];
  let prev = 0;
  for (const h of headings) {
    const level = +h.tagName[1];
    if (prev && level > prev + 1) skips.push(prev + '->' + level);
    prev = level;
  }
  const imgs = [...document.querySelectorAll('img')];
  return JSON.stringify({
    overflow: de.scrollWidth > vw,
    scrollWidth: de.scrollWidth,
    viewport: vw,
    offenders: [...new Set(offenders)].slice(0, 5),
    h1: document.querySelectorAll('h1').length,
    headings: headings.length,
    skips,
    images: imgs.length,
    broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
    noDimensions: imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length,
    noAlt: imgs.filter((i) => i.getAttribute('alt') === null).length,
  });
})()`;

export async function sweep() {
  const page = await connect(9400, 'outredge-verify-sweep');
  await page.send('Page.enable');
  await page.send('Runtime.enable');

  let checks = 0;
  let failures = 0;
  const notes = [];

  try {
    for (const path of PAGES) {
      for (const width of WIDTHS) {
        await page.send('Emulation.setDeviceMetricsOverride', {
          width,
          height: 900,
          deviceScaleFactor: 1,
          mobile: width < 768,
        });
        await page.send('Page.navigate', { url: BASE + path });
        await page.sleep(520);
        /* Lazy images below the fold never load in a headless viewport, so they
           would report as "not complete" rather than as broken. Force them in
           before measuring, or the image half of this check verifies nothing. */
        await page.eval(
          `(async () => {
             for (const i of document.querySelectorAll('img[loading="lazy"]')) i.loading = 'eager';
             await new Promise((r) => setTimeout(r, 250));
           })()`,
          true,
        );
        const d = JSON.parse(await page.eval(PROBE));
        checks++;

        const problems = [];
        if (d.overflow) problems.push(`overflows (${d.scrollWidth} > ${d.viewport})`);
        if (d.offenders.length) problems.push(`unclipped: ${d.offenders.join(', ')}`);
        if (d.h1 !== 1) problems.push(`${d.h1} h1 elements`);
        if (d.skips.length) problems.push(`heading skips ${d.skips.join(', ')}`);
        if (d.broken) problems.push(`${d.broken} broken images`);
        if (d.noDimensions) problems.push(`${d.noDimensions} images without width/height`);
        if (d.noAlt) problems.push(`${d.noAlt} images without alt`);

        if (problems.length) {
          failures++;
          notes.push(`${path} @${width}px — ${problems.join('; ')}`);
        }
      }
    }
  } finally {
    page.close();
  }

  return result('overflow + structure', {
    checks,
    failures,
    unit: `page/width checks (${PAGES.length} pages × ${WIDTHS.length} widths)`,
    notes,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await sweep();
  console.log(line(r));
  for (const n of r.notes) console.log(`         ${n}`);
  process.exit(passed(r) ? 0 : 1);
}
