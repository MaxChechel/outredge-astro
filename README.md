# outredge-system

The Outredge dev system for Astro marketing sites, and the reference
implementation of it. **Every client project starts as a copy of this repo.**

It is not a component library. It is a set of rules with just enough code to
prove they hold — a token layer that makes illegal styling fail to compile, a
page grammar with one parent, and a verification harness that refuses to report a
pass it cannot account for.

The rules live in **[ARCHITECTURE.md](ARCHITECTURE.md)**. That document is law
here and in every project copied from here. This file is how to run the thing.

---

## Stack

| | |
| --- | --- |
| **Astro**, latest stable | static output, `build.format: 'file'` for extensionless URLs |
| **Tailwind CSS v4**, CSS-first | `@theme` in CSS, no config file. The stock scales are killed — `p-4` and `text-slate-500` do not compile |
| **TypeScript**, strict | `astro check` runs in `npm run verify` |
| **Content collections + MDX** | Zod `.strict()`, CMS-shaped from the first commit |
| **Cloudflare Pages** | `_headers` and `_redirects` in repo; forms via a Pages Function |
| **Zero client JS by default** | measured, not assumed. Currently 1,268 B gzipped across the whole site |

Dependencies are default-no: `astro`, `@astrojs/mdx` and `zod` in
`dependencies`, and four dev tools that do not ship. Each one is justified in the
commit that added it.

---

## Commands

```bash
npm install

npm run dev               # /styleguide is always routed in dev
npm run build             # production: the styleguide route is NOT emitted
npm run build:styleguide  # includes /styleguide — what verify is pointed at
npm run preview           # serve the last build

npm run verify            # the full ARCHITECTURE §9 pass. This is the gate.
npm run check             # astro check on its own
npm run springs           # regenerate the linear() spring easings
```

### `npm run verify`

Builds with the styleguide on, serves it, and runs every §9 check against the
real output:

| check | what it asserts |
| --- | --- |
| `astro check` | zero type errors, zero warnings |
| contrast matrix | every text token on every background in every theme clears 4.5:1, computed **from the built CSS**; control boundaries clear 3:1 |
| JS census | every script in `dist` is named, justified and inside its gzipped budget. An undeclared one fails the run |
| overflow + structure | no horizontal overflow at 320/360/390/430/768/1024/1440, exactly one `h1`, zero heading skips, every image with dimensions and a non-null alt |
| axe-core | wcag2a/aa, 21a/aa, 22aa and best-practice, at 390 and 1440, zero violations |

**Every check reports its own executed count, and a check reporting zero fails
the run even with zero failures.** A verification that cannot say how much it
verified has not verified anything — this system has shipped a green result from
a broken harness before, and the counting is the fix.

Needs Google Chrome. Set `CHROME=/path/to/chrome` if it is somewhere unusual.

---

## New client project — the checklist

Work top to bottom. **Run `npm run verify` after step 3 and again at the end**;
the contrast matrix is what tells you whether the rebrand is shippable, and it
tells you by name.

### 1. Copy the template

```bash
git clone <this repo> client-name && cd client-name
rm -rf .git && git init
```

Then in `package.json` set `name`, and in `astro.config.mjs` set `site` to the
real production URL. **`site` is required** — canonical URLs, `og:url` and the
sitemap are all built from it.

### 2. Replace the primitives

Everything a rebrand touches is marked `PROJECT: replace`. Find all of it:

```bash
grep -rn "PROJECT: replace" src/ astro.config.mjs scripts/
```

In `src/styles/global.css`:

- the **neutral ramp** (`--gray-0` … `--gray-1000`) from the client's Figma
  variables;
- the **accent primitives** (`--accent-500`, `--accent-300`) — **two steps, not
  one.** An accent that clears 4.5:1 as text on white is far too dark to clear it
  on near-black.

### 3. Re-derive both themes

Not a find-and-replace. The semantic tokens in §2 and the `[data-theme]` blocks
in §3 point at ramp steps, and the right steps for a new ramp are different
steps. Work through the six dark-derivation rules written at the head of §3 —
dark is not inversion, elevation is lightness, lines lighten, shadows become
borders, the accent is re-picked, verify then ship.

```bash
npm run verify
```

The contrast matrix fails by name on any pair below threshold. **If a text token
cannot clear AA, move the ramp — never ship a decorative-but-failing step.**
This system deleted a "faint" text token once for exactly that reason.

### 4. Fonts

Drop source faces in `src/assets/fonts/source/`, list only the weights the design
actually applies in `scripts/subset-fonts.py`, subset them, then declare the
output in `astro.config.mjs`'s `fonts` block and uncomment `<Font>` in
`BaseLayout`. Astro emits the `@font-face` and the metric-matched fallbacks,
which are the CLS insurance.

### 5. Logo

Replace the path data in `src/components/atoms/Logo.astro`, keeping the
`currentColor` fills — that is what makes the mark follow the theme. Client
wordmarks go in `src/assets/clients/` for `ClientLogo`; narrow its `slug` prop
from `string` to a union of the real filenames while you are there.

### 6. Content collections

Define the real collections in `src/content.config.ts` from the `items` pattern,
and delete `items` once nothing references it.

- **Write the Zod schema as the future CMS schema** — same field names, types,
  optionality. The point is that swapping `glob()` for a Sanity loader later
  changes one line.
- **One adapter per collection** (`src/lib/items.ts` is the model). Components
  take view models and never a `CollectionEntry`, so the CMS swap touches one
  file.
- `.strict()` everywhere. An unknown frontmatter key is a typo or a half-finished
  rename, and either way it should fail the build.

### 7. Build the pages

A page is **a stack of `<Section>`** with atoms and blocks inside. That is the
whole grammar. Below Section there is no `max-w-container-*`, no `px-*`
recreating gutters, no `py-*` recreating section rhythm, no `mx-auto` — and most
of those do not compile, which is deliberate.

Add every new page to `PAGES` in `scripts/verify/lib/cdp.mjs`. **A page that is
not in that list is a page nothing verifies.**

### 8. Forms

`functions/api/contact.ts` is a template and ships inert. Set
`TURNSTILE_SECRET_KEY`, `LEAD_TO`, `LEAD_FROM` and a provider key in the Pages
environment, point `sendLead()` at the right hop, and **verify one real
submission end to end before enabling the form.** It ships visibly disabled on
purpose: an unconfigured endpoint silently swallowing an enquiry is the most
expensive failure a marketing site has.

### 9. Deploy

- Cloudflare Pages, build command `npm run build` (**not**
  `build:styleguide` — production must not emit the styleguide).
- `public/_headers` ships as-is unless a third-party script needs the CSP
  widened. Widen it deliberately and say why.
- `public/_redirects` ships empty-but-commented. Fill it from the **real** list
  of indexed URLs — export them from Search Console and the old CMS, do not
  guess. §8's rule is that old URLs 301, never 404.
- Secrets are environment variables. Nothing secret enters this repo.

### 10. Verify, then hand over

```bash
npm run verify
```

Then Lighthouse mobile on the homepage and the heaviest page, behind real host
config. **100/100/100/100 is the bar**, and the numbers get recorded.

---

## Repo map

```
ARCHITECTURE.md          the rules. Law.
WORKLOG.md               append-only: decisions, reasoning, bugs with root cause
src/styles/global.css    the single source of truth for every token.
                         In this repo it is also documentation — every layer
                         opens with its rule and the trap that rule avoids.
src/styles/springs.css   GENERATED by scripts/springs/. Do not hand-edit.
src/components/
  Section.astro          the page grammar. The only page-level parent.
  atoms/                 Button, TextLink, FormField, Logo, ClientLogo,
                         VisuallyHidden, JsonLd
  blocks/                SectionHeader, Faq, CtaBanner, LogoStrip, ItemCard
  mdx/                   Figure, Clip, Lede — content vocabulary, MDX only
  shells/                BaseLayout, Nav, Footer
src/scripts/             one vanilla module per behaviour, loaded once per page
src/lib/                 urls, media, and the collection adapters
src/content.config.ts    collections. CMS-shaped from the first commit.
src/pages/
  _styleguide.astro      env-gated: injected in dev and with INCLUDE_STYLEGUIDE=1,
                         emitted by no production build
functions/api/           Cloudflare Pages Functions
public/_headers          security + cache policy
public/_redirects        old URLs. Ships commented; fill from the real list.
scripts/verify/          the §9 harness. Part of the repo, never a scratch
                         script in /tmp — that rule is paid for.
scripts/springs/         generates the linear() spring easings
scripts/*.py             font subsetting, poster grabbing, video staging
```

## Conventions worth knowing before you type

- **The Tailwind scanner reads source as text.** `` class={`text-${size}`} ``
  generates nothing and silently styles nothing. Props map to complete, literal
  class strings, always.
- **A token namespace is a fact about Tailwind, not a preference.**
  `--spacing-*` generates `p-*`/`gap-*`; `--transition-duration-*` generates
  `duration-*`. Get one wrong and the variable still emits while the utility
  never does. Verify against built output.
- **Three token groups sit outside `@theme` on purpose** — semantic colours, the
  type scale, the layout tokens — so that `bg-primary`, `text-2xl` and
  `max-w-main` do not exist. See ARCHITECTURE §2.1.1.
- **`as` is reserved for `Section`.** An `as` prop on a leaf component silently
  discards its entire `Props` type. Leaves take `headingLevel`.
- **A card is a pattern, not a component**: `bg-surface` + `border-line` +
  `rounded-md` + padding from the spacing scale.
- **Springs are the default**, and they cost zero JavaScript.
