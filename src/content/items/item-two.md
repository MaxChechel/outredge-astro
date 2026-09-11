---
title: Strict schemas fail loudly
summary: An unknown frontmatter key is a typo or a half-finished rename. Either way it fails the build rather than being ignored.
cover: ../../assets/items/item-two.webp
coverAlt: Placeholder cover — concentric arcs on a mid-grey ground
order: 2
tags:
  - validation
---

`.strict()` on every schema. The alternative is a field that silently does
nothing, which is the same failure mode as a class name the Tailwind scanner
never saw.
