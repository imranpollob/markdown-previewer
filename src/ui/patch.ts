const LINE_ATTR = / data-line="\d+"/g;

/** Identity of a top-level node, ignoring source-line bookkeeping. */
function signature(node: Node): string {
  return node instanceof Element
    ? node.outerHTML.replace(LINE_ATTR, '')
    : `${node.nodeType}:${node.textContent ?? ''}`;
}

/** Copies `data-line` values from a freshly rendered twin onto a kept node. */
function syncLineAttributes(target: Node, source: Node): void {
  if (!(target instanceof Element) || !(source instanceof Element)) return;
  const line = source.getAttribute('data-line');
  if (line !== null) target.setAttribute('data-line', line);
  const targets = target.querySelectorAll('[data-line]');
  source.querySelectorAll('[data-line]').forEach((element, i) => {
    targets[i]?.setAttribute('data-line', element.getAttribute('data-line')!);
  });
}

/**
 * Replaces `container`'s children with `html`, but keeps the unchanged leading
 * and trailing top-level nodes. Typing in one paragraph then only rebuilds that
 * paragraph, so images elsewhere don't reload or flicker.
 */
export function patchChildren(container: Element, html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html;

  const next = [...template.content.childNodes];
  const prev = [...container.childNodes];
  const nextSigs = next.map(signature);
  const prevSigs = prev.map(signature);

  let head = 0;
  while (head < prev.length && head < next.length && prevSigs[head] === nextSigs[head]) head++;

  let tail = 0;
  while (
    tail < prev.length - head &&
    tail < next.length - head &&
    prevSigs[prev.length - 1 - tail] === nextSigs[next.length - 1 - tail]
  ) {
    tail++;
  }

  for (let i = 0; i < head; i++) syncLineAttributes(prev[i]!, next[i]!);
  for (let i = 1; i <= tail; i++) syncLineAttributes(prev[prev.length - i]!, next[next.length - i]!);

  const anchor = prev[prev.length - tail] ?? null;
  for (let i = head; i < prev.length - tail; i++) prev[i]!.remove();
  container.insertBefore(fragmentOf(next.slice(head, next.length - tail)), anchor);
}

function fragmentOf(nodes: Node[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(...nodes);
  return fragment;
}
