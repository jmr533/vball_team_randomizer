import {
  SESSION_KEY,
  SESSION_VERSION,
  createInitialSession,
  createRoundResetSession,
  createSessionStore,
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

    expect(createRoundResetSession(session)).toEqual({
      players: session.players,
      courts: 2,
      courtModes: session.courtModes,
      teams: [],
      sittingOut: [],
      gameHistory: []
    });
  });

  it('loads the saved value through the Preferences interface', async () => {
    const session = createInitialSession();
    session.players[0].name = 'Jordan';
    const preferences = {
      get: jest.fn().mockResolvedValue({ value: serializeSession(session) }),
      set: jest.fn(),
      remove: jest.fn()
    };

    const restored = await createSessionStore(preferences).load();

    expect(preferences.get).toHaveBeenCalledWith({ key: SESSION_KEY });
    expect(restored.players[0].name).toBe('Jordan');
  });

  it('serializes writes so older saves cannot finish after newer saves', async () => {
    let releaseFirstWrite;
    const events = [];
    const preferences = {
      get: jest.fn(),
      remove: jest.fn(),
      set: jest.fn(({ value }) => {
        const playerName = JSON.parse(value).players[0].name;
        events.push(`start-${playerName}`);

        if (playerName === 'First') {
          return new Promise((resolve) => {
            releaseFirstWrite = () => {
              events.push('end-First');
              resolve();
            };
          });
        }

        events.push(`end-${playerName}`);
        return Promise.resolve();
      })
    };
    const store = createSessionStore(preferences);
    const firstSession = createInitialSession();
    firstSession.players[0].name = 'First';
    const secondSession = createInitialSession();
    secondSession.players[0].name = 'Second';

    const firstSave = store.save(firstSession);
    const secondSave = store.save(secondSession);
    await Promise.resolve();
    await Promise.resolve();

    expect(events).toEqual(['start-First']);
    releaseFirstWrite();
    await Promise.all([firstSave, secondSave]);

    expect(events).toEqual(['start-First', 'end-First', 'start-Second', 'end-Second']);
  });

  it('queues clearing after pending saves', async () => {
    const events = [];
    const preferences = {
      get: jest.fn(),
      set: jest.fn(async () => events.push('save')),
      remove: jest.fn(async () => events.push('clear'))
    };
    const store = createSessionStore(preferences);

    await Promise.all([store.save(createInitialSession()), store.clear()]);

    expect(events).toEqual(['save', 'clear']);
  });
});
