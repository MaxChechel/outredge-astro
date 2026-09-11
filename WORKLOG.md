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
