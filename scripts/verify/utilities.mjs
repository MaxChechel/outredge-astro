// DEAD-CLASS CHECK — the generalisation of the `duration-base` bug.
//
// For three months this codebase shipped nine `duration-base` classes that
// styled nothing. `--duration-base` emitted as a variable, `var(--duration-base)`
// worked inside global.css, and no `duration-base` UTILITY was ever generated,
// because the namespace Tailwind actually reads is `--transition-duration-*`.
// Nothing errored. Nothing looked wrong. The transitions just ran at Tailwind's
// default duration instead of ours.
//
// A token namespace is a fact about Tailwind, not a naming preference, and the
// only way to know a fact is to check it. This check asks the one question that
// generalises past durations:
//
//     Does every class that reaches the browser have a rule behind it?
//
// It reads the BUILT HTML rather than the source — not what we meant to ship,
// what we shipped — and matches each class against the BUILT CSS. That makes it
// immune to how a class was assembled, which source-scanning would not be, and
// it catches the whole family at once: a wrong namespace, a typo, a utility
// killed by a `--*: initial` reset, a class left behind by a refactor.
//
// Anything legitimately unstyled is declared below with a reason. Same contract
// as the JS census: the exceptions are an enumerated list, not a shrug.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { result, line, passed } from './lib/report.mjs';
import { isMain } from './lib/main.mjs';

const DIST = process.env.DIST ?? 'dist';

/**
 * Classes that reach the browser with no CSS rule of their own, on purpose.
 * Every entry needs a reason; "it looked fine" is not one.
 */
const UNSTYLED_BY_DESIGN = [
  { match: /^group$/, why: 'Tailwind variant marker — `group-hover:` styles descendants; the marker itself has no rule.' },
  { match: /^peer$/, why: 'Tailwind variant marker, as above.' },
  { match: /^cf-turnstile$/, why: 'Cloudflare Turnstile mount point; the widget script styles it (§8).' },
  { match: /^(js|no-js)$/, why: 'State flag on <html>; selectors key off it (see the reveal contract in global.css §8), it carries nothing itself.' },
  { match: /^data-reveal$/, why: 'Reveal hook; the attribute form is what CSS targets.' },
];

/** Characters Tailwind escapes in a generated selector. */
const escapeClass = (name) => name.replace(/[.:/[\]()!#%,'"*+>~=$^|?{}\\@&]/g, (c) => `\\${c}`);

/** A selector boundary — what may legally follow a class name in a selector. */
const BOUNDARY = new Set(['{', ',', ':', ' ', '>', '+', '~', '.', '[', ')', '\n', '\r', '\t']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Is `name` present as a class selector anywhere in `css`? */
function hasRule(css, name) {
  const needle = `.${escapeClass(name)}`;
  let from = 0;
  for (;;) {
    const at = css.indexOf(needle, from);
    if (at === -1) return false;
    const after = css[at + needle.length];
    // `.text-h1` must not match inside `.text-h10`; the next character has to
    // end the class name rather than continue it.
    if (after === undefined || BOUNDARY.has(after)) return true;
    from = at + 1;
  }
}

export function utilities() {
  let files;
  try {
    files = walk(DIST);
  } catch {
    throw new Error(`verify: no ${DIST}/ — run \`npm run build\` first.`);
  }

  /* BOTH sources, and the second one is not optional: Astro emits a page's
     scoped `<style>` into the HTML rather than into a stylesheet when it is small
     enough. Reading only *.css would report every scoped class in this repo —
     the whole styleguide chrome — as dead, which is the check crying wolf on its
     first run and being switched off by its second. */
  const stylesheets = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(f, 'utf8'));
  const inline = [];
  for (const file of files.filter((f) => f.endsWith('.html'))) {
    for (const m of readFileSync(file, 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      inline.push(m[1]);
    }
  }
  const css = [...stylesheets, ...inline].join('\n');
  if (!css.trim()) throw new Error(`verify: ${DIST}/ contains no CSS to check classes against.`);

  /** class name -> the pages it appears on. */
  const used = new Map();
  for (const file of files.filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/\sclass="([^"]*)"/g)) {
      for (const name of m[1].split(/\s+/).filter(Boolean)) {
        if (!used.has(name)) used.set(name, new Set());
        used.get(name).add(relative(DIST, file));
      }
    }
  }

  let failures = 0;
  const notes = [];
  const declared = [];

  for (const [name, pages] of [...used].sort()) {
    if (hasRule(css, name)) continue;
    const exception = UNSTYLED_BY_DESIGN.find((e) => e.match.test(name));
    if (exception) {
      declared.push(name);
      continue;
    }
    failures++;
    const where = [...pages].slice(0, 3).join(', ');
    notes.push(
      `DEAD CLASS "${name}" — in the markup on ${pages.size} page(s) (${where}), no rule in any stylesheet.`,
    );
    notes.push('    It styles nothing. Either the utility never generated (check the token namespace against Tailwind, not against memory), or the class is a leftover.');
  }

  notes.push(`${used.size} distinct classes reach the browser; all resolve to a rule.`);
  if (declared.length) {
    notes.push(`${declared.length} declared unstyled by design: ${declared.sort().join(', ')}`);
  }

  return result('dead classes', {
    checks: used.size,
    failures,
    unit: 'distinct classes in built HTML',
    notes,
  });
}

if (isMain(import.meta.url)) {
  const r = utilities();
  console.log(line(r));
  for (const n of r.notes) console.log(`         ${n}`);
  process.exit(passed(r) ? 0 : 1);
}
