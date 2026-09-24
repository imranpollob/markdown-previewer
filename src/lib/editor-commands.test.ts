import { describe, expect, it } from 'vitest';
import {
  applyEditToString,
  continueList,
  cycleHeading,
  indent,
  insertCodeBlock,
  insertLink,
  insertRule,
  insertTable,
  toggleInline,
  toggleLinePrefix,
  type Edit,
  type Selection,
} from './editor-commands';

/** "a «b» c" → selection over "b"; "a|b" → cursor between a and b. */
function sel(marked: string): Selection {
  if (marked.includes('|')) {
    const start = marked.indexOf('|');
    return { value: marked.replace('|', ''), start, end: start };
  }
  const start = marked.indexOf('«');
  const end = marked.indexOf('»') - 1;
  return { value: marked.replace('«', '').replace('»', ''), start, end };
}

/** Applies the edit and renders the result with the same markers. */
function show(selection: Selection, edit: Edit | null): string {
  if (!edit) return 'null';
  const value = applyEditToString(selection.value, edit);
  if (edit.selStart === edit.selEnd) {
    return value.slice(0, edit.selStart) + '|' + value.slice(edit.selStart);
  }
  return value.slice(0, edit.selStart) + '«' + value.slice(edit.selStart, edit.selEnd) + '»' + value.slice(edit.selEnd);
}

const run = (marked: string, command: (s: Selection) => Edit | null) => {
  const selection = sel(marked);
  return show(selection, command(selection));
};

describe('toggleInline', () => {
  it('wraps a selection', () => {
    expect(run('make «this» bold', (s) => toggleInline(s, 'bold'))).toBe('make **«this»** bold');
  });

  it('inserts a selected placeholder with no selection', () => {
    expect(run('a |b', (s) => toggleInline(s, 'italic'))).toBe('a _«italic text»_b');
  });

  it('unwraps when the markers surround the selection', () => {
    expect(run('**«bold»**', (s) => toggleInline(s, 'bold'))).toBe('«bold»');
  });

  it('unwraps when the markers are inside the selection', () => {
    expect(run('«~~gone~~»', (s) => toggleInline(s, 'strikethrough'))).toBe('«gone»');
  });

  it('does not wrap surrounding whitespace', () => {
    expect(run('«word »next', (s) => toggleInline(s, 'code'))).toBe('`«word»` next');
  });
});

describe('insertLink', () => {
  it('uses selected text as the label and selects the URL', () => {
    expect(run('see «docs»', (s) => insertLink(s))).toBe('see [docs](«https://»)');
  });

  it('uses a selected URL as the target and selects the label', () => {
    expect(run('«https://x.dev»', (s) => insertLink(s))).toBe('[«link text»](https://x.dev)');
  });

  it('inserts an image', () => {
    expect(run('|', (s) => insertLink(s, true))).toBe('![«alt text»](https://)');
  });
});

describe('toggleLinePrefix', () => {
  it('prefixes every selected line', () => {
    expect(run('«one\ntwo»', (s) => toggleLinePrefix(s, 'bullet'))).toBe('«- one\n- two»');
  });

  it('numbers ordered lists', () => {
    expect(run('«a\nb\nc»', (s) => toggleLinePrefix(s, 'ordered'))).toBe('«1. a\n2. b\n3. c»');
  });

  it('removes the prefix when every line already has it', () => {
    expect(run('«> a\n> b»', (s) => toggleLinePrefix(s, 'quote'))).toBe('«a\nb»');
  });

  it('converts between list types', () => {
    expect(run('«- a\n- b»', (s) => toggleLinePrefix(s, 'task'))).toBe('«- [ ] a\n- [ ] b»');
  });

  it('keeps the cursor on the same text', () => {
    expect(run('hel|lo', (s) => toggleLinePrefix(s, 'quote'))).toBe('> hel|lo');
  });

  it('only touches the lines in the selection', () => {
    expect(run('keep\n«x»\nkeep', (s) => toggleLinePrefix(s, 'bullet'))).toBe('keep\n«- x»\nkeep');
  });
});

describe('cycleHeading', () => {
  it('cycles # → ## → ### → none', () => {
    expect(run('Ti|tle', cycleHeading)).toBe('# Ti|tle');
    expect(run('# Ti|tle', cycleHeading)).toBe('## Ti|tle');
    expect(run('### Ti|tle', cycleHeading)).toBe('Ti|tle');
  });
});

describe('blocks', () => {
  it('puts a code fence on its own paragraph with the cursor inside', () => {
    expect(run('text|', insertCodeBlock)).toBe('text\n\n```\n|\n```\n');
  });

  it('fences selected code', () => {
    expect(run('«x = 1»', insertCodeBlock)).toBe('```\n«x = 1»\n```\n');
  });

  it('inserts a table with the first header selected', () => {
    expect(run('|', insertTable)).toBe('| «Column 1» | Column 2 |\n| -------- | -------- |\n| Cell     | Cell     |\n');
  });

  it('inserts a rule between paragraphs', () => {
    expect(run('a|\nb', insertRule)).toBe('a\n\n---|\n\nb');
  });
});

describe('continueList', () => {
  it('continues bullets', () => {
    expect(run('- one|', continueList)).toBe('- one\n- |');
  });

  it('increments numbers', () => {
    expect(run('9) nine|', continueList)).toBe('9) nine\n10) |');
  });

  it('continues tasks unchecked, keeping indentation', () => {
    expect(run('  - [x] done|', continueList)).toBe('  - [x] done\n  - [ ] |');
  });

  it('continues quotes', () => {
    expect(run('> said|', continueList)).toBe('> said\n> |');
  });

  it('ends the list on an empty item', () => {
    expect(run('- one\n- |', continueList)).toBe('- one\n|');
  });

  it('ignores normal lines, code fences and cursors inside the marker', () => {
    expect(run('plain|', continueList)).toBe('null');
    expect(run('```\n- not a list|', continueList)).toBe('null');
    expect(run('-| item', continueList)).toBe('null');
  });
});

describe('indent', () => {
  it('inserts spaces at a plain cursor', () => {
    expect(run('a|b', (s) => indent(s))).toBe('a  |b');
  });

  it('nests a list item from anywhere in the line', () => {
    expect(run('- ite|m', (s) => indent(s))).toBe('  - ite|m');
  });

  it('indents and outdents selected lines', () => {
    expect(run('«a\nb»', (s) => indent(s))).toBe('«  a\n  b»');
    expect(run('«  a\n b»', (s) => indent(s, true))).toBe('«a\nb»');
  });
});
