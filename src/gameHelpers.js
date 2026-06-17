const GAME_MODES = ['2v2', '3v3', '4v4'];
const MAX_COURTS = 4;
const DEFAULT_COURT_MODES = Array(MAX_COURTS).fill('2v2');
const ALL_MODE_PREFERENCE = 'Any';

const createId = (prefix) => {
  if (window.crypto && window.crypto.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getPlayersPerCourt = (mode) => {
  return mode === '2v2' ? 4 : mode === '3v3' ? 6 : 8;
};

const getGameModeDescription = (mode) => {
  const playersPerCourt = getPlayersPerCourt(mode);
  const teamSize = playersPerCourt / 2;
  return `Teams of ${teamSize} players each (${playersPerCourt} per court)`;
};

const getPlayerName = (player) => player.name.trim();

const normalizePreferredModes = (preferredModes) => {
  if (!Array.isArray(preferredModes)) {
    return [...GAME_MODES];
  }

  const normalizedModes = GAME_MODES.filter((mode) => preferredModes.includes(mode));
  return normalizedModes.length > 0 ? normalizedModes : [...GAME_MODES];
};

const normalizePlayer = (player) => {
  if (player && typeof player === 'object') {
    return {
      id: player.id || createId('player'),
      name: player.name || '',
      preferredModes: normalizePreferredModes(player.preferredModes)
    };
  }

  return {
    id: createId('player'),
    name: player || '',
    preferredModes: [...GAME_MODES]
  };
};

const createPlayer = (name = '') => normalizePlayer({ id: createId('player'), name });

const isPlayerEligibleForMode = (player, mode) => {
  return normalizePreferredModes(player.preferredModes).includes(mode);
};

const hasAnyModePreference = (player) => {
  return normalizePreferredModes(player.preferredModes).length === GAME_MODES.length;
};

const getPreferenceLabel = (player) => {
  const preferredModes = normalizePreferredModes(player.preferredModes);
  return preferredModes.length === GAME_MODES.length ? ALL_MODE_PREFERENCE : preferredModes.join(', ');
};

const getGameTeamGroups = (game) => {
  return (game.teams || []).flatMap((court) => [
    {
      court: court.court,
      team: 'A',
      players: court.team1 || []
    },
    {
      court: court.court,
      team: 'B',
      players: court.team2 || []
    }
  ]).filter((teamGroup) => teamGroup.players.length > 0);
};

const getTeamGroupKey = (players) => {
  return players.map((player) => player.id).sort().join(':');
};

const getTeamGroupStats = (games) => {
  const statsByGroup = new Map();

  games.forEach((game) => {
    getGameTeamGroups(game).forEach(({ players }) => {
      const key = getTeamGroupKey(players);
      const existingStat = statsByGroup.get(key);

      if (existingStat) {
        existingStat.count += 1;
        existingStat.games.push(game.gameNumber);
        return;
      }

      statsByGroup.set(key, {
        key,
        players,
        count: 1,
        games: [game.gameNumber]
      });
    });
  });

  return Array.from(statsByGroup.values()).sort((statA, statB) => {
    if (statB.count !== statA.count) {
      return statB.count - statA.count;
    }

    return statA.players.map(getPlayerName).join(' + ').localeCompare(
      statB.players.map(getPlayerName).join(' + ')
    );
  });
};

const getPlayerRoundStats = (games) => {
  const statsByPlayerId = new Map();

  games.forEach((game) => {
    const gameModes = game.courtModes || (game.teams || []).map((court) => court.gameMode || game.gameMode || '2v2');

    (game.playing || []).forEach((player) => {
      const stats = statsByPlayerId.get(player.id) || { played: 0, satOut: 0, lastSatOutGame: 0 };
      stats.played += 1;
      statsByPlayerId.set(player.id, stats);
    });

    (game.sittingOut || []).forEach((player) => {
      const wasEligibleForGame = gameModes.some((mode) => isPlayerEligibleForMode(player, mode));

      if (!wasEligibleForGame) {
        return;
      }

      const stats = statsByPlayerId.get(player.id) || { played: 0, satOut: 0, lastSatOutGame: 0 };
      stats.satOut += 1;
      stats.lastSatOutGame = Math.max(stats.lastSatOutGame, game.gameNumber || 0);
      statsByPlayerId.set(player.id, stats);
    });
  });

  return statsByPlayerId;
};

export {
  GAME_MODES,
  MAX_COURTS,
  DEFAULT_COURT_MODES,
  ALL_MODE_PREFERENCE,
  getPlayersPerCourt,
  getGameModeDescription,
  getPlayerName,
  normalizePreferredModes,
  createPlayer,
  isPlayerEligibleForMode,
  hasAnyModePreference,
  getPreferenceLabel,
  getTeamGroupStats,
  getPlayerRoundStats
};
