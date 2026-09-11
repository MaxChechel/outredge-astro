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
  const scopes = parseThemeScopes(builtCss());

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
    unit: `token pairs at ${AA}:1 (and 3:1 for control boundaries)`,
    notes,
  });
}

if (isMain(import.meta.url)) {
  const r = contrast();
  console.log(line(r));
  for (const n of r.notes) console.log(`         ${n}`);
  process.exit(passed(r) ? 0 : 1);
}
