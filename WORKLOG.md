# WORKLOG — outredge-system

Append-only. Newest entries at the bottom. Decisions, reasoning, bugs with root
cause, and numbered open questions. Never edited retroactively; corrections are
new entries that supersede old ones.

Provenance vocabulary used throughout:

- **ported** — lifted from the reference implementation essentially unchanged.
- **genericized** — lifted, then stripped of Outredge-specific content/values.
- **new** — written here, because the reference had no equivalent.

---

## 2026-09-11 — Entry 0. Inputs located, ground rules set

**Reference implementation.** The brief names `../Outredge`. No such directory
exists on this machine. The reference implementation is at
`/Users/maksimcecel/Desktop/outredge website` — an Astro repo carrying
`ARCHITECTURE.md`, `AUDIT.md`, a 75 KB `WORKLOG.md`, the component kit, the
verify harness and the utility scripts described in the brief. Identified by
content, not by name. Treated strictly read-only for the whole build.

**Not found anywhere on disk:** `styleguide-mock-v2.html`, referenced by the
brief as "a reviewed mock exists at styleguide-mock-v2.html" for Phase 1. See
question Q1.

**Also absent from the reference, contrary to what the brief assumes:**

- A scroll-reveal system. `global.css` reserves `[data-reveal]` under
  `prefers-reduced-motion` and `CircleBg` carries a `data-reveal-path` hook with
  the comment "when the scroll-reveal system lands it can take these over" — but
  no reveal module exists in `src/scripts/`. Brief item 12 says "the ported
  native reveal system"; there is nothing to port. It will be **new**, built to
  the hooks the reference reserved.
- A JS-census script and an `astro check` wrapper in `scripts/verify/`. That
  directory holds `cdp.mjs`, `sweep.mjs`, `axe.mjs` only. The census and the
  check were run by hand in the reference. Brief Phase 2 lists both as part of
  "port wholesale"; they will be **new**, in the harness, per §9's
  "the harness is part of the repo" rule.
- `scripts/springs/`. New.

**Ground rules in force:** never modify the reference; WORKLOG append-only;
phase-gated with a stop at each gate, closed only by the human; §9 verification
applies to this repo itself.

### Open questions

1. **`styleguide-mock-v2.html`** is not on this machine. Phase 1 needs it for
   "structure and annotation density". Proceeding on the brief's prose
   description of the required sections; the mock can be diffed against the
   result at the Phase 1 gate if it surfaces.

---

## 2026-09-11 — Entry 1. Phase 0: scaffold + tokens

### What shipped

| file | provenance | note |
| --- | --- | --- |
| `ARCHITECTURE.md` | genericized | Reference spec + all 13 amendments + the scanner rule + two namespace findings below. Bumped to v3. |
| `src/styles/global.css` | genericized | Restructured to the amended architecture. Shares the reference's layer model, base reset and several component blocks; the token layer is new. |
| `src/styles/springs.css` | new (generated) | Committed output of `scripts/springs/generate.mjs`. |
| `scripts/springs/generate.mjs` | new | No equivalent in the reference. |
| `src/lib/urls.ts` | ported | Byte-identical. Nothing in it was Outredge-specific. |
| `astro.config.mjs` | genericized | Same skeleton; site URL and fonts are placeholders, one new `cssTarget` line (see finding 3). |
| `tsconfig.json` | ported | Including the `exclude` fix and a comment saying why it is there. |
| `package.json` | new | Reference's script set minus its Outredge-only preview task, plus `springs`. |
| `src/pages/index.astro` | new | A token smoke page, not a deliverable. Phase 1 replaces it with the styleguide. |

Nothing Outredge-specific came across: no copy, no client assets, no case-study
collection, no data modules.

### Three silent-failure bugs found and fixed

All three were found by grepping `dist/`, not by reading source. All three
produce CSS that looks correct and a token that does not exist at runtime. This
is the §2.2 "typo'd utilities compile to nothing" cost, arriving from three
directions at once.

**1. `--duration-*` is not a Tailwind v4 namespace — and the reference ships this
bug live.**
The `duration` utility resolves `themeKeys: ["--transition-duration"]`
(verified in `node_modules/tailwindcss/dist/lib.js`). So `--duration-base: 300ms`
emits the variable and generates no `duration-base` utility. `class="duration-base"`
styles nothing, and the transition silently falls back to Tailwind's 150 ms
default. Confirmed in the reference's own `dist/`: `duration-base` appears in the
markup and there is no `.duration-base` rule anywhere in its built CSS.

The brief's amendment 12 names these `--dur-*`, which fails the same way. Tokens
here are `--transition-duration-fast/base/slow`. Recorded in ARCHITECTURE §2 as a
general rule: *a token namespace is a fact about Tailwind, not a naming
preference.*

**2. `linear()` cannot live in `@theme`.**
`@tailwindcss/vite` runs Lightning CSS with browser targets **hardcoded** in
`@tailwindcss/node` (safari 16.4, ios_saf 16.4, chrome 111, firefox 128); they are
not configurable from userland. `linear()` easing shipped in Safari 17.2, so
Lightning CSS deletes every `linear()` it recognises as a timing function — and
inside `@theme`, `--ease-*` is exactly that namespace. Result: both spring tokens
vanished from `dist` and `ease-spring-soft` resolved to nothing.

Probed it: a `linear()` value on a plain `:root` custom property survives; the
same value in `@theme` does not. So the generated file carries the curves as
plain custom properties (`--spring-soft`) and `global.css` declares `var()`
pointers (`--ease-spring-soft: var(--spring-soft)`) inside `@theme` — a value
Lightning CSS cannot evaluate is a value it cannot reject. The pointers are what
generate the `ease-spring-*` utilities.

**3. The documented `cubic-bezier`-then-`linear()` fallback pattern does not
survive the build.**
Brief amendment 12 specifies "declared with a `cubic-bezier` fallback first,
`linear()` override after". Lightning CSS dedupes repeated custom-property
declarations in one rule and keeps the last, so the fallback is deleted before it
ships — a fallback that is present in source and absent from `dist`. Emitted as an
`@supports not (transition-timing-function: linear(0, 1))` override instead:
nothing dedupes across at-rules, and a browser without `linear()` evaluates the
condition as true. **Deviation from the brief's literal wording; the intent —
degrade to a close ease-out — is met.**

A fourth related change: `vite.build.cssTarget` is set to a 2023 baseline in
`astro.config.mjs`. It turned out not to be the cause of finding 2, but Vite's
stock `chrome87/safari14` baseline is wrong for a repo that ships `linear()`,
`color-mix()` and `::details-content`, and leaving it would have made the next
such deletion harder to diagnose.

### Decisions

**Container primitive: a `@utility` pair, not `Container.astro`.** (Amendment 9
asked for a proposal.) Section already renders the inner element the container
belongs on, so a component adds a DOM node per section for nothing; and Nav and
Footer need the same behaviour on elements they already own. `container-main` /
`container-narrow` / `container-full`.

**Layout tokens leave `@theme` too, extending amendment 4's mechanism to
amendment 9's rule.** Amendment 4 moves semantic colours out of `--color-*` so
illegal cross-use does not compile. The same move applied to `--container-*`
means `max-w-main` does not exist, which makes "no `max-w-container-*` on
children" a compile-time boundary rather than a review item. `--site-margin` is
likewise a plain property, so no `p-site-margin` is generable. Verified: 13
illegal utilities absent from `dist`, 26 legal ones present.

**Primitives also leave `--color-*`.** Amendment 4 only requires it of semantic
colours, but leaving the ramp in `--color-*` would keep `bg-gray-500` compiling —
a bypass around the whole semantic layer. Three keywords are re-declared
(`transparent`, `current`, `inherit`); they are not colours.

**`--spacing-*`, not `--space-*`** (amendment 8 writes the latter). Read as naming
the *steps*, not renaming the namespace: amendment 8 also says the section trio
and nav token are "unchanged", and those are `--spacing-section-*` /
`--spacing-nav` in the reference. Renaming the namespace would stop every `p-*`,
`m-*` and `gap-*` in the codebase from compiling, silently. See question Q2.

**`--line-strong` kept alongside `--line`.** Amendment 4 lists only `--line`. The
reference carried `--color-border` and `--color-border-strong`, so this is a port,
not an invention, and the two have different duties: a divider is decorative,
while a control boundary carries WCAG 1.4.11's 3:1. Measured — in dark,
`gray-600` gives 2.75:1 against `bg-surface` and misses; `gray-500` clears at
4.04:1. A single `--line` token could not have served both.

**Both themes ship designed; the dark ground set is an ascending ladder.** In
light, `surface` is lighter than `base` and `subtle` is darker. Mirroring that on
dark is impossible — there is no perceptual room below the page ground (L*12 →
L*7 is invisible and crushes on OLED) — so dark runs base → subtle → surface
upward. `--bg-surface` sits lighter than `--bg-base` in both themes; it is
`subtle`'s direction that flips. Written up as derivation rule 2 in
`ARCHITECTURE.md` §2.4 and in `global.css`.

**Springs: `spring-soft` ζ=0.898 / 400 ms, `spring-snappy` ζ=0.679 / 280 ms.**
Soft has a whisper of overshoot and is the default; snappy overshoots to 1.055 and
is for reveals. Emitted through Ramer–Douglas–Peucker simplification at a 0.0015
tolerance rather than on a fixed grid, so the overshoot peak keeps its resolution
and the tail does not waste stops: 21 and 24 stops respectively.

### Measured

- Built CSS for the token smoke page: **19,182 B raw, 5,154 B gzipped.** No
  component kit in it yet.
- `astro check`: 0 errors, 0 warnings, 0 hints.
- Utility audit against `dist`: **26 legal utilities present, 0 missing; 13
  illegal utilities checked, 0 leaked.** (Run by hand this phase; it becomes a
  script in Phase 2 so it reports its own count per §9.)

### Contrast matrix — computed, 18/18

Tuned by moving the primitive ramp, per §2.3. The ramp is generated at even CIE
L\* steps with a constant low cool chroma (Lab a\*=-0.6, b\*=-3.2, tapered near
white where the blue channel clips). Even L\* spacing is what let the semantic
layer find steps that clear AA — the first ramp I tried had a 400→500 gap that
straddled the floor on dark (7.14:1 then 3.93:1, nothing usable between).

| | bg-base | bg-subtle | bg-surface |
| --- | --- | --- | --- |
| **light** primary | 15.95 | 14.07 | 16.39 |
| **light** secondary | 8.43 | 7.44 | 8.66 |
| **light** tertiary | 5.83 | **5.14** | 5.98 |
| **dark** primary | 15.24 | 13.41 | 11.50 |
| **dark** secondary | 9.63 | 8.47 | 7.26 |
| **dark** tertiary | 6.69 | 5.89 | **5.05** |

18 pairs, 0 below 4.5:1. The floor is 5.05 — a deliberate ~0.5 margin, so a
client rebrand has room to move without the three text tokens collapsing into
two. Plus 8 accent pairs (accent on each ground, accent-contrast on accent),
also all passing; the matrix script in Phase 2 reports the core 18 and the accent
group separately, each with its own count.

### Open questions

2. **`--space-*` vs `--spacing-*`** (amendment 8). Proceeding with `--spacing-*`
   for the reason above. Confirm at the gate.
3. **`--dur-*` vs `--transition-duration-*`** (amendment 12). Proceeding with
   `--transition-duration-*` because it is the only name that generates
   `duration-*`. Confirm at the gate. This one is not a judgement call — the
   brief's name cannot work — but it is a visible deviation from the brief.
4. **The accent placeholder is a real blue, not monochrome.** The reference site
   was deliberately monochrome and resolved `--color-accent` to the text colour.
   A starter that does that ships an accent nobody can see fail. Two placeholder
   steps (`#3861af` light, `#8ba8fe` dark) are in, both AA-verified. Say if the
   starter should instead ship monochrome and leave the accent slot resolving to
   `--text-primary`.
5. **The fallback pattern deviation** (finding 3 above) — flagging explicitly
   because amendment 12 specifies the mechanism, not just the outcome.

**Phase 0 complete. Stopping for review.**

---

## 2026-09-11 — Entry 2. Rulings 1–5 applied

All five closed as ruled. Nothing to add on Q2 (`--spacing-*`) — already shipped
that way.

- **Q3 → spec updated, deviation retired.** `ARCHITECTURE.md` §2 and §12.1 name
  `--transition-duration-*` as the real namespace, so it is the rule rather than a
  departure from one.
- **Q4 → accent stays a real colour**, and is recorded as a deliberate improvement
  on the brief rather than a liberty: the reference site is monochrome by design,
  and a starter whose accent resolves to `--text-primary` looks correct with the
  accent wiring completely broken. The starter is the one artefact whose job is to
  exercise everything. Both values carry `/* PROJECT: replace */`, which is now a
  stated convention — the marker is what the README retheme checklist greps for —
  and the ramp's first step carries it too, since it is the same swap surface.
- **Q5 → the dedupe behaviour is documented in `global.css`** next to the pointer
  note, generalised: *any two-declaration fallback written anywhere in this file is
  a fallback that will not ship.*

**Inputs.** `styleguide-mock-v2.html` arrived and is the basis for Phase 1. The
native reveal module has not; per the ruling, everything else is built and the
reveal hooks are left dormant — see Entry 3.

---

## 2026-09-11 — Entry 3. Phase 1: component kit + styleguide

### Provenance

| file | provenance | note |
| --- | --- | --- |
| `src/components/Section.astro` | genericized | Same shape and same `<Tag>` ruling; container utilities replace `max-w-*`, `reveal` added, `theme` widened to include dark. |
| `atoms/Button.astro` | genericized | Same API. Variants rewritten onto the accent/line tokens; sizes now use control-height tokens rather than optical padding tuned to one typeface. |
| `atoms/TextLink.astro` | genericized | The reference's open fidelity question (underline in border colour vs currentColor) is settled here: line colour at rest, accent on hover. |
| `atoms/VisuallyHidden.astro`, `atoms/JsonLd.astro` | ported | Unchanged but for comments. |
| `atoms/FormField.astro` | genericized | Rewritten to §4.1: the reference wrapped its control in the label; the spec asks for explicit `for`/`id` plus `aria-describedby`, which a wrapping label cannot give the error. Border moved to `--line-strong` (WCAG 1.4.11). |
| `atoms/Logo.astro` | new | Placeholder wordmark, drawn rather than set in type so it carries no font dependency. |
| `atoms/ClientLogo.astro` | genericized | Kept the viewBox→`aspect-ratio` derivation verbatim; that bug is expensive and already paid for. Slug union replaced by `string` + a build-time throw, since a starter cannot know client names. |
| `blocks/SectionHeader.astro` | genericized | Reference version was welded to one page's layout (a bordered two-column band with its own `px-gutter`, which is a §4.4 violation). Rebuilt as eyebrow + heading + lede with stacked/split layouts and no gutter of its own. |
| `blocks/Faq.astro` | genericized | Same `::details-content` technique, now spring-eased. |
| `blocks/CtaBanner.astro` | genericized | **Now a block, not a Section** — see deviations. |
| `blocks/LogoStrip.astro` | genericized | Including the reference's reconciliation ruling that the label is a `<p>`. |
| `blocks/ItemCard.astro` | new | The card pattern's worked example. |
| `mdx/Figure.astro`, `mdx/Lede.astro`, `mdx/index.ts` | genericized | |
| `mdx/Clip.astro` | genericized | Ported whole, including every media rule. Not rendered — see deviations. |
| `scripts/clips.ts` | ported | Byte-identical. |
| `scripts/disclosure.ts` | new | No equivalent in the reference. |
| `shells/BaseLayout.astro` | genericized | Fonts and favicons are commented placeholder slots; og:image is optional rather than required-with-a-default. |
| `shells/Nav.astro` | genericized | Same one-source-of-truth links and the same `<details>` mobile menu; the dropdown group is new. |
| `shells/Footer.astro` | genericized | Now a Section, so it gets the container from the same place Nav and Section do. |
| `content.config.ts`, `lib/items.ts`, `content/items/*` | new | The CMS-shaped demo collection and its adapter. |
| `scripts/verify/lib/contrast.mjs` | new | Shared by the styleguide and (Phase 2) the contrast check. |
| `src/pages/_styleguide.astro` | new | Structure and annotation density from `styleguide-mock-v2.html`, extended per the brief. |

### Two more silent-failure bugs

**4. An `as` prop on a leaf component silently discards its entire `Props` type.**
`CtaBanner` declared `as?: 'h2' | 'h3'` and rendered literal elements — no
`<Tag>`, no dynamic tag anywhere. `astro check` typed it as `IntrinsicAttributes`
with no `& Props`, which means **every prop on that component stopped being
checked**. Bisected to the prop NAME: renaming `as` → `headingLevel` restored
`IntrinsicAttributes & Props` with no other change. Verified in both directions
with a deliberate bogus prop.

§4.2's dynamic-tag caveat already reserved `<Tag>` for Section; it turns out the
name has to be reserved too, and §4.2's own vocabulary (`headingLevel`) was the
right one all along. `SectionHeader` was renamed as well — it had not tripped the
bug, but it was a landmine. ARCHITECTURE §4.2 amended. Only `Section` uses `as`.

**5. The §9 sweep reports phantom overflow offenders for every closed
`<details>`.** At 390px the sweep flagged five mobile-menu links overflowing to
x=443 on a 390px viewport — while `scrollWidth === clientWidth`, i.e. no actual
overflow. Cause: a closed `<details>` hides its contents through
`content-visibility`, which skips them from rendering and from the document's
scroll extent but leaves `getBoundingClientRect()` returning their last laid-out
geometry. Opening the menu: zero overflowing elements, `scrollWidth` still 390.

The reference's sweep has no `checkVisibility()` filter, so it would report these
on any site with a mobile menu. Added to ARCHITECTURE §9 and implemented in the
sweep used below; Phase 2 ports it into `scripts/verify/`.

### Two a11y findings, both in the styleguide's own furniture

axe found both; both are worth recording because the page's job is to demonstrate
the rules it was breaking.

1. **Ramp swatch labels used `mix-blend-mode: difference`** over white — which axe
   cannot evaluate at all and which genuinely fails on the mid-ramp. Replaced by
   choosing black or white per swatch at build time with the same
   `contrastRatio()` the matrix uses, plus a build-time throw if neither clears AA
   on some swatch (which would be a ramp problem, not a label problem).
2. **`.sg-matrix-ratio` had `opacity: 0.8`**, which knocked the
   tertiary-on-`bg-subtle` cell — the tightest pair in the light theme at 5.14:1 —
   below 4.5. The page that exists to prove the contrast rule was failing it, by
   ad-hoc alpha, which is the exact thing §2.3 bans in markup. Removed; the note
   in the CSS says why.

### Decisions and deviations

**CtaBanner is a block, not a Section.** The reference version wrapped its own
`<Section>`, which meant a page could not place it anywhere but full-width at the
foot — precisely the layout decision §4.4 keeps out of blocks. It now renders no
rhythm and no container; a page wraps it like anything else. Its `theme` prop
makes it a themed island, which is the one-attribute theme swap doing real work.

**`Figure` and `Clip` live in `src/components/mdx/`, not `blocks/`.** The brief's
Phase 1 list groups them under Blocks; ARCHITECTURE §4.2 says explicitly that they
are not blocks but content vocabulary, reachable only from an MDX body (§4.5).
ARCHITECTURE is law, so it wins. Flagging the discrepancy rather than silently
choosing.

**`Clip` ships but is not rendered.** No video ships with the starter —
`VIDEO_BASE` is a per-project decision, and `ffmpeg` is not on this machine to
fabricate one. Rendering it would mean a deliberate broken media reference in a
repo whose whole point is that references are verified. The component and its
module are complete and ported; the first project with real media exercises them.
The brief's Phase 3 JS census language ("only where rendered") already allows for
this. See question Q6.

**The reveal system is dormant, per the ruling.** `Section`'s `reveal` prop sets
`data-reveal-group` on the inner container and nothing else. It deliberately does
NOT set `data-reveal`, because global.css hands `[data-reveal]` `opacity: 0` and
there is nothing on the page able to turn it back on. Verified in `dist`: two
`data-reveal-group` attributes, zero `data-reveal` attributes. The CSS contract,
the stagger custom property and the no-JS fallback are all in place; wiring is
adding `data-reveal` to children and the `.js` one-liner to `BaseLayout` — and
that one-liner must be blocking in `<head>`, not deferred, or every revealed
element paints visible and then snaps to hidden.

**The styleguide gate is an injected route, not a `noindex`.** `_styleguide.astro`
is underscore-prefixed so Astro never routes it; a small integration in
`astro.config.mjs` injects `/styleguide` for `astro dev` and for
`INCLUDE_STYLEGUIDE=1`. A production build emits nothing for it — no orphan HTML,
nothing in a sitemap. `noindex` is a request; not existing is a fact.

**The contrast matrix on the page is computed, not written.** It reads
`global.css` through a `?raw` import and the shared `scripts/verify/lib/contrast.mjs`
— the same module Phase 2's check will run against `dist`. Hand-written ratios go
stale the first time someone nudges a primitive. (`readFileSync` does not work
here: frontmatter is bundled before it runs, so `import.meta.url` points into
`dist/.prerender/`. Cost me one build.)

**The styleguide's chrome is a scoped `<style>` in the page, not in global.css.**
A starter whose global stylesheet carries its own documentation furniture ships
that furniture to every client project.

### Measured

- `astro check`: **0 errors, 0 warnings, 0 hints.**
- Sweep at 320/360/390/430/768/1024/1440 across both pages:
  **14 page/width checks, 0 failures** — no overflow, exactly one `h1` each, zero
  heading skips, every image with dimensions and alt.
- axe-core (wcag2a/aa, 21a/aa, 22aa, best-practice) at 390 and 1440 across both
  pages: **4 page/width runs, 0 violations.**
- **JavaScript: one module, 659 B raw / 347 B gzipped** — the nav disclosure,
  inlined by Astro, so `dist` contains **zero `.js` files**. Under the brief's
  ~1 KB class. The `application/ld+json` block is data, not script, and is
  excluded by type. The Clip module ships in source and is on no page.
- CSS: **31,144 B raw / 7,403 B gzipped**, identical in both builds (the
  styleguide uses no utility a page does not).
- Pages: `index.html` 17,179 B / 4,415 B gz; `styleguide.html` 94,573 B /
  15,361 B gz — the styleguide is deliberately the densest page the system will
  ever render.

### Open questions

6. **`Clip` is unexercised.** Options: leave as is (the first real project
   exercises it); or add a ~100 KB placeholder MP4 to `public/videos/` so the
   starter demonstrates it end to end. I lean to leaving it — video in git is what
   `VIDEO_BASE` exists to avoid — but it does mean a ported module nothing has run.
7. **The placeholder wordmark reads as a word.** The drawn letterforms come out
   looking like "loredge". It is marked `PROJECT: replace` and having real wordmark
   proportions in the nav is useful, but say if you want something obviously
   abstract instead.

**Phase 1 complete. Stopping for review.**

---

## 2026-09-11 — Entry 4. Type scale renamed to roles; real wordmark

**Amendment 7 is reversed on instruction.** The scale was `--text-xs … --text-4xl`
(named for size); it is now `--text-h1 … --text-h6`, `--text-lede`,
`--text-body`, `--text-body-sm`, `--text-caption`, `--text-eyebrow` (named for
role), which is what `styleguide-mock-v2.html` had all along. The two inputs
disagreed and the mock wins.

**Every computed value is unchanged** — this is a rename, not a retune, so the
page that was reviewed still renders identically. `--text-h6`/`--text-lede` and
`--text-body-sm`/`--text-caption` resolve to the same size today but are declared
separately, so either can move later without dragging the other.

**Amendment 7's stated benefit survives the rename, and it is worth being precise
about why.** The decoupling of size from heading level lives in the CLASS, which
any element may wear — `<h2 class="text-h4">` — not in the token name. The
styleguide now demonstrates that directly (an `<h4>` wearing `.text-h2`, and an
`<h4>` wearing `.text-caption`) rather than asserting it. The one real loss,
recorded in ARCHITECTURE §2.1 so nobody rediscovers it: a large thing that is not
a heading — a stat, a pull quote, a figure number — now references `--text-h2`
and reads as though it were claiming to be one.

**The scale left `@theme` as part of the rename, and had to.** In `@theme`,
`--text-h1` generates a `text-h1` FONT-SIZE utility sitting alongside the
`.text-h1` type style — two definitions of one class name, one of which carries
only the size. Outside `@theme` there is one `.text-h1` and it is the whole
treatment, and `--text-*: initial` means no bare `text-<size>` exists at all.

That is now the third group of tokens outside `@theme`, so the pattern is stated
once as a rule rather than three times as a workaround, in ARCHITECTURE §2.1.1 and
at the head of `global.css` §1b:

> Put a token in `@theme` when every utility Tailwind would generate from it is a
> utility you want someone to be able to type. Otherwise keep it out, and expose
> exactly the roles that are legal.

**Q7 closed: the placeholder wordmark is replaced by the real Outredge mark**,
supplied by Max. This repo's own identity is Outredge, so its nav and styleguide
should carry it; it stays marked `PROJECT: replace` for client copies, and the
component still takes no fixed height so a client mark with a different aspect
ratio does not break the nav rhythm.

**Re-verified after the rename:** `astro check` 0/0/0; sweep 14 page/width checks,
0 failures; axe 4 page/width runs, 0 violations. No bare size utility leaked back
into the build (checked `text-xs` through `text-4xl`), and no Tailwind utility
shadows any type-style class.

---

## 2026-09-11 — Entry 5. Phase 2: infrastructure

### Provenance

| file | provenance | note |
| --- | --- | --- |
| `scripts/verify/lib/cdp.mjs` | genericized | Same raw-CDP driver. Chrome is now discovered across macOS/Linux paths with a `CHROME=` override and a loud failure, rather than one hardcoded macOS path. |
| `scripts/verify/lib/report.mjs` | new | The §9 counting contract, in one place. |
| `scripts/verify/lib/contrast.mjs` | new (Phase 1) | Shared by the styleguide and the check below. |
| `scripts/verify/sweep.mjs` | genericized | Same probe, plus the `checkVisibility()` filter from Entry 3 and a lazy-image force. |
| `scripts/verify/axe.mjs` | genericized | Same tags and widths; `axe-core` is now a devDependency. |
| `scripts/verify/contrast.mjs` | new | Amendment 6. |
| `scripts/verify/js-census.mjs` | new | §6's census, run by machine rather than by hand. |
| `scripts/verify/run.mjs` | new | The orchestrator behind `npm run verify`. |
| `scripts/subset-fonts.py`, `grab-posters.py`, `stage-videos.py` | genericized | Same techniques; every Webflow-export path and rename table replaced with an empty, commented `PROJECT:` table that no-ops until filled. |
| `public/_headers` | genericized | Same policy. The CSP comment now explains why `'unsafe-inline'` is not a nonce and what mitigates it. |
| `public/_redirects` | new | Ships commented-out. An empty redirects file is correct for a new site. |
| `functions/api/contact.ts` | genericized | Rewritten around the `sendLead()` boundary; see below. |
| `src/scripts/contact.ts` | genericized | Plus the ready-gate and a bfcache re-stamp. |
| `src/pages/contact.astro` | new | The client half of the pattern. |
| `README.md` | new | Including the numbered new-client checklist. |

### `npm run verify` — the §9 pass, in one command

Builds with the styleguide route on, serves it, and runs five checks against the
real output. **71 assertions on the current tree, all passing.**

| check | assertions |
| --- | --- |
| `astro check` | 1 type-check run — 0 errors, 0 warnings, 0 hints |
| contrast matrix | 38 token pairs — 18 text×bg (floor 5.05:1), 8 accent (5.16), 12 line (3.87) |
| JS census | 5 scripts found in dist, every one named and inside budget |
| overflow + structure | 21 page/width checks (3 pages × 7 widths) |
| axe-core | 6 page/width runs across 6 tag sets |

**The contrast check reads `dist`, not source, and the distinction is the whole
value.** The build is where a token can silently disappear — this system has
already lost one between source and dist (Lightning CSS deleting `linear()` from
`@theme`), and a check that read `global.css` would have reported a clean pass
over a stylesheet nobody shipped. The styleguide and the check share one module,
so if they ever disagree that is a build-pipeline bug rather than two opinions.

**The JS census makes "each byte justified" executable.** Every script in `dist`
must match a declared entry carrying a signature, a reason, and a gzipped budget.
An undeclared script fails the run; so does one that outgrew its budget. That is
what stops a 350-byte module becoming a 40 KB one over six commits with nobody
noticing. It counts inline modules as well as `.js` files — Astro inlines small
scripts, so a census that counted only files would report zero while shipping
code. `application/ld+json` is excluded by type: data, not script.

### The harness was fault-injected before being trusted

A harness that has never failed is a harness nobody has tested, and §9 exists
because this system once shipped a green result from a broken one. So:

- **a sub-AA token** (dark `--text-tertiary` moved one ramp step) → contrast check
  fails and names it: `dark --text-tertiary on --bg-surface = 4.04:1 (needs 4.5:1)
  — #8f9499 on #313539`. Exit 1.
- **an undeclared inline script** → census fails with the bytes and the rule:
  *"Every byte of JavaScript is a ruling (§6). Declare it in EXPECTED with a
  reason, or delete it."* Exit 1.
- **a check that executes nothing** → reports `EMPTY`, and `passed()` returns
  false. A pass with zero reported checks is a failure.
- Full runner exits 1 on any of the above and 0 on a clean tree, so CI can use it.

### Decisions and deviations

**`axe-core` is a devDependency, departing from the reference**, which kept it out
of `package.json` as "a one-off audit tool, not part of the build". §9 runs it
every phase, so it is not one-off — and a harness whose a11y check needs a manual
`npm pack && tar xzf` first is a check that gets skipped exactly when it matters.
devDependencies do not ship.

**`sendLead()` is a real boundary, not a comment.** Everything above it in
`functions/api/contact.ts` is validation; everything below is delivery, and it
takes a `Lead` — a plain object — rather than a `FormData`, for the same reason
the content layer has an adapter: the caller should not have to know the
destination's field names. Resend is Path A, the CRM seam is Path B, both are a
single `fetch`, and swapping touches neither the form nor the page. With no
provider configured it **refuses loudly** rather than returning success.

**`@astrojs/mdx` was missing and is now wired.** §1 and §4.5 both require MDX, the
vocabulary components existed, and nothing could render them — the integration was
simply absent from Phase 1's scaffold. `item-one` is now `.mdx` and its body is
rendered on the styleguide through `getItemBody()` + `<Content components={vocabulary} />`,
so `<Lede>` and `<Figure>` are exercised by the harness instead of merely shipped.
Passing that map is also what closes the approved list: a body can only reach a
component someone deliberately put in `src/components/mdx/index.ts`.

**`getItemBody()` lives in the adapter, and pages may call it; components may
not.** Same boundary `getItems()` draws — the adapter stays the only file that
touches `CollectionEntry`.

### One bug found by looking at the rendered page

**The contact form enabled itself on an unconfigured build.** `contact.ts` lifted
`disabled` unconditionally, so the page rendered "This form is not live yet"
directly above a working-looking submit button — the two halves disagreeing, with
the misleading half being the interactive one. The module now gates on
`data-contact-ready`, which the page sets only when a Turnstile site key exists.
No key → no widget, no third-party request, no enable. Caught by screenshotting
the page, not by any check; worth recording because it is exactly the failure the
ships-disabled rule exists to prevent, reintroduced by the code meant to implement
it.

### Measured

- **JavaScript: 1,280 B gzipped across 4 scripts, 0 `.js` files in `dist`.**
  Nav disclosure 347 B on each of three pages, contact enable 227 B on one. Clip
  is declared and on no page.
- Pages: home, contact, styleguide. `_headers` and `_redirects` ship.
- Production build still emits no styleguide route.

### Open questions

8. **Lighthouse is not automated.** §9 requires mobile Lighthouse behind real host
   config with the numbers recorded, and `npm run verify` does not run it — it
   needs a real host, and a local number would be a number nobody should trust.
   Phase 3 runs it by hand and records it. Say if you want it wired into `verify`
   against `wrangler pages dev` instead.

**Phase 2 complete. Stopping for review.**

---

## 2026-09-11 — Entry 6. Rulings applied; §2.1.1, axe, Lighthouse, contracts

All four closed as ruled.

- **§2.1.1 approved as a stated pattern**, and the framing goes further than I had
  it. The head of ARCHITECTURE §2 now names the family explicitly: the
  scanner-reads-text rule, the namespace-is-a-fact rule, §2.1.1, and the `as`-prop
  finding in §4.2 are four members of one thesis — **the compiler's reality
  outranks the documentation in your head.** Each is a place where correct-looking
  source produces nothing, silently, because a tool behaves differently from the
  mental model of it. None can be caught by review; all are caught by reading
  built output. That is stated as *why §9 is not a formality*.
- **axe as a devDependency approved**, with the framing promoted to a §9 rule:
  **a check with manual setup is a check that dies.** Anything a check needs is
  wired so `npm run verify` works on a fresh clone after `npm install`.
- **Q8 split as ruled.** Lighthouse stays out of `verify` and is now
  `npm run lighthouse`, scripted against `wrangler pages dev`. §9 states the
  permanent shape: *verify = every commit, lighthouse = every gate*, and the
  reason — an environmental audit inside the one command that must never be
  doubted teaches people to doubt it.
- **The ships-disabled rule graduated from convention to assertion**, per the
  ruling, before Phase 3's pass so the final numbers include it.

**One rule added to §9, verbatim from the ruling:**

> A harness that has never failed is a harness nobody has tested.

with the requirement it carries: every check must demonstrate its own failure mode
once — fault-inject the thing it exists to catch, watch it fail legibly with a
non-zero exit, restore — **before that check counts as part of the pass.** A check
whose red path has never run is an assertion about the harness, not about the code.

And its generalisation, which is what the whole system keeps doing:

> A rule that only convention enforces is a rule that will be broken. Convention →
> compile error where possible, convention → assertion where not. "Documented" is
> the weakest of the three and is never the resting place.

### `scripts/verify/contracts.mjs` — and it caught a bug in itself immediately

Two contracts, both rules that were previously only paragraphs:

1. **A form with no configured endpoint ships disabled** (§8). Asserted on the
   BUILT HTML, because the rule is about what a visitor receives:
   `data-contact-ready` absent ⇒ every non-honeypot control must carry `disabled`.
2. **A production build emits no styleguide route** (§2.4/§10). Runs a real
   production build into a scratch directory and looks. A leaked styleguide on a
   client site publishes that client's token values, component inventory and
   internal notes to anyone who guesses the URL.

**The first fault injection passed, and it should not have.** Removing `disabled`
from the submit control did not fail the check. Cause: the test was
`/\bdisabled\b/` on the raw tag, and every button in this system carries Tailwind's
`disabled:pointer-events-none disabled:opacity-40` in its class list — `disabled`
followed by `:` is a word boundary, so **the naive test returned true for every
button whether or not it was disabled.** The contract would have passed forever
while asserting nothing.

Fixed by blanking quoted attribute VALUES before matching, so only attribute names
remain. Re-injected: fails correctly with
`contact.html: SUBMIT CONTROL IS ENABLED on a build with no configured endpoint
(§8)`, exit 1.

That is the new §9 rule earning its place within an hour of being written. The
check that was meant to catch a class of bug was itself an instance of the class
it was written for — a check that looks right and asserts nothing.

### Every check has now demonstrated its failure mode

| check | injected fault | result |
| --- | --- | --- |
| contrast matrix | dark `--text-tertiary` moved one ramp step | `dark --text-tertiary on --bg-surface = 4.04:1 (needs 4.5:1) — #8f9499 on #313539`, exit 1 |
| JS census | an undeclared inline `<script>` | `UNNAMED script in index.html — 52 B raw` + the §6 rule, exit 1 |
| build contracts | `disabled` removed from the submit control | `SUBMIT CONTROL IS ENABLED…`, exit 1 (after fixing the check) |
| build contracts | styleguide route forced into production | `PRODUCTION BUILD EMITTED THE STYLEGUIDE: styleguide.html`, exit 1 |
| overflow + structure | a 3000px-wide child | 7 of 21 checks fail, naming the width and the element, exit 1 |
| axe-core | `<button type="button"></button>` | `button-name (critical, 1 node): Buttons must have discernible text`, exit 1 |
| the counting rule | a check reporting 0 assertions | reports `EMPTY`, `passed()` false |

Full runner exits 1 on any of these and 0 on a clean tree.

### The Lighthouse gate found a real defect on its first run

**No `/robots.txt`.** SEO 92 on the homepage, `robots-txt (0)`. The reference build
shipped `robots.txt.ts` and `sitemap.xml.ts` as routes; neither came across in
Phase 2 and nothing had noticed, because nothing had looked. Both added:

- **`robots.txt` is a route, not a file in `public/`** — the `Sitemap:` line needs
  the absolute production URL, and `site` is the only place that is declared. A
  hand-written `public/robots.txt` is a file that says the wrong hostname on the
  first project that copies this repo and forgets to edit it. No `Disallow` for
  the styleguide: a production build emits no such route, and a `Disallow` line for
  a URL that does not exist is an advertisement for it.
- **`sitemap.xml` is hand-rolled and DERIVED**, not written out. `@astrojs/sitemap`
  is one more dependency for forty lines and would need configuring to exclude the
  styleguide anyway. The page list comes from `import.meta.glob` over the routes
  that exist, filtered the same way Astro filters them — underscore-prefixed files
  are not routes, which is how the styleguide gate works, so the same filter keeps
  it out of the sitemap for free. A hand-maintained sitemap is a second source of
  truth for what the site contains, and §5's rule about second lists applies to
  URLs as much as to work items.

**The styleguide's SEO category is no longer audited, and that is not gaming it.**
The page is deliberately `noindex`, so Lighthouse's `is-crawlable` audit fails it
by design and caps its SEO score forever. Auditing SEO there measures the gate
rather than the page, and a permanently-red number is a number people learn to
scroll past — the same failure mode as flakiness inside `verify`. Performance,
accessibility and best-practices are all still measured on it, and they are what
the dense page exists to stress. The omission is printed in the output with its
reason (`not audited: seo — noindex by design`) rather than being silent.

The page was NOT thinned to protect a score. `dom-size (50)` is reported on the
styleguide and left alone: it is the densest page the system will ever render, on
purpose, and it still scores 100 for performance.

---

## 2026-09-11 — Entry 7. Phase 3: verification and handoff state

The starter is complete. This entry is the handoff record: what came from where,
what was measured, what deviates from the inputs, and what is still open.

### Provenance table — the whole repo

**ported** = lifted essentially unchanged · **genericized** = lifted, then stripped
of Outredge-specific content and values · **new** = written here, no equivalent
existed.

| file | provenance | note |
| --- | --- | --- |
| `ARCHITECTURE.md` | genericized | Reference spec, all 13 brief amendments, plus five rules earned during this build (see below). v2 → v3. |
| `README.md` | new | Stack, commands, the numbered new-client checklist, repo map. |
| `WORKLOG.md` | new | This file. |
| `package.json`, `tsconfig.json`, `.gitignore` | genericized | tsconfig keeps the `exclude` fix and the comment saying why. |
| `astro.config.mjs` | genericized | Same skeleton; `site`/fonts are placeholders; adds the styleguide-route integration and a modern `cssTarget`. |
| `src/styles/global.css` | genericized | Layer model, base reset and several component blocks share the reference's DNA; the entire token layer is new. 1,397 lines, most of them documentation. |
| `src/styles/springs.css` | new (generated) | Committed output of the generator. |
| `scripts/springs/generate.mjs` | new | |
| `src/lib/urls.ts` | ported | Byte-identical. |
| `src/lib/media.ts` | genericized | |
| `src/lib/items.ts` | new | The view-model adapter. |
| `src/content.config.ts` | new | CMS-shaped from the first commit. |
| `src/data/navigation.ts` | new | One source per list. |
| `src/components/Section.astro` | genericized | Container utilities replace `max-w-*`; `reveal` added; `theme` widened to dark. |
| `atoms/Button.astro` | genericized | Same API, rebuilt on the accent/line tokens. |
| `atoms/TextLink.astro` | genericized | Settles the reference's open underline-colour question. |
| `atoms/VisuallyHidden.astro`, `atoms/JsonLd.astro` | ported | |
| `atoms/FormField.astro` | genericized | Rewritten to §4.1's explicit `for`/`id` + `aria-describedby`; `disabled` added for §8. |
| `atoms/Logo.astro` | genericized | The real Outredge mark, supplied by Max, marked `PROJECT: replace`. |
| `atoms/ClientLogo.astro` | genericized | viewBox→`aspect-ratio` derivation kept verbatim — that bug is expensive and already paid for. |
| `blocks/SectionHeader.astro` | genericized | Rebuilt: the reference version carried its own `px-gutter`, a §4.4 violation. |
| `blocks/Faq.astro` | genericized | Same `::details-content` technique, now spring-eased. |
| `blocks/CtaBanner.astro` | genericized | Now a block, not a Section. |
| `blocks/LogoStrip.astro` | genericized | Including the label-is-a-`<p>` reconciliation ruling. |
| `blocks/ItemCard.astro` | new | The card pattern's worked example. |
| `mdx/Figure.astro`, `mdx/Lede.astro`, `mdx/index.ts` | genericized | |
| `mdx/Clip.astro` | genericized | Ported whole, including every media rule. On no page — see Q6. |
| `shells/BaseLayout.astro` | genericized | Fonts/favicons are commented slots. |
| `shells/Nav.astro` | genericized | Same one-source links and `<details>` mobile menu; the dropdown disclosure is new. |
| `shells/Footer.astro` | genericized | Now a Section, so it shares the container. |
| `src/scripts/clips.ts` | ported | Byte-identical. |
| `src/scripts/disclosure.ts` | new | |
| `src/scripts/contact.ts` | genericized | Plus the ready-gate and a bfcache re-stamp. |
| `src/pages/index.astro`, `contact.astro` | new | |
| `src/pages/_styleguide.astro` | new | Structure and annotation density from `styleguide-mock-v2.html`, extended per the brief. |
| `src/pages/robots.txt.ts`, `sitemap.xml.ts` | genericized | Same idea as the reference's; the sitemap is now derived rather than listed. |
| `scripts/verify/lib/cdp.mjs` | genericized | Chrome discovered across platforms with a loud failure. |
| `scripts/verify/lib/report.mjs`, `lib/contrast.mjs` | new | |
| `scripts/verify/sweep.mjs`, `axe.mjs` | genericized | Plus the visibility filter and the lazy-image force. |
| `scripts/verify/contrast.mjs`, `js-census.mjs`, `contracts.mjs`, `run.mjs`, `lighthouse.mjs` | new | |
| `scripts/subset-fonts.py`, `grab-posters.py`, `stage-videos.py` | genericized | Every export path and rename table replaced with an empty, commented `PROJECT:` table that no-ops until filled. |
| `public/_headers` | genericized | Same policy; the CSP note now explains why it is not a nonce. |
| `public/_redirects` | new | Ships commented — an empty redirects file is correct for a new site. |
| `functions/api/contact.ts` | genericized | Rebuilt around the `sendLead()` boundary. |

**No Outredge content came across**: no copy, no case studies, no client assets,
no work/testimonial data, no case-study collection. The only Outredge artefact in
the repo is the wordmark, which is this repo's own identity and is marked
`PROJECT: replace`.

### Final verification — §9, full pass

```
  PASS  astro check            1 type-check run                       0 failures
  PASS  contrast matrix        38 token pairs                         0 failures
  PASS  JS census              5 scripts found in dist (+1 walk)      0 failures
  PASS  build contracts        2 contract assertions                  0 failures
  PASS  overflow + structure   21 page/width checks (3 × 7 widths)    0 failures
  PASS  axe-core               6 page/width runs (6 tag sets)         0 failures

  6 checks, 73 assertions executed          §9 PASS
```

- **Seven widths** — 320/360/390/430/768/1024/1440 — across home, contact and
  styleguide: no overflow, exactly one `h1` per page, zero heading skips, every
  image with dimensions and a non-null alt.
- **axe-core** wcag2a/aa + 21a/aa + 22aa + best-practice at 390 and 1440:
  **0 violations.**
- **`astro check`**: 0 errors, 0 warnings, 0 hints.
- **Contrast matrix 18/18** on the core text×background group, floor **5.05:1**
  (dark `--text-tertiary` on `--bg-surface`). Plus 8 accent pairs (floor 5.16) and
  12 line pairs (floor 3.87 against WCAG 1.4.11's 3:1). **38 pairs total, computed
  from the built CSS.**

### Lighthouse, mobile, behind `wrangler pages dev`

| page | performance | accessibility | best-practices | SEO |
| --- | --- | --- | --- | --- |
| `/` | **100** | **100** | **100** | **100** |
| `/styleguide` | **100** | **100** | **100** | not audited — `noindex` by design |

**Standing caveat, and it is not a formality: these are PRE-CDN, measured on a
developer machine.** They are a gate reading, not the production figure. The
production figure is measured against the real host after deploy, and the numbers
recorded at that point are the ones that count.

Reported and deliberately not chased: `dom-size (50)` on the styleguide. It is the
densest page the system will ever render, on purpose, and it still scores 100 for
performance. The page was not thinned to protect a number.

### Measured sizes

| | |
| --- | --- |
| **CSS** | 31,373 B raw, **7,476 B gzipped** — the whole system, both themes, all component classes |
| **JavaScript** | **1,280 B gzipped across 4 scripts. Zero `.js` files in `dist`** |
| — nav disclosure | 659 B raw / **347 B gz**, on each of three pages |
| — contact enable | 362 B raw / **239 B gz**, on the contact page only |
| — clip playback | declared, budgeted, on no page |
| **Fonts** | none. System stack until a project adds one (§7) |
| `index.html` | 22,082 B raw, 5,740 B gz |
| `contact.html` | 20,014 B raw, 5,391 B gz |
| `styleguide.html` | 107,809 B raw, 18,906 B gz |
| **Whole `dist/`** | **260 KB**, including three placeholder images |
| Dependencies | **3** runtime (`astro`, `@astrojs/mdx`, `zod`), 5 dev |
| `global.css` | 1,397 lines |
| `ARCHITECTURE.md` | 662 lines |
| Verify harness | 10 files, ~1,280 lines, versioned in the repo |

The JS budget is worth stating against the reference: that build shipped 543 B
gzipped on the pages that needed it. This one ships 347 B on every page and 586 B
on the contact page, for strictly more behaviour (a keyboard-operable dropdown
disclosure the reference did not have).

### Deviations from the inputs, in one place

Each is argued in full in the entry that introduced it.

1. **Amendment 7 reversed** (Entry 4) — the type scale is named for role, not
   size, matching `styleguide-mock-v2.html`. Ruled by Max; values unchanged.
2. **`--spacing-*`, not `--space-*`** (Entry 1, ruling approved) — the namespace
   is what generates `p-*`/`gap-*`.
3. **`--transition-duration-*`, not `--dur-*`** (Entry 1, ruling approved) — same
   reason. The reference ships this bug live.
4. **The `cubic-bezier`-then-`linear()` fallback is an `@supports` block**
   (Entry 1, ruling approved) — Lightning CSS dedupes repeated declarations, so
   the documented pattern does not survive the build.
5. **The accent is a real colour, not monochrome** (Entry 1, ruled a deliberate
   improvement) — a starter whose accent resolves to `--text-primary` hides broken
   accent wiring in the one artefact whose job is to exercise everything.
6. **`CtaBanner` is a block, not a Section** (Entry 3) — the reference version
   wrapped its own Section, which is a §4.4 violation.
7. **`Figure`/`Clip` live in `mdx/`, not `blocks/`** (Entry 3) — the brief's list
   groups them under Blocks; ARCHITECTURE §4.5 says explicitly they are not blocks.
   ARCHITECTURE is law. **The two inputs disagree; this is the one still worth a
   word in the spec or the brief so the next reader is not caught by it.**
8. **`axe-core` is a devDependency** (Entry 5, ruling approved).
9. **Three token groups sit outside `@theme`** (Entries 1, 4, ruling approved) —
   semantic colours, the type scale, the layout tokens. Stated as §2.1.1.
10. **Lighthouse is a separate script, not part of `verify`** (Entry 6, ruled).

### Five rules this build earned, now in the spec

None of these were in the inputs. Each came from something that broke.

1. **§2 — the family.** Scanner-reads-text, namespace-is-a-fact, §2.1.1 and the
   `as`-prop finding are one thesis: the compiler's reality outranks the
   documentation in your head.
2. **§2.1.1 — what belongs in `@theme`.** Put a token there when every utility it
   would generate is one you want typed; otherwise keep it out and expose the
   legal roles.
3. **§4.2 — `as` is reserved for Section by NAME.** An `as` prop on a leaf
   component silently discards its entire `Props` type.
4. **§9 — a harness that has never failed is a harness nobody has tested.**
5. **§9 — a check with manual setup is a check that dies**, and its sibling: a
   rule that only convention enforces is a rule that will be broken.

### Six bugs the system caught before its first client

1. `--duration-*` is not a Tailwind namespace — **live in the reference build**.
2. Lightning CSS deletes `linear()` from `@theme` for its hardcoded Safari 16.4
   target; both spring tokens were vanishing from `dist`.
3. The documented two-declaration fallback is deduped away before it ships.
4. An `as` prop on a leaf component discards its `Props` type — every prop on that
   component silently stopped being checked.
5. The contact form enabled itself on an unconfigured build. **Logged to the
   Outredge repo's `PENDING-CLEANUP.md` as well**, per Max's instruction: the two
   contact functions are about to be shared DNA, so a defect in one is a defect in
   both. (That is the single write into the reference repo during this build; the
   never-modify ground rule held otherwise.)
6. The contract written to catch (5) asserted nothing, because Tailwind's
   `disabled:` variant classes made every button test as disabled.

Plus two in the styleguide's own furniture, both found by axe: `mix-blend-mode`
swatch labels axe cannot evaluate and that genuinely fail mid-ramp, and an
`opacity: 0.8` that knocked the tightest light-theme pair below AA — on the page
that exists to prove the contrast rule.

### Open questions carried forward

6. **`Clip` is unexercised.** No video ships with the starter and there is no
   `ffmpeg` on this machine to fabricate one. It is ported whole, declared and
   budgeted in the census, and on no page. The first project with real media
   exercises it. My recommendation stands: leave it — video in git is exactly what
   `VIDEO_BASE` exists to avoid.
9. **The reveal system is dormant**, per the Phase 1 ruling. `Section`'s `reveal`
   prop sets `data-reveal-group`; nothing carries `data-reveal`, so nothing is
   hidden. Wiring the supplied module is: add `data-reveal` to children, add the
   `.js` one-liner to `BaseLayout` — **and that one-liner must be blocking in
   `<head>`, not deferred**, or every revealed element paints visible and then
   snaps to hidden.
10. **Deviation 7** (`Figure`/`Clip` location) is the one place the brief and
    ARCHITECTURE still disagree on the record.

### Handoff state

- `npm run verify` — green, 73 assertions.
- `npm run lighthouse` — 100/100/100/100.
- Working tree clean, four commits, every phase gated and reviewed.
- **No client project scaffolded.** Per the brief, this stops here.

**Phase 3 complete. The template flag is Max's.**
