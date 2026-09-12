/**
 * Site identity — the first file a new project edits.
 *
 * Everything that is true about THIS SITE rather than about the system lives
 * here: the name, the description, the canonical origin, the locale, and the
 * routes that must never be indexed. `BaseLayout`, `src/lib/urls.ts`,
 * `robots.txt` and `sitemap.xml` all read it.
 *
 * One module because the alternative is what this repo had: a name in
 * `navigation.ts`, an origin in `astro.config.mjs`, a locale hardcoded in
 * `BaseLayout`, and a noindex rule expressed once as a meta tag and again as a
 * sitemap filter. Four places to change, and the fourth is the one someone
 * misses — which is how a staging origin ends up in a production canonical tag.
 *
 * PROJECT: replace every value below. It is step one of the checklist in
 * README.md, and nothing else should be touched before it.
 */
export const SITE = {
  /** PROJECT: replace. Used in the nav's accessible name and the footer. */
  name: 'outredge-system',

  /** PROJECT: replace. The default <meta name="description">. */
  description: 'The Outredge dev system for Astro marketing sites.',

  /**
   * PROJECT: replace. The canonical production origin, no trailing slash.
   *
   * This is the single source of truth for it. `astro.config.mjs` imports this
   * rather than repeating the URL, so a build cannot disagree with the sitemap
   * about where the site lives.
   */
  origin: 'https://example.com',

  /** PROJECT: replace if the site is not in English. Sets <html lang>. */
  locale: 'en',

  /** Where enquiries go in the markup. The endpoint's own config is in env. */
  contactHref: '/contact',

  /**
   * Routes that must never be indexed, and never appear in the sitemap.
   *
   * Stated once and consumed twice — `BaseLayout` emits the robots meta and
   * `sitemap.xml` filters on the same list, so the two cannot drift. The
   * styleguide is here as a belt to the braces of the build-time route gate:
   * the gate means it does not exist in production, this means that if a project
   * ever turns the gate off, the page still says so.
   */
  noindex: ['/styleguide'] as readonly string[],
} as const;

/** Is this path one of the noindexed routes? */
export const isNoindexed = (path: string): boolean =>
  SITE.noindex.some((route) => path === route || path.startsWith(`${route}/`));
