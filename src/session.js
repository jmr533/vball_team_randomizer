import {
  DEFAULT_COURT_MODES,
  GAME_MODES,
  MAX_COURTS,
  createPlayer,
  normalizePlayer
} from './gameHelpers';
import { DEFAULT_THEME, normalizeTheme } from './theme';

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
const normalizeTeams = (teams) => Array.isArray(teams) ? teams.filter(isRecord).map(normalizeTeam) : [];

const normalizeGame = (game, index) => {
  const courts = clampCourts(game.courts);
  return {
    gameNumber: Number.isInteger(game.gameNumber) && game.gameNumber > 0 ? game.gameNumber : index + 1,
    courtModes: normalizeCourtModes(game.courtModes).slice(0, courts),
    courts,
    playing: normalizePlayers(game.playing),
    sittingOut: normalizePlayers(game.sittingOut),
    teams: normalizeTeams(game.teams),
    createdAt: typeof game.createdAt === 'string' ? game.createdAt : ''
  };
};

/** The versioned application session persisted between visits. */
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

export const normalizeSession = (storedSession) => {
  if (!isRecord(storedSession) || storedSession.version !== SESSION_VERSION) return null;
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

export const serializeSession = (session) => JSON.stringify({ version: SESSION_VERSION, ...session });

export const deserializeSession = (value) => {
  if (typeof value !== 'string' || value === '') return null;
  try {
    return normalizeSession(JSON.parse(value));
  } catch {
    return null;
  }
};
