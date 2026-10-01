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
import { ensureBuild } from './lib/builds.mjs';

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
    id: 'select enter-to-open',
    signature: /showPicker/,
    why: 'ARCHITECTURE §6/§4.1 — a focused <select> opens on Space and the arrows but NOT on Enter, on any platform. Measured here: Enter on a select inside a form does nothing at all. One delegated listener restores the key people expect, on a native control, instead of rebuilding the select as a div with role="combobox".',
    maxGzip: 400,
  },
  {
    id: 'clip playback',
    signature: /data-clip/,
    why: 'ARCHITECTURE §7 — attaches the MP4 only near the viewport, and honours prefers-reduced-motion. Not on any page in this repo; ships when a project adds media.',
    maxGzip: 900,
  },
];

/**
 * Scripts served by SOMEBODY ELSE, each declared with its reason. An external
 * `<script src>` that is not listed here fails the run, exactly as an unnamed
 * local script does — the rule is the same; only the list was missing, and
 * without it the first legitimate third-party tag would have forced someone to
 * weaken the check to ship it.
 *
 * NO BYTE BUDGET, on purpose. The payload is served from another origin and can
 * change without this repo changing, so a number here would assert a
 * measurement the harness cannot take. Matched on the exact URL: a different
 * version, path or host is a different script and needs its own ruling.
 *
 * External scripts are usually switched on by configuration, so they are looked
 * for in every build that ships, including `configured` (lib/builds.mjs), not
 * only in dist/.
 *
 * PROJECT: declare here, in the same change that admits the origin in
 * `_headers` and adds it to THIRD_PARTY in contracts.mjs.
 */
const EXTERNAL = [
  {
    id: 'Cloudflare Turnstile',
    src: 'https://challenges.cloudflare.com/turnstile/v0/api.js',
    why: 'ARCHITECTURE §8 — bot challenge on the contact form, server-verified by the Pages Function. Contact page only, and only once PUBLIC_TURNSTILE_SITE_KEY is set.',
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
  /* dist/ is counted per instance, as it always was. The other builds add only
     code dist/ does not already contain — the same module in a second build is
     not a second script. */
  const seenCode = new Set();

  const collect = (dir, label, dirFiles) => {
    const where = (f) => (label ? `${label}: ` : '') + relative(dir, f);
    // 1. Standalone .js files.
    for (const f of dirFiles.filter((f) => f.endsWith('.js'))) {
      const code = readFileSync(f, 'utf8');
      if (label && seenCode.has(code)) continue;
      seenCode.add(code);
      found.push({ where: where(f), kind: 'file', code });
    }

    // 2. Inline modules in HTML. Astro inlines small scripts rather than emitting
    //    a file, so counting only .js files would report zero while shipping code.
    for (const f of dirFiles.filter((f) => f.endsWith('.html'))) {
      const html = readFileSync(f, 'utf8');
      for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
        const attrs = m[1];
        const type = /type="([^"]*)"/.exec(attrs)?.[1] ?? '';
        if (DATA_TYPES.includes(type)) continue;
        const src = /src="([^"]*)"/.exec(attrs)?.[1];
        if (src) {
          if (!label) found.push({ where: `${where(f)} → ${src}`, kind: 'ref', code: '' });
          continue;
        }
        if (m[2].trim() === '' || (label && seenCode.has(m[2]))) continue;
        seenCode.add(m[2]);
        found.push({ where: where(f), kind: 'inline', code: m[2] });
      }
    }
  };

  /* dist/ first, then anything that only the production-shaped builds ship: a
     script switched on by configuration is still a script, and a census of
     dist/ alone never sees it (lib/builds.mjs). */
  collect(DIST, '', files);
  const shipped = ['production', 'configured'].map(ensureBuild);
  for (const b of shipped.filter((b) => b.ok)) collect(b.dir, b.name, walk(b.dir));

  let failures = 0;
  const notes = [];
  let totalGzip = 0;

  for (const s of found) {
    const raw = Buffer.byteLength(s.code);
    const gzip = raw ? gzipSync(s.code, { level: 9 }).length : 0;
    totalGzip += gzip;

    if (s.kind === 'ref') {
      /* A <script src> pointing at a file already counted above is fine; one
         pointing off-site is checked against EXTERNAL below, across every build
         that ships. */
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

  /* External scripts, in dist/ and in both production-shaped builds. Not
     deduplicated like the code above: one URL is one ruling, but every place it
     loads is reported. */
  const externals = new Map();
  const scanExternals = (dir, label) => {
    for (const f of walk(dir).filter((f) => f.endsWith('.html'))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/<script\b[^>]*\ssrc="(https?:[^"]+|\/\/[^"]+)"/g)) {
        const where = `${label}: ${relative(dir, f)}`;
        if (!externals.has(m[1])) externals.set(m[1], []);
        externals.get(m[1]).push(where);
      }
    }
  };
  scanExternals(DIST, 'dist');
  for (const b of shipped) {
    if (!b.ok) {
      failures++;
      notes.push(`${b.name} build failed — cannot census it. ${b.log}`);
      continue;
    }
    scanExternals(b.dir, b.name);
  }
  for (const e of EXTERNAL.filter((e) => !e.why || !e.why.trim())) {
    failures++;
    notes.push(`EXTERNAL entry "${e.id}" has no reason. A declaration without a ruling is not a declaration (§6).`);
  }
  for (const [src, where] of externals) {
    const match = EXTERNAL.find((e) => e.src === src);
    if (!match) {
      failures++;
      notes.push(`UNDECLARED external script ${src} — in ${where.slice(0, 3).join(', ')}`);
      notes.push('    Third-party code is a ruling too (§6). Declare it in EXTERNAL with a reason, or remove it.');
      continue;
    }
    notes.push(`${match.id} — external, ${src} — in ${where.slice(0, 3).join(', ')}`);
    notes.push(`    ${match.why}`);
  }
  for (const e of EXTERNAL.filter((e) => !externals.has(e.src))) {
    notes.push(`${e.id} — external, declared, in no build. ${e.why}`);
  }

  const unused = EXPECTED.filter((e) => !found.some((s) => e.signature.test(s.code)));
  for (const e of unused) notes.push(`${e.id} — declared, on no page in this build. ${e.why}`);

  notes.push(`total shipped JavaScript: ${bytes(totalGzip)} gzipped across ${found.filter((s) => s.kind !== 'ref').length} script(s)`);

  /* The census always runs at least one check — "did we walk dist" — so that a
     genuinely zero-JS build reports a pass rather than an EMPTY. */
  return result('JS census', {
    checks: found.length + externals.size + 1,
    failures,
    unit: 'scripts found (+1 walk)',
    notes,
  });
}

if (isMain(import.meta.url)) {
  const r = jsCensus();
  console.log(line(r));
  for (const n of r.notes) console.log(`         ${n}`);
  process.exit(passed(r) ? 0 : 1);
}
