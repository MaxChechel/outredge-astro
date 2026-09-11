#!/usr/bin/env node
// Generates the CSS `linear()` spring easings in src/styles/springs.css from the
// damped-harmonic-oscillator parameters below. Run `npm run springs` after
// changing them; the output is committed so a build never depends on this script.
//
// Why springs as `linear()` and not a JS animation library:
//   A spring is a curve. `linear(...)` can carry an arbitrary curve — including
//   the overshoot a cubic-bezier cannot express — so the entire spring character
//   of this system costs zero bytes of JavaScript and runs on the compositor.
//   That is why springs are the default here rather than a special occasion.
//
// TWO TRAPS PAID FOR HERE. Both were found by grepping dist, not by reading
// source, and both fail silently — the CSS looks right and the token is simply
// not there at runtime.
//
// 1. `linear()` CANNOT LIVE IN `@theme`.
//    @tailwindcss/vite runs Lightning CSS over the generated CSS with browser
//    targets HARDCODED in @tailwindcss/node (safari 16.4, chrome 111,
//    firefox 128). `linear()` easing shipped in Safari 17.2, so Lightning CSS
//    deletes every `linear()` declaration it recognises as a timing function —
//    and inside `@theme` the `--ease-*` namespace is exactly that. The variable
//    vanishes from dist entirely and `ease-spring-soft` resolves to nothing.
//    The targets are not configurable from userland.
//
//    So the curves are declared as PLAIN custom properties on :root, where
//    Lightning CSS does not type-check them, and `@theme` holds only a
//    `var()` pointer — which it cannot evaluate and therefore cannot reject.
//    That pointer is what generates the `ease-spring-*` utilities.
//
// 2. THE USUAL FALLBACK PATTERN DOES NOT SURVIVE EITHER.
//    Declaring a token twice — `cubic-bezier()` first, `linear()` second — is
//    the documented way to degrade. Lightning CSS dedupes repeated
//    custom-property declarations in one rule and keeps the last, so the
//    cubic-bezier is deleted before it ships. The fallback is therefore an
//    `@supports not (...)` override instead: nothing dedupes across at-rules,
//    and a browser without `linear()` evaluates the condition as true.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Spring parameters, recorded here as the source of truth (§Motion).
 *
 * `stiffness` (k) sets how hard the spring pulls, `damping` (c) how quickly the
 * oscillation bleeds off, `mass` (m) the inertia. The damping ratio
 * ζ = c / (2·√(k·m)) is what you actually feel:
 *   ζ ≥ 1  — no overshoot at all (that is an ease, not a spring)
 *   ζ ≈ 0.9 — a whisper of overshoot; reads as "settled", not as "bouncy"
 *   ζ ≈ 0.65 — one visible overshoot; reads as responsive and physical
 *
 * `fallback` is the hand-fitted cubic-bezier for browsers without `linear()`.
 */
const SPRINGS = [
  {
    name: 'spring-soft',
    stiffness: 236,
    damping: 27.6,
    mass: 1,
    fallback: 'cubic-bezier(0.22, 0.68, 0.28, 1)',
    comment: 'Default character. Hovers, colour and transform transitions, accordion and disclosure opens.',
  },
  {
    name: 'spring-snappy',
    stiffness: 841,
    damping: 39.4,
    mass: 1,
    fallback: 'cubic-bezier(0.16, 0.9, 0.22, 1)',
    comment: 'One visible overshoot. Reveals, anything that should read as arriving rather than fading in.',
  },
];

/** Settle threshold: the curve is cut when the envelope falls below this. */
const SETTLE = 0.004;
/** Maximum linear-interpolation error tolerated when simplifying the curve. */
const TOLERANCE = 0.0015;
/** Dense sample count before simplification. */
const SAMPLES = 2000;

/**
 * Displacement of an underdamped/critically damped spring released from 1 with
 * zero initial velocity. Progress is 1 − displacement, so it starts at 0, may
 * exceed 1 on the overshoot, and settles at 1.
 */
function progressFn({ stiffness: k, damping: c, mass: m }) {
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  if (zeta >= 1) {
    // Critically damped (ζ = 1) or overdamped; no oscillation, closed form.
    return { zeta, w0, at: (t) => 1 - (1 + w0 * t) * Math.exp(-w0 * t) };
  }
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return {
    zeta,
    w0,
    at: (t) =>
      1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t)),
  };
}

/** Time at which the exponential envelope drops under SETTLE — the useful duration. */
const settleTime = (zeta, w0) => -Math.log(SETTLE) / (zeta * w0);

/**
 * Ramer–Douglas–Peucker over (t, value). Keeps the curve's shape — including the
 * overshoot peak — while dropping the samples a straight line already covers, so
 * the emitted `linear()` is as short as the tolerance allows rather than a fixed
 * grid that is too coarse at the peak and too dense on the tail.
 */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [first] = points;
  const last = points[points.length - 1];
  const dx = last[0] - first[0];
  const dy = last[1] - first[1];
  const norm = Math.hypot(dx, dy) || 1;

  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const dist =
      Math.abs(dx * (first[1] - points[i][1]) - (first[0] - points[i][0]) * dy) / norm;
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }
  if (maxDist <= tolerance) return [first, last];
  return [
    ...simplify(points.slice(0, index + 1), tolerance),
    ...simplify(points.slice(index), tolerance).slice(1),
  ];
}

const round = (n, places) => Number(n.toFixed(places));

function build(spring) {
  const { at, zeta, w0 } = progressFn(spring);
  const duration = settleTime(zeta, w0);

  const dense = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const t = i / SAMPLES;
    return [t, at(t * duration)];
  });
  // Pin the ends exactly: the curve must start at 0 and land on 1.
  dense[0][1] = 0;
  dense[dense.length - 1][1] = 1;

  const points = simplify(dense, TOLERANCE);
  const stops = points.map(([t, v], i) => {
    const value = round(v, 4);
    // First and last stops need no position — `linear()` infers 0% and 100%.
    if (i === 0 || i === points.length - 1) return String(value);
    return `${value} ${round(t * 100, 2)}%`;
  });

  return {
    ...spring,
    zeta,
    durationMs: Math.round(duration * 1000),
    stops: stops.join(', '),
    pointCount: points.length,
  };
}

const built = SPRINGS.map(build);

const out = `/* ==========================================================================
   GENERATED FILE — do not edit by hand.

   Produced by scripts/springs/generate.mjs. Change the stiffness/damping
   parameters there and run \`npm run springs\`.

   This file carries CURVES ONLY. The tokens that point at them live in the
   motion block of src/styles/global.css, alongside every other token, because:

     · \`@theme\` in global.css resets \`--ease-*: initial\`, and an \`@import\` must
       precede it — so any --ease-* declared HERE is wiped by that reset. The
       reset cannot move after the import; @import has to come first.
     · Lightning CSS deletes linear() from @theme anyway (trap 1 above).

   Adding a spring is therefore two edits: add it to SPRINGS below, run
   \`npm run springs\`, then add its pointer in global.css. The second edit is
   deliberate, exactly like adding a @utility for a new colour token.
   ========================================================================== */

:root {
${built
  .map(
    (s) => `  /* ${s.comment}
     k=${s.stiffness} c=${s.damping} m=${s.mass} → damping ratio ζ=${round(s.zeta, 3)}, settles in ${s.durationMs}ms over ${s.pointCount} stops. */
  --${s.name}: linear(${s.stops});`,
  )
  .join('\n\n')}
}

/* Engines without linear() easing get a hand-fitted approximation; all that is
   lost is the overshoot. An @supports override rather than a repeated
   declaration, because Lightning CSS dedupes repeats (trap 2 above). */
@supports not (transition-timing-function: linear(0, 1)) {
  :root {
${built.map((s) => `    --${s.name}: ${s.fallback};`).join('\n')}
  }
}
`;

const target = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/styles/springs.css');
writeFileSync(target, out);
console.log(
  `springs: wrote ${built.length} curves to src/styles/springs.css — ` +
    built.map((s) => `${s.name} (ζ=${round(s.zeta, 2)}, ${s.durationMs}ms, ${s.pointCount} stops)`).join('; '),
);
console.log('\nglobal.css must carry a pointer for each curve, inside its @theme block:\n');
for (const s of built) {
  console.log(`  --ease-${s.name}: var(--${s.name});`);
  console.log(`  --transition-duration-${s.name}: ${s.durationMs}ms;`);
}
