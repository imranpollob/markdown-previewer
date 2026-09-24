/**
 * Pure text-editing commands for the Markdown textarea. Each command takes the
 * current text + selection and returns a single replacement (`Edit`), which the
 * UI applies in a way that keeps native undo/redo working.
 */

export interface Selection {
  value: string;
  start: number;
  end: number;
}

export interface Edit {
  /** Replace value[from, to) with `insert`, then select [selStart, selEnd). */
  from: number;
  to: number;
  insert: string;
  selStart: number;
  selEnd: number;
}

export type InlineFormat = 'bold' | 'italic' | 'strikethrough' | 'code';
export type LineFormat = 'quote' | 'bullet' | 'ordered' | 'task';

const INLINE_MARKERS: Record<InlineFormat, { marker: string; placeholder: string }> = {
  bold: { marker: '**', placeholder: 'bold text' },
  italic: { marker: '_', placeholder: 'italic text' },
  strikethrough: { marker: '~~', placeholder: 'struck text' },
  code: { marker: '`', placeholder: 'code' },
};

const LIST_MARKER = /^([-*+] \[[ xX]\] |[-*+] |\d+[.)] )/;
const LINE_PATTERNS: Record<LineFormat, RegExp> = {
  quote: /^> ?/,
  bullet: /^[-*+] (?!\[[ xX]\] )/,
  ordered: /^\d+[.)] /,
  task: /^[-*+] \[[ xX]\] /,
};

const INDENT = '  ';

/** Bounds of the full lines touched by the selection. */
export function lineBounds({ value, start, end }: Selection): { from: number; to: number } {
  // A selection ending right after a newline shouldn't include the next line.
  const last = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const from = value.lastIndexOf('\n', start - 1) + 1;
  const newline = value.indexOf('\n', last);
  return { from, to: newline === -1 ? value.length : newline };
}

/** Wraps the selection in a marker (`**bold**`), or unwraps it if already wrapped. */
export function toggleInline(sel: Selection, format: InlineFormat): Edit {
  const { marker, placeholder } = INLINE_MARKERS[format];
  const { value } = sel;
  const m = marker.length;

  // Trim surrounding whitespace so "word " becomes "**word** ", not "**word **".
  let { start, end } = sel;
  while (start < end && /\s/.test(value[start]!)) start++;
  while (end > start && /\s/.test(value[end - 1]!)) end--;
  const selected = value.slice(start, end);

  if (selected.length >= 2 * m && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(m, -m);
    return { from: start, to: end, insert: inner, selStart: start, selEnd: start + inner.length };
  }
  if (value.slice(start - m, start) === marker && value.slice(end, end + m) === marker) {
    return { from: start - m, to: end + m, insert: selected, selStart: start - m, selEnd: end - m };
  }

  const text = selected || placeholder;
  return {
    from: start,
    to: end,
    insert: marker + text + marker,
    selStart: start + m,
    selEnd: start + m + text.length,
  };
}

/** Inserts `[text](url)` / `![alt](url)`, selecting whichever part the user still needs to type. */
export function insertLink(sel: Selection, image = false): Edit {
  const { value, start, end } = sel;
  const selected = value.slice(start, end);
  const bang = image ? '!' : '';
  const label = image ? 'alt text' : 'link text';

  if (/^(https?:\/\/|www\.)\S+$/i.test(selected)) {
    const labelStart = start + bang.length + 1;
    return {
      from: start,
      to: end,
      insert: `${bang}[${label}](${selected})`,
      selStart: labelStart,
      selEnd: labelStart + label.length,
    };
  }

  const text = selected || label;
  const insert = `${bang}[${text}](https://)`;
  if (!selected) {
    const labelStart = start + bang.length + 1;
    return { from: start, to: end, insert, selStart: labelStart, selEnd: labelStart + text.length };
  }
  const urlStart = start + bang.length + text.length + 3;
  return { from: start, to: end, insert, selStart: urlStart, selEnd: urlStart + 'https://'.length };
}

/** Adds or removes a line prefix (quote, bullet, numbered, task) on every selected line. */
export function toggleLinePrefix(sel: Selection, format: LineFormat): Edit {
  const { from, to } = lineBounds(sel);
  const lines = sel.value.slice(from, to).split('\n');
  const pattern = LINE_PATTERNS[format];
  const content = lines.filter((line) => line.trim() !== '');
  const remove = content.length > 0 && content.every((line) => pattern.test(line.trimStart()));

  let number = 0;
  const next = lines.map((line) => {
    const indent = /^\s*/.exec(line)![0];
    let rest = line.slice(indent.length);
    if (remove) return indent + rest.replace(pattern, '');
    if (rest === '' && lines.length > 1) return line;
    if (format !== 'quote') rest = rest.replace(LIST_MARKER, '');
    const prefix =
      format === 'quote' ? '> '
      : format === 'bullet' ? '- '
      : format === 'task' ? '- [ ] '
      : `${++number}. `;
    return indent + prefix + rest;
  });

  return replaceLines(sel, from, to, lines, next);
}

/** Cycles the heading level of the selected lines: none → # → ## → ### → none. */
export function cycleHeading(sel: Selection): Edit {
  const { from, to } = lineBounds(sel);
  const lines = sel.value.slice(from, to).split('\n');
  const level = /^(#{1,6}) /.exec(lines[0]!)?.[1]!.length ?? 0;
  const nextLevel = level >= 3 ? 0 : level + 1;
  const next = lines.map((line) => {
    const text = line.replace(/^#{1,6} /, '');
    return nextLevel === 0 ? text : `${'#'.repeat(nextLevel)} ${text}`;
  });
  return replaceLines(sel, from, to, lines, next);
}

/** Inserts a block (code fence, table, rule) on its own lines, separated by blank lines. */
export function insertBlock(sel: Selection, block: string, select?: [number, number]): Edit {
  const { value, start, end } = sel;
  const before = value.slice(0, start);
  const after = value.slice(end);

  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail = after === '' ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const insert = lead + block + trail;
  const base = start + lead.length;
  const [selFrom, selTo] = select ?? [block.length, block.length];

  return { from: start, to: end, insert, selStart: base + selFrom, selEnd: base + selTo };
}

export function insertCodeBlock(sel: Selection): Edit {
  const selected = sel.value.slice(sel.start, sel.end);
  const block = '```\n' + selected + '\n```';
  return insertBlock(sel, block, [4, 4 + selected.length]);
}

export function insertTable(sel: Selection): Edit {
  const block = '| Column 1 | Column 2 |\n| -------- | -------- |\n| Cell     | Cell     |';
  return insertBlock(sel, block, [2, 10]);
}

export function insertRule(sel: Selection): Edit {
  return insertBlock(sel, '---');
}

/** True when `pos` sits inside a fenced code block. */
function inCodeFence(value: string, pos: number): boolean {
  const fences = value.slice(0, pos).match(/^\s*(```|~~~)/gm);
  return (fences?.length ?? 0) % 2 === 1;
}

/**
 * Enter inside a list item or quote continues it (`- ` → next `- `, `3. ` → `4. `,
 * `- [x] ` → `- [ ] `). Enter on an empty item ends the list. Returns null to
 * fall back to a plain newline.
 */
export function continueList(sel: Selection): Edit | null {
  const { value, start, end } = sel;
  if (start !== end) return null;

  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEndIndex = value.indexOf('\n', start);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const line = value.slice(lineStart, lineEnd);
  if (inCodeFence(value, lineStart)) return null;

  const list = /^(\s*)(?:([-*+])|(\d+)([.)]))(\s+)(\[[ xX]\]\s+)?/.exec(line);
  const quote = /^(\s*>\s?)/.exec(line);
  const match = list ?? quote;
  if (!match || start < lineStart + match[0].length) return null;

  const isEmpty = line.slice(match[0].length).trim() === '';
  if (isEmpty) {
    // Second Enter on an empty item: drop the marker and leave a blank line.
    return { from: lineStart, to: lineEnd, insert: '', selStart: lineStart, selEnd: lineStart };
  }

  let marker: string;
  if (list) {
    const [, indent, bullet, number, delimiter, space, task] = list;
    const head = bullet ?? `${Number(number) + 1}${delimiter}`;
    marker = `${indent}${head}${space}${task ? '[ ] ' : ''}`;
  } else {
    marker = quote![1]!;
  }

  const insert = '\n' + marker;
  return { from: start, to: end, insert, selStart: start + insert.length, selEnd: start + insert.length };
}

/** Tab / Shift+Tab: indent or outdent the selected lines (or insert spaces at the cursor). */
export function indent(sel: Selection, outdent = false): Edit {
  const { value, start, end } = sel;
  const { from, to } = lineBounds(sel);
  const lines = value.slice(from, to).split('\n');
  const onListItem = LIST_MARKER.test(lines[0]!.trimStart());

  if (!outdent && start === end && !onListItem) {
    return { from: start, to: end, insert: INDENT, selStart: start + INDENT.length, selEnd: start + INDENT.length };
  }

  const next = lines.map((line) => {
    if (!outdent) return line === '' && lines.length > 1 ? line : INDENT + line;
    return line.replace(/^(\t| {1,2})/, '');
  });
  return replaceLines(sel, from, to, lines, next);
}

/** Replaces whole lines, keeping the cursor on the same text where possible. */
function replaceLines(sel: Selection, from: number, to: number, before: string[], after: string[]): Edit {
  const insert = after.join('\n');
  if (sel.start === sel.end && before.length === 1) {
    const delta = insert.length - (to - from);
    const cursor = Math.min(Math.max(from, sel.start + delta), from + insert.length);
    return { from, to, insert, selStart: cursor, selEnd: cursor };
  }
  return { from, to, insert, selStart: from, selEnd: from + insert.length };
}

/** Applies an edit to a string (used by tests and as the non-DOM fallback). */
export function applyEditToString(value: string, edit: Edit): string {
  return value.slice(0, edit.from) + edit.insert + value.slice(edit.to);
}
