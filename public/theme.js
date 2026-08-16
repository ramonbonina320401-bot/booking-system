// Apply the saved theme before React mounts to avoid a flash of the wrong
// theme (kept in sync with src/stores/useThemeStore.ts). Moved out of
// index.html into its own file so the deployed CSP can block inline scripts.
(function () {
  var t = null
  try {
    t = localStorage.getItem('booking-theme')
  } catch (e) {}
  // Default to light mode (white) — only use saved preference
  var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (dark) document.documentElement.classList.add('dark')
})()
