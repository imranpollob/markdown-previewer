/** Shown on the first visit (and never again once the user has edited). */
export const SAMPLE_DOCUMENT = `# Welcome to Markdown Previewer

Write **Markdown** in the editor and see it rendered in the preview, instantly.
Everything stays in your browser: your text is autosaved locally and never uploaded.

## Formatting

You can use **bold**, _italic_, ~~strikethrough~~, \`inline code\`, and [links](https://github.github.com/gfm/).
Bare URLs like https://imranpollob.github.io become links automatically.

> Blockquotes are great for callouts and citations.

## Lists and tasks

1. Open a \`.md\` file (or drag one onto the editor)
2. Edit with the toolbar or keyboard shortcuts
3. Download it again, or export to HTML

- [x] Live GitHub Flavored Markdown preview
- [x] Syntax highlighting
- [ ] Write something great

## Tables

| Shortcut | Action |
| :------- | :----- |
| <kbd>Ctrl</kbd> + <kbd>B</kbd> | Bold |
| <kbd>Ctrl</kbd> + <kbd>I</kbd> | Italic |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Link |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Download \`.md\` |

## Code

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet('Markdown'));
\`\`\`

\`\`\`python
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b
\`\`\`

## Extras

<details>
<summary>Raw HTML such as &lt;details&gt; works too</summary>

It is sanitized before rendering, so scripts and unsafe attributes are removed.

</details>

Footnotes are supported as well.[^1]

---

Happy writing! ✍️

[^1]: Like this one.
`;
