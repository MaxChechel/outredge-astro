#!/usr/bin/env node
// `npm run verify` — the full ARCHITECTURE §9 pass.
//
// Builds with the styleguide route on, serves the build, and runs every check
// against the real output. Each check reports its own executed count; a check
// that reports zero fails the run even with zero failures, because a
// verification that cannot say how much it verified has not verified anything.
//
// The harness lives in the repo, versioned alongside the code it checks, and is
// never a scratch script in /tmp. That rule is paid for: in the build this system
// came from, a sweep script was deleted out of /tmp between runs, `grep -c`
// counted an empty stream, and a clean pass was reported over nothing.

import { spawn } from 'node:child_process';
import { line, passed, ok, bad, dim } from './lib/report.mjs';
import { contrast } from './contrast.mjs';
import { jsCensus } from './js-census.mjs';
import { sweep } from './sweep.mjs';
import { axe } from './axe.mjs';

const PORT = Number(process.env.PORT ?? 4321);
const BASE = process.env.BASE ?? `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });
}

async function waitForServer(url, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  return false;
}

const results = [];
let server;

try {
  console.log(dim('\nverify — ARCHITECTURE §9\n'));

  // --- astro check -----------------------------------------------------------
  // First, because a type error makes every check after it a check of the wrong
  // code. tsconfig's `exclude` lists node_modules explicitly; without it,
  // `exclude` REPLACES TypeScript's defaults, every dependency gets type-checked,
  // and this times out and "passes" on partial output.
  process.stdout.write(dim('  astro check…\r'));
  const check = await run('npx', ['astro', 'check']);
  const counts = /(\d+) errors?[\s\S]*?(\d+) warnings?[\s\S]*?(\d+) hints?/.exec(
    check.out.replace(/\x1b\[[0-9;]*m/g, ''),
  );
  const [errors, warnings, hints] = counts ? counts.slice(1).map(Number) : [NaN, NaN, NaN];
  results.push({
    name: 'astro check',
    checks: Number.isNaN(errors) ? 0 : 1,
    failures: errors + warnings,
    unit: 'type-check run',
    notes: Number.isNaN(errors)
      ? ['could not parse astro check output — treating as unverified', check.out.slice(-600)]
      : [`${errors} errors, ${warnings} warnings, ${hints} hints`, ...(errors + warnings ? [check.out.slice(-1500)] : [])],
  });

  // --- build -----------------------------------------------------------------
  process.stdout.write(dim('  build (styleguide route on)…\r'));
  const build = await run('npx', ['astro', 'build'], { INCLUDE_STYLEGUIDE: '1' });
  if (build.code !== 0) {
    console.log(bad('\n  build failed:\n'));
    console.log(build.out);
    process.exit(1);
  }

  // --- static checks, straight off dist --------------------------------------
  results.push(contrast());
  results.push(jsCensus());

  // --- serve, then the rendered checks ---------------------------------------
  process.stdout.write(dim('  starting preview server…\r'));
  server = spawn('npx', ['astro', 'preview', '--port', String(PORT)], { stdio: 'ignore' });
  if (!(await waitForServer(BASE))) {
    console.log(bad(`\n  preview server never came up on ${BASE}`));
    process.exit(1);
  }

  process.stdout.write(dim('  sweep (7 widths)…            \r'));
  results.push(await sweep());
  process.stdout.write(dim('  axe-core…                    \r'));
  results.push(await axe());
} finally {
  server?.kill();
}

// --- report ------------------------------------------------------------------
console.log('');
for (const r of results) {
  console.log(line(r));
  for (const n of r.notes) console.log(dim(`         ${n}`));
}

const empty = results.filter((r) => r.checks === 0);
const failed = results.filter((r) => r.failures > 0);
const totalChecks = results.reduce((n, r) => n + r.checks, 0);

console.log('');
console.log(`  ${results.length} checks, ${totalChecks} assertions executed`);
if (empty.length) {
  console.log(bad(`  ${empty.length} check(s) reported ZERO executed assertions: ${empty.map((r) => r.name).join(', ')}`));
  console.log(dim('  A pass with zero reported checks is a failure (§9).'));
}
if (failed.length) {
  console.log(bad(`  ${failed.length} check(s) failed: ${failed.map((r) => r.name).join(', ')}`));
}

const green = results.every(passed);
console.log(green ? ok('\n  §9 PASS\n') : bad('\n  §9 FAIL\n'));
process.exit(green ? 0 : 1);
