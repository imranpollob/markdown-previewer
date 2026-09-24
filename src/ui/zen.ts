interface Anchor {
  line: string;
  fraction: number;
}

/** The source block at the top of a scroll container, and how far into it we are. */
function topAnchor(scroller: HTMLElement): Anchor | null {
  if (scroller.scrollTop <= 0) return null; // at the very top: stay there
  const top = scroller.getBoundingClientRect().top;
  for (const element of scroller.querySelectorAll<HTMLElement>('[data-line]')) {
    const rect = element.getBoundingClientRect();
    if (rect.bottom > top) {
      const fraction = rect.height > 0 ? (top - rect.top) / rect.height : 0;
      return { line: element.dataset.line!, fraction: Math.min(1, Math.max(0, fraction)) };
    }
  }
  return null;
}

/** Scrolls so the anchored block is back at the top, even after the width changed. */
function restoreAnchor(scroller: HTMLElement, anchor: Anchor | null): void {
  const element = anchor && scroller.querySelector<HTMLElement>(`[data-line="${anchor.line}"]`);
  if (!element) {
    scroller.scrollTop = 0;
    return;
  }
  const rect = element.getBoundingClientRect();
  scroller.scrollTop += rect.top - scroller.getBoundingClientRect().top + anchor!.fraction * rect.height;
}

/**
 * Zen mode: the live preview moves into a centred modal <dialog> over a dimmed,
 * blurred page. `showModal()` makes everything else inert and handles Esc; the
 * reading position is kept when entering and leaving.
 */
export function initZenMode(options: {
  button: HTMLElement;
  dialog: HTMLDialogElement;
  body: HTMLElement;
  closeButton: HTMLElement;
  scroller: HTMLElement;
  onClose: () => void;
}): void {
  const { button, dialog, body, closeButton, scroller, onClose } = options;
  const home = scroller.parentElement!;

  // By the time `close` fires the dialog is hidden and nothing can be measured,
  // so the reading position is tracked while zen mode is open.
  let anchor: Anchor | null = null;
  let frame = 0;
  const remember = () => {
    if (dialog.open) anchor = topAnchor(scroller);
  };
  scroller.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(remember);
  }, { passive: true });

  button.addEventListener('click', () => {
    const start = topAnchor(scroller);
    body.append(scroller);
    dialog.showModal();
    restoreAnchor(scroller, start);
    anchor = start;
    scroller.focus({ preventScroll: true });
  });

  const close = () => {
    remember();
    dialog.close();
  };

  dialog.addEventListener('cancel', remember); // Esc
  dialog.addEventListener('close', () => {
    cancelAnimationFrame(frame);
    home.append(scroller);
    restoreAnchor(scroller, anchor);
    onClose();
  });

  closeButton.addEventListener('click', close);

  // A click on the backdrop targets the dialog itself (its content fills the box).
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
}
