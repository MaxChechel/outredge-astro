// Owns the preview server's whole life: start it, prove it is ours, use it,
// and kill it — including when the run dies abnormally.
//
// PAID FOR. `astro preview` DAEMONISES: it forks a background server and returns.
// Killing the spawned `npx` child leaves that server listening, so every run
// leaked one. In the Outredge repo a leaked daemon from THIS project held port
// 4321 while that project's harness ran, and every browser-driven check
// connected to it, requested eleven URLs that do not exist on this site, was
// served this site's fallback page — one h1, no overflow, no axe violations —
// and reported "77 page/width checks, 0 failures" and "22 axe runs, 0
// violations".
//
// Both numbers were real. Both were about the wrong website.
//
// So this module does three things, and all three are load-bearing:
//   1. stops any daemon this project left behind, before starting;
//   2. refuses to start if something ELSE already owns the port, rather than
//      silently measuring it;
//   3. registers cleanup on normal exit, on SIGINT/SIGTERM, and on an uncaught
//      throw — because the failure mode is a server that outlives the run that
//      started it.
//
// lib/served.mjs is the net under all of it: even a port that passes every check
// here is compared byte-for-byte against the build before anything trusts it.

import { spawn, spawnSync } from 'node:child_process';
import { assertServingDist } from './served.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isListening(base) {
  try {
    const res = await fetch(base, { redirect: 'manual' });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitFor(base, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isListening(base)) return true;
    await sleep(250);
  }
  return false;
}

/** Stop a daemon THIS project started. Cannot reach another project's. */
const stopOwnDaemon = () => {
  spawnSync('npx', ['astro', 'preview', 'stop'], { stdio: 'ignore' });
};

/**
 * @returns {Promise<{ base: string, stop: () => void }>}
 */
export async function startPreview({ port = 4321, dist = 'dist' } = {}) {
  const base = `http://localhost:${port}`;

  stopOwnDaemon();
  await sleep(300);

  if (await isListening(base)) {
    throw new Error(
      `verify: ${base} is already in use by something this project did not start.\n` +
        '  Refusing to run against it. A harness that measures whatever happens to be on\n' +
        '  a port is a harness that reports real numbers about the wrong artifact.\n' +
        '  Free the port (`npx astro preview stop` in the offending project, or kill the\n' +
        '  process holding it) and run again.',
    );
  }

  const child = spawn('npx', ['astro', 'preview', '--port', String(port)], { stdio: 'ignore' });

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    child.kill();
    /* The child is npx; the server it started is a daemon and outlives it. Both
       have to go, or the next run — here or in another repo — inherits it. */
    stopOwnDaemon();
  };

  /* Abnormal exits leak the daemon just as effectively as forgetting to call
     stop(), and more often. `exit` covers the normal path and process.exit();
     the signals cover Ctrl-C and a kill; uncaughtException covers a throw that
     escapes the runner's own try/finally. */
  const onSignal = (signal) => {
    stop();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('exit', stop);
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  process.once('uncaughtException', (err) => {
    stop();
    console.error(err);
    process.exit(1);
  });

  if (!(await waitFor(base))) {
    stop();
    throw new Error(`verify: preview server never came up on ${base}`);
  }

  /* And even now, do not trust it. */
  const identity = await assertServingDist(base, dist).catch((err) => {
    stop();
    throw err;
  });

  return { base, stop, bytes: identity.bytes };
}
