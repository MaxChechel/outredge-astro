#!/usr/bin/env python3
"""Subset the project's web fonts to the codepoints it actually renders (§7).

A stock woff2 from a foundry or Google Fonts typically carries 600+ codepoints,
most of them Greek, Cyrillic and Vietnamese that a English-language marketing
site never draws. Subsetting to Latin is routinely a 60-70% saving on a file that
sits in the critical path, and it costs nothing but this script.

ONLY THE WEIGHTS ACTUALLY APPLIED get subset. A face nobody references is a face
nobody should download; if a weight is not in FACES it does not ship, and if a
rule wants it, add it here deliberately.

    PROJECT: drop source files in src/assets/fonts/source/, list them in FACES,
    then declare the OUTPUT files in astro.config.mjs's `fonts` block.

Requires fonttools + brotli, kept out of package.json because this is a build-time
authoring tool, not a dependency of the site:

    python3 -m venv .venv && .venv/bin/pip install fonttools brotli
    .venv/bin/python scripts/subset-fonts.py
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "assets" / "fonts" / "source"
OUT = ROOT / "src" / "assets" / "fonts"

# The Google Fonts "latin" unicode-range. Covers ASCII plus the punctuation real
# copy uses — the en/em dashes, the curly apostrophe, the middot — which is what
# a naive "ASCII only" subset drops and nobody notices until a dash renders as a
# fallback glyph mid-heading.
UNICODES = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,"
    "U+2212,U+2215,U+FEFF,U+FFFD"
)

# PROJECT: the faces this site applies. Filenames without extension.
FACES: list[str] = [
    # "BrandSans-Regular",
    # "BrandSans-Medium",
]


def main() -> int:
    if not FACES:
        print("subset-fonts: FACES is empty — nothing to do. Edit this script first.")
        return 0
    if not SRC.is_dir():
        print(f"subset-fonts: no source directory at {SRC.relative_to(ROOT)}")
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    done = 0
    for face in FACES:
        source = next((SRC / f"{face}{ext}" for ext in (".woff2", ".ttf", ".otf")
                       if (SRC / f"{face}{ext}").exists()), None)
        if source is None:
            print(f"  MISSING  {face} — expected {SRC.relative_to(ROOT)}/{face}.(woff2|ttf|otf)")
            return 1

        target = OUT / f"{face}.subset.woff2"
        subprocess.run(
            [sys.executable, "-m", "fontTools.subset", str(source),
             f"--unicodes={UNICODES}",
             "--layout-features=kern,liga,calt",
             "--flavor=woff2",
             "--desubroutinize",
             f"--output-file={target}"],
            check=True,
        )
        before, after = source.stat().st_size, target.stat().st_size
        saved = 100 - round(after / before * 100)
        print(f"  {face}: {before:,} B -> {after:,} B  ({saved}% smaller)")
        done += 1

    print(f"subset-fonts: {done} face(s) subset into {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
