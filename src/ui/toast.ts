let hideTimer = 0;

/** Brief, screen-reader-announced notification (the element has role="status"). */
export function toast(message: string, tone: 'info' | 'error' = 'info'): void {
  const element = document.getElementById('toast');
  if (!element) return;

  element.textContent = message;
  element.dataset.tone = tone;
  element.classList.add('is-visible');

  clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => element.classList.remove('is-visible'), tone === 'error' ? 5000 : 3000);
}
