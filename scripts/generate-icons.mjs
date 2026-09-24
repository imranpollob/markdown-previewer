// Renders every raster icon (and the Open Graph share image) from public/favicon.svg.
// Run with `npm run icons` after changing the logo; the outputs are committed.
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const OUT = 'public/icons';
const logo = await readFile('public/favicon.svg');

const renderLogo = (size) => sharp(logo, { density: 600 }).resize(size, size).png().toBuffer();

async function onBackground(size, background, padding) {
  const inner = Math.round(size * (1 - padding * 2));
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: await renderLogo(inner), gravity: 'center' }])
    .png();
}

await mkdir(OUT, { recursive: true });

await sharp(await renderLogo(32)).toFile(`${OUT}/favicon-32.png`);
await sharp(await renderLogo(192)).toFile(`${OUT}/icon-192.png`);
await sharp(await renderLogo(512)).toFile(`${OUT}/icon-512.png`);
await (await onBackground(180, '#ffffff', 0.14)).toFile(`${OUT}/apple-touch-icon.png`);
// Maskable icons are cropped to a circle; keep the mark inside the 80% safe zone.
await (await onBackground(512, '#ecfdfb', 0.2)).toFile(`${OUT}/icon-maskable-512.png`);

const og = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ecfdfb"/>
      <stop offset="1" stop-color="#ccfbf1"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1130" cy="40" r="260" fill="#99f6e4" opacity="0.35"/>
  <circle cx="1180" cy="620" r="180" fill="#5eead4" opacity="0.18"/>
  <rect x="72" y="72" width="8" height="486" rx="4" fill="#0d9488"/>
  <text x="400" y="250" font-family="Georgia, 'Times New Roman', serif" font-size="84" font-weight="700" fill="#0f172a">Markdown</text>
  <text x="400" y="345" font-family="Georgia, 'Times New Roman', serif" font-size="84" font-weight="700" fill="#0f172a">Previewer</text>
  <text x="402" y="415" font-family="'Segoe UI', Arial, sans-serif" font-size="32" fill="#334155">Live GitHub Flavored Markdown preview.</text>
  <text x="402" y="458" font-family="'Segoe UI', Arial, sans-serif" font-size="32" fill="#334155">Free, private, right in your browser.</text>
  <text x="402" y="540" font-family="'Segoe UI', Arial, sans-serif" font-size="26" font-weight="600" fill="#0f766e">imranpollob.github.io/markdown-previewer</text>
</svg>`;

await sharp(Buffer.from(og))
  .composite([{ input: await renderLogo(260), left: 110, top: 185 }])
  .png()
  .toFile('public/og-image.png');

console.log('Icons written to public/icons and public/og-image.png');
