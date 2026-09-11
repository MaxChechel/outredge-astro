# Outredge Dev System — Astro · v3

The house framework for marketing sites, and the spec this starter repo is the
reference implementation of. Every rule was proven on a shipped build
(100/100/100/100 mobile, 543 B JS, axe-clean) or ruled explicitly since. Lumos
equivalents noted — that's the lineage. Component tiers mirror Edge Builder's
taxonomy (primitives → blocks → sections) so both systems share one mental model.

**This document is law here and in every project copied from here.** A project
that needs to deviate records the deviation in its own `AUDIT.md` with a reason;
it does not edit this file.

> **On section numbers.** Numbers here are identifiers, not an ordering claim.
> "The §9 pass" is a name used across every downstream repo, worklog and script
> comment in this system, so §1–§11 keep the numbers they have always had. v3's
> new section, **Motion**, is therefore §12 rather than being inserted mid-document
> and pushing verification off §9.

---

## 1. Stack

- **Astro**, latest stable, static output. No SSR/adapters unless a feature forces it.
- **Tailwind CSS v4, CSS-first** — `@theme` in CSS, no config file. Tailwind is the
  *delivery mechanism for our tokens*, not a design system: industry-readable
  syntax, but stock scales are dead (see 2.2), so nobody can freelance outside
  the tokens.
- **TypeScript strict.**
- **Content collections + MDX** for repeating content. Zod `.strict()`.
- **Zero client JS by default.** Every script is a ruling, not a habit.
- Dependencies: default no. Each one justified in the commit message.

## 2. CSS architecture

`src/styles/global.css` is the single source of truth. In the starter it is also
documentation: every layer opens with its rule and the trap that rule avoids.

> **The rule that governs every layer: the Tailwind scanner reads source as
> text.** It never executes it. A class name assembled at runtime —
> `` class={`text-${size}`} `` — is invisible to the scanner, the utility is
> never generated, and the element is silently unstyled. **Props must always map
> to complete, literal class strings.**
>
> ```js
> const SIZE = { sm: 'text-sm', md: 'text-md' };   // scanner sees both
> const SIZE = (s) => `text-${s}`;                 // scanner sees neither
> ```

> **These two rules, 2.1.1, and the `as`-prop finding in 4.2 are one family, and
> the family is this spec's actual thesis: THE COMPILER'S REALITY OUTRANKS THE
> DOCUMENTATION IN YOUR HEAD.** Each member is a place where correct-looking
> source produces nothing, silently, because a tool's behaviour differs from the
> mental model of it. None of them can be caught by review. All of them are
> caught by reading built output. That is why 9 is not a formality.

> **The corollary rule: a token namespace is a fact about Tailwind, not a naming
> preference.** Three namespaces in this system exist under names nobody would
> choose, because they are the only names that generate the utility:
> `--spacing-*` (not `--space-*`) generates `p-*`/`m-*`/`gap-*`;
> `--transition-duration-*` (not `--duration-*`, not `--dur-*`) generates
> `duration-*`; `--ease-*` generates `ease-*`. Get one wrong and the variable
> still emits, the utility never generates, the class in markup styles nothing,
> and no error appears anywhere. **Namespaces are verified against built output,
> never assumed.**

### 2.1 Primitive tokens (`@theme static`)
Raw values, no usage meaning. *(Lumos: the variables panel.)* No component ever
references a primitive.

- **Colour ramp**, tuned so the semantic layer below can clear AA — see 2.3. The
  ramp does **not** live in the `--color-*` namespace, so `bg-gray-500` does not
  compile. Primitives are not a vocabulary.
- **Fluid type scale, named for ROLE**: `--text-h1 … --text-h6`, plus
  `--text-lede`, `--text-body`, `--text-body-sm`, `--text-caption`,
  `--text-eyebrow`. Every step a `clamp()` mobile→desktop. **Breakpointless —
  type never jumps at a media query.**
  - **The scale is not in `@theme`** (see 2.1.1). `--text-*` is reset to
    `initial`, so no bare `text-<size>` utility exists at all: the type-style
    classes in 2.5 are the only way to apply type, and each is the whole
    treatment rather than a font-size.
  - **Visual size stays decoupled from heading level.** The decoupling lives in
    the CLASS, which any element may wear — `<h2 class="text-h4">` is correct and
    ordinary — not in the token name. A component takes the level as a prop, the
    sweep enforces one `h1` and zero skips, and neither cares what size anything
    is.
  - Known cost, stated so nobody rediscovers it: something large that is not a
    heading — a stat, a pull quote, a figure number — references `--text-h2` and
    reads as though it were claiming to be one. Enough of those in one project is
    the moment to add a role for them, not to rename the ramp.
- **Fluid spacing scale**: `--spacing-3xs / 2xs / xs / sm / md / lg / xl / 2xl /
  3xl / 4xl`, `clamp()` throughout, from a ~2px hairline gap to ~12rem. Plus the
  section-rhythm trio `--spacing-section-none/sm/md/lg` and the derived
  `--spacing-section-nav`, unchanged.
  - The namespace is `--spacing-*`, **not `--space-*`** — see the corollary rule
    above.
  - **Naming stays t-shirt permanently. Numeric spacing names are prohibited.**
    They would collide with stock Tailwind's meanings in every developer's and
    every model's memory — `p-4` means 1rem to the entire industry — and the
    failure is silent in both directions.
- **Layout tokens** — `--site-margin`, `--container-main / narrow / measure` —
  are **plain custom properties, deliberately outside `@theme`**. See 3.1.
- **Motion tokens** — durations and easings, including the generated spring
  `linear()` curves. See 12.
- Radii, borders, focus. Fonts: only weights applied.

### 2.1.1 What belongs in `@theme`, and what does not

> **Put a token in `@theme` when every utility Tailwind would generate from it is
> a utility you want someone to be able to type. Otherwise keep it out, and
> expose exactly the roles that are legal.**

`@theme` is generous: it generates every utility in a namespace for every token
in it. That is right for spacing — `p-md`, `mt-lg`, `gap-sm` are all legal — and
wrong wherever a token has one legal role. Three groups therefore sit outside it,
and the consequences are the point of the exercise:

| group | what does not exist as a result |
| --- | --- |
| semantic colours (2.3) | `bg-primary`, `text-surface`, `border-accent-contrast`, `fill-line`, `ring-subtle` … |
| the type scale (2.1) | `text-xs`, `text-2xl`, and a `text-h1` font-size utility shadowing the `.text-h1` type style |
| layout tokens (3.1) | `max-w-main`, `max-w-narrow`, `p-site-margin` |

Each token is exposed by one explicit `@utility` or one type-style class, in its
legal role only. Adding a token means adding its exposure, deliberately. **That
deliberation is the feature**, and it is what makes the system's rules
compile-time facts rather than review comments.

### 2.2 Kill the stock scales
`--color-*: initial; --spacing-*: initial; --text-*: initial;` etc. Tokens are
the entire vocabulary — `p-4`, `text-slate-500`, `rounded-xl` must not compile.
Re-declare `--spacing-0`.

**Exception: the numeric grid scale lives** — `grid-cols-*`, `col-span-*`,
`row-*` are structural, not spacing, and carry the house grid. They are generated
from bare numbers rather than a theme namespace, so the resets do not touch them.

**Second exception: three keywords, not colours** — `--color-transparent`,
`--color-current`, `--color-inherit`. A button variant with no fill still needs a
border box; an inline SVG still needs `fill-current`.

**Known cost:** typo'd utilities compile to nothing (silent). The verification
pass is the net.

**Ordering trap.** The resets live in `global.css`'s own `@theme` block. `@import`
must precede it, so **anything a namespaced token an imported file declares is
wiped by the reset**. Imported files carry data (plain custom properties); the
tokens that point at that data are declared in `global.css`, after the reset.

### 2.3 Semantic tokens — plain custom properties, outside `@theme`
The only layer components touch. Never a primitive, never a literal.

**No semantic colour enters the `--color-*` namespace.** That is enforcement, not
taste: in `--color-*`, Tailwind generates every utility for every token, so
`--color-surface` yields the legal `bg-surface` *and* the illegal `text-surface`,
`border-surface`, `fill-surface`, `divide-surface`, `ring-surface`,
`from-surface` — all compiling silently into a page that looks almost right.

> **Measured, not argued.** The Outredge site predates this rule and keeps its
> semantic tokens inside `--color-*`. Typing the illegal forms there and reading
> the built CSS: `bg-text`, `text-bg`, `border-text`, `fill-text`, `ring-border`,
> `from-accent` and `caret-text` **all compile**. Seven ways to paint text onto a
> background and a background onto text, none of which any review would catch,
> all of which stop existing the moment the tokens leave the namespace.

The tokens are therefore plain custom properties, each exposed by **one explicit
`@utility`, in its legal role only**:

| token | legal role | utility |
| --- | --- | --- |
| `--bg-base` | the page ground | `bg-base` |
| `--bg-subtle` | a secondary ground — bands, wells | `bg-subtle` |
| `--bg-surface` | cards and anything raised | `bg-surface` |
| `--text-primary` | headings and body | `text-primary` |
| `--text-secondary` | supporting copy, lede | `text-secondary` |
| `--text-tertiary` | captions, metadata, labels | `text-tertiary` |
| `--line` | dividers and card edges | `border-line`, `divide-line` |
| `--line-strong` | the boundary of an interactive control | `border-line-strong` |
| `--accent` | accent text, fill, border | `text-accent`, `bg-accent`, `border-accent` |
| `--accent-contrast` | the only legal text on an `--accent` fill | `text-on-accent` |

`bg-primary` and `text-surface` **do not compile**. Adding a token means adding
its utility, deliberately, in the role it is allowed to play.

- `--line` and `--line-strong` are two jobs, not two shades. A divider is
  decorative and only has to be seen; a control boundary carries WCAG 1.4.11's
  3:1 when the border is the only thing saying "this is a control".
- **`--accent` exists from day one** even in a monochrome design, so the day an
  accent is introduced it is introduced here and every consumer follows.
- **Opacity variants are new tokens via `color-mix()`, never ad-hoc alpha in
  markup.** `bg-surface/50` does not compile, and that is the point: a
  translucent surface is a design decision with a contrast consequence, so it
  gets a name and goes through the matrix like everything else.

**The contrast rule.** Every text token clears WCAG AA (4.5:1) on every
background token in every theme — **3 × 3 × 2 = 18 pairs, computed, not
eyeballed** (see 9). The tuning goes one way only: if a text token cannot clear
AA, **the primitive ramp moves until it can**. A decorative-but-failing step never
ships. This system once deleted a "faint" text token for exactly this reason;
`--text-tertiary` is that slot done properly, and it must not be reintroduced as
a token that fails.

### 2.4 Themes (`[data-theme]`)
*(Lumos: `u-theme-*`.)* A theme block remaps the semantic tokens; every consumer
recolours. Applied per **section** via the Section component's `theme` prop. No
`dark:` variants in markup, and no `prefers-color-scheme` media query — a theme
here is a design decision about a region of a page, not a user preference about
the whole site. (A project that wants the OS preference honoured sets
`data-theme` on `<html>` from it: one line, and every rule already works.)

**Both themes ship in the starter, designed.** The rule that only *designed*
themes are populated still stands — never duplicate-as-placeholder. This repo
populates two because both were derived and verified.

**Dark derivation rules.** A client project re-derives both themes from its brand
primitives using these; it does not copy the starter's values.

1. **Dark is not inversion.** Not one token is the light value mirrored across
   the ramp, and every text/background pair is verified on its own. Mirroring
   produces text that technically passes and reads as glare.
2. **Elevation is lightness.** On a dark ground there is no perceptual room
   *below* the page ground, so the background set is an **ascending ladder**
   rather than light's descending one: base → subtle → surface. **`--bg-surface`
   sits lighter than `--bg-base`.**
3. **`--line` lightens** relative to the grounds, for the same reason.
4. **Shadows are replaced or reinforced by borders.** This system ships no shadow
   tokens at all, which is what makes rule 3 sufficient. A system built on
   shadows has to invent a second, unrelated mechanism for dark.
5. **The accent is re-picked, not re-used.** An accent that clears 4.5:1 as text
   on white is far too dark to clear it on near-black. Each theme names its own
   step from the accent primitives.
6. **Verify, then ship.** All 18 pairs, from the built CSS, on every run.

### 2.5 Base, type styles, prose
Semantic HTML defaults, `:focus-visible` states, `prefers-reduced-motion`
handling. Type styles (`.text-h1`…`.text-h6`, `.text-lede`, `.text-body`,
`.text-body-sm`, `.text-caption`, `.text-eyebrow`) defined **once**, and they are
the only way to apply type — there is no bare `text-<size>` to fall back to.

**Prose is one scoped `.prose` style of our own — NOT the Tailwind typography
plugin.** The plugin ships its own type scale, spacing scale and colour opinions,
all of which would have to be overridden token by token, at which point it costs
more than it saves and quietly reintroduces the stock scales 2.2 spent a whole
block killing. Ours covers: paragraph spacing from the spacing scale, list and
blockquote treatment, TextLink styling inside prose, heading margins, and a
`--container-measure` cap. MDX bodies render inside it.

## 3. Layout conventions

- **Grid is a convention, not a component.** (The Lumos Grid component exists for
  Webflow's visual editor; in code it's indirection.) Utilities directly in
  markup: `grid grid-cols-12` at desktop, collapsing via breakpoint variants
  (`max-lg:grid-cols-6`, `max-md:grid-cols-1` as the design dictates).
- **12-column house grid** at desktop. Column placement via `col-span-*` /
  `col-start-*`.
- **Gaps only from spacing tokens** — `gap-sm`, `gap-md`. Gap is spacing.
- Flexbox freely for one-dimensional layout; grid for two-dimensional.

### 3.1 The site margin and the container primitive

- **`--site-margin`** is the global horizontal gutter, fluid `clamp()`
  (reference: ~1.25rem mobile → ~2.5rem desktop). It is **the only source of
  page-edge inline padding in the system.**
- **The container primitive** = `max-width` (from `--container-main|narrow`) +
  `margin-inline: auto` + `padding-inline: var(--site-margin)`. **Implemented
  once** as the `@utility container-main` / `container-narrow` pair, and consumed
  by Section, Nav and Footer alike — which is what makes a nav logo, a section
  heading and a footer link land on the same vertical line down the page edge, in
  every theme, at every width.
  - A `@utility` pair rather than a `Container.astro`: Section already renders the
    inner element the container belongs on, so a component would add a DOM node
    per section for nothing, and Nav and Footer need the same behaviour on
    elements they already own.
  - The padding sits *inside* the container so a full-bleed section can opt out of
    it without opting out of the wrapper.
- **`--container-measure`** is a text-measure cap applied *inside* content (the
  `measure` utility), never a page container.
- **The layout tokens are outside `@theme` on purpose.** If `--container-main`
  lived in `@theme`, Tailwind would generate `max-w-main`, and any child anywhere
  could re-apply the page container — the single thing 4.4 exists to prevent.
  Outside `@theme` there is no `max-w-main` to type. (This also retires an older
  trap: `max-w-*` resolves `--spacing-*` before `--container-*`, so a
  `--container-sm` beside a `--spacing-sm` silently made `max-w-sm` mean 1.25rem.
  Hence main/narrow/measure and never sm/md/lg — and now, no `max-w-*` at all.)

## 4. Component system

Four tiers. Pages are written in tier-4 grammar only.

### 4.1 Atoms
The indivisible primitives every project ships:

- **`Button`** — the canonical API:
  ```
  variant: "primary" | "secondary" | "ghost"
  size:    "sm" | "md"
  icon?:   "arrow" | "play" | "close"     // typed, extend per project
  iconPosition?: "start" | "end"
  href?:   string
  ```
  Renders `<a>` when `href` present, `<button>` otherwise, with correct
  semantics either way. Icons are inline SVG, `currentColor`.
- **`TextLink`** — prose links with the house underline treatment, drawn in the
  line colour.
- **`FormField`** — the whole form kit, in one component: `text`, `email`, `tel`,
  `url`, `textarea`, `select`, `checkbox`, `radio`. Correct `for`/`id` wiring,
  `aria-describedby` + `aria-invalid` on error, and one disabled state.
  - **One component, not five.** What is worth sharing is not the control — it is
    the label wiring, the error slot, the describedby/invalid pair and the
    disabled state. Five components re-implement that five times and drift four
    ways. The control is the easy half.
  - **Native elements only.** `<select>`, `<input type="checkbox">`,
    `<input type="radio">` — never a div with ARIA. Each is focusable, announced,
    form-associated, keyboard-operable and included in a `FormData` for free, and
    every one of those is something a re-implementation eventually gets wrong.
    `appearance: none` removes the platform box and nothing else.
  - **The tick, the dot and the arrow are drawn in CSS**, on an aria-hidden
    sibling span — `::before`/`::after` on an `<input>` are not reliably
    supported. Not an inline SVG or a data URI: a data URI cannot carry
    `currentColor`, so its colour would be hardcoded, and a hardcoded tick stays
    white on a light theme's white fill. They follow `--accent-contrast` like
    everything else on an accent fill, and the contrast matrix (§9) already
    covers that pair.
  - **Zero JavaScript.**
- **A radio group is a PATTERN, not a component.** It is a `<fieldset>` with a
  `<legend>`, and that is all it is:
  ```astro
  <fieldset class="field-group flex flex-col gap-sm">
    <legend class="text-body-sm text-secondary mb-xs">Engagement</legend>
    <FormField type="radio" name="engagement" value="project"  label="One-off project" />
    <FormField type="radio" name="engagement" value="retainer" label="Retainer" />
  </fieldset>
  ```
  The `<legend>` is what a screen reader announces before each option, and no
  component can supply it without also owning how the options are laid out — the
  first design that wants them in two columns forks it. `<fieldset disabled>`
  makes the whole group inert, and §9's ships-disabled contract honours that
  rather than demanding the attribute on every control: a contract people have to
  work around is a contract people delete.
- **File upload and switch are deliberately absent — build-on-demand.** Neither
  has a native control worth restyling (`<input type="file">` needs its own
  labelling, drag-drop and progress story; a switch is a checkbox with a different
  promise about when it takes effect). Both are real components with real a11y
  surface, and §4.2's rule applies: built when a project's content demands one,
  not invented ahead of need.
- **`Logo`** / **`ClientLogo`** — inline SVG, fills rewritten to `currentColor`
  (theme-proof), through `svgoOptimizer()`. Inconsistent viewBoxes normalized
  with height + `max-width`.
- **`VisuallyHidden`** — SR-only text utility.

Atoms may be non-visual. `JsonLd`, which emits an `application/ld+json` block
and renders nothing, is an atom: indivisible and context-free is the test, not
whether it paints.

### 4.2 Blocks
Composed pieces, still context-free:

`SectionHeader` (eyebrow + heading + lede; heading level as prop),
`Faq`/accordion (native `<details>` first), `CtaBanner`, `LogoStrip` (label + row
of `ClientLogo` marks).

**Card is a pattern, not a component.** There is no generic `Card` shell and no
card *family* in the base kit. The recipe is:

> `bg-surface` + `border-line` + `--radius-md` + interior padding from the
> spacing scale (`sm` or `md`).

It is demonstrated in the styleguide with the rule stated. Project cards
(`ProductCard`, `WorkCard`, `PricingCard`, …) are **instantiations of this
recipe**; they never invent their own surface/border/radius treatment. They share
no structure — different elements, different internal grids, different
interaction — so a common parent would be a bordered `<div>`, which is a class,
not a component. They are siblings, not subclasses.

`Figure` and `Clip` are **not** blocks; they are content vocabulary and live in
4.5. They are only ever reachable from an MDX body.

Block rules:
- **Heading level is always a prop** (`headingLevel={2|3}`) — same block, correct
  outline anywhere. One `h1` per page, zero skips, verified.
- **Dynamic-tag caveat:** `const { as: Tag } = Astro.props` + `<Tag>` silently
  disables prop-type inference. **Leaf components branch on literal elements;
  `<Tag>` is reserved for Section, with typing re-verified.** That rule is
  unchanged and is the one to follow.

  **The mechanism, bisected against ground truth** (an earlier revision of this
  section stated it wrongly, and a rule that mis-states its own trigger is a rule
  people stop believing). A component's entire `Props` type is discarded when
  **both** of these hold:

  1. its `Props` declares a key named `as`, and
  2. the frontmatter's **last statement** is the `Astro.props as Props`
     destructure.

  Add any statement after that destructure and the type comes back. It bites
  whether or not `as` is destructured, and whether or not it is renamed on
  destructure (`as: level`). It does not bite when the key is called anything
  else.

  The consequence is that **every prop on that component stops being checked,
  silently** — `<VisuallyHidden as={42} nonsense="x">` raised no error at all
  until this was found. Because whether it bites depends on an unrelated detail
  of the file, the dependable rule is about the NAME: **`as` is reserved for
  Section.** Leaves take `headingLevel`, `element`, `variant` — anything else.
  `scripts/verify/contracts.mjs` enforces the name, because the failure is the
  ABSENCE of a type error and there is nothing for `astro check` to report.

  How to see it by hand: pass a bogus prop and read the message. `IntrinsicAttributes
  & Props` means the type is intact; a bare `IntrinsicAttributes`, or no error at
  all, means it is gone.
- Used 3+ times with identical meaning → becomes a block. No arbitrary values
  (`p-[13px]`) without a justifying comment; twice = new token.

### 4.3 Shells
`BaseLayout` (head, fonts, skip link → real `#main`, canonical/og normalized in
`src/lib/urls.ts`), `Nav`, `Footer`.

- **One nav tree** — never parallel desktop/mobile markup. Mobile menu is native
  `<details>/<summary>`: keyboard + SR correct, zero JS; burger morph is CSS.
- Nav, like Section, gets its horizontal alignment from the container primitive
  (3.1). It never sets its own gutter.

**Dropdown / mega menu — a disclosure, never hover-only.**
- Trigger is a `<button aria-expanded>` toggling a panel. Hover *may* open it as
  an enhancement; hover is never the only way in, because that excludes touch and
  keyboard entirely.
- `Esc` closes and returns focus to the trigger. Outside click closes. Tab order
  is document order; arrow keys move within the open panel.
- `aria-current="page"` on the active page link.
- **One shared vanilla module per page owning all disclosures** via delegation —
  same pattern as `Clip`, not a script per instance. Gzipped size recorded
  (~1 KB class).
- The desktop panel is a grid aligned to the container gutters. **On mobile the
  panels fold into the `<details>` menu as grouped lists, with no extra JS.**

### 4.4 Section — the page grammar
*(Lumos: `u-section` + `u-container`.)* The **only** thing pages compose:

```astro
<Section
  as="section"        // section | div | header | footer   (default: section)
  space="md"          // none | sm | md | lg — symmetric vertical padding
  spaceTop="nav"      // optional override of the top only; adds "nav"
  spaceBottom="sm"    // optional asymmetric override of the bottom only
  width="main"        // main | narrow | full              (default: main)
  theme="dark"        // optional — sets data-theme, children adapt
  reveal              // optional — opts this section's children into scroll reveal
  id="pricing"        // anchor target
>
  <slot />            <!-- content lands inside the container -->
</Section>
```

**Section is the ONLY page-level parent.** It alone applies vertical section
padding, the container, and the theme.

- Section owns **all vertical rhythm**. Pages never make spacing decisions; no
  spacer divs, ever.
- Overrides compose: `space="md" spaceTop="lg"` → lg top, md bottom.
- **`space="none"`** is a real step, not an escape hatch. Sections that butt
  directly against the next — separated by a border or a background change
  rather than by space — need zero padding on an edge. A named step keeps that
  decision inside Section; the alternative is a bespoke class per site.
- **`spaceTop="nav"`** is the page-top step: the first section on a page must
  clear the fixed nav. It is not a member of the section scale, and it is
  **derived, never measured** — the token is nav height plus one `md` step:
  ```css
  --spacing-section-nav: calc(var(--nav-height) + var(--spacing-section-md));
  ```
  so it stays correct when either input moves.
- **`width="full"`** keeps the wrapper (theme + spacing behave identically) and
  skips the container's max-width and site margin — full bleed is a container
  variant, not a different component.
- A page is a stack of Sections with atoms/blocks inside. That's the grammar.

**Below Section, a hard boundary. On children there is:**

- **no `max-w-container-*`** — the page container is Section's job, and the token
  is outside `@theme` so the utility does not exist (3.1);
- **no `px-*` recreating gutters** — `--site-margin` is applied once, by the
  container;
- **no `py-*` recreating section rhythm** — that is `space`;
- **no `mx-auto` page centering.**

Children compose with grid/flex, `gap-*`, token `mt-*` for intra-component
spacing, and the type/colour tokens. **Any element that must exceed its container
is a Section-level decision** (`width="full"`, or a new ruling) — never a local
override.

> **Open ruling.** A "breakout" width — wider than `main`, narrower than `full` —
> is **not** in the system. The first project that designs one adds it as a
> Section `width` value, not as a child hack.

### 4.5 Content components (MDX vocabulary)
Derived by **counting what real content contains** — never invented ahead of
need. Baseline: `<Figure>`, `<Clip>`, `<Lede>`. The approved list is closed per
project; new component in a body requires a ruling. Frontmatter strict-Zod;
missing required slot **fails the build**.

## 5. Data conventions

- **The content layer is CMS-shaped from day one.** All repeating content lives
  in **content collections from the first commit** — not in a typed module that
  "will become a collection later", because that migration never happens for free.
  - **Zod schemas are written as the future CMS schemas**: same field names, same
    types, same optionality. Swapping the `glob()` loader for a CMS loader must
    change nothing downstream.
  - **Components consume view models through one thin adapter per collection**
    (entry → props). Images are normalized in the adapter to
    `{ src, width, height, alt }`. **Components never touch source-specific
    types** — no `CollectionEntry<'x'>` in a component's props, ever. The adapter
    is the only file that knows where the data came from, and it is therefore the
    only file a CMS swap touches.
- **One source per list.** Work items, testimonials, nav links live in exactly
  one collection or typed module; derived views (a featured reel) filter/merge —
  never a second hardcoded list. (Second lists are how orphans happen.)
- Assets named by content slug, kebab-case; rename mapping recorded on migration.

## 6. JavaScript rules

- Zero JS in `dist/` is the default state — **measured** (script-tag + `.js`
  census), not assumed.
- Real behavior → one shared vanilla module per behavior, loaded once per page,
  owning all instances (single observer / delegation). No per-instance scripts,
  no framework islands for DOM sprinkles. Gzipped size recorded.
- `const`/`let`, vanilla DOM. No jQuery, no GSAP by default, no smooth-scroll
  runtime. Reveals via the native scroll-reveal system on `data-reveal` hooks
  (see 12).
- Reference budget: 543 B gzipped, loaded only on pages that need it.

## 7. Media rules

- **Fonts:** self-hosted, subset (fonttools), only applied weights, via Astro's
  `fonts` config (metric-matched fallbacks = CLS insurance). Reference: ~34 KB.
- **Images:** `astro:assets`, explicit `width`/`height`, non-null `alt`, always.
  Nothing loose in `public/` except favicons/OG.
- **Video:** single MP4/H.264 (no WebM), poster required (grab ~1.5 s, human-
  reviewed), `preload="none"`, IntersectionObserver play, **never bare
  `autoplay`**. Looping clips get a visible pause control (WCAG 2.2.2);
  `prefers-reduced-motion` → poster + explicit play. Own CDN behind one
  `VIDEO_BASE` constant.

## 8. Delivery platform

- **Cloudflare Pages.** Extensionless URLs native with `build.format: 'file'`;
  `_headers` (security + immutable `_astro`) and `_redirects` in repo. Old URLs
  301, never 404.
- Forms: Pages Function + invisible Turnstile (contact page only) + honeypot +
  time floor. **The form ships visibly disabled until the endpoint is verified
  end to end**, and that is an assertion, not a convention: 9's contract check
  fails the build if a page with no configured endpoint renders an enabled submit
  control. An unconfigured endpoint silently swallowing an enquiry is the most
  expensive failure a marketing site has, and it is the default state of every
  form nobody has verified.
- **The delivery hop is swappable.** Everything after validation sits behind a
  single `sendLead()` function boundary inside the Pages Function — email today
  (Resend), a CRM tomorrow — **and swapping it touches neither the form nor the
  page.** Keys come from env, never from the repo. The commented CRM seam ships
  in the template so the boundary is visible rather than theoretical.

## 9. Verification standard (every phase, non-negotiable)

- DevTools-Protocol rendered checks at **320/360/390/430/768/1024/1440**:
  `scrollWidth === clientWidth` everywhere.
- Exactly one `h1`, zero heading skips — automated.
- Every image: dimensions + alt; zero broken refs.
- **Visibility-filtered overflow.** The offender list must skip elements that
  fail `checkVisibility()`. A closed `<details>` keeps its last laid-out
  geometry — `getBoundingClientRect()` on its hidden children returns stale,
  overflowing rects while the document itself does not scroll — so an unfiltered
  sweep reports phantom offenders for every mobile menu on the site, and a sweep
  nobody believes is a sweep nobody reads.
- JS census of `dist/`, each byte justified.
- **Token contrast matrix** — the contrast ratio of every text token on every
  background token in every theme (currently 3 × 3 × 2 = 18 pairs), computed
  **from the built CSS custom property values**. Any pair below 4.5:1 fails the
  run. This is what validates a client rebrand: replace the primitive ramp, run
  it, and the matrix says whether the new brand is shippable.
- `astro check` clean; axe-core (wcag2a/aa/21aa/22aa + best-practice) 0
  violations.
- **Contract assertions** against the built HTML for rules the compiler cannot
  enforce (see below).
- **Referent assertion** before any rendered check: the port under test is
  serving this build, proven by comparison, not assumed.
- Lighthouse mobile, homepage + heaviest page, behind real host config:
  **100/100/100/100 is the bar**, numbers recorded.

**Two commands, two contracts.** `npm run verify` runs on every commit: it is
fast, hermetic and deterministic, and nothing environmental goes in it — an
audit that flakes inside the one command that must never be doubted teaches
people to doubt it. `npm run lighthouse` runs at every phase gate, against
`wrangler pages dev` so `_headers`, `_redirects` and the Functions are real. It
is scripted rather than performed by hand, because a gate number nobody can
reproduce is a number nobody should record.

**The harness is part of the repo.** It lives in `scripts/verify/`, versioned
alongside the code it checks, and is never a scratch script in `/tmp`.

**Every check reports its own executed count, and a pass with zero reported
checks is a failure.** A verification that cannot say how much it verified has
not verified anything.

**THE HARNESS MUST PROVE ITSELF ON THREE AXES, AND ALL THREE HAVE FAILED HERE.**
A check can be wrong in three independent ways, each silent, each producing a
green result: it can fail to **execute** (the main-module guard compared a raw
path to a percent-encoded URL, so in any directory with a space every check ran,
printed nothing and exited 0); it can execute but **count nothing** (a sweep
deleted out of `/tmp` between runs, so `grep -c` read an empty stream and reported
a clean pass over zero files); or it can execute and count correctly while
**measuring the wrong artifact** (a leaked preview daemon from another repository
held the port, and 77 page/width checks and 22 axe runs passed against somebody
else's website). Three failure modes, three proofs — **it ran, it counted, it
measured the thing under test** — and none of the three substitutes for another.
Every rule below is one of those proofs, and each has been demonstrated by
fault injection rather than asserted.

**A harness that has never failed is a harness nobody has tested.** Every check
must demonstrate its own failure mode once — fault-inject the thing it exists to
catch, watch it fail with a legible message and a non-zero exit, restore — before
that check counts as part of the pass. A check whose red path has never run is an
assertion about the harness, not about the code.

**A check must verify its referent.** Failing legibly and reporting its own count
are not enough: a check also has to establish that it is measuring the artifact
under test. **A harness that has never been proven to be measuring the artifact
under test has proven nothing.**

> **The port-4321 incident, which is why this is a rule.** A preview server left
> running by a *different repository* held the port this harness uses. Every
> browser-driven check connected to it, requested eleven URLs that do not exist
> on that site, was served that site's fallback page — one `h1`, no overflow, no
> axe violations — and reported **"77 page/width checks, 0 failures"** and
> **"22 axe runs, 0 violations"**. Both numbers were real. Both were about
> somebody else's website, and a full phase pass was recorded from them.
>
> This is the "pass over nothing" failure arriving through a door the counting
> rule does not cover: the count was not zero, it was *pointed at the wrong
> thing*. Counting how much you verified is necessary and not sufficient — you
> also have to know **what** you verified.

In practice: `scripts/verify/lib/served.mjs` fetches a page over HTTP and compares
it byte-for-byte with the file the build just wrote, before any browser check
trusts the port; and `scripts/verify/lib/preview.mjs` owns the server's whole
lifecycle — stopping a daemon the project left behind, refusing to start against a
port something else already owns, and cleaning up on normal exit, on SIGINT/SIGTERM
and on an uncaught throw. `astro preview` daemonises, so killing the spawned child
leaks the server; that leak is what created the incident above.

**A check with manual setup is a check that dies.** Anything a check needs to
run — a browser, `axe-core`, a pinned CLI — is wired so that `npm run verify`
works on a fresh clone after `npm install`. Tooling that must be fetched and
unpacked by hand before the a11y pass runs is tooling that gets skipped exactly
when it matters. `axe-core` is therefore a devDependency; devDependencies do not
ship.

**A rule that only convention enforces is a rule that will be broken.** Where a
rule is stated in this document but produces no compile error — the form ships
disabled (8), production emits no styleguide route (2.4/10) — it is asserted
against the BUILT OUTPUT in `scripts/verify/contracts.mjs`. The system's recurring
move is convention → compile error where possible, convention → assertion where
not; "documented" is the weakest of the three and is never the resting place.

Both rules are paid for. In the Outredge build, (1) a sweep script was deleted
out of `/tmp` between runs, so `grep -c` counted an empty stream and reported a
clean pass over nothing; and (2) `tsconfig.json` set `exclude` without
TypeScript's defaults — `exclude` replaces rather than extends — so
`node_modules` was type-checked, `astro check` never finished, and it had been
"passing" on partial output read from a timeout. Two green results in one
project came from a broken harness rather than from correct code. Trusting a
check means being able to show what it ran.

## 10. Process

- **Phase-gated:** 0 audit → 1 tokens/shells → 2 components/pages → 3
  content/media → 4 SEO/redirects/deploy → 5 verification. AI stops at each
  gate; only the human closes phases.
- **WORKLOG.md** append-only (decisions + reasoning, bugs + root cause,
  numbered questions). **AUDIT.md** for findings and sanctioned deviations.
- Migrations: source export is **reference, not codebase** — content, values,
  assets lift; markup, classes, JS never do.
- Fidelity rule: render identical to source **except** documented a11y fixes.
  Redesign is a separate engagement.
- AI never touches DNS, dashboards, accounts, signups — named human punch-list
  items.

## 11. What this system is not

- Not a visual-editing platform. **The self-serve client tier is Astro + Sanity
  via Content Layer loaders** — which is exactly why 5 requires CMS-shaped
  collections from the first commit: moving a project onto that tier is a loader
  swap, not a rewrite. *(Keystatic over the same MDX remains an alternative, and
  is unproven; a first self-serve client would have to validate it.)* Edge
  Builder (Next.js + Sanity) remains the heavier tier. This system is the
  performance-first, code-owned one.
- Not a generic component library. The base kit (4.1–4.3) ships in the starter;
  everything else is built when a project's content demands it. Third-party
  dependency-free components (e.g. Lumos for Astro's slider / modal / tabs) may
  slot in per-project, adapted to our tokens, under 6 and the a11y rules.

## 12. Motion

Springs are the **default character of this system**, not a special occasion.

### 12.1 Tokens

- **Durations** `--transition-duration-fast / base / slow`. (The namespace is a
  fact about Tailwind, not a preference — see the corollary rule in 2.)
- **Easings**: a standard `--ease-out`, plus **pre-generated spring easings as
  CSS `linear()`**: `--ease-spring-soft` and `--ease-spring-snappy`.
- Springs are generated at build time by `scripts/springs/` from
  stiffness/damping/mass parameters, **recorded in the script**, and the output
  is committed so a build never depends on the generator.
- Each spring ships a `cubic-bezier` fallback for engines without `linear()`; all
  that degrades is the overshoot.
- **Springs are therefore free — zero JavaScript, compositor-driven — and are the
  default**: hovers, reveals, accordion and disclosure opens all use them.

> **Two traps, both paid for, both silent.** `linear()` cannot live in `@theme`:
> `@tailwindcss/vite` runs Lightning CSS with browser targets hardcoded at Safari
> 16.4, `linear()` easing shipped in Safari 17.2, and Lightning CSS therefore
> *deletes* the declaration — the token vanishes from `dist` and `ease-spring-*`
> resolves to nothing. And the usual two-declaration fallback pattern
> (`cubic-bezier` first, `linear()` second) does not survive either: Lightning CSS
> dedupes repeated custom properties and keeps the last.
> **So:** the curves are plain custom properties in the generated file, `@theme`
> holds only `var()` pointers (which Lightning CSS cannot evaluate and therefore
> cannot reject), and the fallbacks are an `@supports not (...)` override.

### 12.2 Scroll reveals

- The native reveal system drives transform/opacity through the spring tokens via
  `data-reveal` hooks.
- **Reveals are opt-in per Section** (a `reveal` prop). Children stagger via an
  attribute. **Default off** — a page where everything animates in has no
  emphasis left to spend.
- A reveal system that hides content when its script does not run is a
  content-loss bug, not an animation. Content is visible without JS.

### 12.3 The reduced-motion contract

Stated once, honoured globally. Under `prefers-reduced-motion`:

- reveals render their content **visible, with no animation** — never hidden;
- transitions collapse to near-instant rather than being removed, so state
  changes still read as changes;
- nothing autoplays.

**Only `transform` and `opacity` are ever animated**, in either mode. They are
the only properties the compositor can animate without layout or paint;
animating anything else is a performance bug with a visual symptom.

### 12.4 Motion (motion.dev) — sanctioned as an island, not a runtime

- **`motion/mini` imports only**, loaded per-page, where a design genuinely needs
  gesture-driven, interruptible, or orchestrated animation that CSS cannot
  express.
- Its real gzipped contribution is **measured and recorded at build**.
- It is **never a sitewide default**, and its use **requires a WORKLOG entry
  naming what CSS could not do**.

## Open rulings (decide on first real need)

1. Slider/carousel policy — hand-rolled scroll-snap vs Lumos for Astro's,
   adapted.
2. Keystatic tier — unproven; a self-serve client would have to validate it
   against the sanctioned Sanity path (11).
3. Modal/dialog — native `<dialog>` first when needed.
4. Breakout width — not in the system; first project that designs one adds it as
   a Section `width` value (4.4).
