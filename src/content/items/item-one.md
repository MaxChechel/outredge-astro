---
title: Collections from the first commit
summary: The schema is written as the CMS schema, so the loader swap is one line and nothing downstream moves.
cover: ../../assets/items/item-one.webp
coverAlt: Placeholder cover — concentric arcs on a pale ground
order: 1
tags:
  - content layer
  - zod
---

Repeating content lives in a collection from day one. The adapter in
`src/lib/items.ts` turns an entry into a view model, and the card that renders
this item has never seen a `CollectionEntry`.
