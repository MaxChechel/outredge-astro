// §6/§9's JavaScript census. Zero JS in dist/ is the default state, MEASURED,
// not assumed — and every byte that is there has to be named.
//
// "Named" is enforced, not documented: each expected module below carries a
// signature that must match the code found, a reason it exists, and a gzipped
// budget. A script nothing matches fails the run, and so does one that outgrew
// its budget. That is what stops a 543-byte module becoming a 40 KB one over six
// commits without anyone noticing.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { result, line, passed, bytes } from './lib/report.mjs';
import { isMain } from './lib/main.mjs';

const DIST = process.env.DIST ?? 'dist';

/**
 * PROJECT: every module a project adds is declared here, with a reason, before
 * it ships. That is the point of friction — §6 says every script is a ruling,
 * not a habit, and this is where the ruling gets written down.
 */
const EXPECTED = [
  {
    id: 'nav disclosure',
    signature: /data-disclosure/,
    why: 'ARCHITECTURE §4.3 — dropdown panels must be a keyboard-operable disclosure, which CSS alone cannot do (Escape must return focus).',
    maxGzip: 700,
  },
  {
    id: 'contact form enable',
    signature: /data-contact-form/,
    why: 'ARCHITECTURE §8 — the form ships disabled so an unverified endpoint cannot silently swallow an enquiry, and started_at must be stamped in the browser rather than baked into cached HTML.',
    maxGzip: 500,
  },
  {
    id: 'clip playback',
    signature: /data-clip/,
    why: 'ARCHITECTURE §7 — attaches the MP4 only near the viewport, and honours prefers-reduced-motion. Not on any page in this repo; ships when a project adds media.',
    maxGzip: 900,
  },
];

/** Script types that are data, not code, and do not count against the budget. */
const DATA_TYPES = ['application/ld+json'];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

export function jsCensus() {
  let files;
  try {
    files = walk(DIST);
  } catch {
    throw new Error(`verify: no ${DIST}/ — run \`npm run build:styleguide\` first.`);
  }

  const found = [];

  // 1. Standalone .js files.
  for (const f of files.filter((f) => f.endsWith('.js'))) {
    const code = readFileSync(f, 'utf8');
    found.push({ where: relative(DIST, f), kind: 'file', code });
  }

  // 2. Inline modules in HTML. Astro inlines small scripts rather than emitting
  //    a file, so counting only .js files would report zero while shipping code.
  for (const f of files.filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(f, 'utf8');
    for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      const attrs = m[1];
      const type = /type="([^"]*)"/.exec(attrs)?.[1] ?? '';
      if (DATA_TYPES.includes(type)) continue;
      const src = /src="([^"]*)"/.exec(attrs)?.[1];
      if (src) {
        found.push({ where: `${relative(DIST, f)} → ${src}`, kind: 'ref', code: '' });
        continue;
      }
      if (m[2].trim() === '') continue;
      found.push({ where: relative(DIST, f), kind: 'inline', code: m[2] });
    }
  }

  let failures = 0;
  const notes = [];
  let totalGzip = 0;

  for (const s of found) {
    const raw = Buffer.byteLength(s.code);
    const gzip = raw ? gzipSync(s.code, { level: 9 }).length : 0;
    totalGzip += gzip;

    if (s.kind === 'ref') {
      /* A <script src> pointing at a file already counted above is fine; one
         pointing off-site is a dependency nobody declared. */
      if (/^https?:/.test(s.where.split('→ ')[1] ?? '')) {
        failures++;
        notes.push(`UNDECLARED external script: ${s.where}`);
      }
      continue;
    }

    const match = EXPECTED.find((e) => e.signature.test(s.code));
    if (!match) {
      failures++;
      notes.push(`UNNAMED script in ${s.where} — ${bytes(raw)} raw, ${bytes(gzip)} gzipped`);
      notes.push(`    ${s.code.trim().slice(0, 120).replace(/\s+/g, ' ')}…`);
      notes.push('    Every byte of JavaScript is a ruling (§6). Declare it in EXPECTED with a reason, or delete it.');
      continue;
    }
    if (gzip > match.maxGzip) {
      failures++;
      notes.push(`OVER BUDGET: ${match.id} in ${s.where} — ${bytes(gzip)} gzipped, budget ${bytes(match.maxGzip)}`);
      continue;
    }
    notes.push(`${match.id} — ${s.where} (${s.kind}) — ${bytes(raw)} raw, ${bytes(gzip)} gzipped / ${bytes(match.maxGzip)} budget`);
    notes.push(`    ${match.why}`);
  }

  const unused = EXPECTED.filter((e) => !found.some((s) => e.signature.test(s.code)));
  for (const e of unused) notes.push(`${e.id} — declared, on no page in this build. ${e.why}`);

  notes.push(`total shipped JavaScript: ${bytes(totalGzip)} gzipped across ${found.filter((s) => s.kind !== 'ref').length} script(s)`);

  /* The census always runs at least one check — "did we walk dist" — so that a
     genuinely zero-JS build reports a pass rather than an EMPTY. */
  return result('JS census', {
    checks: found.length + 1,
    failures,
    unit: 'scripts found in dist (+1 walk)',
    notes,
  });
}

if (isMain(import.meta.url)) {
  const r = jsCensus();
  console.log(line(r));
  for (const n of r.notes) console.log(`         ${n}`);
  process.exit(passed(r) ? 0 : 1);
}
