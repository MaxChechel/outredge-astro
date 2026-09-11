#!/usr/bin/env python3
"""Stage transcoded clips into public/videos/ under their published names (§7).

Only needed while VIDEO_BASE in src/lib/media.ts points at a local path. Once the
CDN pull zone exists, upload the same files there instead and delete
public/videos/ — video does not belong in git, which is the entire reason
VIDEO_BASE is a constant rather than a path scattered through components.

Renaming happens HERE, once, and the map is recorded: §5 requires assets named by
content slug in kebab-case, and a rename that lives only in someone's shell
history is a rename nobody can reproduce.

    python3 scripts/stage-videos.py
"""

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# PROJECT: wherever the transcoded masters arrive.
SRC = ROOT / "media" / "transcoded"
OUT = ROOT / "public" / "videos"

# PROJECT: source filename (without extension) -> published slug. Every rename a
# migration performs is recorded here, per §5.
RENAME: dict[str, str] = {
    # "Product_Tour_FINAL_v3": "product-tour",
}

# Clips transcoded but deliberately not shipped. Listed rather than deleted, so
# "why is this not on the site" has an answer.
DORMANT: set[str] = set()


def main() -> int:
    if not RENAME:
        print("stage-videos: RENAME is empty — nothing to do. Edit this script first.")
        return 0
    if not SRC.is_dir():
        print(f"stage-videos: no source directory at {SRC.relative_to(ROOT)}")
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    staged = skipped = missing = 0
    for source_name, slug in RENAME.items():
        if source_name in DORMANT:
            skipped += 1
            continue
        source = SRC / f"{source_name}.mp4"
        if not source.exists():
            print(f"  MISSING  {source.relative_to(ROOT)}")
            missing += 1
            continue
        target = OUT / f"{slug}.mp4"
        shutil.copy2(source, target)
        print(f"  {source_name} -> {slug}.mp4  ({target.stat().st_size:,} B)")
        staged += 1

    print(f"stage-videos: {staged} staged, {skipped} dormant, {missing} missing")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
