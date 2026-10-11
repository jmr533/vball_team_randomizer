import { deserializeSession, serializeSession } from './session';

export const SESSION_KEY = 'volleyball-session';

/** Session store backed by localStorage. Storage errors surface as rejected promises. */
export const createBrowserSessionStore = (storage = window.localStorage) => ({
  async load() {
    return deserializeSession(storage.getItem(SESSION_KEY));
  },
  async save(session) {
    storage.setItem(SESSION_KEY, serializeSession(session));
  },
  async clear() {
    storage.removeItem(SESSION_KEY);
  }
});
