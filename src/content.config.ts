import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
/* Imported from zod directly: astro:content's `z` re-export is deprecated as of
   Astro 7, and a deprecated import is a migration someone else has to do later. */
import { z } from 'zod';

/**
 * Content collections (§5).
 *
 * THE CONTENT LAYER IS CMS-SHAPED FROM DAY ONE. All repeating content lives in a
 * collection from the first commit — not in a typed module that "will become a
 * collection later", because that migration never happens for free.
 *
 * The schema below is written as the FUTURE CMS SCHEMA: the same field names,
 * the same types, the same optionality it will have in Sanity (§11). Swapping
 * `glob()` for a CMS loader is then a one-line change here, and nothing
 * downstream moves — because nothing downstream ever saw a `CollectionEntry`.
 * Components consume view models from `src/lib/items.ts`, which is the only file
 * that knows where the data came from.
 *
 * `.strict()` everywhere: an unknown frontmatter key is a typo or a
 * half-finished rename, and either way it should fail the build rather than be
 * silently ignored.
 *
 * `image()` is the one field whose TYPE is loader-specific — a glob loader gives
 * an ImageMetadata, a CMS loader gives a URL and dimensions. That is precisely
 * what the adapter normalizes away, and precisely why components never touch
 * these types directly.
 */
const items = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/items' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        summary: z.string(),
        cover: image(),
        /** Non-null alt, always (§7). Required by the schema, not by review. */
        coverAlt: z.string(),
        /** Explicit ordering; editors do not get to rely on filename sort. */
        order: z.number().int().nonnegative(),
        tags: z.array(z.string()).default([]),
        publishedAt: z.coerce.date().optional(),
        /** Drafts are filtered in the adapter, in one place. */
        draft: z.boolean().default(false),
      })
      .strict(),
});

export const collections = { items };
