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
  /** Short description, shown in a dropdown panel where there is room for it. */
  description?: string;
}

export interface NavGroup {
  /** The disclosure trigger's label. */
  label: string;
  /** Stable id — the trigger and the panel are wired together by it. */
  id: string;
  links: readonly NavLink[];
}

export type NavItem = NavLink | NavGroup;

export const isGroup = (item: NavItem): item is NavGroup => 'links' in item;

export const navigation: readonly NavItem[] = [
  { href: '/', label: 'Home' },
  {
    label: 'Resources',
    id: 'nav-resources',
    links: [
      { href: '/styleguide', label: 'Styleguide', description: 'Every token and component, annotated.' },
      { href: '/#pattern', label: 'Patterns', description: 'The card recipe and the layout rules.' },
      { href: '/#motion', label: 'Motion', description: 'Spring tokens and the reduced-motion contract.' },
    ],
  },
  { href: '/#about', label: 'About' },
];

/** The footer's own list. Flat by definition — a footer has no disclosures. */
export const footerLinks: readonly NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/styleguide', label: 'Styleguide' },
  { href: '/contact', label: 'Contact' },
];

export const site = {
  /** PROJECT: replace. */
  name: 'outredge-system',
  description: 'The Outredge dev system for Astro marketing sites.',
  contactHref: '/contact',
} as const;
