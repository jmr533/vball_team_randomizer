import { createPlatformSessionStore } from './sessionStorage';

// Backward-compatible public entry point for the shared session contract.
export {
  SESSION_VERSION,
  createInitialSession,
  createRoundResetSession,
  deserializeSession,
  normalizeSession as normalizeStoredSession,
  serializeSession
} from './session';
export {
  SESSION_KEY,
  createAndroidSessionStore,
  createBrowserSessionStore,
  createPlatformSessionStore,
  isNativeRuntime
} from './sessionStorage';

export const sessionStore = createPlatformSessionStore();
