#!/usr/bin/env node
// `npm run lighthouse` — the phase-gate audit (§9).
//
// DELIBERATELY NOT PART OF `npm run verify`. Verify's contract is fast, hermetic
// and deterministic: it runs on every commit and must never be doubted. Lighthouse
// is an environmental audit — it measures a machine as much as a build, and its
// numbers move with CPU contention — so putting it inside verify would teach
// people to tolerate flakiness in the one command that must not flake.
//
// But it is not performed by hand either. A gate number nobody can reproduce is a
// number nobody should record, so this script pins the versions, serves the build
// through `wrangler pages dev` — which is what makes `_headers`, `_redirects` and
// the Pages Functions REAL rather than approximated by a static server — and
// prints the four scores per page.
//
//   verify     → every commit
//   lighthouse → every phase gate
//
// Both CLIs are fetched by pinned `npx --yes` rather than installed: they are
// gate-only, they are large, and every project copied from this template would
// otherwise pay for them on `npm install`. The pin is what makes the run
// reproducible; being in node_modules is not.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { ok, bad, dim } from './lib/report.mjs';

const WRANGLER = 'wrangler@4';
const LIGHTHOUSE = 'lighthouse@12';
const PORT = Number(process.env.PORT ?? 8788);
const BASE = `http://localhost:${PORT}`;
const OUT = '.verify/lighthouse';
/**
 * PROJECT: the homepage and the heaviest page, per §9.
 *
 * `categories` is per page for one reason: the styleguide is deliberately
 * `noindex`, so Lighthouse's `is-crawlable` audit fails it by design and caps its
 * SEO score forever. Auditing SEO there measures the gate rather than the page,
 * and a permanently-red number is a number people learn to scroll past — the same
 * failure mode as flakiness inside `verify`. Performance, a11y and best-practices
 * are all still measured, and they are what the dense page is here to stress.
 */
const ALL = ['performance', 'accessibility', 'best-practices', 'seo'];
const PAGES = [
  { path: '/', categories: ALL },
  { path: '/styleguide', categories: ALL.filter((c) => c !== 'seo'), why: 'noindex by design' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await sleep(400);
  }
  return false;
}

console.log(dim('\nlighthouse — §9 phase gate\n'));

// The styleguide is the heaviest page in the repo, so the gate audits the build
// that contains it. Production does not ship it; that is contracts.mjs's job.
console.log(dim('  building (styleguide route on)…'));
const build = spawnSync('npx', ['astro', 'build'], {
  encoding: 'utf8',
  env: { ...process.env, INCLUDE_STYLEGUIDE: '1' },
});
if (build.status !== 0) {
  console.log(bad('  build failed:\n') + (build.stderr || build.stdout));
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

console.log(dim(`  starting ${WRANGLER} pages dev on ${PORT}…`));
const server = spawn(
  'npx',
  ['--yes', WRANGLER, 'pages', 'dev', 'dist', '--port', String(PORT), '--ip', '127.0.0.1'],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);
let serverErr = '';
server.stderr.on('data', (d) => (serverErr += d));

let failures = 0;
const rows = [];

try {
  if (!(await waitFor(BASE))) {
    console.log(bad(`  wrangler never came up on ${BASE}`));
    console.log(dim(serverErr.slice(-1200)));
    process.exit(1);
  }

  for (const { path, categories, why } of PAGES) {
    const slug = path === '/' ? 'home' : path.replace(/\W+/g, '-').replace(/^-|-$/g, '');
    const report = `${OUT}/${slug}.json`;
    console.log(dim(`  auditing ${path} (mobile)…`));

    const run = spawnSync(
      'npx',
      [
        '--yes',
        LIGHTHOUSE,
        BASE + path,
        // Mobile is the default preset and the one §9 names. Stated, not assumed.
        '--form-factor=mobile',
        '--screenEmulation.mobile',
        `--only-categories=${categories.join(',')}`,
        '--output=json',
        `--output-path=${report}`,
        '--quiet',
        '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
      ],
      { encoding: 'utf8' },
    );

    if (run.status !== 0) {
      failures++;
      rows.push({ path, error: (run.stderr || run.stdout || 'lighthouse failed').trim().slice(-400) });
      continue;
    }

    const json = JSON.parse(readFileSync(report, 'utf8'));
    const scores = Object.fromEntries(
      categories.map((id) => [id, Math.round((json.categories[id]?.score ?? 0) * 100)]),
    );
    /* Opportunities worth naming when a score is not 100, so the number comes
       with its reason rather than needing the JSON opened by hand. */
    const notes = Object.values(json.audits ?? {})
      .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode !== 'informative')
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .slice(0, 4)
      .map((a) => `${a.id} (${Math.round((a.score ?? 0) * 100)})`);
    rows.push({ path, scores, notes, report, skipped: ALL.filter((c) => !categories.includes(c)), why });
    if (Object.values(scores).some((s) => s < 100)) failures++;
  }
} finally {
  server.kill();
}

console.log('');
for (const r of rows) {
  if (r.error) {
    console.log(`  ${bad('ERROR')} ${r.path}\n         ${r.error}`);
    continue;
  }
  const values = Object.values(r.scores);
  const perfect = values.every((n) => n === 100);
  const cells = Object.entries(r.scores)
    .map(([id, n]) => `${id} ${String(n).padStart(3)}`)
    .join('  ');
  console.log(`  ${perfect ? ok('100s ') : bad('BELOW')} ${r.path.padEnd(14)} ${cells}`);
  if (r.skipped?.length) console.log(dim(`         not audited: ${r.skipped.join(', ')} — ${r.why}`));
  if (r.notes.length) console.log(dim(`         ${r.notes.join(', ')}`));
  console.log(dim(`         ${r.report}`));
}

console.log('');
console.log(dim(`  ${rows.length} page(s) audited, mobile, behind ${WRANGLER} pages dev`));
console.log(
  dim('  These numbers are PRE-CDN and measured on a developer machine. Record them\n' +
      '  as a gate reading, not as the production figure — the production figure is\n' +
      '  measured against the real host after deploy.'),
);
console.log(failures === 0 ? ok('\n  100/100/100/100\n') : bad(`\n  ${failures} page(s) below the bar\n`));
process.exit(failures === 0 ? 0 : 1);
