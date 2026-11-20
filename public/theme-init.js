// Applies the saved theme before first paint, so light-theme users never see a flash of the dark default.
// Kept as an external same-origin file (not inline in index.html) so a strict Content-Security-Policy with
// `script-src 'self'` — see docs/SECURITY.md — needs no hashes or 'unsafe-inline' for scripts.
(function () {
  try {
    var raw = localStorage.getItem('chainbeat.ui');
    var theme = raw ? (JSON.parse(raw).state || {}).theme : null;
    var resolved =
      theme === 'light' || theme === 'dark'
        ? theme
        : window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches && theme === 'system'
          ? 'light'
          : 'dark';
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (e) {
    /* storage unavailable: keep the default dark theme */
  }
})();
