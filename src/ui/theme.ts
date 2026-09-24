import { readSetting, writeSetting } from '../lib/storage';
import { icon } from './icons';

// The initial theme is applied before first paint by public/theme-init.js.

type Theme = 'light' | 'dark';

const current = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

export function initThemeToggle(button: HTMLButtonElement): void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  const apply = (theme: Theme) => {
    document.documentElement.dataset.theme = theme;
    const next = theme === 'dark' ? 'light' : 'dark';
    button.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
    button.setAttribute('aria-label', `Switch to ${next} theme`);
    button.title = `Switch to ${next} theme`;
  };

  apply(current());

  button.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    writeSetting('theme', next);
    apply(next);
  });

  // Follow the OS setting until the user picks a theme explicitly.
  media.addEventListener('change', (event) => {
    if (!readSetting('theme')) apply(event.matches ? 'dark' : 'light');
  });
}
