/**
 * Canonical URL helper.
 *
 * `build.format: 'file'` emits /work.html, so Astro.url.pathname carries an
 * extension at build time while the deployed URL does not. Everything that
 * ends up in a <link rel="canonical">, an og:url, or a sitemap has to be the
 * public form, so normalize in one place rather than at each call site.
 */
export function canonicalPath(pathname: string): string {
  const withoutIndex = pathname.replace(/\/index\.html$/, '/');
  const withoutExtension = withoutIndex.replace(/\.html$/, '');
  if (withoutExtension === '' || withoutExtension === '/') return '/';
  return withoutExtension.replace(/\/$/, '');
}

export function canonicalUrl(pathname: string, site: URL | undefined): string {
  if (!site) throw new Error('`site` must be set in astro.config.mjs for canonical URLs.');
  return new URL(canonicalPath(pathname), site).href;
}
