import { SITE_URL } from '../config';
import brandCss from '../styles/brand.css?inline';
import highlightCss from '../styles/highlight.css?inline';
import markdownCss from '../styles/markdown.css?inline';

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** A self-contained HTML document (styles inlined) for the "Export HTML" action. */
export function buildStandaloneHtml(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Markdown Previewer (${SITE_URL})">
<title>${escapeHtml(title)}</title>
<style>
${brandCss}
${markdownCss}
${highlightCss}
body { margin: 0; background: #fff; color: var(--color-text); }
.markdown-body { max-width: 860px; margin: 0 auto; padding: 48px 24px 64px; }
</style>
</head>
<body>
<article class="markdown-body">
${bodyHtml}
</article>
</body>
</html>
`;
}
