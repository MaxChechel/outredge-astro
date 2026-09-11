// axe-core over every page at a narrow and a wide width, with the tag set §9
// names: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa and best-practice.
//
// axe-core is a devDependency here, deliberately, and that is a departure from
// the reference build, which kept it out of package.json as "a one-off audit
// tool". §9 runs it every phase, so it is not one-off — and a harness whose
// a11y check needs a manual `npm pack` dance first is a check that gets skipped
// exactly when it matters. devDependencies do not ship.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { connect, PAGES, BASE } from './lib/cdp.mjs';
import { result, line, passed } from './lib/report.mjs';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
/** Narrow and wide: the two layouts. The seven-width sweep is sweep.mjs's job. */
const WIDTHS = [390, 1440];

export async function axe() {
  const page = await connect(9401, 'outredge-verify-axe');
  await page.send('Page.enable');
  await page.send('Runtime.enable');

  let checks = 0;
  let failures = 0;
  const notes = [];

  try {
    for (const width of WIDTHS) {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
      for (const path of PAGES) {
        await page.send('Page.navigate', { url: BASE + path });
        await page.sleep(650);
        await page.eval(AXE);
        const violations = JSON.parse(
          await page.eval(
            `axe.run(document, { runOnly: { type: 'tag', values: ${JSON.stringify(TAGS)} } })
               .then((r) => JSON.stringify(r.violations.map((v) => ({
                 id: v.id, impact: v.impact, n: v.nodes.length, help: v.help,
                 sample: v.nodes[0] && v.nodes[0].html.slice(0, 140),
               }))))`,
            true,
          ),
        );
        checks++;
        for (const v of violations) {
          failures++;
          notes.push(`${path} @${width}px — ${v.id} (${v.impact}, ${v.n} node${v.n === 1 ? '' : 's'}): ${v.help}`);
          notes.push(`    ${v.sample}`);
        }
      }
    }
  } finally {
    page.close();
  }

  return result('axe-core', {
    checks,
    failures,
    unit: `page/width runs (${TAGS.length} tag sets)`,
    notes,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await axe();
  console.log(line(r));
  for (const n of r.notes) console.log(`         ${n}`);
  process.exit(passed(r) ? 0 : 1);
}
