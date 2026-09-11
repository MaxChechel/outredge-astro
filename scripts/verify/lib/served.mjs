// "Am I talking to the build I just made?"
//
// PAID FOR, EXPENSIVELY. A preview server left running by a DIFFERENT REPO held
// port 4321. Every browser-driven check in this harness connected to it, walked
// eleven URLs that do not exist on that site, was served that site's fallback
// page — which has one h1, no overflow and no axe violations — and reported
// "77 page/width checks, 0 failures" and "22 axe runs, 0 violations".
//
// Both numbers were real. Both were about somebody else's website.
//
// This is ARCHITECTURE §9's "a pass with zero reported checks is a failure"
// arriving through a door the counting rule does not cover: the count was not
// zero, it was just measuring the wrong thing. Counting how much you verified
// is necessary and not sufficient — you also have to know WHAT you verified.
//
// So before any browser check runs, the harness fetches a page over HTTP and
// compares it byte-for-byte with the file the build just wrote. If they differ,
// something else is on that port and the run stops rather than reporting a
// confident pass over a stranger's site.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @param base  e.g. http://localhost:4321
 * @param dist  the directory the build wrote
 * @param page  route to compare, and the file it should have come from
 */
export async function assertServingDist(base, dist = 'dist', page = { url: '/', file: 'index.html' }) {
  const onDisk = readFileSync(join(dist, page.file), 'utf8');

  let served;
  try {
    const res = await fetch(base + page.url, { redirect: 'follow' });
    if (!res.ok) {
      throw new Error(`${base}${page.url} answered ${res.status}`);
    }
    served = await res.text();
  } catch (cause) {
    throw new Error(
      `verify: cannot read ${base}${page.url} to confirm what is being served.\n  ${cause.message}`,
    );
  }

  if (served.trim() === onDisk.trim()) return { ok: true, bytes: served.length };

  /* Say what is actually there, because "mismatch" is not a diagnosis. */
  const title = /<title>([^<]*)<\/title>/i.exec(served)?.[1] ?? '(no <title>)';
  const expected = /<title>([^<]*)<\/title>/i.exec(onDisk)?.[1] ?? '(no <title>)';
  throw new Error(
    `verify: ${base} IS NOT SERVING ${dist}/.\n` +
      `  expected page title: ${expected}\n` +
      `  actually served:     ${title}\n` +
      `  served ${served.length} bytes, ${dist}/${page.file} is ${onDisk.length} bytes.\n` +
      '  Something else owns that port — most likely a preview server left running by\n' +
      '  another project. `npx astro preview stop`, or free the port, and run again.\n' +
      '  The run is stopping rather than reporting a pass over a site nobody asked about.',
  );
}
