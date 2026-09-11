// @ts-check
import { defineConfig, svgoOptimizer } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // REPLACE PER PROJECT. Required: canonical URLs, og:url and the sitemap are
  // all built from it (src/lib/urls.ts), and the build throws without it.
  site: 'https://example.com',

  output: 'static',
  trailingSlash: 'never',

  // Extensionless URLs on Cloudflare Pages come from `file` format: it emits
  // /work.html, which Pages serves at /work. `directory` format would emit
  // /work/index.html and serve /work/ with a trailing slash instead.
  // src/lib/urls.ts normalizes the ".html" back out of canonical URLs.
  build: { format: 'file' },

  vite: {
    plugins: [tailwindcss()],

    // The CSS minifier lowers output to `build.cssTarget`, and at Vite's stock
    // baseline (chrome87/safari14) it DELETES `linear()` easings outright —
    // which silently removes every spring token in src/styles/springs.css and
    // leaves `ease-spring-*` resolving to nothing. Baseline 2024 keeps them.
    // Verified by grepping dist for `--ease-spring-soft:linear(`; the check is
    // part of `npm run verify`.
    build: { cssTarget: ['chrome111', 'safari17.2', 'firefox112', 'edge111'] },
  },

  experimental: {
    // Inline SVGs (logos, icons) get their fills rewritten to currentColor so
    // they follow the theme, which means the full-precision path data from
    // Figma ships in the HTML. Astro's built-in SVGO pass fixes the size cost
    // without adding a dependency — svgo already ships inside Astro.
    // Flagged experimental as of Astro 7; re-check on each major upgrade.
    svgOptimizer: svgoOptimizer(),
  },

  // FONTS — placeholder. A project self-hosts and subsets its faces
  // (scripts/subset-fonts.py), declares only the weights it actually applies,
  // and lets Astro emit the @font-face plus the metric-matched fallbacks that
  // are the CLS insurance. Until then the stack falls through to system-ui:
  // see --font-sans in src/styles/global.css.
  //
  // fonts: [
  //   {
  //     provider: fontProviders.local(),
  //     name: 'Brand Sans',
  //     cssVariable: '--font-body',
  //     display: 'swap',
  //     fallbacks: ['Arial', 'sans-serif'],
  //     options: {
  //       variants: [
  //         { weight: 400, style: 'normal', src: ['./src/assets/fonts/BrandSans-Regular.subset.woff2'] },
  //         { weight: 500, style: 'normal', src: ['./src/assets/fonts/BrandSans-Medium.subset.woff2'] },
  //       ],
  //     },
  //   },
  // ],
});
