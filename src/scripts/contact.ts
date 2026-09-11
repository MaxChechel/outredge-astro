/**
 * Contact form enhancement (§8). Loaded on the contact page only.
 *
 * Two jobs, both of which must happen in the BROWSER:
 *
 *  1. Stamp `started_at`. The endpoint uses it as a bot floor, and a build-time
 *     value would be baked into the HTML and then cached — every visitor would
 *     submit with the same, increasingly stale, timestamp.
 *  2. Enable the form — but ONLY when the page says the endpoint is configured.
 *     The form ships `disabled` in the markup, and this module is the only thing
 *     that lifts it, so a browser with no JavaScript gets an honest inert form
 *     rather than a button that posts into nothing.
 *
 * THE GATE IS NOT OPTIONAL. An earlier version of this module enabled the form
 * unconditionally, which meant an unconfigured build rendered "this form is not
 * live yet" directly above a working-looking submit button — the two halves of
 * the page disagreeing, with the misleading half being the interactive one.
 *
 * Submission itself is a normal POST — no fetch, no JSON, no spinner. The
 * endpoint answers with a redirect-friendly status and the browser does the
 * rest, so the form works identically with this module and without it (minus
 * the enable, which is the point).
 */
const form = document.querySelector<HTMLFormElement>('[data-contact-form]');

/* Set by the page only when a Turnstile site key exists. Absent → the endpoint
   cannot verify a submission, so there is nothing to enable. */
if (form?.hasAttribute('data-contact-ready')) {
  const startedAt = form.querySelector<HTMLInputElement>('input[name="started_at"]');
  if (startedAt) startedAt.value = String(Date.now());

  /* Re-stamp if the page was restored from the back/forward cache, where the
     original timestamp could be hours old and would trip the MAX_FILL_MS ceiling. */
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && startedAt) startedAt.value = String(Date.now());
  });

  for (const control of form.querySelectorAll<HTMLElement & { disabled: boolean }>('[disabled]')) {
    control.disabled = false;
  }
  form.removeAttribute('data-form-disabled');
}
