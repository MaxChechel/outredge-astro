import type { APIRoute } from 'astro';
import { canonicalUrl } from '../lib/urls';

/**
 * /robots.txt (§8).
 *
 * A route rather than a file in `public/`, because the sitemap line has to carry
 * the absolute production URL and `site` is the only place that is declared. A
 * hand-written public/robots.txt is a file that says the wrong hostname on the
 * first project that copies this repo and forgets to edit it.
 *
 * The styleguide needs no `Disallow`: a production build emits no such route, and
 * a Disallow line for a URL that does not exist is an advertisement for it.
 */
export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('robots.txt: `site` must be set in astro.config.mjs.');

  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${canonicalUrl('/sitemap.xml', site).replace(/\/sitemap$/, '/sitemap.xml')}`,
    '',
  ].join('\n');

  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
