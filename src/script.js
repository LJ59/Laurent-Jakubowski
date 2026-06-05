(function () {
  const STORAGE_KEY = 'cv-theme';
  const root = document.documentElement;
  const toggle = document.querySelector('[data-theme-toggle]');

  function preferredTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    if (toggle) toggle.textContent = theme === 'dark' ? '☀' : '☾';
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  applyTheme(saved || preferredTheme());

  if (toggle) {
    toggle.addEventListener('click', function () {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    });
  }
})();
