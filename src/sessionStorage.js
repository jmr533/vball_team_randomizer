import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { deserializeSession, serializeSession } from './session';

export const SESSION_KEY = 'volleyball-session';

const createQueuedStore = ({ read, write, remove }) => {
  let writeQueue = Promise.resolve();
  const enqueue = (operation) => {
    writeQueue = writeQueue.catch(() => undefined).then(operation);
    return writeQueue;
  };

  return {
    async load() {
      return deserializeSession(await read());
    },
    save(session) {
      return enqueue(() => write(serializeSession(session)));
    },
    clear() {
      return enqueue(remove);
    },
    flush() {
      return writeQueue;
    }
  };
};

/** Browser adapter backed by localStorage. */
export const createBrowserSessionStore = (storage = window.localStorage) => createQueuedStore({
  read: async () => storage.getItem(SESSION_KEY),
  write: async (value) => storage.setItem(SESSION_KEY, value),
  remove: async () => storage.removeItem(SESSION_KEY)
});

/** Android adapter backed by Capacitor Preferences. */
export const createAndroidSessionStore = (preferences = Preferences) => createQueuedStore({
  read: async () => (await preferences.get({ key: SESSION_KEY })).value,
  write: (value) => preferences.set({ key: SESSION_KEY, value }),
  remove: () => preferences.remove({ key: SESSION_KEY })
});

export const isNativeRuntime = () => Capacitor.isNativePlatform();

export const createPlatformSessionStore = () => (
  isNativeRuntime() ? createAndroidSessionStore() : createBrowserSessionStore()
);
