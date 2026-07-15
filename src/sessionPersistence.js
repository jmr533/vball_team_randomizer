import { Preferences } from '@capacitor/preferences';
import {
  DEFAULT_COURT_MODES,
  GAME_MODES,
  MAX_COURTS,
  createPlayer,
  normalizePlayer
} from './gameHelpers';
import { DEFAULT_THEME, normalizeTheme } from './theme';

export const SESSION_KEY = 'volleyball-session';
export const SESSION_VERSION = 1;

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const clampCourts = (value) => Math.max(1, Math.min(Number.isInteger(value) ? value : 1, MAX_COURTS));
const normalizeMode = (mode) => GAME_MODES.includes(mode) ? mode : GAME_MODES[0];
const normalizePlayers = (players) => Array.isArray(players) ? players.map(normalizePlayer) : [];

const normalizeCourtModes = (courtModes) => DEFAULT_COURT_MODES.map((defaultMode, index) => (
  normalizeMode(Array.isArray(courtModes) ? courtModes[index] : defaultMode)
));

const normalizeTeam = (team, index = 0) => ({
  court: Number.isInteger(team?.court) && team.court > 0 ? team.court : index + 1,
  gameMode: normalizeMode(team?.gameMode),
  team1: normalizePlayers(team?.team1),
  team2: normalizePlayers(team?.team2)
});

const normalizeTeams = (teams) => Array.isArray(teams)
  ? teams.filter(isRecord).map(normalizeTeam)
  : [];

const normalizeGame = (game, index) => {
  const courts = clampCourts(game.courts);
  const courtModes = normalizeCourtModes(game.courtModes).slice(0, courts);

  return {
    gameNumber: Number.isInteger(game.gameNumber) && game.gameNumber > 0 ? game.gameNumber : index + 1,
    courtModes,
    courts,
    playing: normalizePlayers(game.playing),
    sittingOut: normalizePlayers(game.sittingOut),
    teams: normalizeTeams(game.teams),
    createdAt: typeof game.createdAt === 'string' ? game.createdAt : ''
  };
};

export const createInitialSession = () => ({
  players: [createPlayer()],
  courts: 1,
  courtModes: [...DEFAULT_COURT_MODES],
  teams: [],
  sittingOut: [],
  gameHistory: [],
  theme: DEFAULT_THEME
});

export const createRoundResetSession = ({ players, courts, courtModes, theme }) => ({
  players,
  courts,
  courtModes,
  teams: [],
  sittingOut: [],
  gameHistory: [],
  theme: normalizeTheme(theme)
});

export const normalizeStoredSession = (storedSession) => {
  if (!isRecord(storedSession) || storedSession.version !== SESSION_VERSION) {
    return null;
  }

  const players = normalizePlayers(storedSession.players);

  return {
    players: players.length > 0 ? players : [createPlayer()],
    courts: clampCourts(storedSession.courts),
    courtModes: normalizeCourtModes(storedSession.courtModes),
    teams: normalizeTeams(storedSession.teams),
    sittingOut: normalizePlayers(storedSession.sittingOut),
    gameHistory: Array.isArray(storedSession.gameHistory)
      ? storedSession.gameHistory.filter(isRecord).map(normalizeGame)
      : [],
    theme: normalizeTheme(storedSession.theme)
  };
};

export const serializeSession = (session) => JSON.stringify({
  version: SESSION_VERSION,
  ...session
});

export const deserializeSession = (value) => {
  if (typeof value !== 'string' || value === '') {
    return null;
  }

  try {
    return normalizeStoredSession(JSON.parse(value));
  } catch {
    return null;
  }
};

export const createSessionStore = (preferences = Preferences) => {
  let writeQueue = Promise.resolve();

  const enqueue = (operation) => {
    writeQueue = writeQueue.catch(() => undefined).then(operation);
    return writeQueue;
  };

  return {
    async load() {
      const { value } = await preferences.get({ key: SESSION_KEY });
      return deserializeSession(value);
    },
    save(session) {
      return enqueue(() => preferences.set({
        key: SESSION_KEY,
        value: serializeSession(session)
      }));
    },
    clear() {
      return enqueue(() => preferences.remove({ key: SESSION_KEY }));
    },
    flush() {
      return writeQueue;
    }
  };
};

export const sessionStore = createSessionStore();
