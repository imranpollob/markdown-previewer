import katex from 'katex';
import type { MarkdownIt } from 'markdown-it';

const MATH_LANGS = new Set(['latex', 'tex', 'math', 'katex']);

function renderMath(source: string, displayMode: boolean): string {
  return katex.renderToString(source, {
    displayMode,
    throwOnError: false, // show KaTeX's inline error instead of throwing
    output: 'htmlAndMathml',
  });
}

/**
 * LaTeX math rendered with KaTeX:
 *  - ```latex (also tex / math / katex) fenced blocks -> display math
 *  - `$$ ... $$` blocks (one line or several)         -> display math
 *  - `$$ ... $$` within a line of text                 -> display math
 *  - `$ ... $` inline                                  -> inline math
 */
export function math(md: MarkdownIt): void {
  const fallback = md.renderer.rules.fence!;

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!;
    const lang = (token.info.trim().split(/\s+/)[0] ?? '').toLowerCase();
    if (!MATH_LANGS.has(lang)) return fallback(tokens, idx, options, env, self);
    return `<div class="math-block"${self.renderAttrs(token)}>${renderMath(token.content, true)}</div>\n`;
  };

  md.block.ruler.before(
    'fence',
    'math_block',
    (state, startLine, endLine, silent) => {
      const start = state.bMarks[startLine]! + state.tShift[startLine]!;
      const max = state.eMarks[startLine]!;
      if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
      if (state.src.slice(start, start + 2) !== '$$') return false;

      const first = state.src.slice(start + 2, max);
      let content: string;
      let last = startLine;

      if (first.trimEnd().endsWith('$$') && first.trim().length > 2) {
        content = first.trimEnd().slice(0, -2); // $$ x $$ on one line
      } else {
        const lines = [first];
        let closed = false;
        for (last = startLine + 1; last < endLine; last++) {
          const from = state.bMarks[last]! + state.tShift[last]!;
          const line = state.src.slice(from, state.eMarks[last]!);
          // A blank line ends the search, so a stray $$ can't swallow later sections.
          if (!line.trim()) break;
          if (line.trimEnd().endsWith('$$')) {
            lines.push(line.trimEnd().slice(0, -2));
            closed = true;
            break;
          }
          lines.push(line);
        }
        if (!closed) return false;
        content = lines.join('\n');
      }

      if (silent) return true;
      state.line = last + 1;
      const token = state.push('math_block', 'div', 0);
      token.block = true;
      token.content = content.trim();
      token.map = [startLine, state.line];
      return true;
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
  );

  md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
    const src = state.src;
    const start = state.pos;
    if (src[start] !== '$') return false;
    const next = src[start + 1];

    if (next === '$') {
      // $$ ... $$ within a line of text: display math.
      const end = src.indexOf('$$', start + 2);
      if (end < 0 || end >= state.posMax || !src.slice(start + 2, end).trim()) return false;
      if (!silent) {
        const token = state.push('math_inline_display', 'span', 0);
        token.content = src.slice(start + 2, end);
      }
      state.pos = end + 2;
      return true;
    }

    if (next === undefined || /\s/.test(next)) return false;

    for (let i = start + 1; i < state.posMax; i++) {
      const ch = src[i];
      if (ch === '\\') {
        i++; // skip escaped character
        continue;
      }
      if (ch !== '$') continue;
      // Closing $ must follow non-space and not precede a digit ("$5 and $6" is prose).
      if (/\s/.test(src[i - 1]!) || /\d/.test(src[i + 1] ?? '')) return false;
      if (!silent) {
        const token = state.push('math_inline', 'span', 0);
        token.content = src.slice(start + 1, i);
      }
      state.pos = i + 1;
      return true;
    }
    return false;
  });

  md.renderer.rules.math_block = (tokens, idx, _options, _env, self) => {
    const token = tokens[idx]!;
    return `<div class="math-block"${self.renderAttrs(token)}>${renderMath(token.content, true)}</div>\n`;
  };
  md.renderer.rules.math_inline = (tokens, idx) => renderMath(tokens[idx]!.content, false);
  md.renderer.rules.math_inline_display = (tokens, idx) => renderMath(tokens[idx]!.content, true);
}
