import { readSetting, writeSetting } from '../lib/storage';

const MIN_PANE_PX = 280;
const KEY_STEP = 0.02;

/**
 * Draggable divider between the editor and preview. The editor's share of the
 * width is kept as a ratio (so it survives window resizes) and persisted.
 */
export function initSplit(workspace: HTMLElement, handle: HTMLElement): void {
  const stored = Number(readSetting('split'));
  let preferred = stored > 0 && stored < 1 ? stored : 0.5;

  const available = () => {
    const style = getComputedStyle(workspace);
    return workspace.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - handle.offsetWidth;
  };

  const bounds = (): [number, number] => {
    const width = available();
    if (width < MIN_PANE_PX * 2) return [0.5, 0.5];
    const min = MIN_PANE_PX / width;
    return [min, 1 - min];
  };

  /** Applies a ratio (clamped so neither pane gets too narrow). */
  const apply = (ratio: number) => {
    const [min, max] = bounds();
    const shown = Math.min(max, Math.max(min, ratio));
    workspace.style.setProperty('--split-left', `${shown}fr`);
    workspace.style.setProperty('--split-right', `${1 - shown}fr`);
    handle.setAttribute('aria-valuemin', String(Math.round(min * 100)));
    handle.setAttribute('aria-valuemax', String(Math.round(max * 100)));
    handle.setAttribute('aria-valuenow', String(Math.round(shown * 100)));
    handle.setAttribute('aria-valuetext', `Editor ${Math.round(shown * 100)}% of the width`);
    return shown;
  };

  const commit = (ratio: number) => {
    preferred = apply(ratio);
    writeSetting('split', preferred.toFixed(4));
  };

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add('is-resizing');
  });

  handle.addEventListener('pointermove', (event) => {
    if (!handle.hasPointerCapture(event.pointerId)) return;
    const left = workspace.getBoundingClientRect().left + parseFloat(getComputedStyle(workspace).paddingLeft);
    preferred = apply((event.clientX - left - handle.offsetWidth / 2) / available());
  });

  const endDrag = (event: PointerEvent) => {
    if (!handle.hasPointerCapture(event.pointerId)) return;
    handle.releasePointerCapture(event.pointerId);
    document.body.classList.remove('is-resizing');
    commit(preferred);
  };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);

  handle.addEventListener('dblclick', () => commit(0.5));

  handle.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? KEY_STEP * 5 : KEY_STEP;
    const [min, max] = bounds();
    const current = apply(preferred);
    const next: Record<string, number> = {
      ArrowLeft: current - step,
      ArrowRight: current + step,
      Home: min,
      End: max,
      Enter: 0.5,
    };
    const target = next[event.key];
    if (target === undefined) return;
    event.preventDefault();
    commit(target);
  });

  new ResizeObserver(() => apply(preferred)).observe(workspace);
  apply(preferred);
}
