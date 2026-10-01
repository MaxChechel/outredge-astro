// §9's token contrast matrix, computed from the BUILT CSS in dist/.
//
// Every text token on every background token in every theme — 3 × 3 × 2 = 18
// pairs today — plus the accent group and the line group, each reported with its
// own count. Any pair below its threshold fails the run.
//
// From dist, not from source, and that distinction is the whole value: the build
// is where a token can silently disappear. This system has already lost a token
// between source and dist once (Lightning CSS deleting `linear()` from @theme);
// a check that reads global.css would have reported a clean pass over a stylesheet
// nobody shipped.
//
// THIS IS WHAT VALIDATES A REBRAND. Replace the primitive ramp with a client's
// values, run this, and it says by name whether the new brand is shippable.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseThemeScopes,
  textMatrix,
  accentMatrix,
  lineMatrix,
  declarationSites,
  AA,
} from './lib/contrast.mjs';
import { result, line, passed } from './lib/report.mjs';
import { isMain } from './lib/main.mjs';

const DIST = process.env.DIST ?? 'dist';

/** Every stylesheet the build emitted, concatenated. */
function builtCss() {
  const dir = join(DIST, '_astro');
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.css'));
  } catch {
    throw new Error(`verify: no ${dir}/ — run \`npm run build:styleguide\` first.`);
  }
  if (files.length === 0) {
    throw new Error(`verify: ${dir}/ contains no CSS. The build emitted no stylesheet.`);
  }
  return files.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
}

export function contrast() {
  const css = builtCss();
  const scopes = parseThemeScopes(css);

  const groups = [
    { label: 'text × background', rows: textMatrix(scopes) },
    { label: 'accent', rows: accentMatrix(scopes) },
    { label: 'line', rows: lineMatrix(scopes) },
  ];

  let checks = 0;
  let failures = 0;
  const notes = [];

  for (const g of groups) {
    const bad = g.rows.filter((r) => !r.pass);
    checks += g.rows.length;
    failures += bad.length;
    const floor = Math.min(...g.rows.filter((r) => r.threshold !== null).map((r) => r.ratio));
    notes.push(
      `${g.label}: ${g.rows.length} pairs, ${bad.length} below threshold` +
        (Number.isFinite(floor) ? `, floor ${floor.toFixed(2)}:1` : ''),
    );
    for (const r of bad) {
      notes.push(
        `    ${r.theme} ${r.text} on ${r.bg} = ${r.ratio.toFixed(2)}:1 ` +
          `(needs ${r.threshold}:1) — ${r.textHex} on ${r.bgHex}`,
      );
    }
  }

  /* Declaration sites: whether each token RESOLVES where the matrix assumes it
     does. Reported as its own group, with its own count, because a pair can
     clear 4.5:1 in the matrix and still never reach the page. */
  const sites = declarationSites(css);
  const siteFailures = sites.filter((r) => !r.pass);
  const derived = new Set(sites.filter((r) => r.kind === 'restated').map((r) => r.token));
  checks += sites.length;
  failures += siteFailures.length;
  notes.push(
    `declaration sites: ${sites.length} assertions, ${siteFailures.length} failing — ` +
      `${derived.size} :root token(s) derived from a themed token, each restated per theme; ` +
      'every themed token declared at :root',
  );
  for (const r of siteFailures) notes.push(`    ${r.message}`);
  if (!derived.size) {
    /* The derived-token population is what this group exists for. If it drops
       to zero the parser has stopped seeing :root, and every row above passes
       over nothing. */
    failures++;
    notes.push('    found no :root token derived from a themed token — the :root parser is not seeing the root');
  }

  /* A matrix that shrank is a matrix that stopped checking something. The core
     text group is fixed by §2.3 at three texts × three backgrounds × two themes;
     if a token is renamed out from under this check, resolveColor() throws — but
     if one is DELETED from the constants, nothing would. So assert the shape. */
  const core = groups[0].rows.length;
  if (core !== 18) {
    failures++;
    notes.push(`    core matrix is ${core} pairs, not 18 — a token was added or removed without a ruling`);
  }

  return result('contrast matrix', {
    checks,
    failures,
    unit: `assertions (pairs at ${AA}:1 or 3:1, declaration sites)`,
    notes,
  });
}

if (isMain(import.meta.url)) {
  const r = contrast();
  console.log(line(r));
  for (const n of r.notes) console.log(`         ${n}`);
  process.exit(passed(r) ? 0 : 1);
}
