import { getHighlighter, loadHighlighter, onHighlighterReady } from '../lib/highlight';
import { highlightSource } from '../lib/source-highlight';

/** Above this size the overlay is dropped and the textarea shows plain text. */
const MAX_HIGHLIGHT_CHARS = 200_000;

/**
 * Syntax highlighting for the textarea: its text is transparent and a <pre> with
 * identical metrics sits underneath, rendering the highlighted source. The
 * textarea stays the real editor, so caret, selection, undo, spellcheck and IME
 * behave natively.
 */
export function attachEditorHighlight(editor: HTMLTextAreaElement, layer: HTMLElement): { refresh(): void } {
  const container = editor.parentElement!;

  const syncScroll = () => {
    layer.scrollTop = editor.scrollTop;
    layer.scrollLeft = editor.scrollLeft;
  };

  const refresh = () => {
    const source = editor.value;
    const plain = source.length > MAX_HIGHLIGHT_CHARS;
    container.classList.toggle('is-plain', plain);
    if (plain) {
      layer.textContent = '';
      return;
    }
    // A trailing newline needs a character after it to produce the empty last line.
    const html = highlightSource(source, getHighlighter());
    layer.innerHTML = source === '' || source.endsWith('\n') ? `${html} ` : html;
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
