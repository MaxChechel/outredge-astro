# WORKLOG

Append-only. Newest entries at the bottom.

This file is the project's memory: why something is the way it is, what broke and
why, and what is still undecided. It is not a changelog — `git log` already does
that. It exists because the reasoning behind a decision outlives the person who
made it, and because a bug fixed without its root cause recorded is a bug that
comes back wearing a different hat.

## Rules

- **Append-only.** Never edit or delete an earlier entry. A correction is a NEW
  entry that supersedes the old one, and says so. The record of having been wrong
  is part of the record.
- **Decisions carry their reasoning**, not just their outcome. "Chose X" is
  useless in six months; "chose X because Y, having measured Z" is not.
- **Bugs carry their root cause**, and the symptom that led to it.
- **Measurements are numbers**, with the conditions they were measured under.
- **Open questions are numbered** and stay numbered, so a later entry can close
  one by name.
- **Deviations from an instruction are recorded as deviations**, not quietly
  absorbed.

`AUDIT.md` is the companion file for findings and sanctioned deviations from
`ARCHITECTURE.md`. Create it when there is a first one.

---

## Template provenance

This project was created from the **outredge-system** template. The build record
for the system itself — every decision, every bug with its root cause, and the
eleven defects the harness caught before any client project existed — lives in
that repository's own WORKLOG at tag `v1.1.0`. It is worth reading once before
deviating from `ARCHITECTURE.md`.

Entries below are about **this project**.

---

## YYYY-MM-DD — Entry 0. Project start

*(Replace this. First entry records: the client, the scope, the inputs received —
brand primitives, fonts, logo, content model, domain — and anything agreed that
is not in a brief.)*

---

## 2026-10-01 — Template: TEMPLATE-NOTES section A (field report from CentiPack)

*Template work, logged here per the 2c19062 precedent: the template's tip carries
a client stub, so this entry moves to history when the template surface is next
prepared for release.*

Input: `TEMPLATE-NOTES.md`, CentiPack's field report. Treated as evidence. Every
entry was re-checked against this repo, in source AND in a fresh build, before
any change. Baseline `npm run verify`: green, 8 checks, 308 assertions — while
A1 below measured 1:1. That green is the finding section B exists to close.

**Reproduced and fixed**

- **A1 — focus ring invisible in every dark region.** Root cause: `--focus-ring`,
  `--selection-bg`, `--selection-text` are declared at `:root` as `var()` of
  tokens the theme blocks remap; a `var()` in a custom property resolves where it
  is DECLARED, so all three kept the light values. Measured before: ring
  `#1c2024` on ground `#1c2024`, 1:1, in all 6 dark regions (`/`, `/styleguide`).
  A scan of every `:root` declaration found exactly these three. Fix: restated
  in both theme blocks. After: 15.24:1 in every dark region.
- **A2 — `SectionHeader` dropped children silently.** Fix: throws at build when
  given default-slot children (not a new default slot: §4.2 defines the block as
  eyebrow + heading + lede, and a slot would grow its API). Fault-injected: a
  child passed on `/` → build exits 1 naming the header. The styleguide's
  `slot="lede"` use still builds.
- **A3 — nothing stopped an unbreakable word leaving its box.** Fix:
  `overflow-wrap: break-word` on body, `anywhere` on `code, kbd, samp`.
  Measured at 320 with a 55-char token injected: card title 277px in a 246px box
  before; 246 in 246 after, grid unchanged at 1440. A long `<code>` env var
  breaks inside its paragraph (0px spill). `hyphenate-limit-chars` deliberately
  not added (TEMPLATE-NOTES C9).
- **A4 — rotated carets overflow their box.** Wider than reported: `.faq-chevron`
  (+1–2px at all 7 widths) AND `.nav-caret` (+1–2px at 1024/1440). Fix: the
  corner moves to `::before` inside a box sized to the rotated footprint
  (s·√2 wide, s·(√2 + 0.5) tall to cover the ±25% nudge); the open/close
  transform moves with it. After: neither reports.
- **A7 — cards shipped one 800px file.** Drawn 278–393px. Fix: the adapter
  emits `srcset` (400/800/1200, clamped to the source's real width — C15) and
  `ItemCard` takes a REQUIRED `sizes` from the parent that lays it out. Every
  descriptor checked against the file with `sips`. Chosen by the browser
  (read from `currentSrc`, not `naturalWidth` — C16): 320@1x → 400w,
  320@3x → 1200w, 390@2x → 800w, 1024@1x → 400w, 1440@2x → 1200w.
  `Figure` already emitted a correct srcset and was not touched.
- **A8 — comments shipped to visitors.** 27 `<!-- -->` in source, 18 reached
  dist (C18: Astro strips some), including the paragraph explaining the contact
  form's honeypot. Fix: all 27 → `{/* */}`.

**Standing rule, from the human (2026-10-01): no comments in anything published.**
Source is commented freely; the built site carries none. Beyond A8 this meant
Tailwind's `/*! tailwindcss vX | MIT License */` banner, which its compiler
prepends unconditionally and lightningcss (Vite 8's CSS minifier) always keeps
as a legal comment, with no option. Fix: a build-only Vite hook in
`astro.config.mjs` strips `/*! */` from emitted CSS assets. Measured after, both
the styleguide build and a production build: 0 comments in HTML, SVG, XML, CSS,
JS and inline `<script>`/`<style>`. `_headers`/`_redirects` keep `#` comments —
consumed by the host, never served. Not yet enforced by a check: that is B8.

**Spec amended (§5):** the adapter's image shape is now
`{ src, srcset, width, height, alt }`, with `sizes` passed by the laying-out
parent. Taken on the human's instruction to proceed after the conflict was
raised.

**Not reproduced — no change**

- **A5 — logo shrinks in the flex row.** 112px (= `--spacing-nav-logo`) at all 7
  widths on all 3 pages. This nav has room; the flex-shrink default remains,
  latent.
- **A6 — blur scale killed by the reset.** Nothing here uses blur, and the reset
  states the trade (a utility with no token compiles to nothing; the dead-class
  check is the net). That check caught it on CentiPack: working as designed.

**Measurement traps hit while doing this — inputs for section B**

1. A ring-vs-ground reading taken against the focused element's own fill read
   7.12:1 for a ring drawn over a 1:1 band. B2 must compare against the ground
   BEHIND the outline.
2. After the fix, a real Tab onto the dark band's CTA still read 1:1. Cause:
   the button's `transition-colors` animates `outline-color` from `currentcolor`
   (its dark text), and headless reads a transition's start value (C6). Settled
   value 15.24:1, both after 1.5s and with transitions off. B2 must neutralise
   transitions before reading.
3. A spill sweep without `checkVisibility()` reported a dozen phantom offenders
   in the closed mobile menu — exactly what §9 already warns about.
4. One real spill remains, styleguide only: a `whitespace-nowrap` button row,
   +20px at 320. `overflow-wrap` cannot fix a nowrap; B3 will turn red on it.

**Environment:** `dist/` contained ten `* 2.*` files (`robots 2.txt`, eight
images, …) dated 2026-09-12 — macOS/iCloud duplicates of build output (the repo
is under `~/Documents`), which `astro build` did not clean and which would have
deployed. `dist/` deleted and rebuilt. Nothing similar in source.

`npm run verify`: PASS, 8 checks, 308 assertions.

**Open questions**

1. Stripping Tailwind's MIT banner from shipped CSS: done per the no-comments
   rule. If attribution in the served stylesheet is wanted, revert the one hook.
2. `TEMPLATE-NOTES.md` is untracked at the repo root. Committed there, it would
   land in every client project (cf. 2c19062).

---

## 2026-10-01 — Template: TEMPLATE-NOTES section B (harness holes)

*Template work; same placement note as the section A entry.*

Each new check was fault-injected before it counted: inject, watch it fail with
a legible message and exit 1, restore (diffed after every restore). Where the
injection is the section A bug the check exists for, that is said.
`npm run verify`: **PASS, 8 checks, 579 assertions** (308 before), 38s on a
clean `dist/` and `.verify/`.

**B1 — declaration sites** (`lib/contrast.mjs` `declarationSites()`, a group in
the contrast check). Root cause of the hole: `resolveColor()` resolves a var()
chain inside the theme it is asked about; the browser substitutes where the
property is declared, so the matrix modelled A1 as correct. Two assertions from
the built CSS: a `:root` token referencing a themed token is restated in every
theme; every themed token exists at `:root`. 36 assertions, 3 derived tokens.
A guard fails the group if it finds zero derived tokens (parser blind to
`:root`). Faults: A1 reverted → 3 failures naming each token; `--bg-scrim`
deleted from `:root` → "declared in dark, not at :root". Its first summary line
said "each restated" under its own failures — fixed to describe what was found.

**B2 — the ring must be VISIBLE** (keyboard check). Was: outline exists, form
controls only, pages with no enabled control skipped — so `/`, whose dark CTA
is the one place A1 showed on a real page, was never walked. Now every focus
stop on every page: `:focus-visible`, an outline, and ≥3:1 against the ground
BEHIND the outline (composited up the ancestors; colours read through a canvas
so color-mix tokens resolve to pixels). Transitions are switched off for the
walk (C6: headless reads the start value; measured 1:1 → 15.24:1 settled).
Plus: at least one ring measured inside a dark region across the run.
81 rings, 12 dark. Faults: A1 reverted → `/` CTA and 10 styleguide stops at
`#1c2024 on #1c2024 = 1:1`; PAGES cut to `/contact` → "no ring measured on a
dark ground".

**B3 — content fits its own box** (sweep). `scrollWidth > clientWidth` on
visible, non-clipping elements, deepest offender only, `checkVisibility()` with
visibility counted. First real run: one spill, the styleguide's `nowrap` button
row (+20px @320) — fixed by shortening two demo labels; buttons stay nowrap by
design. Faults: A4 reverted → chevron +2px at all 7 widths; A3 reverted with a
long title → card h3 +31px @320 / +37px @1024; control (long title, A3 fix in)
→ green. **The escape hatch failed its own test**: marking the chevron
`data-bleed` moved the report up to its `<summary>`, because the exemption only
looked at the marked element's box, not its own overflow. Fixed; re-tested both
ways (marked → green, unmarked → red).

**B4 — `slot` reserved** (contracts). Fault: `slot?: string` in Figure → red.

**B6 — internal links resolve, fragments included** (contracts), against dist/
and two production-shaped builds (`lib/builds.mjs`: `production`, and
`configured` with Cloudflare's public Turnstile TEST key). **First run found a
template bug:** the nav, footer and index page linked `/styleguide` from every
page of a production build that does not emit it (10 nav/footer links + 2 on
`/`). TEMPLATE-NOTES said those links "all exist" — true only in the styleguide
build. Fix: the route gate exposes `import.meta.env.STYLEGUIDE`;
`navigation.ts` drops unrouted links (and empty columns/groups); the index page
shows its styleguide button only when routed and points the dark CTA at Contact
otherwise; the desktop `<ul>` self-skips when empty. Faults: `/terms` in the
footer and `#moton` in the nav → red per build, per page.

**B7 — CSP matches the site, per directive, both ways** (contracts), from each
production build's `_headers`. `THIRD_PARTY` declares Turnstile and the
directives it needs. **First run: two permissions nothing used** — `img-src
data:` and `media-src https:`. Removed. Turnstile stays admitted ahead of its
env var (so the deploy that sets the key needs no `_headers` edit); a VIDEO_BASE
CDN will be demanded by direction 1 because `Clip` writes its URL into
`data-src`. Faults: Turnstile out of `frame-src` only → red, caught ONLY via the
configured build (the per-directive trap CentiPack's first version passed); out
of `script-src` → red; stale `https://api.old-crm.example` in `connect-src` → red.

**B8 — no comments in anything served** (contracts; the human's standing rule
from 2026-10-01). html/svg/xml `<!--`, inline script/style, css (legal comments
included), js, robots.txt `#`; host files skipped. Faults: `<!-- -->` inside a
plain `<div>` on `/` (C18's shipping position) plus the CSS banner hook removed
→ both reported in all three builds; a comment in an `is:inline` script → red.

**B9 — external scripts declared** (JS census `EXTERNAL`, exact URL, reason
required, no budget), looked for in all three builds. Faults: list emptied →
Turnstile UNDECLARED (in `configured` only — dist never contained it, so the old
hard-fail could not have fired either); reason blanked → red; URL changed to
`/v1/` → undeclared. **Hole found and closed on the way:** the census read inline
scripts only in dist/, so a script shipped only when configured escaped it.
Now censused across builds, deduplicated against dist/ only — dist's per-page
total is unchanged (1,714 B across 6), deliberately. Fault: an unnamed inline
script in the configured build only → UNNAMED.

**B11 — every navigation surface leads somewhere** (sweep, from the DOM, once
per page): mobile menu, each desktop panel, footer nav each contain a link;
mobile and desktop offer the same destinations (logo excluded). Faults (C22's
two shapes): mobile column links lose `href` → "reachable on desktop, missing
from the mobile menu: …" (9 hrefs); plus Contact → "mobile menu contains no
links".

**Not built, with reasons**
- **B5** (inverse and fade matrices). The template has no inverse fill beyond
  accent/accent-contrast, already in the accent group, and no fade group (that
  arrives with D3). Nothing for either matrix to compute.
- **B10** (text over a photograph). Nothing in the template sets type on an
  image, so the check would have no subject and no reachable red path on real
  content. Also: TEMPLATE-NOTES section E says the template "ships
  `--scrim-strength` and uses it" — not this repo. It has `--bg-scrim` (and a
  `bg-scrim` utility), used by nothing.

**Spec (§9)** now states: content fits its own box and `data-bleed`; navigation
surfaces; token declaration sites; the shipped-build contracts (links, CSP both
ways per directive, no comments, external scripts); keyboard rings measured at
3:1 on their ground with a dark region exercised.

**Lighthouse gate** (`npm run lighthouse`, wrangler@4, mobile, pre-CDN):
`/` 100/100/100/100; `/styleguide` 100/100/**96**/— (seo not audited, noindex).
The 96 is `font-size` (41% of styleguide text under 12px: `.sg-meta`, code).
**Not caused by this work:** the same 96 on an untouched worktree at 2c19062.
The last recorded gate (v1.1.0 era) was 100.

**Open questions**

3. `/styleguide` best-practices 96 (`font-size`). Either a commit after the last
   recorded gate made styleguide text smaller, or Lighthouse 12's floating minor
   moved/changed the audit. Fixing it means changing styleguide type sizes —
   not done without a ruling.
4. Turnstile's `connect-src` entry is the template's existing declaration,
   carried into `THIRD_PARTY`; not re-verified against Cloudflare's current CSP
   documentation in this pass.

---

## 2026-10-01 — Template: TEMPLATE-NOTES section D (promotions from CentiPack)

*Template work; same placement note as the section A entry.*

Every entry was read against §4.2/§4.5/§11 before anything was built. §11:
"Not a generic component library. The base kit ships in the starter;
everything else is built when a project's content demands it." That rules out
promoting CentiPack's components as such; those are questions, below.
CentiPack (`../centipack`) read only, never written.

`npm run verify`: **PASS, 8 checks, 609 assertions.** Lighthouse: `/`
100/100/100/100; `/styleguide` 100/100/96/— (the pre-existing `font-size`
finding, open question 3, unchanged).

**Done**

- **D1 — `slug` is a schema field.** The template had `slug: entry.id`, and
  `getItemBody()` looked entries up by id. Now `slug` is required in the schema
  (kebab-case), the adapter reads `entry.data.slug`, and `getItemBody()` finds
  by the field. Shown: with `item-one.mdx` renamed so its id is no longer its
  slug, the build passes and the styleguide still renders that item's body
  (`getEntry` by id would have thrown). `.strict()` was already in place; the
  `render()` helper is not dead here (the styleguide renders a body); the
  remote-image branch is the CMS swap's own work, not built ahead of it.
  **Trap found:** Astro's `glob()` loader reads a frontmatter `slug` AS the entry
  id, and on a duplicate it keeps one entry and DROPS the other with only a
  `[WARN]` — exit 0, one item gone. The adapter's own duplicate guard (kept, for
  CMS loaders, which pass duplicates through) never sees it. Recorded in
  README; see open question 6. The styleguide's printed copy of the adapter
  still showed `Number(image.attributes.width)` — the C15 pattern A7 removed —
  updated to match the code.
  Content-layer cache: a renamed content file failed the build until `.astro/`
  was cleared — environmental, not the change.
- **D4 — a sideways scroller says so.** `.scroll-x` in global.css: the
  four-layer scroll shadow, CSS only (taken from CentiPack's history — their tip
  replaced it with a gutter bleed, a design call of theirs). The cover ground is
  `var(--scroll-ground, var(--bg-base))` used directly in the rule, so it
  resolves per theme (C1). Enforced in the sweep: an element that actually
  scrolls horizontally must carry `background-attachment: local` or sit in
  `data-bleed`. Fault: `scroll-x` removed → the styleguide's four code samples
  fail at 320–430 (up to 637px of content in 244px). The contrast matrix also
  carries it, but measured: it fits at every width, so there it is prevention,
  not a fix.
- **D10 — icons.** The template shipped no favicon at all. `scripts/build-icons.mjs`
  (run by hand, output committed; `sharp` is Astro's own dependency) builds
  `favicon.svg` (prefers-color-scheme inside the file), `favicon.ico` (32×32,
  ICO container written by hand) and `apple-touch-icon.png` (180, inset) from
  `src/assets/brand/icon.svg` — the template's existing "O" mark, extracted from
  the Logo's last path, not a new asset — in the ink of `--gray-950`/`--gray-50`
  on `--gray-0`, read from global.css. **Bug caught in my own script:** sharp
  runs `composite` after `flatten` whatever the call order, so the first version
  shipped an alpha channel while claiming to flatten; now two passes, verified
  `hasAlpha: no`. No share image: the template has none, and `ogImage` stays a
  per-page prop. Guarded without new code: B6 checks `<link>` hrefs — fault,
  `favicon.ico` deleted → dead in all three builds.
- **D11 — one `@graph`** in BaseLayout: Organization (name, url, description,
  logo = the touch icon), WebSite (publisher, inLanguage), the page (`pageType`:
  `'WebPage' | 'ContactPage'`, isPartOf). Every value is one the site already
  states; no SearchAction. Contact passes `ContactPage`. Read in the built HTML.
- **D9** was section B.

Spec: §4.3 (structured data), §5 (slug), §7 (icons), §9 (sideways scrollers).
README: icons step, slug rule and the glob trap.

**Not done — the spec rules them out as template work** (questions, below)
- **D2 `Media`, D3 `.fade-group`, D6 `Breadcrumb`, D7 rail** — components with no
  consumer in the template. §11 says they are built when a project's content
  demands it.
- **D5 two lockups from one asset** — specific to a badge+wordmark logo; this
  template's mark has no badge, and A5 did not reproduce.
- **D8 launch gate** — no route family here to gate. The principle (a link to a
  route the build does not emit is a 404 nothing catches) is now applied to the
  styleguide route and enforced by B6.

**Found outside section D — NOT fixed, awaiting a ruling**

The custom select's popup is INVISIBLE in current Chrome. `global.css` styles
`select::picker(select)` with `opacity: 0` and reveals it in
`select::picker(select):popover-open`. Lightning CSS rejects that selector
("Invalid pseudo class after pseudo element") and drops the rule: the build
warns on every run, and `popover-open` appears 0 times in the built CSS.
Measured in Chrome 154 on `/styleguide`: Space opens the select (`:open` true),
and 1.2s later the picker's computed opacity is `0`; screenshot shows no list.
Every native select on every site built from the template. The likely fix is
`select:open::picker(select)` — not applied, because it is outside this phase.
No check caught it because nothing opens a select, and the build's CSS warnings
are printed and never read.

**Open questions**

5. Fix the invisible select popup now (above)? And make the harness fail on
   build warnings — the CSS minifier dropping a rule and the glob loader dropping
   a duplicate entry both arrive only as `[WARN]` lines on a green build.
6. The glob duplicate-slug drop, specifically — covered by question 5's check
   if taken; otherwise it stays a documented trap.
7. D2/D3/D6/D7: leave them in CentiPack (my reading of §11), or keep them
   somewhere as reference recipes outside the shipped kit?

---

## 2026-10-01 — Template: open questions 1, 3, 4, 5, 6, 7 closed

*Template work; same placement note as the section A entry.* The human approved
the recommendations at the section D gate ("all good, continue").

**Q5 — the invisible select popup: fixed.** `.select-wrap select::picker(select):popover-open`
→ `.select-wrap select:open::picker(select)`. Root cause: only user-action
pseudo-classes may follow a pseudo-element, so Lightning CSS dropped the rule,
leaving the popup at its base `opacity: 0`. Measured in Chrome 154 after: Space
opens the select, picker opacity `1`, and the list is drawn (screenshot). The
`@starting-style` entry state ships with it.

**Q5/Q6 — new check, `build warnings`** (run.mjs, `lib/builds.mjs`): the
styleguide, production and configured builds must print no warnings. Excluded:
Node 24's type-stripping ExperimentalWarning and its hint line — the runtime
announcing a Node feature because astro.config.mjs imports a .ts file, not the
build. Fault (both at once): old picker selector + a duplicate slug → 9
failures across the three builds, exit 1. The first report printed the CSS
code frame's context lines rather than the offending selector, and its
look-ahead attached the CSS caret message to the glob warning; both fixed, so
it now reads `… select::picker(select):popover-open { — Invalid pseudo class
after pseudo element …` and names the two files sharing a slug. Note: Astro keeps
a content store in `node_modules/.astro` as well as `.astro/`; a stale one
replayed the duplicate-slug warning after the fault was reverted. Clearing both
cleared it.

**Q3 — `/styleguide` best-practices 96: a regression, fixed.** Not Lighthouse
drift: bisected with today's Lighthouse — 714e0da (where 100 was recorded) 100,
12f3a2a 100, **aa79517 "Form atoms" 96**. That commit shrank nothing; it added
enough 0.72rem (11.52px) annotation that more than 40% of the page's text fell
under 12px, Lighthouse's legibility line. The styleguide's own chrome used nine
hardcoded sizes from 0.6rem to 0.72rem, all below the system's smallest type
token (`--text-eyebrow`, 12px minimum). All nine now use `--sg-small: 0.75rem`
— the floor, not the least change that clears 40%. Sweep: no spills at the new
size. **Lighthouse now: `/` 100/100/100/100, `/styleguide` 100/100/100/—.**

**Q4 — Turnstile's CSP: corrected.** Cloudflare's Turnstile CSP reference:
`script-src` and `frame-src` on challenges.cloudflare.com; `connect-src` only
`'self'`, and only for pre-clearance. The template admitted `connect-src
https://challenges.cloudflare.com`, and `THIRD_PARTY` (section B) had copied
that assumption, which is why B7 passed it. Correcting the declaration alone
turned B7 red on the shipped header ("connect-src admits … no build loads
anything there"); removing it from `_headers` turned it green.

**Q1 — Tailwind's licence banner** stays stripped. **Q7 — D2/D3/D6/D7** stay in
CentiPack (§11). **Q2 — `TEMPLATE-NOTES.md`** is still untracked at the root,
which is the human's to place.

`npm run verify`: **PASS, 9 checks, 610 assertions.** Spec §9: build warnings.
