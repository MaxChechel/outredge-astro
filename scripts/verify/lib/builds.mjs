// The builds the static contracts read, built once per run.
//
// `npm run verify` builds dist/ WITH the styleguide route, because that is the
// page that exercises every component. But a visitor never receives that build,
// so the rules about what ships — links that resolve, a CSP that matches the
// site, no comments, no undeclared third-party code — are asserted against the
// builds that DO ship:
//
//   production  the site as deployed with no third-party features configured;
//   configured  the same, with every env-gated feature switched on.
//
// Two, because a feature gated on an env var is invisible to a build without it.
// The contact page loads Turnstile only once PUBLIC_TURNSTILE_SITE_KEY is set, so
// a CSP or census checked only against the unconfigured build cannot see the one
// external script this system ships — and the deploy that sets the key is the
// one that would break.
//
// PROJECT: a new env-gated feature adds its variable to `configured`.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export const BUILDS = {
  production: { dir: '.verify/production', env: { INCLUDE_STYLEGUIDE: '' } },
  configured: {
    dir: '.verify/configured',
    env: {
      INCLUDE_STYLEGUIDE: '',
      /* Cloudflare's published always-passes TEST site key — public by design,
         like every site key, and never a real credential. */
      PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    },
  },
};

const built = new Map();

/**
 * Builds `name` into its scratch directory, once per process.
 * @returns {{ name: string, dir: string, ok: boolean, log: string }}
 */
export function ensureBuild(name) {
  if (built.has(name)) return built.get(name);
  const { dir, env } = BUILDS[name];
  const run = spawnSync('npx', ['astro', 'build', '--outDir', dir], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const r = {
    name,
    dir,
    ok: run.status === 0 && existsSync(join(dir, 'index.html')),
    log: output.slice(-800),
    warnings: buildWarnings(output),
  };
  built.set(name, r);
  return r;
}

/**
 * Every warning a build printed. A build that exits 0 can still have thrown work
 * away, and the only record is a line nobody reads:
 *   - the CSS minifier DROPS a rule it cannot parse and says so in a warning —
 *     that is how every select on the site shipped an invisible popup;
 *   - the glob loader, given two entries on one slug, keeps one and DROPS the
 *     other with a `[WARN]`.
 * So a warning is a failure. The one exclusion is Node's own ExperimentalWarning
 * for TypeScript type stripping, printed by the RUNTIME when astro.config.mjs
 * imports src/consts.ts — a fact about Node 24, not about this build — and the
 * hint line Node prints under it.
 */
export function buildWarnings(output) {
  const lines = output.replace(/\x1b\[[0-9;]*m/g, '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\(node:\d+\) ExperimentalWarning: Type Stripping is an experimental feature/.test(l)) continue;
    if (/^\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)$/.test(l.trim())) continue;
    if (!/\[WARN\]|\bwarnings?\b/i.test(l)) continue;
    /* Lightning CSS prints a code frame: context lines, then the offending line,
       then a caret line carrying the message. Report the offending line and the
       message, not the context above them. */
    const frame = /Found \d+ warnings? while optimizing/.test(l);
    const caret = frame ? lines.slice(i + 1, i + 30).findIndex((x) => /\^--/.test(x)) : -1;
    if (caret !== -1) {
      const at = i + 1 + caret;
      const source = lines.slice(i + 1, at).reverse().find((x) => /[│|]\s*\S/.test(x)) ?? '';
      out.push(`${l.trim()} ${source.replace(/^[\s│|┆]+/, '').trim()} — ${lines[at].replace(/^.*\^--\s*/, '').trim()}`);
      continue;
    }
    /* Otherwise the next few lines carry the detail (which entries, which file). */
    out.push([l.trim(), ...lines.slice(i + 1, i + 6).map((x) => x.trim()).filter(Boolean)].join(' ⏎ ').slice(0, 400));
  }
  return out;
}

/**
 * Files the HOST consumes and never serves. Cloudflare Pages reads these at
 * deploy; a request for /_headers is a 404.
 */
export const HOST_FILES = new Set(['_headers', '_redirects', '_routes.json']);

/** Every file a visitor can request from a build directory, relative paths. */
export function servedFiles(dir) {
  const out = [];
  const walk = (d, rel) => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const r = rel ? `${rel}/${entry}` : entry;
      if (statSync(full).isDirectory()) walk(full, r);
      else if (!(rel === '' && HOST_FILES.has(entry))) out.push(r);
    }
  };
  walk(dir, '');
  return out;
}
