export const THEME_OPTIONS = ['light', 'dark', 'system'];
export const DEFAULT_THEME = 'system';

export const normalizeTheme = (theme) => THEME_OPTIONS.includes(theme) ? theme : DEFAULT_THEME;

export const getSystemTheme = (matchMedia = window.matchMedia) => (
  matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
);

export const resolveTheme = (theme, matchMedia = window.matchMedia) => (
  normalizeTheme(theme) === DEFAULT_THEME ? getSystemTheme(matchMedia) : normalizeTheme(theme)
);

export const applyTheme = (theme, documentElement = document.documentElement) => {
  documentElement.dataset.theme = theme;
  documentElement.style.colorScheme = theme;
};

export const subscribeToSystemTheme = (onChange, matchMedia = window.matchMedia) => {
  const query = matchMedia('(prefers-color-scheme: dark)');
  const listener = () => onChange(getSystemTheme(matchMedia));
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
};
