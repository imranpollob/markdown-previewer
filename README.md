# Markdown Previewer

A fast, private Markdown editor with a live GitHub Flavored Markdown preview. It runs entirely in the browser: no account, no backend, and files never leave your device.

**Live:** https://imranpollob.github.io/markdown-previewer/

## Features

- Split-pane editor with live GFM preview (tables, task lists, strikethrough, autolinks, footnotes)
- Syntax-highlighted Markdown source in the editor (fenced code is highlighted in its own language)
- Syntax highlighting for 25+ languages in the preview, loaded lazily
- Open, drag-and-drop or paste `.md` files (up to 2 MB); download as `.md`
- Export a standalone HTML page, or copy the rendered HTML
- Autosave to `localStorage`
- Line-accurate scroll sync (toggle in the preview bar)
- Line numbers that follow soft-wrapped lines (toggle in the editor bar)
- Resizable split: drag the divider, use arrow keys on it, or double-click to reset
- Zen mode: read the preview in a centred, distraction-free modal (Esc to exit)
- Toolbar and keyboard shortcuts, smart list continuation, Tab indentation
- Light and dark themes (follows the OS by default)
- Mobile layout with Write / Preview tabs

## Security

All rendered HTML (typed, pasted or uploaded) is parsed with markdown-it first and then sanitized with DOMPurify. Sanitizing after parsing is deliberate, so nothing reaches the DOM unchecked. On top of that:

- a Content-Security-Policy forbids inline and third-party scripts;
- `<style>` and `<form>` are stripped, and element ids are prefixed (`user-content-`) to prevent DOM clobbering;
- the preview uses `contain: paint`, so documents can't overlay the app UI.

## Development

```bash
npm install
npm run dev      # http://localhost:5173/
npm test         # unit tests (Vitest + jsdom)
npm run build    # type-check + production build into dist/ (base path /markdown-previewer/)
npm run preview  # serve the production build at http://localhost:4173/markdown-previewer/
npm run icons    # regenerate PNG icons + og-image.png from public/favicon.svg
```

## Project layout

```
index.html                 SEO metadata, static content, app shell
public/                    favicon.svg (brand mark), icons, og-image, manifest, theme-init.js
src/config.ts              site URL (single source for canonical URL, sitemap, base path)
src/main.ts                UI wiring
src/lib/                   pure logic: markdown rendering, sanitizing, editor commands, files, stats
src/ui/                    DOM helpers: scroll sync, preview patching, theme, icons, toast
src/styles/brand.css       personal brand tokens
```

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/` to GitHub Pages. One-time setup: **Settings → Pages → Source: GitHub Actions**.

### SEO notes

- `robots.txt` is only read at a domain root, so a project site can't provide its own. Add this line to the `robots.txt` of the `imranpollob.github.io` repo, or submit the sitemap in Google Search Console:
  `Sitemap: https://imranpollob.github.io/markdown-previewer/sitemap.xml`
- To change the URL, edit `src/config.ts`. The base path, canonical URL, Open Graph tags and sitemap all derive from it.

## License

MIT © Imran Pollob
