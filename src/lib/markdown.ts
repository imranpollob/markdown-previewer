import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import { highlightCode } from './highlight';
import { headingIds, inlineText } from './plugins/heading-ids';
import { sourceLines } from './plugins/source-lines';
import { taskLists } from './plugins/task-lists';
import { sanitize } from './sanitize';

const md = MarkdownIt({
  html: true, // raw HTML (e.g. <details>, <kbd>) is allowed, then sanitized
  linkify: true,
  typographer: false,
  highlight: highlightCode,
})
  .use(footnote)
  .use(taskLists)
  .use(headingIds)
  .use(sourceLines);

export interface RenderOptions {
  /** Add `data-line` attributes for scroll sync. Default true; off for exports. */
  sourceLines?: boolean;
}

/** Markdown -> sanitized HTML, safe to assign to innerHTML. */
export function renderMarkdown(source: string, options: RenderOptions = {}): string {
  return sanitize(md.render(source, { sourceLines: options.sourceLines ?? true }));
}

/** Plain text of the first level-1 heading, if any. */
export function firstHeading(source: string): string | null {
  const tokens = md.parse(source, {});
  const index = tokens.findIndex((token) => token.type === 'heading_open' && token.tag === 'h1');
  if (index < 0) return null;
  return inlineText(tokens[index + 1]).trim() || null;
}
