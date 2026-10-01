// §9 rendered checks: horizontal overflow, content that spills its own box,
// navigation surfaces that lead somewhere, exactly one h1, zero heading skips,
// and every image carrying dimensions and a non-null alt — at all seven widths,
// on every page.
//
// Run through `npm run verify`, or on its own against a running preview:
//   npm run build:styleguide && npm run preview &  →  node scripts/verify/sweep.mjs

import { connect, PAGES, WIDTHS, BASE } from './lib/cdp.mjs';
import { result, line, passed } from './lib/report.mjs';
import { isMain } from './lib/main.mjs';
import { assertServingDist } from './lib/served.mjs';

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
 *
 * CONTENT THAT SPILLS ITS OWN BOX — the second question, and the one the first
 * cannot ask. A word wider than its card does not scroll the page; it lies on
 * top of the card beside it, or is cut off by the card's own clip, while the
 * document stays exactly as wide as the viewport. So: every visible element
 * whose content is wider than its box (`scrollWidth > clientWidth`), deepest
 * offender only, excluding
 *   - an element that scrolls or clips its own overflow — that is handled;
 *   - an element that fails checkVisibility(), for the reason in 1 (and with
 *     visibility:hidden counted too — a closed panel keeps its geometry);
 *   - an element marked `data-bleed`, or one whose overflow comes from a
 *     `data-bleed` descendant. That is the one escape hatch, and it is written
 *     in the markup at the element that bleeds, where a reviewer sees it. A
 *     rail cancelling the gutter with a negative margin is deliberate and
 *     invisible to geometry; the author says so, the checker does not guess.
 * Transforms count: a rotated glyph does not move layout but does enlarge the
 * scrollable overflow area, and this is how the FAQ chevron was found.
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
  const spills = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.checkVisibility({ visibilityProperty: true })) continue;
    if (el.clientWidth === 0 || el.scrollWidth <= el.clientWidth) continue;
    if (/auto|scroll|hidden|clip/.test(getComputedStyle(el).overflowX)) continue;
    if (el.closest('[data-bleed]')) continue;
    const box = el.getBoundingClientRect();
    /* A bleed reaches this box either as the marked element's own box poking
       out of it (a negative margin) or as the marked element's OWN overflow (a
       transformed ::before inside a box that stays put). Testing only the first
       left the escape hatch broken: marking the bleed moved the report one
       level up instead of clearing it. */
    const bled = [...el.querySelectorAll('[data-bleed]')].some((b) => {
      const r = b.getBoundingClientRect();
      return r.left < box.left - 0.5 || r.right > box.right + 0.5 || b.scrollWidth > b.clientWidth;
    });
    if (!bled) spills.push(el);
  }
  const deepest = spills.filter((el) => !spills.some((o) => o !== el && el.contains(o)));
  const spilled = deepest.slice(0, 5).map((el) => {
    const cls = String(el.className.baseVal ?? el.className).trim().split(/\\s+/).slice(0, 2).join('.');
    const text = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 32);
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '') + ' +' + (el.scrollWidth - el.clientWidth) + 'px "' + text + '"';
  });

  /* A region that actually scrolls sideways at this width must show it: the
     scroll-shadow layers (background-attachment: local, global.css .scroll-x),
     or data-bleed where a cut-off edge is the affordance. Touch scrollbars fade
     to nothing, so otherwise a cell cut mid-value is all a reader sees. */
  const silent = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.checkVisibility({ visibilityProperty: true })) continue;
    const cs = getComputedStyle(el);
    if (!/auto|scroll/.test(cs.overflowX) || el.scrollWidth <= el.clientWidth + 1) continue;
    if (cs.backgroundAttachment.includes('local') || el.closest('[data-bleed]')) continue;
    const name = el.getAttribute('aria-label') || String(el.className.baseVal ?? el.className).trim().split(/\\s+/)[0] || '';
    silent.push(el.tagName.toLowerCase() + (name ? ' "' + name + '"' : '') + ' (' + el.scrollWidth + ' in ' + el.clientWidth + ')');
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
    spilled,
    silent: silent.slice(0, 5),
    h1: document.querySelectorAll('h1').length,
    headings: headings.length,
    skips,
    images: imgs.length,
    broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
    noDimensions: imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length,
    noAlt: imgs.filter((i) => i.getAttribute('alt') === null).length,
  });
})()`;

/**
 * Runs in the page, once per page: every NAVIGATION SURFACE has a way out.
 *
 * Every other assertion here is about links that exist; none was about a menu
 * having any. A project on this system gated its child pages behind a launch
 * flag, the mobile menu went to ZERO links, and it was valid HTML that passed
 * the sweep, axe and the link check — a menu with no way out of it. It had been
 * one link short for weeks before that: a column landing page was wired into
 * the desktop panel and not the mobile fold, because the two render the same
 * data through structurally different markup and nothing pairs them.
 *
 * So, from the DOM rather than the viewport (the surfaces swap at lg, and both
 * must be right whichever is showing):
 *   1. the mobile menu, each desktop panel and the footer nav each contain at
 *      least one link;
 *   2. the mobile menu and the desktop bar offer the SAME destinations. The logo
 *      is excluded: it is outside both surfaces and visible at every width.
 */
const NAV_PROBE = `(() => {
  const nav = document.querySelector('nav[aria-label="Main"]');
  if (!nav) return JSON.stringify({ problems: ['no nav[aria-label="Main"] on this page'], surfaces: 0 });
  const hrefs = (root) => [...root.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
  const problems = [];
  const mobile = nav.querySelector('details.nav-disclosure');
  const panels = [...nav.querySelectorAll('.nav-panel')];
  const footer = document.querySelector('nav[aria-label="Footer"]');
  const surfaces = [['mobile menu', mobile], ['footer nav', footer]].concat(panels.map((p) => ['desktop panel #' + p.id, p]));
  for (const [name, el] of surfaces) {
    if (!el) problems.push(name + ' is missing');
    else if (hrefs(el).length === 0) problems.push(name + ' contains no links');
  }
  const logo = nav.querySelector(':scope > a');
  const desktop = [...nav.querySelectorAll('a[href]')]
    .filter((a) => a !== logo && !(mobile && mobile.contains(a)))
    .map((a) => a.getAttribute('href'));
  const mobileSet = new Set(mobile ? hrefs(mobile) : []);
  const desktopSet = new Set(desktop);
  const onlyDesktop = [...desktopSet].filter((h) => !mobileSet.has(h));
  const onlyMobile = [...mobileSet].filter((h) => !desktopSet.has(h));
  if (onlyDesktop.length) problems.push('reachable on desktop, missing from the mobile menu: ' + onlyDesktop.join(', '));
  if (onlyMobile.length) problems.push('in the mobile menu, missing from the desktop bar: ' + onlyMobile.join(', '));
  return JSON.stringify({ problems, surfaces: surfaces.length, destinations: desktopSet.size });
})()`;

export async function sweep() {
  /* Before a single measurement, confirm this port is serving the build under
     test. A check whose counts are real but whose referent is somebody else's
     website has proven nothing — see lib/served.mjs. */
  await assertServingDist(BASE);

  const page = await connect(9400, 'outredge-verify-sweep');
  await page.send('Page.enable');
  await page.send('Runtime.enable');

  let checks = 0;
  let failures = 0;
  const notes = [];
  const navNotes = [];

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

        if (width === WIDTHS[0]) {
          const n = JSON.parse(await page.eval(NAV_PROBE));
          checks++;
          navNotes.push(`${path}: ${n.surfaces} navigation surface(s), ${n.destinations ?? 0} destination(s) on each viewport's menu`);
          if (n.problems.length) {
            failures++;
            notes.push(`${path} — navigation: ${n.problems.join('; ')}`);
          }
        }

        const problems = [];
        if (d.overflow) problems.push(`overflows (${d.scrollWidth} > ${d.viewport})`);
        if (d.offenders.length) problems.push(`unclipped: ${d.offenders.join(', ')}`);
        if (d.spilled.length) problems.push(`content spills its box: ${d.spilled.join(' | ')}`);
        if (d.silent.length) problems.push(`scrolls sideways with no visible sign of it: ${d.silent.join(' | ')}`);
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
    unit: `page/width checks (${PAGES.length} pages × ${WIDTHS.length} widths, + nav per page)`,
    notes: [...notes, ...navNotes],
  });
}

if (isMain(import.meta.url)) {
  const r = await sweep();
  console.log(line(r));
  for (const n of r.notes) console.log(`         ${n}`);
  process.exit(passed(r) ? 0 : 1);
}
