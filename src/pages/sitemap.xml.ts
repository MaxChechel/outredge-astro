import type { APIRoute } from 'astro';
import { canonicalPath } from '../lib/urls';

/**
 * /sitemap.xml (§8).
 *
 * Hand-rolled rather than @astrojs/sitemap: the integration is one more
 * dependency for forty lines, and it would need configuring to exclude the
 * styleguide anyway. Dependencies are default-no.
 *
 * The page list is DERIVED from the routes that exist, not written out — a
 * hand-maintained sitemap is a second source of truth for what the site
 * contains, and §5's rule about second lists applies to URLs as much as to work
 * items. Underscore-prefixed files are not routes (that is how the styleguide is
 * gated), so the same filter that keeps them out of the build keeps them out of
 * here.
 *
 * PROJECT: a collection-driven route contributes its own entries. Add them the
 * same way — derived from `getCollection`, never typed out:
 *
 *     const items = await getItems();
 *     const urls = [...pageUrls, ...items.map((i) => `/items/${i.slug}`)];
 */
const pageModules = import.meta.glob('./**/*.astro');

const staticPaths = Object.keys(pageModules)
  .map((file) => file.replace(/^\.\//, '').replace(/\.astro$/, ''))
  // Not routes: underscore-prefixed files, and anything under a `_` directory.
  .filter((name) => !name.split('/').some((segment) => segment.startsWith('_')))
  // Dynamic routes cannot be enumerated from their filename alone.
  .filter((name) => !name.includes('['))
  // 404 is a route the crawler should find by getting a 404, not by being told.
  .filter((name) => name !== '404')
  .map((name) => (name === 'index' ? '/' : `/${name.replace(/\/index$/, '')}`))
  .sort();

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('sitemap.xml: `site` must be set in astro.config.mjs.');

  const urls = staticPaths
    .map((path) => `  <url><loc>${new URL(canonicalPath(path), site).href}</loc></url>`)
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
