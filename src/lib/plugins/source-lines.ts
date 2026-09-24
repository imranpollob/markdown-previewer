import type { MarkdownIt, StateCore } from 'markdown-it';

/**
 * Tags rendered block elements with `data-line="<source line>"` so the preview
 * can be scroll-synced with the editor. Skipped when `env.sourceLines === false`
 * (e.g. for exported or copied HTML).
 */
export function sourceLines(md: MarkdownIt): void {
  md.core.ruler.push('source_lines', (state: StateCore) => {
    if (state.env?.sourceLines === false) return;

    for (const token of state.tokens) {
      if (token.map && token.block && token.nesting !== -1) {
        token.attrSet('data-line', String(token.map[0]));
      }
    }
  });
}
