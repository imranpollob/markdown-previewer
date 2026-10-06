/* Brand launcher: drop-in "all my tools" menu for any site using this theme.
 *
 *   <link rel="stylesheet" href="https://imranpollob.github.io/personal-brand-theme/launcher.css">
 *   <script src="https://imranpollob.github.io/personal-brand-theme/launcher.js" defer></script>
 *
 * Put <span data-brand-launcher></span> in your header to choose where the
 * button goes; otherwise a floating button appears top-left. The tool list is
 * tools.json next to this script (override with data-tools="..." on the script).
 */
(() => {
  const script = document.currentScript;
  const base = script ? new URL('.', script.src).href : '';
  const toolsUrl = script?.dataset.tools || base + 'tools.json';
  const STAR_KEY = 'launcher-starred';

  const esc = text =>
    String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const loadStars = () => {
    try {
      const v = JSON.parse(localStorage.getItem(STAR_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  };
  const saveStars = stars => {
    try { localStorage.setItem(STAR_KEY, JSON.stringify(stars)); } catch { /* session only */ }
  };

  const WAFFLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor">' +
    [5, 12, 19].flatMap(y => [5, 12, 19].map(x => `<circle cx="${x}" cy="${y}" r="1.7"/>`)).join('') + '</g></svg>';
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z" stroke-linejoin="round"/></svg>';

  // Homepage order: web tools first, then installables, each by priority.
  const byPriority = (a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity);
  const order = tools => [
    ...tools.filter(t => t.type === 'online').sort(byPriority),
    ...tools.filter(t => t.type === 'install').sort(byPriority),
  ];

  const tile = (t, starred) =>
    `<div class="bl-tile" style="--hue: ${Number(t.hue) || 170}">` +
    `<span class="bl-glyph" aria-hidden="true">${esc(t.glyph ?? '')}</span>` +
    `<a class="bl-link" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">${esc(t.title)}</a>` +
    `<button type="button" class="bl-star" data-repo="${esc(t.repo)}" aria-pressed="${starred}" ` +
    `aria-label="${starred ? 'Unstar' : 'Star'} ${esc(t.title)}" title="${starred ? 'Unstar' : 'Star'}">${STAR}</button></div>`;

  function mount(tools) {
    const list = order(tools);
    let stars = loadStars();

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'bl-toggle';
    toggle.title = toggle.ariaLabel = 'Browse all tools';
    toggle.setAttribute('aria-haspopup', 'dialog');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = WAFFLE;

    const slot = document.querySelector('[data-brand-launcher]');
    if (slot) slot.replaceWith(toggle);
    else {
      toggle.classList.add('bl-floating');
      document.body.append(toggle);
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'bl-backdrop';
    backdrop.hidden = true;
    const panel = document.createElement('div');
    panel.className = 'bl-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'All tools');
    panel.hidden = true;
    panel.innerHTML = `<p class="bl-title">All tools <span class="bl-count">${list.length}</span></p><div class="bl-grid"></div>`;
    document.body.append(backdrop, panel);
    const grid = panel.querySelector('.bl-grid');

    const render = () => {
      const set = new Set(stars);
      const sorted = [...list.filter(t => set.has(t.repo)), ...list.filter(t => !set.has(t.repo))];
      grid.innerHTML = sorted.map(t => tile(t, set.has(t.repo))).join('');
    };
    render();

    const place = () => {
      const r = toggle.getBoundingClientRect();
      const w = panel.offsetWidth;
      panel.style.top = `${r.bottom + 4}px`;
      panel.style.left = `${Math.max(20, Math.min(r.left, innerWidth - w - 20))}px`;
    };
    const isOpen = () => !panel.hidden;
    const open = () => {
      panel.hidden = backdrop.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      place();
    };
    const close = (refocus = false) => {
      if (!isOpen()) return;
      panel.hidden = backdrop.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      if (refocus) toggle.focus();
    };

    toggle.addEventListener('click', () => (isOpen() ? close() : open()));
    backdrop.addEventListener('click', () => close());
    addEventListener('resize', () => isOpen() && place());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen()) close(true);
    });
    grid.addEventListener('click', e => {
      const btn = e.target.closest('.bl-star');
      if (!btn) return;
      const repo = btn.dataset.repo;
      stars = stars.includes(repo) ? stars.filter(r => r !== repo) : [...stars, repo];
      saveStars(stars);
      grid.scrollTop = 0;
      render();
    });
  }

  const start = () =>
    fetch(toolsUrl)
      .then(r => r.json())
      .then(mount)
      .catch(() => { /* menu is optional: fail silently */ });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
