// Runs before first paint to avoid a light/dark flash. Kept as an external file
// (not inline) so the Content-Security-Policy can forbid inline scripts.
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem('mdp:theme');
  } catch (e) {}
  var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
