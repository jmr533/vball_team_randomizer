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
      id: typeof player.id === 'string' && player.id ? player.id : createId('player'),
      name: typeof player.name === 'string' ? player.name : '',
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

const canPlayerPlaySelectedModes = (player, modes) => {
  return modes.some((mode) => isPlayerEligibleForMode(player, mode));
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
    const gameModes = game.courtModes || [];

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

const shuffleArray = (array, random) => {
  const shuffled = [...array];

  for (let index = shuffled.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
};

const canFillCourtRequirements = (players, courtRequirements) => {
  const requiredPlayers = courtRequirements.reduce(
    (total, { playersPerCourt }) => total + playersPerCourt,
    0
  );

  if (players.length < requiredPlayers) {
    return false;
  }

  const playerOffset = 1;
  const courtOffset = playerOffset + players.length;
  const sink = courtOffset + courtRequirements.length;
  const graph = Array.from({ length: sink + 1 }, () => []);
  const addEdge = (from, to, capacity) => {
    graph[from].push({ to, capacity, reverse: graph[to].length });
    graph[to].push({ to: from, capacity: 0, reverse: graph[from].length - 1 });
  };

  players.forEach((player, playerIndex) => {
    const playerNode = playerOffset + playerIndex;
    addEdge(0, playerNode, 1);

    courtRequirements.forEach(({ mode }, courtIndex) => {
      if (isPlayerEligibleForMode(player, mode)) {
        addEdge(playerNode, courtOffset + courtIndex, 1);
      }
    });
  });

  courtRequirements.forEach(({ playersPerCourt }, courtIndex) => {
    addEdge(courtOffset + courtIndex, sink, playersPerCourt);
  });

  let flow = 0;

  while (flow < requiredPlayers) {
    const parent = Array(sink + 1).fill(null);
    const queue = [0];
    parent[0] = { node: -1, edge: -1 };

    for (let queueIndex = 0; queueIndex < queue.length && !parent[sink]; queueIndex++) {
      const node = queue[queueIndex];

      graph[node].forEach((edge, edgeIndex) => {
        if (edge.capacity > 0 && !parent[edge.to]) {
          parent[edge.to] = { node, edge: edgeIndex };
          queue.push(edge.to);
        }
      });
    }

    if (!parent[sink]) {
      return false;
    }

    for (let node = sink; node !== 0; node = parent[node].node) {
      const { node: previousNode, edge: edgeIndex } = parent[node];
      const edge = graph[previousNode][edgeIndex];
      edge.capacity -= 1;
      graph[node][edge.reverse].capacity += 1;
    }

    flow += 1;
  }

  return true;
};

const allocateFairRound = ({
  players,
  courtModes,
  gameHistory,
  random = Math.random
}) => {
  const lastGame = gameHistory[gameHistory.length - 1];
  const previouslyEligibleWaitingIds = new Set(
    (lastGame?.sittingOut || [])
      .filter((player) => canPlayerPlaySelectedModes(player, lastGame?.courtModes || []))
      .map((player) => player.id)
  );
  const priorityPlayers = players.filter((player) => previouslyEligibleWaitingIds.has(player.id));
  const otherPlayers = players.filter((player) => !previouslyEligibleWaitingIds.has(player.id));
  const orderedPlayers = [
    ...shuffleArray(priorityPlayers, random),
    ...shuffleArray(otherPlayers, random)
  ];
  const playerPriorityIndex = new Map(
    orderedPlayers.map((player, index) => [player.id, index])
  );
  const playerPriorityTier = new Map([
    ...priorityPlayers.map((player) => [player.id, 0]),
    ...otherPlayers.map((player) => [player.id, 1])
  ]);
  const playerRoundStats = getPlayerRoundStats(gameHistory);
  const comparePlayers = (playerA, playerB) => {
    const tierDifference = playerPriorityTier.get(playerA.id) - playerPriorityTier.get(playerB.id);

    if (tierDifference !== 0) {
      return tierDifference;
    }

    const playerAStats = playerRoundStats.get(playerA.id) || { played: 0, satOut: 0, lastSatOutGame: 0 };
    const playerBStats = playerRoundStats.get(playerB.id) || { played: 0, satOut: 0, lastSatOutGame: 0 };
    const sitOutDifference = playerBStats.satOut - playerAStats.satOut;

    if (sitOutDifference !== 0) {
      return sitOutDifference;
    }

    const playedDifference = playerAStats.played - playerBStats.played;

    if (playedDifference !== 0) {
      return playedDifference;
    }

    const lastSatOutDifference = playerAStats.lastSatOutGame - playerBStats.lastSatOutGame;

    if (lastSatOutDifference !== 0) {
      return lastSatOutDifference;
    }

    const flexibilityDifference = normalizePreferredModes(playerA.preferredModes).length -
      normalizePreferredModes(playerB.preferredModes).length;

    if (flexibilityDifference !== 0) {
      return flexibilityDifference;
    }

    return playerPriorityIndex.get(playerA.id) - playerPriorityIndex.get(playerB.id);
  };
  const courtConfigs = courtModes.map((mode, index) => ({
    court: index + 1,
    mode,
    playersPerCourt: getPlayersPerCourt(mode),
    eligibleCount: players.filter((player) => isPlayerEligibleForMode(player, mode)).length
  })).sort((courtA, courtB) => {
    if (courtA.eligibleCount !== courtB.eligibleCount) {
      return courtA.eligibleCount - courtB.eligibleCount;
    }

    return courtB.playersPerCourt - courtA.playersPerCourt;
  });
  const assignments = [];
  let remainingPlayers = [...orderedPlayers];

  for (let courtIndex = 0; courtIndex < courtConfigs.length; courtIndex++) {
    const courtConfig = courtConfigs[courtIndex];
    const courtPlayers = [];
    const candidates = remainingPlayers
      .filter((player) => isPlayerEligibleForMode(player, courtConfig.mode))
      .sort(comparePlayers);

    for (const candidate of candidates) {
      if (courtPlayers.length === courtConfig.playersPerCourt) {
        break;
      }

      const playersAfterSelection = remainingPlayers.filter(({ id }) => id !== candidate.id);
      const remainingRequirements = [
        {
          ...courtConfig,
          playersPerCourt: courtConfig.playersPerCourt - courtPlayers.length - 1
        },
        ...courtConfigs.slice(courtIndex + 1)
      ].filter(({ playersPerCourt }) => playersPerCourt > 0);

      if (!canFillCourtRequirements(playersAfterSelection, remainingRequirements)) {
        continue;
      }

      courtPlayers.push(candidate);
      remainingPlayers = playersAfterSelection;
    }

    if (courtPlayers.length !== courtConfig.playersPerCourt) {
      return null;
    }

    assignments.push({
      court: courtConfig.court,
      mode: courtConfig.mode,
      players: courtPlayers
    });
  }

  return assignments.sort((courtA, courtB) => courtA.court - courtB.court);
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
  normalizePlayer,
  createPlayer,
  isPlayerEligibleForMode,
  canPlayerPlaySelectedModes,
  hasAnyModePreference,
  getPreferenceLabel,
  getTeamGroupStats,
  getPlayerRoundStats,
  allocateFairRound
};
