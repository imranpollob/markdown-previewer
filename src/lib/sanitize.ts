import DOMPurify from 'dompurify';

/**
 * DOMPurify prefixes every `id`/`name` with this (SANITIZE_NAMED_PROPS) so a
 * heading like "# Images" can't clobber `document.images`. Same prefix GitHub uses.
 */
export const ID_PREFIX = 'user-content-';

const CONFIG = {
  SANITIZE_NAMED_PROPS: true,
  // <style> would restyle the whole app; <form> has no place in a document preview.
  FORBID_TAGS: ['style', 'form'],
};

let hooksInstalled = false;

function installHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName !== 'A') return;
    const link = node as Element;
    const href = link.getAttribute('href');
    if (href === null) return;

    if (href.startsWith('#')) {
      // Point in-document links at the prefixed ids.
      const fragment = href.slice(1);
      if (fragment && !fragment.startsWith(ID_PREFIX)) {
        link.setAttribute('href', `#${ID_PREFIX}${fragment}`);
      }
    } else {
      // Never navigate away from the editor.
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

/**
 * The security boundary: everything rendered into the preview (typed, pasted or
 * uploaded) passes through here *after* Markdown parsing.
 */
export function sanitize(html: string): string {
  installHooks();
  return DOMPurify.sanitize(html, CONFIG);
}
