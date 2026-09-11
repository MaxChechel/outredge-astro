// The §9 reporting contract, in one place.
//
//   "Every check reports its own executed count, and a pass with zero reported
//    checks is a failure. A verification that cannot say how much it verified has
//    not verified anything."
//
// This is not a style rule. In the build this system came from, a sweep script was
// deleted out of /tmp between runs, so `grep -c` counted an empty stream and
// reported a clean pass over nothing. Every check here returns a Result, and the
// runner refuses a Result with `checks === 0` even when `failures === 0`.

/** @typedef {{name: string, checks: number, failures: number, unit: string, notes?: string[]}} Result */

/** @returns {Result} */
export const result = (name, { checks, failures, unit = 'checks', notes = [] }) => ({
  name,
  checks,
  failures,
  unit,
  notes,
});

export const ok = (s) => `\x1b[32m${s}\x1b[39m`;
export const bad = (s) => `\x1b[31m${s}\x1b[39m`;
export const dim = (s) => `\x1b[2m${s}\x1b[22m`;

/** One line per check, in a fixed shape, so a run is diffable against the last. */
export function line(r) {
  const zero = r.checks === 0;
  const failed = zero || r.failures > 0;
  const status = zero ? bad('EMPTY') : failed ? bad('FAIL ') : ok('PASS ');
  const count = `${r.checks} ${r.unit}`;
  return `  ${status} ${r.name.padEnd(22)} ${count.padEnd(26)} ${
    r.failures ? bad(`${r.failures} failure${r.failures === 1 ? '' : 's'}`) : dim('0 failures')
  }`;
}

export const passed = (r) => r.checks > 0 && r.failures === 0;

export const bytes = (n) => `${n.toLocaleString('en-US')} B`;
