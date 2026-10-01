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

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { result, line, passed } from './lib/report.mjs';
import { ensureBuild, servedFiles } from './lib/builds.mjs';
import { isMain } from './lib/main.mjs';

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
 *
 * EVERY CONTROL TYPE, and the breakdown is reported rather than summed, so the
 * next person can see at a glance that the checkbox and the radios are actually
 * in the population. A contract that says "8 controls" hides a control type
 * dropping out of the form entirely.
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

      /* `<fieldset disabled>` disables every control inside it, per the HTML
         spec, and that is the correct way to make a radio group inert — so a
         contract that only looked for the attribute on each control would
         false-positive on correct markup. Model the real rule, not a convention:
         collect the character ranges covered by a disabled fieldset, and treat
         anything inside one as disabled. A contract people have to work around
         is a contract people delete. */
      const disabledRanges = [];
      for (const m of form.matchAll(/<fieldset\b[^>]*>/g)) {
        if (!hasDisabledAttribute(m[0])) continue;
        const close = form.indexOf('</fieldset>', m.index);
        disabledRanges.push([m.index, close === -1 ? form.length : close]);
      }
      const insideDisabledFieldset = (at) => disabledRanges.some(([a, b]) => at > a && at < b);

      const controls = [...form.matchAll(/<(input|textarea|select|button)\b[^>]*>/g)]
        .map((m) => ({ tag: m[0], element: m[1], at: m.index }))
        // The honeypot is deliberately not disabled: a bot must be able to fill
        // it, which is the entire mechanism.
        .filter((c) => !/company_website/.test(c.tag))
        // Nothing types into a hidden input.
        .filter((c) => !/type=["']hidden["']/.test(c.tag));

      if (ready) {
        notes.push(`${file}: contact form is configured (data-contact-ready) — enable path allowed`);
        continue;
      }

      /* Report the population by type. "8 controls" hides a control type falling
         out of the form; "checkbox 1, radio 3, select 1" does not. */
      const kindOf = (c) => {
        const type = /type=["']([a-z]+)["']/.exec(c.tag)?.[1];
        return c.element === 'input' ? (type ?? 'text') : c.element;
      };
      const breakdown = {};
      for (const c of controls) breakdown[kindOf(c)] = (breakdown[kindOf(c)] ?? 0) + 1;
      const census = Object.entries(breakdown)
        .sort()
        .map(([k, n]) => `${k} ${n}`)
        .join(', ');

      const enabledSubmits = submits.filter((c) => !hasDisabledAttribute(c));
      const enabled = controls.filter((c) => !hasDisabledAttribute(c.tag) && !insideDisabledFieldset(c.at));

      if (submits.length === 0) {
        failures++;
        notes.push(`${file}: contact form has no submit control — cannot verify the ships-disabled rule`);
      } else if (enabledSubmits.length) {
        failures++;
        notes.push(
          `${file}: SUBMIT CONTROL IS ENABLED on a build with no configured endpoint (§8). ` +
            'An unverified endpoint must not be reachable.',
        );
        notes.push(`    ${enabledSubmits[0].slice(0, 140)}`);
      } else if (enabled.length) {
        failures++;
        for (const c of enabled) {
          notes.push(
            `${file}: ${kindOf(c).toUpperCase()} CONTROL "${/name=["']([^"']*)["']/.exec(c.tag)?.[1] ?? '?'}" ` +
              'IS ENABLED with no configured endpoint (§8). A control that accepts input invites someone ' +
              'to fill this form and lose it.',
          );
          notes.push(`    ${c.tag.slice(0, 140)}`);
        }
      } else {
        notes.push(`${file}: ships disabled — ${controls.length} controls (${census}), no endpoint configured`);
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
  const build = ensureBuild('production');
  if (!build.ok) {
    return { checks: 1, failures: 1, notes: ['production build failed', build.log] };
  }
  const out = build.dir;

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

/* ---------------------------------------------------------------------------
   Shared by the three contracts below: the builds a visitor can receive, and
   small readers over their HTML. Attribute values are read as Astro emits them
   (double-quoted); `&amp;` is the only entity that occurs in a URL here.
   ------------------------------------------------------------------------- */

/** The styleguide build plus both production-shaped builds. */
function shippedBuilds() {
  const builds = [{ name: 'styleguide build', dir: DIST, ok: existsSync(join(DIST, 'index.html')), log: '' }];
  for (const name of ['production', 'configured']) builds.push(ensureBuild(name));
  return builds;
}

/** The canonical origin, from the one module that declares it. */
const SITE_ORIGIN = /origin:\s*'([^']+)'/.exec(readFileSync('src/consts.ts', 'utf8'))?.[1] ?? '';

const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tag);
  return m ? m[1].replace(/&amp;/g, '&') : null;
};
const tags = (html, names) => [...html.matchAll(new RegExp(`<(?:${names})\\b[^>]*>`, 'gi'))].map((m) => m[0]);

/** `contact.html` → `/contact`, `index.html` → `/`, `a/index.html` → `/a/`. */
const pagePath = (file) => '/' + file.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '');

/**
 * B6 — EVERY INTERNAL LINK RESOLVES, IN EVERY BUILD THAT SHIPS.
 *
 * §9 demands zero broken refs for images and says nothing about `href`, and a
 * static build has no objection to an anchor pointing at a URL it never wrote. A
 * 404 is not a rendering defect: it builds clean, types clean, sweeps clean and
 * passes axe. A project on this system shipped two dead footer links on every
 * page from its first build, and the starter itself linked /styleguide ten times
 * from every page of a production build that does not emit it.
 *
 * Internal means relative, root-relative or on the canonical origin. A link
 * resolves when the build emits the file it names (format: 'file', so /contact
 * is contact.html) or when _redirects sends it somewhere. A FRAGMENT must name an
 * element on the target page: a skip link or an index entry pointing at an id no
 * page has is a link that goes nowhere while looking like it works.
 */
function internalLinksResolve() {
  const notes = [];
  let checks = 0;
  let failures = 0;

  for (const build of shippedBuilds()) {
    if (!build.ok) {
      checks++;
      failures++;
      notes.push(`${build.name}: build failed — ${build.log}`);
      continue;
    }
    const files = new Set(servedFiles(build.dir));
    const redirects = existsSync(join(build.dir, '_redirects'))
      ? new Set(
          readFileSync(join(build.dir, '_redirects'), 'utf8')
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#'))
            .map((l) => l.split(/\s+/)[0]),
        )
      : new Set();
    const ids = new Map();
    const idsOf = (file) => {
      if (!ids.has(file)) {
        const html = readFileSync(join(build.dir, file), 'utf8');
        ids.set(file, new Set([...html.matchAll(/\s(?:id|name)="([^"]+)"/g)].map((m) => m[1])));
      }
      return ids.get(file);
    };
    const fileFor = (pathname) => {
      const p = decodeURIComponent(pathname).replace(/^\//, '');
      const bare = p.replace(/\/$/, '');
      return [p === '' ? 'index.html' : null, p, `${bare}.html`, `${bare}/index.html`].find((c) => c && files.has(c));
    };

    const dead = new Map();
    let links = 0;
    for (const page of [...files].filter((f) => f.endsWith('.html'))) {
      const html = readFileSync(join(build.dir, page), 'utf8');
      const base = new URL(pagePath(page), SITE_ORIGIN || 'https://site.invalid');
      for (const tag of tags(html, 'a|link')) {
        const href = attr(tag, 'href');
        if (href === null || href === '' || href === '#') continue;
        if (/^\/\//.test(href)) continue;
        if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !(SITE_ORIGIN && href.startsWith(SITE_ORIGIN))) continue;
        const url = new URL(href, base);
        links++;
        const target = fileFor(url.pathname);
        let problem = null;
        if (!target) {
          if (!redirects.has(url.pathname)) problem = 'no such page in this build';
        } else if (url.hash && target.endsWith('.html') && !idsOf(target).has(decodeURIComponent(url.hash.slice(1)))) {
          problem = `${pagePath(target)} has no element with id "${decodeURIComponent(url.hash.slice(1))}"`;
        }
        if (problem) {
          const key = `${href} — ${problem}`;
          if (!dead.has(key)) dead.set(key, new Set());
          dead.get(key).add(pagePath(page));
        }
      }
    }

    checks += links;
    failures += [...dead.values()].reduce((n, pages) => n + pages.size, 0);
    notes.push(`${build.name}: ${links} internal link(s), ${dead.size} dead target(s)`);
    for (const [key, pages] of dead) {
      notes.push(`    DEAD LINK ${key} — on ${pages.size} page(s): ${[...pages].slice(0, 4).join(', ')}`);
    }
  }
  return { checks, failures, notes };
}

/**
 * NO COMMENTS IN ANYTHING A VISITOR CAN DOWNLOAD.
 *
 * Source is commented freely; the built site carries none of it. A flat rule on
 * purpose: the author of a comment is the last person able to judge whether it
 * is safe to publish. This starter once served the paragraph explaining its
 * contact form's honeypot, beside the form, to the bots it existed to fool.
 *
 * Checked in the BUILD, because Astro strips an HTML comment in some positions
 * (a direct child of a component's slot) and ships it verbatim in others (inside
 * a plain element) — a grep of source flags both and half its hits are false,
 * and a fault injected in the stripped position passes. Per file type:
 *   html, svg, xml   `<!--`, plus inline <script>/<style> read as js/css
 *   css              any block comment, including `/*!` legal comments
 *   js               block comments, and line comments at the start of a line
 *                    (where a minifier leaves `//# sourceMappingURL`)
 *   txt              `#` lines (robots.txt)
 * Host-consumed files (_headers, _redirects) are never served and are skipped.
 */
function noCommentsShipped() {
  const notes = [];
  let checks = 0;
  let failures = 0;

  const jsComments = (code) => [
    ...[...code.matchAll(/\/\*[\s\S]{0,48}/g)].map((m) => m[0]),
    ...[...code.matchAll(/^[ \t]*\/\/.{0,48}/gm)].map((m) => m[0]),
  ];
  const cssComments = (code) => [...code.matchAll(/\/\*[\s\S]{0,48}/g)].map((m) => m[0]);
  const markupComments = (code) => [...code.matchAll(/<!--[\s\S]{0,48}/g)].map((m) => m[0]);

  for (const build of shippedBuilds()) {
    if (!build.ok) {
      checks++;
      failures++;
      notes.push(`${build.name}: build failed — ${build.log}`);
      continue;
    }
    let scanned = 0;
    let found = 0;
    const summaryAt = notes.length;
    notes.push('');
    for (const file of servedFiles(build.dir)) {
      const ext = file.split('.').pop().toLowerCase();
      if (!['html', 'svg', 'xml', 'css', 'js', 'mjs', 'txt'].includes(ext)) continue;
      const code = readFileSync(join(build.dir, file), 'utf8');
      let hits = [];
      if (ext === 'html') {
        hits = markupComments(code);
        for (const m of code.matchAll(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
          if (/application\/ld\+json/.test(m[2])) continue;
          hits.push(...(m[1].toLowerCase() === 'style' ? cssComments(m[3]) : jsComments(m[3])));
        }
      } else if (ext === 'svg' || ext === 'xml') hits = markupComments(code);
      else if (ext === 'css') hits = cssComments(code);
      else if (ext === 'js' || ext === 'mjs') hits = jsComments(code);
      else if (ext === 'txt') hits = [...code.matchAll(/^[ \t]*#.{0,48}/gm)].map((m) => m[0]);

      checks++;
      scanned++;
      if (hits.length) {
        failures++;
        found += hits.length;
        notes.push(
          `    ${build.name}: ${file} ships ${hits.length} comment(s) — ` +
            hits.slice(0, 2).map((h) => JSON.stringify(h.replace(/\s+/g, ' ') + '…')).join(', '),
        );
      }
    }
    notes[summaryAt] = `${build.name}: ${scanned} served file(s) scanned, ${found} comment(s)`;
  }
  if (failures) {
    notes.push(
      '    Comment in source with {/* … */} in .astro templates (compiled away) — never <!-- -->, which ships. ' +
        "CSS legal comments are stripped by astro.config.mjs's build hook.",
    );
  }
  return { checks, failures, notes };
}

/**
 * Third-party origins this system loads, and every CSP directive each one needs.
 * A script from another origin rarely needs only `script-src`: it frames, it
 * calls home. Declaring the set is what lets the CSP contract demand ALL of them
 * — the per-directive gap is exactly where a form broke in production once
 * (`connect-src` named a service the site no longer used and not the one it
 * posted to; every submission was refused by the browser).
 *
 * PROJECT: a new third party is declared here, with its reason, in the same
 * change that adds it to `_headers` and to the JS census.
 */
const THIRD_PARTY = [
  {
    origin: 'https://challenges.cloudflare.com',
    /* Per Cloudflare's Turnstile CSP reference (checked 2026-10-01): script-src
       and frame-src. NOT connect-src — the widget talks to its own origin from
       inside its iframe; only pre-clearance mode needs connect-src, and then
       'self', for the cf_clearance endpoint. The starter used to admit
       connect-src too, on an assumption nobody had checked. */
    directives: ['script-src', 'frame-src'],
    why: 'Cloudflare Turnstile on the contact form (§8): the script loads from it and renders its challenge in an iframe from it.',
  },
];

/** Where each kind of reference in the built output is governed by the CSP. */
function cspReferences(dir) {
  const refs = new Map();
  const add = (directive, url) => {
    if (!url) return;
    for (const u of url.split(',').map((c) => c.trim().split(/\s+/)[0]).filter(Boolean)) {
      if (!refs.has(directive)) refs.set(directive, new Set());
      refs.get(directive).add(u);
    }
  };
  for (const file of servedFiles(dir)) {
    const code = () => readFileSync(join(dir, file), 'utf8');
    if (file.endsWith('.html')) {
      const html = code();
      for (const t of tags(html, 'script')) add('script-src', attr(t, 'src'));
      for (const t of tags(html, 'link')) {
        const rel = (attr(t, 'rel') ?? '').toLowerCase();
        if (rel === 'stylesheet') add('style-src', attr(t, 'href'));
        if (/icon/.test(rel)) add('img-src', attr(t, 'href'));
        if (rel === 'preload' && attr(t, 'as') === 'font') add('font-src', attr(t, 'href'));
      }
      for (const t of tags(html, 'img')) {
        add('img-src', attr(t, 'src'));
        add('img-src', attr(t, 'srcset'));
      }
      for (const t of tags(html, 'source')) {
        add('img-src', attr(t, 'srcset'));
        add('media-src', attr(t, 'src'));
      }
      for (const t of tags(html, 'video|audio')) {
        add('media-src', attr(t, 'src'));
        add('media-src', attr(t, 'data-src'));
        add('img-src', attr(t, 'poster'));
      }
      for (const t of tags(html, 'iframe')) add('frame-src', attr(t, 'src'));
      for (const t of tags(html, 'form')) add('form-action', attr(t, 'action') ?? '');
      for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) cssRefs(m[1], add);
    } else if (file.endsWith('.css')) {
      cssRefs(code(), add);
    }
  }
  return refs;
}

function cssRefs(css, add) {
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    add(/\.(woff2?|ttf|otf)(\?|#|$)/i.test(m[1]) ? 'font-src' : 'img-src', m[1]);
  }
}

/** A reference as the CSP sees it: `'self'`, a scheme like `data:`, or an origin. */
function sourceOf(url) {
  if (url === '' || url.startsWith('/') && !url.startsWith('//')) return "'self'";
  if (/^data:/i.test(url)) return 'data:';
  if (/^blob:/i.test(url)) return 'blob:';
  if (!/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) return "'self'";
  const u = new URL(url, SITE_ORIGIN || 'https://site.invalid');
  return SITE_ORIGIN && u.origin === SITE_ORIGIN ? "'self'" : u.origin;
}

/** Does a CSP source list admit this source? */
function admits(list, source) {
  return list.some((s) => {
    if (s === source || s === '*' && !/^'|^(data|blob):$/.test(source)) return true;
    if (/^[a-z]+:$/.test(s) && !source.startsWith("'")) return source.startsWith(s);
    const wild = /^(https?:\/\/)?\*\.(.+)$/.exec(s);
    return Boolean(wild && /^https?:\/\//.test(source) && new URL(source).hostname.endsWith('.' + wild[2]));
  });
}

/** Parses the Content-Security-Policy set for `/*` in a build's _headers. */
function readCsp(dir) {
  const path = join(dir, '_headers');
  if (!existsSync(path)) return null;
  const line = readFileSync(path, 'utf8')
    .split('\n')
    .find((l) => /^\s*Content-Security-Policy:/i.test(l));
  if (!line) return null;
  const policy = new Map();
  for (const part of line.replace(/^\s*Content-Security-Policy:\s*/i, '').split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) policy.set(name.toLowerCase(), sources);
  }
  return policy;
}

const KEYWORD = /^'/;
const FETCH_DIRECTIVES = ['script-src', 'style-src', 'img-src', 'font-src', 'media-src', 'connect-src', 'frame-src'];

/**
 * B7 — THE CSP MATCHES WHAT THE SITE ACTUALLY LOADS, IN BOTH DIRECTIONS.
 *
 * A CSP is a response header, and `astro dev` and `astro preview` do not apply
 * `_headers`, so the policy is inert everywhere except a real deploy. No rendered
 * check can see it. This reads `_headers` beside each production-shaped build and
 * the references in that build, per directive:
 *
 *   1. everything the build loads is admitted by the directive that governs it
 *      — including every directive a declared THIRD_PARTY needs, once the build
 *      loads anything from it;
 *   2. every non-keyword source the policy admits is used by some build — which
 *      is what catches an allowlist rotting into a list of things somebody once
 *      used, or might.
 *
 * PER DIRECTIVE, not as a flat set of origins: an earlier version of this check
 * elsewhere read the policy as one set, so an origin removed from `connect-src`
 * while it stayed in `form-action` looked fine — and passed its own fault
 * injection.
 */
function cspMatchesTheSite() {
  const notes = [];
  let checks = 0;
  let failures = 0;
  const fail = (msg) => {
    failures++;
    notes.push(`    ${msg}`);
  };

  const builds = ['production', 'configured'].map(ensureBuild);
  const used = new Map();
  for (const build of builds) {
    if (!build.ok) {
      checks++;
      fail(`${build.name}: build failed — ${build.log}`);
      continue;
    }
    const policy = readCsp(build.dir);
    checks++;
    if (!policy) {
      fail(`${build.name}: no Content-Security-Policy in _headers`);
      continue;
    }
    /* The build's summary line goes ABOVE its failures, so each failure reads
       under the build it belongs to. */
    const summaryAt = notes.length;
    notes.push('');
    const governing = (d) => policy.get(d) ?? policy.get('default-src') ?? [];
    const refs = cspReferences(build.dir);
    const markUsed = (d, src) => {
      if (!used.has(d)) used.set(d, new Set());
      used.get(d).add(src);
    };

    let n = 0;
    for (const [directive, urls] of refs) {
      for (const url of urls) {
        const src = sourceOf(url);
        markUsed(directive, src);
        checks++;
        n++;
        if (!admits(governing(directive), src)) {
          fail(`${build.name}: ${directive} does not admit ${src}, which the build loads (${url.slice(0, 80)})`);
        }
      }
    }
    const referenced = new Set([...refs.values()].flatMap((u) => [...u].map(sourceOf)));
    for (const tp of THIRD_PARTY.filter((t) => referenced.has(t.origin))) {
      for (const directive of tp.directives) {
        markUsed(directive, tp.origin);
        checks++;
        if (!admits(governing(directive), tp.origin)) {
          fail(`${build.name}: ${directive} does not admit ${tp.origin}. This build loads from it, and it is declared as needing ${directive} — ${tp.why}`);
        }
      }
    }
    notes[summaryAt] = `${build.name}: ${n} reference(s) checked against the directive that governs each`;
  }

  /* Direction 2, over the union of both builds. */
  const policy = builds.find((b) => b.ok) && readCsp(builds.find((b) => b.ok).dir);
  if (policy) {
    for (const [directive, sources] of policy) {
      if (!FETCH_DIRECTIVES.includes(directive) && directive !== 'form-action') continue;
      for (const s of sources.filter((x) => !KEYWORD.test(x))) {
        checks++;
        const seen = [...(used.get(directive) ?? [])];
        if (!seen.some((src) => admits([s], src))) {
          fail(
            `${directive} admits ${s}, and no build of this site loads anything there. A permission nothing uses ` +
              "is how an allowlist rots; remove it, or declare what needs it.",
          );
        }
      }
    }
  }
  return { checks, failures, notes };
}

/**
 * §4.2 — `as` IS RESERVED FOR SECTION, AS A NAME.
 *
 * A leaf component whose `Props` declares a key called `as` can have its entire
 * `Props` type silently discarded — every prop on it stops being checked, with no
 * error anywhere. `VisuallyHidden` shipped that way: `<VisuallyHidden as={42}
 * nonsense="x">` raised nothing at all.
 *
 * The trigger is narrow (see §4.2 for the exact mechanism) and depends on an
 * unrelated detail of the file, which is precisely why the rule is about the NAME
 * rather than about the circumstances: a rule you have to re-derive per file is a
 * rule that gets it wrong once.
 *
 * A static check rather than a type probe, because the failure is the ABSENCE of
 * type errors — there is nothing for `astro check` to report. Reading the source
 * for the name is the only reliable detector.
 */
function asPropReservedForSection() {
  const notes = [];
  let checks = 0;
  let failures = 0;

  for (const file of componentFiles()) {
    const source = readFileSync(file, 'utf8');
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(source)?.[1];
    if (!frontmatter) continue;
    checks++;
    if (!/^\s*as\??\s*:/m.test(frontmatter)) continue;
    if (file.endsWith('Section.astro')) {
      notes.push(`${file}: declares \`as\` — the one sanctioned use (§4.2), typing re-verified`);
      continue;
    }
    failures++;
    notes.push(
      `${file}: declares an \`as\` prop. §4.2 reserves that NAME for Section — on a leaf ` +
        'component it can discard the entire Props type, silently. Rename it (headingLevel, ' +
        'element, variant …).',
    );
  }

  notes.push(`${checks} component(s) scanned for a reserved \`as\` prop`);
  return { checks, failures, notes };
}

/** Every .astro file under src/components, for the source-level contracts. */
function componentFiles() {
  const components = [];
  const walkSrc = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walkSrc(full);
      else if (full.endsWith('.astro')) components.push(full);
    }
  };
  walkSrc('src/components');
  return components;
}

/**
 * Astro — `slot` IS RESERVED, AS A PROP NAME. No exceptions.
 *
 * `slot` is Astro's slot-assignment attribute, consumed before a component sees
 * its props. So a component that declares a `slot` prop never receives it — and
 * worse, a component passed `slot="…"` as a direct child of a parent with no
 * matching named slot is DISCARDED: no error, no warning, no element. A project
 * built on this system shipped its category pages with no hero image that way,
 * with `astro check` and the whole of §9 green, because nothing in the output
 * was wrong; there was simply less of it.
 *
 * Static, for the same reason as the `as` contract: the failure is an absence,
 * and an absence gives a type checker nothing to report.
 */
function slotPropReserved() {
  const notes = [];
  let checks = 0;
  let failures = 0;

  for (const file of componentFiles()) {
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, 'utf8'))?.[1];
    if (!frontmatter) continue;
    checks++;
    if (!/^\s*slot\??\s*:/m.test(frontmatter)) continue;
    failures++;
    notes.push(
      `${file}: declares a \`slot\` prop. \`slot\` is reserved by Astro for slot assignment — the ` +
        'attribute is consumed before the component sees it, and a component passed `slot="…"` as a direct ' +
        'child of a parent with no matching named slot is silently dropped. Rename it (`label`, `name`, `area` …).',
    );
  }

  notes.push(`${checks} component(s) scanned for a reserved \`slot\` prop`);
  return { checks, failures, notes };
}

const CONTRACTS = [
  ['form ships disabled (§8)', formShipsDisabled],
  ['`as` reserved for Section (§4.2)', asPropReservedForSection],
  ['`slot` reserved by Astro', slotPropReserved],
  ['production omits styleguide (§2.4)', productionOmitsStyleguide],
  ['internal links resolve', internalLinksResolve],
  ['CSP matches the site', cspMatchesTheSite],
  ['no comments shipped', noCommentsShipped],
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

if (isMain(import.meta.url)) {
  const r = contracts();
  console.log(line(r));
  for (const n of r.notes) console.log(`         ${n}`);
  process.exit(passed(r) ? 0 : 1);
}
