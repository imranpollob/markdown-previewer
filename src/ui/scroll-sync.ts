/**
 * Line-accurate scroll sync between the textarea and the preview.
 *
 * Both panes are reduced to monotonic (sourceLine -> pixelOffset) tables:
 *  - editor: where each source line starts (including soft-wrapping), read from
 *    the highlight overlay's per-line blocks, or from a hidden mirror if the
 *    overlay is off;
 *  - preview: every rendered block carries `data-line` (see source-lines plugin).
 * Scrolling one pane maps its top edge to a fractional source line, then to
 * the other pane's offset by linear interpolation.
 */

interface Points {
  lines: number[];
  offsets: number[];
}

/** Piecewise-linear lookup over sorted `xs`. */
function interpolate(xs: number[], ys: number[], x: number): number {
  const n = xs.length;
  if (n === 0) return 0;
  if (x <= xs[0]!) return ys[0]!;
  if (x >= xs[n - 1]!) return ys[n - 1]!;

  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]! <= x) lo = mid;
    else hi = mid;
  }
  const span = xs[hi]! - xs[lo]!;
  const t = span === 0 ? 0 : (x - xs[lo]!) / span;
  return ys[lo]! + t * (ys[hi]! - ys[lo]!);
}

const MIRRORED_STYLES = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariantLigatures', 'letterSpacing',
  'lineHeight', 'tabSize', 'textIndent', 'textTransform', 'wordSpacing', 'wordBreak', 'overflowWrap', 'whiteSpace',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
] as const;

export interface ScrollSync {
  /** Call after the editor text changes or its width changes. */
  invalidateEditor(): void;
  /** Call after the preview re-renders or its layout changes. */
  invalidatePreview(): void;
  /** Align the preview to the editor's current position. */
  syncPreviewToEditor(): void;
  /** Align the editor to the preview's current position. */
  syncEditorToPreview(): void;
  setEnabled(enabled: boolean): void;
}

export function createScrollSync(
  editor: HTMLTextAreaElement,
  preview: HTMLElement,
  /** The highlight overlay (one block per source line), if present. */
  overlay?: () => HTMLElement | null,
): ScrollSync {
  let enabled = true;
  let active: 'editor' | 'preview' = 'editor';
  let editorPoints: Points | null = null;
  let previewPoints: Points | null = null;
  let frame = 0;

  const mirror = document.createElement('div');
  mirror.setAttribute('aria-hidden', 'true');
  Object.assign(mirror.style, {
    position: 'absolute',
    top: '0',
    left: '-10000px',
    visibility: 'hidden',
    whiteSpace: 'pre-wrap',
    boxSizing: 'border-box',
    border: '0',
  });
  document.body.append(mirror);

  const isVisible = (element: HTMLElement) => element.clientHeight > 0;
  const maxScroll = (element: HTMLElement) => Math.max(0, element.scrollHeight - element.clientHeight);

  /** Exact line offsets from the highlight overlay's per-line blocks, when it is showing. */
  function measureFromOverlay(lineCount: number): Points | null {
    const layer = overlay?.();
    if (!layer || layer.children.length !== lineCount || !isVisible(layer)) return null;
    const top = layer.getBoundingClientRect().top - layer.scrollTop;
    const points: Points = { lines: [], offsets: [] };
    for (let i = 0; i < lineCount; i++) {
      points.lines.push(i);
      points.offsets.push(layer.children[i]!.getBoundingClientRect().top - top);
    }
    return points;
  }

  function measureEditor(): Points {
    const fromOverlay = measureFromOverlay(editor.value.split('\n').length);
    if (fromOverlay) return fromOverlay;

    // Fallback (plain mode for huge documents): lay the text out in a hidden mirror.
    const style = getComputedStyle(editor);
    for (const property of MIRRORED_STYLES) mirror.style[property] = style[property];
    // Fractional width (clientWidth rounds), minus any scrollbar, so wrapping matches exactly.
    const scrollbar = editor.offsetWidth - editor.clientWidth;
    mirror.style.width = `${editor.getBoundingClientRect().width - scrollbar}px`;

    const lines = editor.value.split('\n');
    const fragment = document.createDocumentFragment();
    for (const line of lines) {
      const row = document.createElement('div');
      row.textContent = line || ' ';
      fragment.append(row);
    }
    mirror.replaceChildren(fragment);

    const rows = mirror.children;
    const mirrorTop = mirror.getBoundingClientRect().top;
    const points: Points = { lines: [], offsets: [] };
    for (let i = 0; i < rows.length; i++) {
      points.lines.push(i);
      points.offsets.push(rows[i]!.getBoundingClientRect().top - mirrorTop);
    }
    mirror.replaceChildren(); // free memory; offsets are cached
    return points;
  }

  function measurePreview(): Points {
    const containerTop = preview.getBoundingClientRect().top - preview.scrollTop;
    const byLine = new Map<number, number>();
    preview.querySelectorAll<HTMLElement>('[data-line]').forEach((element) => {
      const line = Number(element.dataset.line);
      if (!byLine.has(line)) byLine.set(line, element.getBoundingClientRect().top - containerTop);
    });

    const points: Points = { lines: [0], offsets: [0] };
    [...byLine.entries()]
      .sort((a, b) => a[0] - b[0])
      .forEach(([line, offset]) => {
        // Keep the table monotonic in both axes (nested blocks can overlap).
        if (offset >= points.offsets.at(-1)! && line >= points.lines.at(-1)!) {
          points.lines.push(line);
          points.offsets.push(offset);
        }
      });
    return points;
  }

  function editorTable(): Points {
    editorPoints ??= measureEditor();
    return editorPoints;
  }

  function previewTable(): Points {
    previewPoints ??= measurePreview();
    return previewPoints;
  }

  function syncFrom(source: 'editor' | 'preview'): void {
    if (!enabled || !isVisible(editor) || !isVisible(preview)) return;

    const from = source === 'editor' ? editor : preview;
    const to = source === 'editor' ? preview : editor;
    const fromTable = source === 'editor' ? editorTable() : previewTable();
    const toTable = source === 'editor' ? previewTable() : editorTable();

    // Pin the extremes so the ends of both documents always line up.
    let target: number;
    if (from.scrollTop <= 0) target = 0;
    else if (from.scrollTop >= maxScroll(from) - 1) target = maxScroll(to);
    else {
      const line = interpolate(fromTable.offsets, fromTable.lines, from.scrollTop);
      target = interpolate(toTable.lines, toTable.offsets, line);
    }

    if (Math.abs(to.scrollTop - target) > 1) to.scrollTop = target;
  }

  function schedule(source: 'editor' | 'preview'): void {
    if (source !== active) return; // ignore scroll events we caused ourselves
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => syncFrom(source));
  }

  // Whichever pane the user is interacting with drives the other one.
  const claim = (pane: 'editor' | 'preview') => () => { active = pane; };
  for (const type of ['pointerenter', 'pointerdown', 'wheel', 'touchstart', 'focusin', 'keydown']) {
    editor.addEventListener(type, claim('editor'), { passive: true });
    preview.addEventListener(type, claim('preview'), { passive: true });
  }
  editor.addEventListener('scroll', () => schedule('editor'), { passive: true });
  preview.addEventListener('scroll', () => schedule('preview'), { passive: true });

  // Images and other late-loading content shift the preview layout.
  preview.addEventListener('load', () => { previewPoints = null; }, true);

  const resizeObserver = new ResizeObserver(() => {
    editorPoints = null;
    previewPoints = null;
  });
  resizeObserver.observe(editor);
  resizeObserver.observe(preview);

  return {
    invalidateEditor() {
      editorPoints = null;
    },
    invalidatePreview() {
      previewPoints = null;
    },
    syncPreviewToEditor() {
      active = 'editor';
      syncFrom('editor');
    },
    syncEditorToPreview() {
      previewPoints = null;
      active = 'preview';
      syncFrom('preview');
    },
    setEnabled(value) {
      enabled = value;
      if (value) syncFrom(active);
    },
  };
}
