import type { MarkdownIt, StateCore, Token } from 'markdown-it';

/** Visible text of an inline token (ignores emphasis markup, images, etc.). */
export function inlineText(inline: Token | undefined): string {
  return (inline?.children ?? [])
    .filter((child) => child.type === 'text' || child.type === 'code_inline')
    .map((child) => child.content)
    .join('');
}

/** GitHub-compatible heading slug: "Hello, World!" -> "hello-world". */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/**
 * Gives every heading an `id` so in-document links (`[see](#setup)`) and the
 * table of contents pattern work. Duplicate slugs get `-1`, `-2`, ... like GitHub.
 */
export function headingIds(md: MarkdownIt): void {
  md.core.ruler.push('heading_ids', (state: StateCore) => {
    const seen = new Map<string, number>();
    const tokens = state.tokens;

    for (let i = 0; i < tokens.length - 1; i++) {
      const open = tokens[i]!;
      if (open.type !== 'heading_open' || open.attrGet('id')) continue;

      const base = slugify(inlineText(tokens[i + 1])) || 'section';
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      open.attrSet('id', count === 0 ? base : `${base}-${count}`);
    }
  });
}
