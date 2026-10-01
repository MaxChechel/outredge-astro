import { getCollection, render, type CollectionEntry } from 'astro:content';
import { getImage } from 'astro:assets';

/**
 * The `items` view-model adapter (§5).
 *
 * ONE adapter per collection, and it is the ONLY file that knows what shape the
 * source data has. Components take `ItemView` and nothing else: no
 * `CollectionEntry<'items'>` ever crosses into a component's props, so a swap
 * from `glob()` to a Sanity loader changes this file and stops.
 *
 * The image is normalized here to `{ src, srcset, width, height, alt }` — a
 * plain, source-agnostic shape. `getImage()` is what turns a glob loader's
 * ImageMetadata into that; a CMS loader would build the same object from a URL,
 * the dimensions the CMS reports, and a srcset string built from its image
 * CDN's width parameter. The card component cannot tell them apart, which is
 * the point.
 */
export interface ItemImage {
  src: string;
  /** `url 400w, url 800w, …` — every candidate at or below the source's real width. */
  srcset: string;
  width: number;
  height: number;
  alt: string;
}

export interface ItemView {
  slug: string;
  title: string;
  summary: string;
  image: ItemImage;
  tags: readonly string[];
  order: number;
  publishedAt?: Date;
}

/**
 * Cover candidates. A card is drawn anywhere from ~280px (one column on a
 * phone) to ~430px (a third of the container), so these cover 1x through 3x of
 * that range. The browser picks one using the `sizes` the LAYING-OUT parent
 * passes to the card — only the parent knows how wide its grid cell is.
 */
const COVER_WIDTHS = [400, 800, 1200];
/** The `src` fallback, for the rare client that ignores srcset. */
const COVER_FALLBACK = 800;

async function toView(entry: CollectionEntry<'items'>): Promise<ItemView> {
  const cover = entry.data.cover;

  /* Clamp every candidate to the source's REAL width. Astro will not upscale,
     but `getImage()` still reports the width you asked for, so an unclamped
     `1200w` candidate over a 1037px source names a file smaller than it claims
     — and a browser trusting the descriptor renders it softer than the one it
     would otherwise have picked. The emitted HTML looks right either way. */
  const widths: number[] = COVER_WIDTHS.filter((w) => w < cover.width);
  widths.push(Math.min(Math.max(...COVER_WIDTHS), cover.width));
  const fallback = Math.min(COVER_FALLBACK, cover.width);

  const image = await getImage({ src: cover, format: 'webp', width: fallback, widths });

  return {
    /* The schema field, never `entry.id` — see content.config.ts. */
    slug: entry.data.slug,
    title: entry.data.title,
    summary: entry.data.summary,
    image: {
      src: image.src,
      srcset: image.srcSet.attribute,
      width: fallback,
      height: Math.round((fallback * cover.height) / cover.width),
      alt: entry.data.coverAlt,
    },
    tags: entry.data.tags,
    order: entry.data.order,
    publishedAt: entry.data.publishedAt,
  };
}

/**
 * Every publishable item, ordered. Derived views (a featured reel, a tag page)
 * filter THIS — never a second hardcoded list, which is how orphans happen.
 */
export async function getItems(): Promise<ItemView[]> {
  const entries = await getCollection('items', (entry: CollectionEntry<'items'>) => !entry.data.draft);
  const views = await Promise.all(entries.map(toView));
  /* Unique by construction while the key was the filename; a field has to be
     made unique. Two items on one slug would shadow each other in every route
     and lookup built from it, with no error anywhere. */
  const seen = new Map<string, string>();
  for (const [i, view] of views.entries()) {
    const other = seen.get(view.slug);
    if (other) throw new Error(`items: slug "${view.slug}" is used by both ${other} and ${entries[i].id}`);
    seen.set(view.slug, entries[i].id);
  }
  return views.sort((a, b) => a.order - b.order);
}

/**
 * One item's rendered body, for a page that shows one.
 *
 * The adapter stays the only file that touches the source type — a PAGE may call
 * this, a COMPONENT may not, which is the same boundary `getItems()` draws. The
 * returned `Content` is rendered with the §4.5 vocabulary:
 *
 *     import * as vocabulary from '../components/mdx';
 *     <Content components={vocabulary} />
 *
 * Passing that map is what closes the approved list: a body can only reach a
 * component someone deliberately put in `src/components/mdx/index.ts`.
 */
export async function getItemBody(slug: string) {
  /* By the slug FIELD. `getEntry('items', slug)` looks up the entry id, which
     only equals the slug while the loader is glob() over files named for it. */
  const [entry] = await getCollection('items', (e: CollectionEntry<'items'>) => e.data.slug === slug);
  if (!entry) throw new Error(`getItemBody: no item "${slug}"`);
  const { Content } = await render(entry);
  return { Content, title: entry.data.title };
}
