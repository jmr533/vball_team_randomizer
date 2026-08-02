import { applyTheme, getSystemTheme, normalizeTheme, resolveTheme, subscribeToSystemTheme } from '../theme';

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

  it('reacts to OS changes while System is selected', () => {
    let listener;
    const query = {
      addEventListener: jest.fn((event, callback) => { listener = callback; }),
      removeEventListener: jest.fn()
    };
    const matchMedia = jest.fn().mockReturnValue(query);
    const onChange = jest.fn();

    const unsubscribe = subscribeToSystemTheme(onChange, matchMedia);
    listener();
    unsubscribe();

    expect(onChange).toHaveBeenCalledWith('light');
    expect(query.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
