import { describe, expect, it } from 'vitest';
import hljs from './hljs-bundle';
import { highlightSource, segmentSource, splitLines } from './source-highlight';

/** Text content of highlighted HTML — must equal the source for the overlay to line up. */
function textOf(html: string): string {
  const element = document.createElement('div');
  element.innerHTML = html;
  return element.textContent ?? '';
}

const SAMPLE = [
  '# Title',
  '',
  'Some **bold**, _em_, `code` & <b>html</b> [link](https://x.dev).',
  '',
  '```ts',
  'const x: number = 1 < 2 ? 1 : 2;',
  '```',
  '',
  '> quote',
  '- item',
  '~~~',
  'plain <fence>',
  '~~~',
  '',
  '```',
  'unterminated',
].join('\n');

describe('segmentSource', () => {
  it('splits paragraphs and fenced code, preserving every character', () => {
    const segments = segmentSource(SAMPLE);
    expect(segments.map((s) => s.text).join('')).toBe(SAMPLE);
    expect(segments.filter((s) => s.kind === 'code').map((s) => s.lang)).toEqual(['ts', '', '']);
  });

  it('does not treat inline triple-backtick code as a fence', () => {
    expect(segmentSource('```a``` b\ntext').map((s) => s.kind)).toEqual(['markdown']);
  });

  it('only closes a fence with a matching marker', () => {
    const segments = segmentSource('````md\n```\nstill code\n````\nafter');
    expect(segments.map((s) => s.kind)).toEqual(['fence', 'code', 'fence', 'markdown']);
    expect(segments[1]!.text).toBe('```\nstill code\n');
  });
});

describe('highlightSource', () => {
  it('keeps the text identical to the source (overlay alignment)', () => {
    expect(textOf(highlightSource(SAMPLE, hljs))).toBe(SAMPLE);
    expect(textOf(highlightSource(SAMPLE + '\n\n', hljs))).toBe(SAMPLE + '\n\n');
  });

  it('highlights Markdown syntax', () => {
    const html = highlightSource('# Title\n\n**bold** and `code`', hljs);
    expect(html).toContain('<span class="hljs-section"># Title</span>');
    expect(html).toContain('<span class="hljs-strong">**bold**</span>');
    expect(html).toContain('<span class="hljs-code">`code`</span>');
  });

  it('highlights fenced code in its own language', () => {
    const html = highlightSource('```ts\nconst x = 1;\n```', hljs);
    expect(html).toContain('<span class="hljs-keyword">const</span>');
  });

  it('splits into one balanced HTML line per source line', () => {
    const source = SAMPLE + '\n';
    const lines = splitLines(highlightSource(source, hljs));
    expect(lines.map(textOf)).toEqual(source.split('\n'));
    for (const line of lines) {
      expect(line.match(/<span/g)?.length ?? 0).toBe(line.match(/<\/span>/g)?.length ?? 0);
    }
  });

  it('reopens spans that cross a newline', () => {
    expect(splitLines('<span class="a">x\ny</span>z')).toEqual([
      '<span class="a">x</span>',
      '<span class="a">y</span>z',
    ]);
  });

  it('escapes HTML so typed markup is never live', () => {
    const html = highlightSource('<img src=x onerror=alert(1)>', null);
    expect(html).toBe('&lt;img src=x onerror=alert(1)&gt;');
    const root = document.createElement('div');
    root.innerHTML = highlightSource('<img src=x onerror=alert(1)>\n\n```html\n<script>x</script>\n```', hljs);
    expect(root.querySelector('img, script')).toBeNull();
  });
});
