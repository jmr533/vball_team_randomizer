import { createBrowserSessionStore } from './sessionStorage';

// Public entry point for the session contract.
export {
  SESSION_VERSION,
  createInitialSession,
  createRoundResetSession,
  deserializeSession,
  normalizeSession as normalizeStoredSession,
  serializeSession
} from './session';
export { SESSION_KEY, createBrowserSessionStore } from './sessionStorage';

export const sessionStore = createBrowserSessionStore();
