import { getHighlighter, loadHighlighter, onHighlighterReady } from '../lib/highlight';
import { highlightSource, splitLines } from '../lib/source-highlight';

/** Above this size the overlay is dropped and the textarea shows plain text. */
const MAX_HIGHLIGHT_CHARS = 200_000;

/**
 * Syntax highlighting (and line numbers) for the textarea: its text is
 * transparent and a <pre> with identical metrics sits underneath, rendering the
 * highlighted source one block per line. The textarea stays the real editor, so
 * caret, selection, undo, spellcheck and IME behave natively.
 */
export function attachEditorHighlight(editor: HTMLTextAreaElement, layer: HTMLElement): { refresh(): void } {
  const container = editor.parentElement!;
  let rendered: string[] = [];

  const syncScroll = () => {
    layer.scrollTop = editor.scrollTop;
    layer.scrollLeft = editor.scrollLeft;
  };

  /** Replaces only the lines that changed since the last render. */
  const patch = (lines: string[]) => {
    let head = 0;
    while (head < lines.length && head < rendered.length && lines[head] === rendered[head]) head++;
    let tail = 0;
    while (
      tail < lines.length - head &&
      tail < rendered.length - head &&
      lines[lines.length - 1 - tail] === rendered[rendered.length - 1 - tail]
    ) {
      tail++;
    }

    const rows = layer.children;
    for (let i = rendered.length - tail - 1; i >= head; i--) rows[i]!.remove();
    const html = lines
      .slice(head, lines.length - tail)
      .map((line) => `<div class="line">${line}</div>`)
      .join('');
    const before = rows[head];
    if (before) before.insertAdjacentHTML('beforebegin', html);
    else layer.insertAdjacentHTML('beforeend', html);
    rendered = lines;
  };

  const refresh = () => {
    const source = editor.value;
    const plain = source.length > MAX_HIGHLIGHT_CHARS;
    container.classList.toggle('is-plain', plain);
    if (plain) {
      layer.textContent = '';
      rendered = [];
      return;
    }
    const lines = splitLines(highlightSource(source, getHighlighter()));
    container.style.setProperty('--line-digits', String(Math.max(2, String(lines.length).length)));
    patch(lines);
    syncScroll();
  };

  // Update in the same frame as the keystroke, or typed text would flash invisible.
  editor.addEventListener('input', refresh);
  editor.addEventListener('scroll', syncScroll, { passive: true });
  onHighlighterReady(refresh);
  loadHighlighter().catch(() => {}); // plain text stays visible if it can't load

  refresh();
  return { refresh };
}
