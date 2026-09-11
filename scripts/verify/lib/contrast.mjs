// Contrast maths and a CSS custom-property resolver, shared by two consumers:
// src/pages/_styleguide.astro renders the matrix from the SOURCE global.css, and
// scripts/verify/contrast.mjs fails the run from the BUILT CSS in dist/.
//
// One implementation on purpose. If the two ever disagree, that is a
// build-pipeline bug worth finding — which it cannot be if each has its own maths.

/** WCAG 2.x relative luminance. */
export function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1–21. */
export function contrastRatio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Accepts #rgb, #rrggbb and the CSS named colours this system actually uses. */
export function toRgb(input) {
  const value = String(input).trim().toLowerCase();
  const named = { white: '#ffffff', black: '#000000' };
  let hex = named[value] ?? value;
  if (!hex.startsWith('#')) throw new Error(`Not a hex colour: ${input}`);
  hex = hex.slice(1);
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length !== 6) throw new Error(`Not a 6-digit hex colour: ${input}`);
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/**
 * Splits CSS into a root scope and one scope per `[data-theme=…]` block.
 *
 * Deliberately a brace scanner rather than a regex over whole rules: the built
 * CSS is minified onto one line, nests `@layer`/`@supports`/`@media` several
 * deep, and a regex that tries to match a balanced block over that is the kind
 * of "works until it doesn't" code a verification harness must not contain.
 *
 * Everything that is not inside a `[data-theme=…]` block lands in `root`, later
 * declarations winning — which is exactly how the cascade would resolve them for
 * a same-specificity `:root` selector, and all this file's inputs are that.
 */
export function parseThemeScopes(css) {
  const scopes = { root: new Map() };
  const themeSelector = /\[data-theme\s*=\s*['"]?([a-z0-9-]+)['"]?\s*\]/gi;

  // 1. Pull out each [data-theme="x"] block by scanning braces from its selector.
  const consumed = [];
  let match;
  while ((match = themeSelector.exec(css)) !== null) {
    const open = css.indexOf('{', match.index);
    if (open === -1) continue;
    // `:where([data-theme])` and similar carry no custom properties; harmless.
    const close = matchBrace(css, open);
    if (close === -1) continue;
    const name = match[1].toLowerCase();
    const body = css.slice(open + 1, close);
    if (!scopes[name]) scopes[name] = new Map();
    for (const [prop, value] of declarations(body)) scopes[name].set(prop, value);
    consumed.push([match.index, close + 1]);
  }

  // 2. Everything else is root scope.
  let rest = '';
  let cursor = 0;
  for (const [start, end] of consumed.sort((a, b) => a[0] - b[0])) {
    if (start > cursor) rest += css.slice(cursor, start);
    cursor = Math.max(cursor, end);
  }
  rest += css.slice(cursor);
  for (const [prop, value] of declarations(rest)) scopes.root.set(prop, value);

  return scopes;
}

/** Index of the `}` matching the `{` at `open`. */
function matchBrace(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/** Every `--name: value` in a chunk of CSS, in source order. */
function* declarations(chunk) {
  const re = /(--[a-z0-9-]+)\s*:\s*([^;{}]+)/gi;
  let m;
  while ((m = re.exec(chunk)) !== null) yield [m[1], m[2].trim()];
}

/**
 * Resolves a custom property to a hex colour within a theme, following var()
 * chains. Theme scope wins over root, which is what `[data-theme]` does at
 * runtime.
 *
 * Throws rather than returning null: a token that cannot be resolved is a token
 * that is not in the built CSS, and a contrast check that quietly skips it is
 * the "pass with zero reported checks" failure §9 exists to prevent.
 */
export function resolveColor(scopes, theme, name, depth = 0) {
  if (depth > 12) throw new Error(`Cyclic var() chain resolving ${name}`);
  const scope = scopes[theme];
  const raw = (scope && scope.get(name)) ?? scopes.root.get(name);
  if (raw === undefined) {
    throw new Error(`Token ${name} is not declared in theme "${theme}" or in :root`);
  }
  const ref = /^var\(\s*(--[a-z0-9-]+)\s*(?:,[^)]*)?\)$/i.exec(raw);
  if (ref) return resolveColor(scopes, theme, ref[1], depth + 1);
  return raw;
}

/** The token names §2.3 fixes, and the pairs §9 requires. */
export const BACKGROUNDS = ['--bg-base', '--bg-subtle', '--bg-surface'];
export const TEXTS = ['--text-primary', '--text-secondary', '--text-tertiary'];
export const THEMES = ['light', 'dark'];
export const AA = 4.5;
/** WCAG 1.4.11: a control's boundary, when the border is the control. */
export const UI = 3;

/**
 * The core matrix: every text token on every background in every theme.
 * Returns one row per pair, each carrying its own ratio and pass flag.
 */
export function textMatrix(scopes) {
  const rows = [];
  for (const theme of THEMES) {
    for (const bg of BACKGROUNDS) {
      for (const text of TEXTS) {
        const bgHex = resolveColor(scopes, theme, bg);
        const textHex = resolveColor(scopes, theme, text);
        const ratio = contrastRatio(textHex, bgHex);
        rows.push({ theme, bg, text, bgHex, textHex, ratio, pass: ratio >= AA, threshold: AA });
      }
    }
  }
  return rows;
}

/**
 * The accent group, reported separately from the core 18 so each keeps its own
 * count: the accent as text on each ground, and --accent-contrast on the accent
 * fill. Not in the brief's 3×3×2, but an accent that fails AA is exactly as
 * unshippable as a text token that does.
 */
export function accentMatrix(scopes) {
  const rows = [];
  for (const theme of THEMES) {
    const accent = resolveColor(scopes, theme, '--accent');
    for (const bg of BACKGROUNDS) {
      const bgHex = resolveColor(scopes, theme, bg);
      const ratio = contrastRatio(accent, bgHex);
      rows.push({ theme, bg, text: '--accent', bgHex, textHex: accent, ratio, pass: ratio >= AA, threshold: AA });
    }
    const onAccent = resolveColor(scopes, theme, '--accent-contrast');
    const ratio = contrastRatio(onAccent, accent);
    rows.push({
      theme, bg: '--accent', text: '--accent-contrast',
      bgHex: accent, textHex: onAccent, ratio, pass: ratio >= AA, threshold: AA,
    });
  }
  return rows;
}

/**
 * Line tokens. `--line` is decorative and only has to be seen, so it is reported
 * without a threshold; `--line-strong` is a control boundary and carries 3:1.
 */
export function lineMatrix(scopes) {
  const rows = [];
  for (const theme of THEMES) {
    for (const bg of BACKGROUNDS) {
      const bgHex = resolveColor(scopes, theme, bg);
      for (const [token, threshold] of [['--line', null], ['--line-strong', UI]]) {
        const hex = resolveColor(scopes, theme, token);
        const ratio = contrastRatio(hex, bgHex);
        rows.push({
          theme, bg, text: token, bgHex, textHex: hex, ratio,
          pass: threshold === null ? true : ratio >= threshold,
          threshold,
        });
      }
    }
  }
  return rows;
}
