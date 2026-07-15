import { applyTheme, getSystemTheme, normalizeTheme, resolveTheme } from '../theme';

describe('theme helpers', () => {
  const matchMedia = (matches) => jest.fn().mockReturnValue({ matches });

  it('normalizes supported themes', () => {
    expect(normalizeTheme('light')).toBe('light');
    expect(normalizeTheme('dark')).toBe('dark');
    expect(normalizeTheme('system')).toBe('system');
    expect(normalizeTheme('unknown')).toBe('system');
  });

  it('resolves the system preference', () => {
    expect(getSystemTheme(matchMedia(true))).toBe('dark');
    expect(getSystemTheme(matchMedia(false))).toBe('light');
    expect(resolveTheme('system', matchMedia(true))).toBe('dark');
    expect(resolveTheme('light', matchMedia(true))).toBe('light');
  });

  it('applies the resolved theme to the document root', () => {
    const documentElement = { dataset: {}, style: {} };

    applyTheme('dark', documentElement);

    expect(documentElement.dataset.theme).toBe('dark');
    expect(documentElement.style.colorScheme).toBe('dark');
  });
});
