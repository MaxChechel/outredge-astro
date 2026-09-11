/**
 * Nav disclosure panels — one module per page, owning every disclosure (§4.3, §6).
 *
 * ONE delegated listener on the document, not a script per trigger. Adding a
 * fourth dropdown adds zero bytes.
 *
 * The panel's visibility is CSS's job, driven off `aria-expanded` on the trigger
 * (see `.nav-panel` in global.css). This module therefore only ever writes one
 * attribute — which means the accessible state and the visual state cannot drift
 * apart, because they are the same fact.
 *
 * Behaviour, all of it required by §4.3:
 *   - click on a trigger toggles it, and closes any other open panel;
 *   - Escape closes the open panel and RETURNS FOCUS to its trigger;
 *   - a pointer press outside closes;
 *   - focus leaving the group closes it, so Tab cannot strand an open panel
 *     behind you;
 *   - hover is not wired at all. Hover may be added per project as an
 *     enhancement, never as the only way in: that excludes touch and keyboard.
 */
const TRIGGER = '[data-disclosure]';
const GROUP = '[data-disclosure-group]';

const triggersIn = (root: ParentNode): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(TRIGGER));

const setOpen = (trigger: HTMLElement, open: boolean): void => {
  trigger.setAttribute('aria-expanded', String(open));
};

const isOpen = (trigger: Element): boolean => trigger.getAttribute('aria-expanded') === 'true';

const closeAll = (except?: Element): void => {
  for (const trigger of triggersIn(document)) {
    if (trigger !== except) setOpen(trigger, false);
  }
};

document.addEventListener('click', (event) => {
  const trigger = (event.target as Element | null)?.closest<HTMLElement>(TRIGGER);
  if (!trigger) return;
  const open = !isOpen(trigger);
  closeAll(trigger);
  setOpen(trigger, open);
});

/* Pointerdown rather than click: a press that starts outside should close the
   panel even if the pointer is released somewhere else. */
document.addEventListener('pointerdown', (event) => {
  const target = event.target as Element | null;
  if (target?.closest(GROUP)) return;
  closeAll();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const open = triggersIn(document).find(isOpen);
  if (!open) return;
  setOpen(open, false);
  /* Returning focus is the half of Escape that is usually missing. Without it
     the user is dropped at the top of the document. */
  open.focus();
});

document.addEventListener('focusin', (event) => {
  const group = (event.target as Element | null)?.closest(GROUP);
  for (const trigger of triggersIn(document)) {
    if (isOpen(trigger) && trigger.closest(GROUP) !== group) setOpen(trigger, false);
  }
});
