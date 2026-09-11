/**
 * Video delivery (§7).
 *
 * PROJECT: replace. Clips are served from a CDN pull zone, not from the repo —
 * video does not belong in git. Set the hostname here and every <Clip> follows;
 * there are no other video URLs in the codebase, which is the point of the
 * constant.
 *
 * The default points at a local `/videos/` folder in public/ so a project is
 * testable end to end before the pull zone exists. No video ships with the
 * starter itself.
 */
export const VIDEO_BASE = '/videos';

/** Single MP4/H.264 per clip. WebM was dropped: it measured 2.5x the MP4. */
export const videoUrl = (name: string): string => `${VIDEO_BASE}/${name}.mp4`;
