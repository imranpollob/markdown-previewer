import type { HLJSApi } from 'highlight.js';

let hljs: HLJSApi | null = null;
let loading: Promise<HLJSApi> | null = null;
const readyListeners = new Set<() => void>();

/** Starts loading the highlighter chunk; resolves once it is ready. */
export function loadHighlighter(): Promise<HLJSApi> {
  loading ??= import('./hljs-bundle')
    .then(({ default: api }) => {
      hljs = api;
      readyListeners.forEach((listener) => listener());
      return api;
    })
    .catch((error: unknown) => {
      loading = null; // allow a retry on the next render (e.g. after a network blip)
      throw error;
    });
  return loading;
}

/** Called once the highlighter has loaded, so the preview can re-render. */
export function onHighlighterReady(listener: () => void): void {
  readyListeners.add(listener);
}

/**
 * markdown-it `highlight` callback. Returns highlighted HTML, or '' to let
 * markdown-it escape the code itself (unknown language, or not loaded yet).
 */
export function highlightCode(code: string, lang: string): string {
  const language = lang.trim().toLowerCase();
  if (!language) return '';
  if (!hljs) {
    loadHighlighter().catch(() => {});
    return '';
  }
  if (!hljs.getLanguage(language)) return '';
  try {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  } catch {
    return '';
  }
}
