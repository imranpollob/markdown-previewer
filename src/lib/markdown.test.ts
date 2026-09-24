import { describe, expect, it } from 'vitest';
import { loadHighlighter } from './highlight';
import { firstHeading, renderMarkdown } from './markdown';
import { slugify } from './plugins/heading-ids';

const render = (source: string) => renderMarkdown(source, { sourceLines: false });

function dom(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('GitHub Flavored Markdown', () => {
  it('renders tables', () => {
    const html = render('| a | b |\n| - | :-: |\n| 1 | 2 |');
    const table = dom(html).querySelector('table');
    expect(table?.querySelectorAll('th')).toHaveLength(2);
    expect(table?.querySelector('td:last-child')?.getAttribute('style')).toContain('center');
  });

  it('renders strikethrough and autolinks', () => {
    const root = dom(render('~~gone~~ see https://example.com'));
    expect(root.querySelector('s')?.textContent).toBe('gone');
    expect(root.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
  });

  it('renders task lists as disabled checkboxes', () => {
    const root = dom(render('- [ ] todo\n- [x] done\n- plain'));
    const boxes = root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(boxes).toHaveLength(2);
    expect(boxes[0]!.checked).toBe(false);
    expect(boxes[1]!.checked).toBe(true);
    expect(boxes[0]!.disabled).toBe(true);
    expect(root.querySelector('ul')?.classList.contains('contains-task-list')).toBe(true);
    expect(root.querySelectorAll('li.task-list-item')).toHaveLength(2);
    expect(root.querySelectorAll('li')[0]!.textContent?.trim()).toBe('todo');
  });

  it('does not treat "[ ]" outside a list item as a task', () => {
    expect(render('[ ] not a task')).not.toContain('checkbox');
  });

  it('renders footnotes', () => {
    const root = dom(render('Claim.[^1]\n\n[^1]: Source.'));
    expect(root.querySelector('.footnotes')).not.toBeNull();
  });

  it('allows safe raw HTML such as <details> and <kbd>', () => {
    const root = dom(render('<details><summary>More</summary>Hidden</details>\n\nPress <kbd>Ctrl</kbd>'));
    expect(root.querySelector('details summary')?.textContent).toBe('More');
    expect(root.querySelector('kbd')?.textContent).toBe('Ctrl');
  });
});

describe('headings', () => {
  it('slugifies like GitHub', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('  Use `npm` & Node.js ')).toBe('use-npm--nodejs');
    expect(slugify('Überblick')).toBe('überblick');
  });

  it('adds prefixed, de-duplicated ids and rewrites in-page links', () => {
    const root = dom(render('# Intro\n\n## Intro\n\n[jump](#intro)'));
    const ids = [...root.querySelectorAll('h1, h2')].map((h) => h.id);
    expect(ids).toEqual(['user-content-intro', 'user-content-intro-1']);
    expect(root.querySelector('a')?.getAttribute('href')).toBe('#user-content-intro');
  });

  it('keeps ids that would otherwise clobber document properties', () => {
    expect(dom(render('# Images')).querySelector('h1')?.id).toBe('user-content-images');
  });

  it('finds the first h1', () => {
    expect(firstHeading('Intro\n\n## Sub\n\n# The **Title**')).toBe('The Title');
    expect(firstHeading('no heading')).toBeNull();
  });
});

describe('sanitization', () => {
  const vectors = [
    '<script>alert(1)</script>',
    '<img src=x onerror="alert(1)">',
    '<a href="javascript:alert(1)">x</a>',
    '[x](javascript:alert(1))',
    '[x](JaVaScRiPt:alert(1))',
    '<iframe src="https://example.com"></iframe>',
    '<svg><script>alert(1)</script></svg>',
    '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
    '<div onclick="alert(1)">x</div>',
    '<object data="x.swf"></object>',
    '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  ];

  it.each(vectors)('neutralises %s', (vector) => {
    const root = dom(render(vector));
    expect(root.querySelector('script, iframe, object, embed')).toBeNull();
    for (const element of root.querySelectorAll('*')) {
      for (const attr of element.attributes) {
        expect(attr.name).not.toMatch(/^on/i);
        expect(attr.value).not.toMatch(/javascript:|data:text\/html/i);
      }
    }
  });

  it('strips <style> so documents cannot restyle the app', () => {
    expect(render('<style>body{display:none}</style>\n\ntext')).not.toContain('<style');
  });

  it('opens external links in a new tab without an opener', () => {
    const link = dom(render('[x](https://example.com)')).querySelector('a');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });
});

describe('source lines', () => {
  it('annotates blocks with their source line for scroll sync', () => {
    const root = dom(renderMarkdown('# A\n\npara\n\n- item'));
    expect(root.querySelector('h1')?.dataset.line).toBe('0');
    expect(root.querySelector('p')?.dataset.line).toBe('2');
    expect(root.querySelector('ul')?.dataset.line).toBe('4');
  });

  it('omits them for export', () => {
    expect(render('# A')).not.toContain('data-line');
  });
});

describe('syntax highlighting', () => {
  it('highlights known languages once the highlighter has loaded', async () => {
    await loadHighlighter();
    const root = dom(render('```js\nconst x = 1;\n```'));
    expect(root.querySelector('code.language-js .hljs-keyword')?.textContent).toBe('const');
  });

  it('escapes code in unknown languages', () => {
    const html = render('```nope\n<b>hi</b>\n```');
    expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;');
  });
});
