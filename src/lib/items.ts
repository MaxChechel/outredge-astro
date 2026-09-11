import { getCollection, getEntry, render, type CollectionEntry } from 'astro:content';
import { getImage } from 'astro:assets';

/**
 * The `items` view-model adapter (§5).
 *
 * ONE adapter per collection, and it is the ONLY file that knows what shape the
 * source data has. Components take `ItemView` and nothing else: no
 * `CollectionEntry<'items'>` ever crosses into a component's props, so a swap
 * from `glob()` to a Sanity loader changes this file and stops.
 *
 * The image is normalized here to `{ src, width, height, alt }` — a plain,
 * source-agnostic shape. `getImage()` is what turns a glob loader's
 * ImageMetadata into that; a CMS loader would build the same object from a URL
 * and the dimensions the CMS reports. The card component cannot tell them apart,
 * which is the point.
 */
export interface ItemImage {
  src: string;
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

/** Cover render width. One number, so every card asks for the same asset. */
const COVER_WIDTH = 800;

async function toView(entry: CollectionEntry<'items'>): Promise<ItemView> {
  const image = await getImage({
    src: entry.data.cover,
    format: 'webp',
    width: COVER_WIDTH,
  });

  return {
    slug: entry.id,
    title: entry.data.title,
    summary: entry.data.summary,
    image: {
      src: image.src,
      width: Number(image.attributes.width ?? COVER_WIDTH),
      height: Number(image.attributes.height ?? Math.round((COVER_WIDTH * 2) / 3)),
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
  const entry = await getEntry('items', slug);
  if (!entry) throw new Error(`getItemBody: no item "${slug}"`);
  const { Content } = await render(entry);
  return { Content, title: entry.data.title };
}
