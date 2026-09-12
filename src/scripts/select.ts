/**
 * Enter opens a select's menu (§6, §4.1).
 *
 * A focused `<select>` opens on Space, ArrowDown and Alt+ArrowDown. It does NOT
 * open on Enter — on every platform, and by design. Measured in this repo: Enter
 * on a focused select inside the contact form neither opens the menu nor submits
 * the form. It does nothing at all.
 *
 * That is a dead key on the one control people most expect it to work on. Enter
 * is "activate the thing I am on" everywhere else in a form, and a keyboard user
 * who presses it and gets silence concludes the control is broken rather than
 * that they used the wrong key.
 *
 * WHY THIS IS A RULING AND NOT A HABIT (§6). It buys a real behaviour CSS cannot
 * express, on a NATIVE control — the alternative people reach for is rebuilding
 * the select as a div with `role="combobox"`, which costs three hundred lines and
 * owes focus management, type-ahead, announcement, form association and mobile
 * behaviour forever. This is one delegated listener for every select on the page,
 * and it adds no per-instance cost.
 *
 * It is an ENHANCEMENT, not a dependency: Space and the arrow keys keep working
 * with this module absent, and a browser without `showPicker()` is left alone.
 */
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.defaultPrevented) return;

  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) return;
  if (select.disabled || select.multiple) return;

  /* Already open: the menu's own Enter selects the highlighted option, which is
     the native behaviour and better than anything this could do. */
  if (select.matches(':open')) return;

  if (typeof select.showPicker !== 'function') return;

  /* Only now, because preventing the default of a key we then fail to handle is
     worse than leaving it alone. */
  event.preventDefault();
  try {
    select.showPicker();
  } catch {
    /* showPicker() throws without transient user activation. A keydown is
       activation, so this should not happen — but a thrown error inside a
       keyboard handler would break every later listener on the page, and a
       dropdown that did not open is a smaller problem than that. */
  }
});
