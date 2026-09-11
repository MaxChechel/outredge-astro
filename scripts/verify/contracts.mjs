// Contract assertions against the BUILT OUTPUT (§9).
//
// This file exists for rules the compiler cannot enforce. The system's recurring
// move is convention → compile error where possible, convention → assertion where
// not; "documented" is the weakest of the three and is never the resting place.
// Everything here was a paragraph in ARCHITECTURE.md that something had already
// violated while the paragraph sat there being correct.
//
// Each contract states the rule, what would break it, and how it is checked, so a
// failure here reads as a design violation rather than as a broken test.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { result, line, passed } from './lib/report.mjs';

const DIST = process.env.DIST ?? 'dist';

const read = (file) => {
  const path = join(DIST, file);
  if (!existsSync(path)) throw new Error(`verify: ${path} is missing — run \`npm run build:styleguide\` first.`);
  return readFileSync(path, 'utf8');
};

/**
 * §8 — A FORM WITH NO CONFIGURED ENDPOINT SHIPS DISABLED.
 *
 * Paid for. `src/scripts/contact.ts` lifted `disabled` unconditionally, so an
 * unconfigured build rendered "this form is not live yet" directly above a
 * working-looking submit button: the two halves of the page disagreeing, with the
 * misleading half being the interactive one. A screenshot found it; nothing
 * asserted it. This is that assertion.
 *
 * The check is on the BUILT HTML, not on the source, because the rule is about
 * what a visitor receives. `data-contact-ready` present means a Turnstile site key
 * exists, so the module is allowed to enable the form; absent means every control
 * must carry `disabled` and the module must refuse.
 */
/**
 * Is this tag carrying the `disabled` ATTRIBUTE?
 *
 * Not `/\bdisabled\b/` on the raw tag — and that naive version is why this
 * function exists. Every button in this system carries Tailwind's
 * `disabled:pointer-events-none disabled:opacity-40` in its class list, and
 * `disabled` followed by `:` is a word boundary, so the naive test returned true
 * for every button whether or not it was disabled. The contract passed its own
 * fault injection for the wrong reason, which is the exact failure the
 * demonstrate-your-failure-mode rule (§9) exists to surface.
 *
 * Blanking quoted attribute VALUES first leaves only attribute names to match.
 */
const hasDisabledAttribute = (tag) => {
  const namesOnly = tag.replace(/=\s*"[^"]*"/g, '=""').replace(/=\s*'[^']*'/g, "=''");
  return /\sdisabled(\s|=|\/?>)/.test(namesOnly);
};

function formShipsDisabled() {
  const notes = [];
  let checks = 0;
  let failures = 0;

  const pages = readdirSync(DIST).filter((f) => f.endsWith('.html'));
  for (const file of pages) {
    const html = read(file);
    const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map((m) => m[0]);
    for (const form of forms) {
      if (!/data-contact-form/.test(form)) continue;
      checks++;

      const ready = /data-contact-ready/.test(form);
      const submits = [...form.matchAll(/<(button|input)\b[^>]*type=["']submit["'][^>]*>/g)].map((m) => m[0]);
      const controls = [...form.matchAll(/<(input|textarea|select|button)\b[^>]*>/g)]
        .map((m) => m[0])
        // The honeypot is deliberately not disabled: a bot must be able to fill it.
        .filter((c) => !/company_website/.test(c))
        .filter((c) => !/type=["']hidden["']/.test(c));

      if (ready) {
        notes.push(`${file}: contact form is configured (data-contact-ready) — enable path allowed`);
        continue;
      }

      const enabledSubmits = submits.filter((c) => !hasDisabledAttribute(c));
      const enabledControls = controls.filter((c) => !hasDisabledAttribute(c));

      if (submits.length === 0) {
        failures++;
        notes.push(`${file}: contact form has no submit control — cannot verify the ships-disabled rule`);
      } else if (enabledSubmits.length) {
        failures++;
        notes.push(
          `${file}: SUBMIT CONTROL IS ENABLED on a build with no configured endpoint (§8). ` +
            `An unverified endpoint must not be reachable.`,
        );
        notes.push(`    ${enabledSubmits[0].slice(0, 140)}`);
      } else if (enabledControls.length) {
        failures++;
        notes.push(`${file}: ${enabledControls.length} form control(s) enabled with no configured endpoint (§8)`);
        notes.push(`    ${enabledControls[0].slice(0, 140)}`);
      } else {
        notes.push(`${file}: contact form ships disabled — ${controls.length} controls, no endpoint configured`);
      }
    }
  }

  if (checks === 0) notes.push('no [data-contact-form] in this build — nothing to assert');
  return { checks, failures, notes };
}

/**
 * §2.4 / §10 — A PRODUCTION BUILD EMITS NO STYLEGUIDE ROUTE.
 *
 * The gate is an injected route rather than a `noindex`, because `noindex` is a
 * request and not existing is a fact. But "the integration does the right thing"
 * is exactly the kind of claim that stays true until someone edits the config, so
 * it gets asserted: run a real production build into a scratch directory and look.
 *
 * A leaked styleguide on a client site publishes that client's token values,
 * component inventory and internal notes to anyone who guesses the URL.
 */
function productionOmitsStyleguide() {
  const notes = [];
  const out = '.verify/production';
  const build = spawnSync('npx', ['astro', 'build', '--outDir', out], {
    encoding: 'utf8',
    env: { ...process.env, INCLUDE_STYLEGUIDE: '' },
  });
  if (build.status !== 0) {
    return { checks: 1, failures: 1, notes: ['production build failed', (build.stderr || build.stdout).slice(-800)] };
  }

  const leaked = readdirSync(out).filter((f) => /styleguide/i.test(f));
  if (leaked.length) {
    return {
      checks: 1,
      failures: 1,
      notes: [`PRODUCTION BUILD EMITTED THE STYLEGUIDE: ${leaked.join(', ')} (§2.4/§10)`],
    };
  }
  notes.push(`production build emits ${readdirSync(out).filter((f) => f.endsWith('.html')).length} page(s), none of them the styleguide`);
  return { checks: 1, failures: 0, notes };
}

const CONTRACTS = [
  ['form ships disabled (§8)', formShipsDisabled],
  ['production omits styleguide (§2.4)', productionOmitsStyleguide],
];

export function contracts() {
  let checks = 0;
  let failures = 0;
  const notes = [];

  for (const [label, fn] of CONTRACTS) {
    const r = fn();
    checks += r.checks;
    failures += r.failures;
    notes.push(`${label}: ${r.checks} assertion(s), ${r.failures} failure(s)`);
    for (const n of r.notes) notes.push(`    ${n}`);
  }

  return result('build contracts', {
    checks,
    failures,
    unit: 'contract assertions',
    notes,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = contracts();
  console.log(line(r));
  for (const n of r.notes) console.log(`         ${n}`);
  process.exit(passed(r) ? 0 : 1);
}
