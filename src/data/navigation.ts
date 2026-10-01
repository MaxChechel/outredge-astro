/**
 * Navigation — ONE source per list (§5).
 *
 * Nav and Footer both read this. A second hardcoded list is how a link goes
 * stale in one place and not the other, and how orphan pages happen.
 *
 * PROJECT: replace with the real information architecture.
 */
export interface NavLink {
  href: string;
  label: string;
  /** Shown under the label in a mega-menu panel, where there is room for it. */
  description?: string;
}

/**
 * One column of a mega-menu panel. The `title` is a real heading in the panel's
 * outline, not a styled label — a panel of thirty links with no headings is a
 * list a screen-reader user has to read end to end to navigate.
 */
export interface NavColumn {
  title: string;
  links: readonly NavLink[];
}

export interface NavGroup {
  /** The disclosure trigger's label. */
  label: string;
  /** Stable id — the trigger, the panel and `aria-controls` are wired by it. */
  id: string;
  columns: readonly NavColumn[];
}

export type NavItem = NavLink | NavGroup;

export const isGroup = (item: NavItem): item is NavGroup => 'columns' in item;

/**
 * Whether /styleguide exists in this build — set by the route gate in
 * astro.config.mjs. A link to a route the build does not emit is a 404 that
 * builds clean, types clean and passes every rendered check, so the starter's
 * styleguide links exist only in the builds that have the page.
 *
 * PROJECT: once the real information architecture replaces the lists below,
 * this, `routed()` and the two styleguide links on the index page can go.
 */
export const STYLEGUIDE: boolean = import.meta.env.STYLEGUIDE === true;
const routed = ({ href }: NavLink): boolean => STYLEGUIDE || !href.startsWith('/styleguide');

/** Drops unrouted links, then any column or group left with nothing in it. */
const onlyRouted = (items: readonly NavItem[]): NavItem[] =>
  items.flatMap((item): NavItem[] => {
    if (!isGroup(item)) return routed(item) ? [item] : [];
    const columns = item.columns
      .map((column) => ({ ...column, links: column.links.filter(routed) }))
      .filter((column) => column.links.length > 0);
    return columns.length ? [{ ...item, columns }] : [];
  });

/**
 * The bar is deliberately short. A nav is a set of promises about where the site
 * goes, and a starter that ships five placeholder promises teaches whoever copies
 * it to keep them.
 */
export const navigation: readonly NavItem[] = onlyRouted([
  {
    label: 'The system',
    id: 'nav-system',
    columns: [
      {
        title: 'Foundations',
        links: [
          { href: '/styleguide#color', label: 'Colour tokens', description: 'Semantic layer, both themes, verified.' },
          { href: '/styleguide#type', label: 'Type scale', description: 'Role-named, fluid, breakpointless.' },
          { href: '/styleguide#spacing', label: 'Spacing scale', description: 'T-shirt names, 2px to 12rem.' },
        ],
      },
      {
        title: 'Composition',
        links: [
          { href: '/styleguide#layout', label: 'Layout & gutters', description: 'One site margin, one container.' },
          { href: '/styleguide#section', label: 'Section', description: 'The only page-level parent.' },
          { href: '/styleguide#blocks', label: 'The card pattern', description: 'A recipe, not a component.' },
        ],
      },
      {
        title: 'Behaviour',
        links: [
          { href: '/styleguide#atoms', label: 'Form controls', description: 'Native, token-styled, zero JS.' },
          { href: '/styleguide#nav', label: 'Disclosures', description: 'Never hover-only.' },
          { href: '/styleguide#motion', label: 'Motion', description: 'Springs, free, compositor-driven.' },
        ],
      },
    ],
  },
]);

/** The footer's own list. Flat by definition — a footer has no disclosures. */
export const footerLinks: readonly NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/styleguide', label: 'Styleguide' },
  { href: '/contact', label: 'Contact' },
].filter(routed);

/* Site identity lives in src/consts.ts — one module, consumed by BaseLayout,
   urls.ts, robots.txt and sitemap.xml. This file is about links. */
export { SITE as site } from '../consts';
