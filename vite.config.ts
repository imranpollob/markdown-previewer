import { defineConfig, type Plugin } from 'vitest/config';
import { AUTHOR, REPO_URL, SITE_URL } from './src/config.ts';

/**
 * Fills `__SITE_URL__`-style placeholders in index.html and emits sitemap.xml,
 * so the canonical URL lives in exactly one place (src/config.ts).
 */
function seo(): Plugin {
  const placeholders: Record<string, string> = {
    __SITE_URL__: SITE_URL,
    __AUTHOR_NAME__: AUTHOR.name,
    __AUTHOR_URL__: AUTHOR.url,
    __REPO_URL__: REPO_URL,
  };

  return {
    name: 'seo',
    transformIndexHtml(html) {
      return Object.entries(placeholders).reduce(
        (out, [key, value]) => out.replaceAll(key, value),
        html,
      );
    },
    generateBundle() {
      const lastmod = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
      });
    },
  };
}

export default defineConfig({
  base: new URL(SITE_URL).pathname,
  plugins: [seo()],
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
  },
});
