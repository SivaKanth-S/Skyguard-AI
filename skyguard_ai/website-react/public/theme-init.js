(function () {
  try {
    var theme = localStorage.getItem('skyguard_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch {
    /* storage unavailable — fall back to the CSS default theme */
  }
})();
