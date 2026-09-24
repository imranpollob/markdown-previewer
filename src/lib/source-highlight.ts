import type { HLJSApi } from 'highlight.js';

/**
 * Syntax highlighting for the Markdown *source* shown in the editor.
 *
 * The document is split into segments: fenced code blocks (highlighted in their
 * own language) and Markdown paragraphs (split at blank lines). Each segment is
 * cached by content, so a keystroke only re-highlights the paragraph being edited.
 *
 * Invariant: the text content of the returned HTML is exactly `source`, so the
 * overlay lines up character-for-character with the textarea.
 */

export interface Segment {
  kind: 'markdown' | 'fence' | 'code';
  text: string;
  lang?: string;
}

// A backtick fence's info string may not contain backticks ("```a``` b" is inline code).
const FENCE_OPEN = /^\s*(?:(`{3,})\s*([^\s`]*)[^`]*|(~{3,})\s*(\S*).*)$/;

export function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Splits Markdown into highlightable segments; concatenating their text gives back `source`. */
export function segmentSource(source: string): Segment[] {
  const lines = source.split('\n');
  const last = lines.length - 1;
  const withBreak = (i: number) => lines[i]! + (i < last ? '\n' : '');
  const segments: Segment[] = [];
  let paragraph = '';

  const flush = () => {
    if (paragraph) segments.push({ kind: 'markdown', text: paragraph });
    paragraph = '';
  };

  for (let i = 0; i <= last; i++) {
    const open = FENCE_OPEN.exec(lines[i]!);
    if (!open) {
      paragraph += withBreak(i);
      if (lines[i]!.trim() === '') flush();
      continue;
    }

    flush();
    const marker = (open[1] ?? open[3])!;
    const lang = open[2] ?? open[4] ?? '';
    const close = new RegExp(`^\\s*${marker[0]}{${marker.length},}\\s*$`);
    segments.push({ kind: 'fence', text: withBreak(i) });

    let body = '';
    while (i + 1 <= last && !close.test(lines[i + 1]!)) body += withBreak(++i);
    if (body) segments.push({ kind: 'code', text: body, lang: lang.toLowerCase() });
    if (i + 1 <= last) segments.push({ kind: 'fence', text: withBreak(++i) });
  }
  flush();
  return segments;
}

function highlightSegment(segment: Segment, hljs: HLJSApi): string {
  switch (segment.kind) {
    case 'fence':
      return `<span class="hljs-meta">${escapeHtml(segment.text)}</span>`;
    case 'code':
      return segment.lang && hljs.getLanguage(segment.lang)
        ? hljs.highlight(segment.text, { language: segment.lang, ignoreIllegals: true }).value
        : `<span class="hljs-code">${escapeHtml(segment.text)}</span>`;
    default:
      return hljs.highlight(segment.text, { language: 'markdown', ignoreIllegals: true }).value;
  }
}

const TOKEN = /<span[^>]*>|<\/span>|\n|[^<\n]+/g;

/**
 * Splits highlighted HTML into one balanced HTML string per source line: spans
 * that cross a newline are closed at the end of the line and reopened on the next.
 */
export function splitLines(html: string): string[] {
  const lines: string[] = [];
  const open: string[] = [];
  let line = '';

  for (const [token] of html.matchAll(TOKEN)) {
    if (token === '\n') {
      lines.push(line + '</span>'.repeat(open.length));
      line = open.join('');
    } else if (token === '</span>') {
      open.pop();
      line += token;
    } else {
      if (token.startsWith('<span')) open.push(token);
      line += token;
    }
  }
  lines.push(line);
  return lines;
}

const cache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 2000;

/** Highlighted HTML for the editor overlay; plain escaped text until highlight.js has loaded. */
export function highlightSource(source: string, hljs: HLJSApi | null): string {
  if (!hljs) return escapeHtml(source);

  return segmentSource(source)
    .map((segment) => {
      const key = `${segment.kind}\u0000${segment.lang ?? ''}\u0000${segment.text}`;
      let html = cache.get(key);
      if (html === undefined) {
        html = highlightSegment(segment, hljs);
        if (cache.size >= MAX_CACHE_ENTRIES) cache.clear();
        cache.set(key, html);
      }
      return html;
    })
    .join('');
}
