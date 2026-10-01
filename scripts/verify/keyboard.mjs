// Keyboard operability of every form control (§9, and §4.1's "native elements
// only" rule).
//
// axe checks a great many things, but it cannot press Tab. It will tell you a
// control has an accessible name and will not tell you that Tab skips it, that
// focus lands somewhere invisible, or that a radio group has become four tab
// stops instead of one. Those are the failures a re-implemented control actually
// ships with, and the only way to catch them is to drive the keyboard.
//
// So this check does, through CDP's real key events rather than `.focus()` —
// which does not trigger `:focus-visible` and would report a passing focus ring
// that a keyboard user never sees.
//
// What it asserts, per page:
//   1. every ENABLED control is reachable by Tab (disabled controls are correctly
//      skipped, so they are excluded from the expectation rather than failed);
//   2. EVERY element that takes focus — link, button, summary, control — matches
//      `:focus-visible` AND paints an outline that clears 3:1 against the ground
//      it is drawn on (WCAG 2.4.7, measured as 1.4.11). An outline that EXISTS is
//      not an outline anyone can see: this check once asserted only existence,
//      and passed a #1c2024 ring on a #1c2024 band on every page. At least one
//      ring must be measured on a dark ground, or the check has lost the surface
//      where that bug lived;
//   3. nothing on the page is WEARING an interactive ARIA role that a native
//      element should have provided. `role="checkbox"` on a div is the shape of
//      every control this section exists to rule out, and it is the only version
//      of "the keyboard behaviour is wrong" that can actually reach production —
//      a native <input type="radio"> cannot be coerced into two tab stops, which
//      is exactly why §4.1 says to use one.
//
// (An earlier draft asserted the one-stop-per-radio-group property directly. It
// was dropped: no injected fault could make it fail, because the browser will not
// let a native group misbehave. A check whose red path cannot be reached is a
// check §9 does not count — so it became the assertion above, which can.)

import { connect, PAGES, BASE } from './lib/cdp.mjs';
import { assertServingDist } from './lib/served.mjs';
import { result, line, passed } from './lib/report.mjs';
import { isMain } from './lib/main.mjs';

/** Enough presses to traverse the longest page here, with headroom. The walk
    ends early when focus returns to an element it has already visited. */
const MAX_TABS = 400;

/** WCAG 1.4.11 — a focus indicator is a non-text graphic: 3:1 against its ground. */
const RING_MIN = 3;

/**
 * Transitions off, for the duration of the walk. Headless Chrome reads a
 * transitioned property's START value, and buttons here transition
 * `outline-color` (Tailwind's `transition-colors` includes it), from
 * `currentcolor` — so a ring that settles at 15:1 reads as the button's own text
 * colour, 1:1, at the moment of measuring. This removes the interpolation, not
 * the end state, which is the thing under test.
 */
const NO_TRANSITIONS = `(() => {
  const s = document.createElement('style');
  s.textContent = '*, *::before, *::after { transition: none !important; }';
  document.head.append(s);
  return 1;
})()`;

const INVENTORY = `(() => {
  const controls = [...document.querySelectorAll('input:not([type=hidden]), select, textarea')]
    .filter((el) => !el.closest('.sr-only'))
    .filter((el) => !el.disabled && !el.closest('fieldset[disabled]'));
  const radioGroups = new Set();
  let stops = 0;
  for (const el of controls) {
    if (el.type === 'radio') {
      const key = el.name || el;
      if (radioGroups.has(key)) continue;
      radioGroups.add(key);
    }
    stops++;
  }
  return JSON.stringify({ controls: controls.length, radioGroups: radioGroups.size, expectedStops: stops });
})()`;

/*
 * The focused element, and how visible its ring is.
 *
 * THE GROUND IS WHAT IS BEHIND THE OUTLINE, not the element. An outline with a
 * non-negative offset is drawn OUTSIDE the border box, over the parent's ground,
 * so a ring measured against a button's own fill reads 7:1 while it sits at 1:1
 * on the band behind it. Grounds are composited up the ancestor chain until an
 * opaque one; colours go through a 1px canvas so that oklab()/color() values
 * from color-mix() tokens are read as the pixels they paint.
 *
 * (This is a template literal evaluated in the page: no backticks, no nested
 * dollar-brace, and every regex backslash doubled.)
 */
const FOCUSED = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return JSON.stringify({ kind: 'body' });
  const seen = (window.__kbSeen = window.__kbSeen || new WeakSet());
  const revisit = seen.has(el);
  seen.add(el);

  const ctx = (window.__kbCtx = window.__kbCtx ||
    Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true }));
  const rgba = (c) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const lum = (c) => {
    const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  const cs = getComputedStyle(el);
  const offset = parseFloat(cs.outlineOffset) || 0;
  const layers = [];
  for (let n = offset >= 0 ? el.parentElement : el; n; n = n.parentElement) {
    const c = rgba(getComputedStyle(n).backgroundColor);
    if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
  }
  let ground = [255, 255, 255, 1];
  for (const c of layers.reverse()) ground = over(c, ground);
  const ring = over(rgba(cs.outlineColor), ground);
  const l1 = lum(ring), l2 = lum(ground);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  const isControl = /^(input|select|textarea)$/i.test(el.tagName) && el.type !== 'hidden';
  const text = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || '').trim().replace(/\\s+/g, ' ').slice(0, 32);
  return JSON.stringify({
    kind: el.tagName.toLowerCase(),
    type: el.getAttribute('type') || '',
    name: el.getAttribute('name') || '',
    label: el.tagName.toLowerCase() + ' "' + text + '"',
    revisit,
    isControl,
    dark: Boolean(el.closest('[data-theme="dark"]')),
    focusVisible: el.matches(':focus-visible'),
    hasOutline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
    ratio: Math.round(ratio * 100) / 100,
    ring: hex(ring),
    ground: hex(ground),
  });
})()`;

/**
 * Elements pretending to be controls. Roles a native element already provides —
 * finding one means somebody rebuilt a control that HTML ships.
 */
const IMPOSTORS = `(() => {
  const ROLES = ['checkbox', 'radio', 'combobox', 'listbox', 'switch', 'textbox', 'spinbutton', 'slider'];
  const NATIVE = { checkbox: 'input', radio: 'input', combobox: 'select', listbox: 'select',
                   switch: 'input', textbox: 'input', spinbutton: 'input', slider: 'input' };
  const found = [];
  for (const role of ROLES) {
    for (const el of document.querySelectorAll('[role="' + role + '"]')) {
      const tag = el.tagName.toLowerCase();
      if (tag === NATIVE[role] || tag === 'textarea') continue;
      found.push('<' + tag + ' role="' + role + '"> — use a native ' + NATIVE[role]);
    }
  }
  return JSON.stringify(found);
})()`;

export async function keyboard() {
  await assertServingDist(BASE);

  const page = await connect(9402, 'outredge-verify-keyboard');
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  let checks = 0;
  let failures = 0;
  const notes = [];

  const tab = async () => {
    for (const type of ['keyDown', 'keyUp']) {
      await page.send('Input.dispatchKeyEvent', {
        type,
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
        nativeVirtualKeyCode: 9,
      });
    }
    await page.sleep(30);
  };

  /* Rings measured on a dark ground, across every page. Zero means the walk
     never reached the surface where an invisible ring actually shipped. */
  let darkRings = 0;
  let rings = 0;

  try {
    for (const path of PAGES) {
      await page.send('Page.navigate', { url: BASE + path });
      await page.sleep(500);
      await page.eval(NO_TRANSITIONS);

      const inventory = JSON.parse(await page.eval(INVENTORY));

      await page.eval(`(() => { document.body.focus(); return 1; })()`);

      const reached = new Set();
      const radioStops = new Map();
      let stops = 0;
      const ringless = [];
      let bodyStreak = 0;

      for (let i = 0; i < MAX_TABS; i++) {
        await tab();
        const f = JSON.parse(await page.eval(FOCUSED));
        if (f.kind === 'body') {
          if (++bodyStreak > 2) break;
          continue;
        }
        bodyStreak = 0;
        if (f.revisit) break; // wrapped around

        stops++;
        rings++;
        if (f.dark) darkRings++;
        if (!f.focusVisible || !f.hasOutline) {
          ringless.push(`${f.label}: ${f.focusVisible ? 'no outline' : 'not :focus-visible'}`);
        } else if (f.ratio < RING_MIN) {
          ringless.push(
            `${f.label}${f.dark ? ' (dark region)' : ''}: ring ${f.ring} on ${f.ground} = ${f.ratio}:1, needs ${RING_MIN}:1`,
          );
        }

        if (!f.isControl) continue;
        const id = f.type === 'radio' ? `radio:${f.name}` : `${f.kind}:${f.type}:${f.name}`;
        if (f.type === 'radio') radioStops.set(f.name, (radioStops.get(f.name) ?? 0) + 1);
        reached.add(id);
      }

      /* 1. Reachability — of form controls, where there are any. */
      if (inventory.controls > 0) {
        checks++;
        if (reached.size < inventory.expectedStops) {
          failures++;
          notes.push(
            `${path}: Tab reached ${reached.size} of ${inventory.expectedStops} expected stops — ` +
              'a control a keyboard cannot reach is a control that does not exist for some users.',
          );
        }
      }

      /* 2. Visible focus, on every stop. */
      checks++;
      if (stops === 0) {
        failures++;
        notes.push(`${path}: Tab reached nothing at all — the walk measured no rings`);
      } else if (ringless.length) {
        failures++;
        notes.push(`${path}: ${ringless.length} of ${stops} focus stop(s) without a VISIBLE ring (WCAG 2.4.7 / 1.4.11)`);
        for (const r of ringless.slice(0, 6)) notes.push(`    ${r}`);
      }

      /* 3. No ARIA impostors (§4.1). */
      checks++;
      const impostors = JSON.parse(await page.eval(IMPOSTORS));
      if (impostors.length) {
        failures++;
        notes.push(
          `${path}: ${impostors.length} element(s) wear an interactive ARIA role a native element provides (§4.1).`,
        );
        for (const i of impostors.slice(0, 4)) notes.push(`    ${i}`);
        notes.push(
          '    A native control is focusable, announced, form-associated, keyboard-operable and in the ' +
            'FormData for free. A role attribute buys the announcement and none of the rest.',
        );
      }

      /* Describe what was found, not what was hoped for. An earlier version
         appended "all reachable, all with a visible ring" unconditionally, so a
         failing run printed its own contradiction two lines below the failure —
         which is how a reader learns to skim past the summary. */
      const controlsOk = inventory.controls === 0 || reached.size >= inventory.expectedStops;
      const clean = controlsOk && ringless.length === 0 && impostors.length === 0;
      notes.push(
        `${path}: ${stops} focus stop(s), ${inventory.controls} enabled control(s) in ` +
          `${inventory.expectedStops} control stop(s) — ` +
          (clean ? `all reachable, every ring at least ${RING_MIN}:1 on its ground` : `${reached.size} control stop(s) reached, ${ringless.length} ring(s) not visible`),
      );
    }

    /* 4. The dark surface was actually exercised. */
    checks++;
    if (darkRings === 0) {
      failures++;
      notes.push(
        'no focus ring was measured on a dark ground on any page. Every page walked was light, so this check ' +
          'cannot see the failure it exists for. Add a page with a theme="dark" region to PAGES.',
      );
    } else {
      notes.push(`${rings} ring(s) measured, ${darkRings} of them inside a dark region`);
    }
  } finally {
    page.close();
  }

  return result('keyboard', { checks, failures, unit: 'keyboard assertions', notes });
}

if (isMain(import.meta.url)) {
  const r = await keyboard();
  console.log(line(r));
  for (const n of r.notes) console.log(`         ${n}`);
  process.exit(passed(r) ? 0 : 1);
}
