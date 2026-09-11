# outredge-system — build the starter repo (final brief)

## What this is

A clean repository containing the Outredge dev system for Astro marketing sites: the reference implementation every client project starts from. It is a **template repo** — client projects begin as a copy of it. The first consumer (CentiPack) starts the moment this is done, so bias toward porting proven code over writing new code.

Two inputs:
- `ARCHITECTURE.md` — the spec. Copy it from the reference repo (it carries all previously approved amendments) into this repo root, then apply the amendment set below. It is law here and everywhere downstream.
- The reference implementation at `../Outredge` — **read-only prior art**. Its Section, atoms, blocks, shells, verify harness, and scripts are debugged and verified; port and genericize them. Do not rewrite from scratch what exists there — rewriting reinvents solved bugs (the `@theme static` trap, the `max-w-*` namespace collision, the tsconfig `exclude` trap, the harness false-pass — all already paid for). Its *content* (copy, case studies, client assets, outredge-specific data) must NOT come across.

## Ground rules

- Never modify anything in `../Outredge`.
- WORKLOG.md append-only from the first action: decisions + reasoning, a provenance table (ported / genericized / new), numbered questions.
- Phase-gated; stop at each gate; only I close phases.
- All §9 verification rules apply to this repo itself.

---

## Amendments to ARCHITECTURE.md — apply on copy, before anything else

1. **Content layer is CMS-shaped from day one** (§4/§5). All repeating content lives in content collections from the first commit. Zod schemas are written as the future CMS schemas (same field names, types, optionality) so swapping the `glob()` loader for a CMS loader changes nothing downstream. Components consume view models via one thin adapter per collection (entry → props), images normalized to `{src, width, height, alt}` in the adapter — components never touch source-specific types.

2. **Self-serve client tier is Astro + Sanity via Content Layer loaders** (§11). Keystatic becomes "alternative, unproven."

3. **Form delivery hop is swappable** (§8) behind the function boundary (email today, a CRM tomorrow) without touching the form or page.

4. **Semantic colors leave the color namespace** (§2.3). Tokens are plain custom properties — backgrounds `--bg-base` / `--bg-subtle` / `--bg-surface` (page ground / secondary ground / cards & raised), text `--text-primary` / `--text-secondary` / `--text-tertiary`, plus `--accent` and `--line` — remapped under `[data-theme]`. Each is exposed as an explicit `@utility` in its legal role only (`bg-base`, `bg-subtle`, `bg-surface`, `text-primary`, `text-secondary`, `text-tertiary`, `border-line`, accent utilities as needed), so illegal cross-use (`bg-primary`, `text-surface`) **does not compile**. No semantic color enters `@theme`'s `--color-*` namespace. Opacity variants, when genuinely needed, are new tokens via `color-mix()` — no ad-hoc alpha in markup. The placeholder primitive ramp must be tuned so **all three text tokens clear WCAG AA (4.5:1) on all three backgrounds in both themes** — adjust primitives to satisfy semantics; never ship a decorative-but-failing step (this system once deleted its "faint" token for exactly this; don't reintroduce the bug under a new name). Document the pattern and rationale in global.css comments.

5. **Dark theme ships in the starter, designed** (§2.4), following these derivation rules (as comments in global.css): dark is not inversion — `--bg-surface` sits *lighter* than `--bg-base` (elevation = lightness on dark grounds), `--line` lightens relative to grounds, shadows are replaced or reinforced by borders, and every text/background pair is independently verified, never mirrored from light. The "only designed themes populated" rule stands — client projects re-derive both themes from brand primitives using these same rules.

6. **New verify script — token contrast matrix** (§9, `scripts/verify/`): compute the contrast ratio of every text token on every background token in every theme (currently 3×3×2 = 18 pairs) from the built CSS custom property values; any pair below 4.5:1 fails the run. Reports its own pair count per the harness rule. Runs inside `npm run verify`.

7. **Type scale renamed to sizes** (§2.1): `--text-xs / sm / base / md / lg / xl / 2xl / 3xl / 4xl`, all fluid `clamp()`; `md` is the lede step (deliberate deviation from stock naming). Type-style classes (headings, body, eyebrow, caption) reference size tokens — visual size fully decoupled from heading level, which is already a prop. The styleguide annotates the default role mapping (eyebrow=xs, caption=sm, body=base, lede=md, heading ramp md→4xl).

8. **Spacing scale extended** (§2.1): `--space-3xs / 2xs / xs / sm / md / lg / xl / 2xl / 3xl / 4xl` — fluid `clamp()` throughout, from ~2px hairline gaps to ~12rem at the top; section trio + `--space-nav` unchanged. Naming stays t-shirt permanently: numeric spacing names are prohibited — they'd collide with stock Tailwind's meanings in every developer's and every model's memory and fail silently.

9. **Layout parent rules — site margin, container, Section as sole parent** (§3, §4.4):
   - New token `--site-margin`: the global horizontal gutter, fluid `clamp()` (reference: ~1.25rem mobile → ~2.5rem desktop). The ONLY source of page-edge inline padding in the system.
   - The container primitive = `max-width` (from `--container-main|narrow`) + `margin-inline:auto` + `padding-inline:var(--site-margin)`. Implemented once (internal `Container.astro` or a `@utility container-main`/`container-narrow` pair — propose which in WORKLOG) and consumed by Section, Nav, and Footer alike, so all content sitewide aligns to the same gutter edges. `--container-measure` remains a text-measure cap applied inside content, not a page container.
   - Section is the ONLY page-level parent: it alone applies vertical section padding, the container, and theme. `width="full"` keeps the wrapper with site-margin-free full bleed; everything else gets the container.
   - Below Section, hard boundary: no `max-w-container-*` on children, no `px-*` recreating gutters, no `py-*` recreating section rhythm, no `mx-auto` page centering. Children compose with grid/flex, `gap-*`, token `mt-*` for intra-component spacing, and the type/color tokens. Any element that must exceed its container is a Section-level decision (`width="full"` or a new ruling), never a local override.
   - Open ruling added: a "breakout" width (wider than main, narrower than full) is NOT in the system; the first project that designs one adds it as a Section width value, not a child hack.

10. **Nav dropdown / mega menu** (§4.3): disclosure pattern, never hover-only. Trigger is a `<button aria-expanded>` toggling a panel; Esc closes and returns focus; outside-click closes; arrow/tab order sane; `aria-current` on the active page link. One shared vanilla module (same pattern as Clip: single module per page owning all disclosures via delegation; record gzipped size — ~1KB class). Desktop panel is a grid aligned to the container gutters; on mobile, panels fold into the `<details>` menu as grouped lists with no extra JS. The starter's Nav demonstrates one dropdown group with placeholder links.

11. **Card is a pattern, not a component** (§4.2): the documented recipe — `bg-surface` + `border-line` + `--radius-md` + interior padding from the spacing scale (`sm` or `md`) — demonstrated in the styleguide with the rule stated. Project cards (ProductCard, WorkCard, …) are instantiations of this recipe; they never invent their own surface/border/radius treatment.

12. **Motion system** (new §, "Motion"):
    - Duration tokens `--dur-fast / --dur-base / --dur-slow` and easing tokens including **pre-generated spring easings as CSS `linear()`**: `--ease-spring-soft`, `--ease-spring-snappy` (+ a standard `--ease-out`). Springs are generated at build time by `scripts/springs/` from stiffness/damping params (params recorded in the script); each spring token is declared with a `cubic-bezier` fallback first, `linear()` override after. **Springs are therefore free — zero JS — and are the default character of the system**: hovers, reveals, accordion and disclosure opens all use them.
    - Scroll reveals: the ported native reveal system drives transform/opacity through the spring tokens via `data-reveal` hooks. Reveals are opt-in per Section (a `reveal` prop), children stagger via attribute; default off.
    - Reduced motion contract, stated once: under `prefers-reduced-motion`, reveals render content visible with no animation, transitions collapse to near-instant, nothing autoplays. Only `transform` and `opacity` are ever animated.
    - **Motion (motion.dev) is sanctioned as an island, not a runtime**: `motion/mini` imports only, loaded per-page where a design genuinely needs gesture-driven, interruptible, or orchestrated animation that CSS cannot express. Measure and record its real gzipped contribution at build; it is never a sitewide default, and its use requires a WORKLOG entry naming what CSS couldn't do.

13. **Prose styles** (§2.5): one scoped `.prose` style of our own (NOT the Tailwind typography plugin): paragraph spacing from the spacing scale, list and blockquote treatment, TextLink styling inside prose, `--container-measure` cap, heading margins. MDX bodies render inside it.

Plus one rule into §2 from prior review: **the Tailwind scanner reads source as text** — dynamically assembled class names (`` `text-${x}` ``) are invisible to it and silently style nothing; full class names must always appear literally (map props to complete class strings).

---

## Phase 0 — Scaffold + tokens

- Astro latest stable, static output, TypeScript strict, Tailwind v4 CSS-first. Dependency rules per spec.
- Port `global.css` from the reference and restructure to the amended architecture: primitives (AA-tuned placeholder grayscale ramp) → killed stock scales (numeric grid utilities survive) → semantic tokens as plain custom properties with `@utility` exposure per amendment 4 → both themes populated per amendment 5 → base + type styles (size-named scale per amendment 7) → prose styles (amendment 13) → motion tokens (amendment 12).
- New spacing scale (amendment 8), `--site-margin` and container primitives (amendment 9).
- `scripts/springs/` generating the `linear()` spring tokens; output committed so builds don't depend on the generator.
- Comment `global.css` generously — in the starter it is documentation. Each layer opens with its rule and the trap it avoids (static-vs-inline, namespace collision, why stock scales are dead, why semantic colors sit outside `--color-*`, dark derivation rules, scanner-literalness).
- Port `src/lib/urls.ts`, tsconfig (with the exclude fix), astro config skeleton (`build.format: 'file'`, svgoOptimizer flag noted experimental).
- **Stop for review.**

## Phase 1 — Component kit + styleguide

- Port and genericize the kit to the amended spec:
  - **Atoms**: Button (variant primary/secondary/ghost, size sm/md, typed icon + iconPosition, `<a>`/`<button>` from href), TextLink (line-colored underline), FormField, Logo (placeholder mark), VisuallyHidden, JsonLd.
  - **Blocks**: SectionHeader, Faq (native `<details>`, spring-eased open), CtaBanner, Figure, Clip (with its module and all media-rule behavior), LogoStrip per the reference repo's reconciliation ruling.
  - **Shells**: BaseLayout (skip link → `#main`, canonical/og via urls.ts, fonts config placeholder slots), Nav (single tree, `<details>` mobile menu, one disclosure dropdown group per amendment 10), Footer.
  - **Section**: full API — as / space (`none|sm|md|lg`) / spaceTop / spaceBottom (composing overrides incl. `nav`) / width (`main|narrow|full`) / theme / id / reveal.
- Port nothing outredge-specific (no WorkCard/PricingCard/QuoteCard/FeatureCard, no case-study collection, no client logos, no copy).
- Demo collection (`items`): strict Zod schema, glob loader, view-model adapter per amendment 1, rendered as cards built from the card pattern (amendment 11).
- Build `/styleguide` (env-gated out of production builds — implement the gate now). A reviewed mock exists at `styleguide-mock-v2.html` — match its structure and annotation density, not its exact CSS, and extend it with: sections for the renamed type sizes and extended spacing range; the layout/gutter demo (visible gutter rules over Nav + Section + Footer stacked, showing all three aligned to `--site-margin`, plus the full-bleed case); the side-by-side theme panels and the full contrast matrix with computed ratios; the card pattern with its rule stated; the nav dropdown demo; a motion sample block (spring hover + a reveal demo + reduced-motion note); a prose sample.
- **Stop for review.**

## Phase 2 — Infrastructure

- Port `scripts/verify/` wholesale (sweep with self-reported counts, headings, images, JS census, axe, astro check) and add the contrast-matrix script (amendment 6). `npm run verify` runs the full §9 pass against the built styleguide.
- Port utility scripts with one-line headers: font subsetting, video staging, poster grabbing; add `scripts/springs/`.
- Port `_headers`; `_redirects` template with commented examples.
- Form function template in `functions/api/contact.ts`: Turnstile server-side validation, honeypot, time floor, delivery behind a single `sendLead()` boundary (Resend implementation + commented CRM seam), all keys from env. Client-side pattern included (Turnstile on contact page only; form visibly disabled by default).
- `README.md`: what this repo is, the stack, pointer to ARCHITECTURE.md, dev/build/verify commands, and a numbered **"New client project" checklist**: copy template → replace primitive ramp + accent from client Figma variables (both themes re-derived per the dark rules) → run verify (contrast matrix validates the rebrand) → replace fonts + subset → replace Logo → define real collections from the demo pattern → build pages as Sections → verify → deploy per §8.
- **Stop for review.**

## Phase 3 — Verification + handoff state

- Full §9 pass on the styleguide at all seven widths: overflow, headings, image rules, axe 0 violations, astro check clean, contrast matrix 18/18, JS census (expected: Clip module + nav disclosure module only, only where rendered; every byte named).
- Lighthouse mobile on `/styleguide`: record scores; if anything dips on this deliberately dense page, report the cause — do not thin the page to game it.
- Final WORKLOG entry: provenance table, deviations from the reference with reasons, measured sizes (CSS, JS modules, fonts), open questions.
- **Stop. Do not scaffold any client project.**
