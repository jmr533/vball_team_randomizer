import {
  SESSION_KEY,
  SESSION_VERSION,
  createInitialSession,
  createRoundResetSession,
  createBrowserSessionStore,
  deserializeSession,
  normalizeStoredSession,
  serializeSession
} from '../sessionPersistence';

describe('session persistence', () => {
  it('round-trips and normalizes a stored session', () => {
    const session = createInitialSession();
    session.players[0].name = 'Alex';
    session.courts = 99;
    session.courtModes = ['4v4', 'invalid'];

    const restored = deserializeSession(serializeSession(session));

    expect(restored.players[0].name).toBe('Alex');
    expect(restored.courts).toBe(4);
    expect(restored.courtModes).toEqual(['4v4', '2v2', '2v2', '2v2']);
    expect(restored.theme).toBe('system');
  });

  it('rejects corrupt and incompatible stored values', () => {
    expect(deserializeSession('{broken')).toBeNull();
    expect(deserializeSession('')).toBeNull();
    expect(normalizeStoredSession({ version: SESSION_VERSION + 1 })).toBeNull();
    expect(normalizeStoredSession(null)).toBeNull();
  });

  it('replaces an invalid or empty player list with a blank player', () => {
    const restored = normalizeStoredSession({
      version: SESSION_VERSION,
      players: [],
      courts: 1,
      courtModes: ['2v2']
    });

    expect(restored.players).toHaveLength(1);
    expect(restored.players[0].name).toBe('');
  });

  it('resets rounds while retaining roster and court configuration', () => {
    const session = createInitialSession();
    session.players[0].name = 'Sam';
    session.courts = 2;
    session.courtModes = ['2v2', '3v3', '2v2', '2v2'];
    session.teams = [{ court: 1 }];
    session.sittingOut = [{ id: 'player-2', name: 'Taylor' }];
    session.gameHistory = [{ gameNumber: 1 }];
    session.theme = 'dark';

    expect(createRoundResetSession(session)).toEqual({
      players: session.players,
      courts: 2,
      courtModes: session.courtModes,
      teams: [],
      sittingOut: [],
      gameHistory: [],
      theme: 'dark'
    });
  });

  it('restores valid themes and safely defaults invalid themes to system', () => {
    const session = createInitialSession();
    session.theme = 'dark';

    expect(deserializeSession(serializeSession(session)).theme).toBe('dark');
    expect(normalizeStoredSession({
      version: SESSION_VERSION,
      players: session.players,
      theme: 'midnight'
    }).theme).toBe('system');
  });

  it('uses localStorage through the browser adapter', async () => {
    const storage = {
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };
    const store = createBrowserSessionStore(storage);
    const session = createInitialSession();
    session.players[0].name = 'Browser player';

    await store.save(session);
    await store.clear();

    expect(storage.setItem).toHaveBeenCalledWith(SESSION_KEY, serializeSession(session));
    expect(storage.removeItem).toHaveBeenCalledWith(SESSION_KEY);
  });
});
