/**
 * Clip playback — the site's only JavaScript.
 *
 * One module per page owning every clip: a single IntersectionObserver and one
 * delegated click listener, not a script per instance.
 *
 * Behaviour:
 *  - `preload="none"`; the source is attached only when a clip nears the
 *    viewport, so a case study with seven clips fetches none of them on load.
 *  - Clips pause when scrolled away and resume when scrolled back, unless the
 *    viewer has explicitly paused one.
 *  - Under `prefers-reduced-motion` nothing autoplays: the poster stays and
 *    playback requires an explicit press (WCAG 2.3.3).
 *  - Every clip carries a visible pause/play control, because these loop well
 *    past five seconds (WCAG 2.2.2).
 */
const ROOT_MARGIN = '200px 0px';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Clips the viewer paused by hand; never auto-resumed. */
const userPaused = new WeakSet<HTMLVideoElement>();

const videoOf = (root: Element): HTMLVideoElement | null =>
  root.querySelector('video');

const attachSource = (video: HTMLVideoElement): void => {
  const src = video.dataset.src;
  if (!src) return;
  video.src = src;
  delete video.dataset.src;
  video.load();
};

const setButtonState = (root: Element, playing: boolean): void => {
  const button = root.querySelector<HTMLButtonElement>('[data-clip-toggle]');
  if (!button) return;
  button.setAttribute('aria-pressed', String(!playing));
  button.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
  root.classList.toggle('is-playing', playing);
};

const play = (root: Element): void => {
  const video = videoOf(root);
  if (!video) return;
  attachSource(video);
  const attempt = video.play();
  if (attempt) attempt.then(() => setButtonState(root, true)).catch(() => setButtonState(root, false));
};

const pause = (root: Element): void => {
  const video = videoOf(root);
  if (!video) return;
  video.pause();
  setButtonState(root, false);
};

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const video = videoOf(entry.target);
      if (!video) continue;
      if (entry.isIntersecting) {
        if (reduceMotion.matches || userPaused.has(video)) {
          attachSource(video);
          continue;
        }
        play(entry.target);
      } else {
        video.pause();
        setButtonState(entry.target, false);
      }
    }
  },
  { rootMargin: ROOT_MARGIN, threshold: 0 },
);

for (const root of document.querySelectorAll('[data-clip]')) {
  observer.observe(root);
}

document.addEventListener('click', (event) => {
  const button = (event.target as Element | null)?.closest('[data-clip-toggle]');
  if (!button) return;
  const root = button.closest('[data-clip]');
  const video = root && videoOf(root);
  if (!root || !video) return;

  if (video.paused) {
    userPaused.delete(video);
    play(root);
  } else {
    userPaused.add(video);
    pause(root);
  }
});
