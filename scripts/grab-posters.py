#!/usr/bin/env python3
"""Grab a poster frame for every clip (§7).

Every <Clip> requires a poster, because `preload="none"` means the poster IS the
clip until someone presses play. Frame 0 is the wrong frame for most video: clips
that open on a fade, a white card or a wipe give a blank or misleading poster, so
the default here is 1.5s in, with a per-clip override for the ones that need it.

THE OFFSETS ARE REVIEWED, NOT GUESSED. Render the contact sheet, look at it, and
move the ones that landed badly — a poster is the first frame of the site a
visitor sees, and "probably fine" is not a review.

Requires ffmpeg. Install it project-locally so nothing is added to the system:

    python3 -m venv .venv && .venv/bin/pip install imageio-ffmpeg
    .venv/bin/python scripts/grab-posters.py
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# PROJECT: wherever the transcoded masters live before they go to the CDN.
SRC = ROOT / "public" / "videos"
OUT = ROOT / "src" / "assets" / "posters"

DEFAULT_OFFSET = 1.5

# PROJECT: clips whose default offset lands on a transition, a wipe or a blank
# frame. Record WHY next to each one, so the next person does not re-derive it.
OFFSETS: dict[str, float] = {
    # "product-tour": 0.5,   # 1.5s is mid-wipe: a full-frame gradient
}


def ffmpeg() -> str:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


def main() -> int:
    if not SRC.is_dir():
        print(f"grab-posters: no source directory at {SRC.relative_to(ROOT)}")
        return 1

    clips = sorted(SRC.glob("*.mp4"))
    if not clips:
        print(f"grab-posters: no .mp4 files in {SRC.relative_to(ROOT)} — nothing to do.")
        return 0

    OUT.mkdir(parents=True, exist_ok=True)
    binary = ffmpeg()
    for clip in clips:
        offset = OFFSETS.get(clip.stem, DEFAULT_OFFSET)
        target = OUT / f"{clip.stem}.jpg"
        subprocess.run(
            [binary, "-y", "-loglevel", "error",
             "-ss", str(offset), "-i", str(clip),
             "-frames:v", "1", "-q:v", "3", str(target)],
            check=True,
        )
        flag = "" if clip.stem not in OFFSETS else "  (override)"
        print(f"  {clip.stem}: {offset}s -> {target.stat().st_size:,} B{flag}")

    print(f"grab-posters: {len(clips)} poster(s) in {OUT.relative_to(ROOT)}")
    print("REVIEW THEM AS A CONTACT SHEET before committing.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
