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
