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
//   2. every control that receives focus matches `:focus-visible` AND paints an
//      outline — WCAG 2.4.7;
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

/** Enough presses to traverse the longest page here, with headroom. */
const MAX_TABS = 90;

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

const FOCUSED = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return JSON.stringify({ kind: 'body' });
  const cs = getComputedStyle(el);
  const isControl = /^(input|select|textarea)$/i.test(el.tagName) && el.type !== 'hidden';
  return JSON.stringify({
    kind: el.tagName.toLowerCase(),
    type: el.getAttribute('type') || '',
    name: el.getAttribute('name') || '',
    isControl,
    focusVisible: el.matches(':focus-visible'),
    hasOutline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
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

  try {
    for (const path of PAGES) {
      await page.send('Page.navigate', { url: BASE + path });
      await page.sleep(500);

      const inventory = JSON.parse(await page.eval(INVENTORY));
      if (inventory.controls === 0) continue;

      await page.eval(`(() => { document.body.focus(); return 1; })()`);

      const reached = new Set();
      const radioStops = new Map();
      let ringless = 0;
      const ringlessDetail = [];

      for (let i = 0; i < MAX_TABS; i++) {
        await tab();
        const f = JSON.parse(await page.eval(FOCUSED));
        if (!f.isControl) continue;

        const id = f.type === 'radio' ? `radio:${f.name}` : `${f.kind}:${f.type}:${f.name}`;
        if (f.type === 'radio') radioStops.set(f.name, (radioStops.get(f.name) ?? 0) + 1);
        if (reached.has(id)) break; // wrapped around
        reached.add(id);

        if (!f.focusVisible || !f.hasOutline) {
          ringless++;
          ringlessDetail.push(`${f.kind}[${f.type || '-'}] name="${f.name}"`);
        }
      }

      /* 1. Reachability. */
      checks++;
      if (reached.size < inventory.expectedStops) {
        failures++;
        notes.push(
          `${path}: Tab reached ${reached.size} of ${inventory.expectedStops} expected stops — ` +
            'a control a keyboard cannot reach is a control that does not exist for some users.',
        );
      }

      /* 2. Visible focus. */
      checks++;
      if (ringless) {
        failures++;
        notes.push(`${path}: ${ringless} control(s) took focus with no visible ring (WCAG 2.4.7)`);
        notes.push(`    ${ringlessDetail.slice(0, 4).join(', ')}`);
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
      const clean = reached.size >= inventory.expectedStops && ringless === 0 && impostors.length === 0;
      notes.push(
        `${path}: ${inventory.controls} enabled control(s), ${inventory.expectedStops} tab stop(s), ` +
          `${inventory.radioGroups} radio group(s) — ` +
          (clean ? 'all reachable, all with a visible ring' : `${reached.size} reached, ${ringless} without a ring`),
      );
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
