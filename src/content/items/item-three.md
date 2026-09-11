---
title: Images normalized in the adapter
summary: Components receive { src, width, height, alt }. The loader's image type never reaches them.
cover: ../../assets/items/item-three.webp
coverAlt: Placeholder cover — concentric arcs on a darker grey ground
order: 3
tags:
  - astro assets
  - a11y
---

`image()` is the one schema field whose type is loader-specific. Normalizing it
here is what lets a Sanity loader drop in later without touching a component.
