import type { MarkdownIt, StateCore, Token } from 'markdown-it';

// GFM task list marker: "[ ]" or "[x]" followed by whitespace (or end of line).
const TASK_MARKER = /^\[([ xX])\](?:[ \t]+|$)/;

function isListOpen(token: Token): boolean {
  return token.type === 'bullet_list_open' || token.type === 'ordered_list_open';
}

function addClass(token: Token, className: string): void {
  const current = String(token.attrGet('class') ?? '').split(' ');
  if (!current.includes(className)) token.attrJoin('class', className);
}

/** Renders `- [ ] item` / `- [x] item` as GitHub-style task list checkboxes. */
export function taskLists(md: MarkdownIt): void {
  md.core.ruler.push('task_lists', (state: StateCore) => {
    const tokens = state.tokens;

    for (let i = 2; i < tokens.length; i++) {
      const inline = tokens[i]!;
      const paragraph = tokens[i - 1]!;
      const item = tokens[i - 2]!;
      if (inline.type !== 'inline' || paragraph.type !== 'paragraph_open') continue;
      if (item.type !== 'list_item_open') continue;

      const match = TASK_MARKER.exec(inline.content);
      const first = inline.children?.[0];
      if (!match || !first || first.type !== 'text' || !first.content.startsWith(match[0])) {
        continue;
      }

      first.content = first.content.slice(match[0].length);
      inline.content = inline.content.slice(match[0].length);

      const checkbox = new state.Token('html_inline', '', 0);
      const checked = match[1] !== ' ' ? ' checked' : '';
      checkbox.content = `<input type="checkbox" class="task-list-item-checkbox" disabled${checked}> `;
      inline.children!.unshift(checkbox);

      addClass(item, 'task-list-item');
      for (let j = i - 3; j >= 0; j--) {
        const candidate = tokens[j]!;
        if (isListOpen(candidate) && candidate.level === item.level - 1) {
          addClass(candidate, 'contains-task-list');
          break;
        }
      }
    }
  });
}
