import { deserializeSession, serializeSession } from './session';

export const SESSION_KEY = 'volleyball-session';

/** Session store backed by localStorage. Storage errors throw synchronously. */
export const createBrowserSessionStore = (storage = window.localStorage) => ({
  load: () => deserializeSession(storage.getItem(SESSION_KEY)),
  save: (session) => storage.setItem(SESSION_KEY, serializeSession(session)),
  clear: () => storage.removeItem(SESSION_KEY)
});

export const sessionStore = createBrowserSessionStore();
