import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Shuffle, Users, Plus, Minus, Trash2, RotateCcw } from 'lucide-react';
import { ToastContainer } from './Toast';
import { useToast } from './useToast';
import { usePersistence } from './hooks/usePersistence';
import { saveGame as persistSaveGame, deleteGames as persistDeleteGames } from './services/persistenceService';
import {
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
  getCourtModesFromGame,
  getTeamGroupStats,
  getPlayerRoundStats,
  serializeGame,
  deserializeGame,
  getSessionId
} from './gameHelpers';

/**
 * Beach Volleyball Team Randomizer
 * 
 * A fair, random team assignment system that ensures:
 * 1. Players who sat out last game get priority to play next game
 * 2. Mode preferences are respected as hard rules (can't force someone into incompatible mode)
 * 3. Overall playing time is balanced across sessions
 * 4. Teammate pairings are distributed to avoid same pairs every game
 * 
 * State Management:
 * - players: Array of Player objects with id, name, and preferredModes
 * - courts: Number of simultaneous courts (1-4)
 * - courtModes: Game mode for each court (2v2, 3v3, 4v4)
 * - teams: Current game's teams organized by court
 * - sittingOut: Players not playing in current game
 * - gameHistory: All previous games with teams and stats
 * - persistenceStatus: Database sync status (idle, saving, saved, unavailable)
 * 
 * Fairness Algorithm (generateTeams):
 * Priority Tiers for player selection:
 * 1. Players in waitingQueue (sat out last game) - shuffled randomly within tier
 * 2. Players who sat out before that - prioritized by times sat out
 * 3. Everyone else - sorted by: plays count (fewest first) > last sat out game (oldest first) > flexibility (least flexible first)
 * 
 * For each court:
 * - Select eligible players (respecting mode preferences)
 * - Shuffle their order before splitting into teams
 * - This ensures mode constraints don't create predictable team patterns
 */

export default function VolleyballTeamRandomizer() {
  const [players, setPlayers] = useState([createPlayer()]);
  const [courts, setCourts] = useState(1);
  const [courtModes, setCourtModes] = useState(DEFAULT_COURT_MODES);
  const [teams, setTeams] = useState([]);
  const [sittingOut, setSittingOut] = useState([]);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [persistenceStatus, setPersistenceStatus] = useState('idle');
  const inputRefs = useRef([]);
  const [shouldFocusLast, setShouldFocusLast] = useState(false);
  const { toasts, dismiss, success, error, info } = useToast();
  const { status: persistenceApiStatus, load: loadGamesFromDb } = usePersistence();

  const validPlayers = useMemo(
    () => players.filter((player) => getPlayerName(player) !== ''),
    [players]
  );
  const totalPlayers = validPlayers.length;
  const activeCourtModes = courtModes.slice(0, courts);
  const totalSpotsRequired = activeCourtModes.reduce(
    (totalSpots, mode) => totalSpots + getPlayersPerCourt(mode),
    0
  );
  const selectedModeCounts = activeCourtModes.reduce((counts, mode) => ({
    ...counts,
    [mode]: (counts[mode] || 0) + getPlayersPerCourt(mode)
  }), {});
  const shortageMessages = GAME_MODES.reduce((messages, mode) => {
    const requiredPlayers = selectedModeCounts[mode] || 0;

    if (requiredPlayers === 0) {
      return messages;
    }

    const eligiblePlayers = validPlayers.filter((player) => isPlayerEligibleForMode(player, mode)).length;
    const shortage = requiredPlayers - eligiblePlayers;

    if (shortage <= 0) {
      return messages;
    }

    return [
      ...messages,
      `Need ${shortage} more ${mode}-eligible ${shortage === 1 ? 'player' : 'players'}`
    ];
  }, []);
  const shortageMessage = shortageMessages.length > 0 ? `${shortageMessages.join(' and ')}.` : '';
  const canGenerateTeams = totalPlayers >= totalSpotsRequired && shortageMessages.length === 0;

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let isMounted = true;

    const loadSavedGames = async () => {
      try {
        const response = await fetch(`/api/games?sessionId=${encodeURIComponent(sessionId)}`);

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const savedGames = Array.isArray(data.games) ? data.games.map(deserializeGame) : [];

        if (!isMounted || savedGames.length === 0) {
          return;
        }

        const latestGame = savedGames[savedGames.length - 1];
        setGameHistory(savedGames);
        setTeams(latestGame.teams || []);
        setSittingOut(latestGame.sittingOut || []);
        setWaitingQueue(latestGame.sittingOut || []);
        setCourts(Math.max(1, Math.min(latestGame.courts || 1, MAX_COURTS)));
        setCourtModes(getCourtModesFromGame(latestGame));

        if (latestGame.playersSnapshot && latestGame.playersSnapshot.length > 0) {
          setPlayers(latestGame.playersSnapshot);
        }

        setPersistenceStatus('loaded');
        if (isMounted) {
          info('Game history loaded from previous session');
        }
      } catch (error) {
        setPersistenceStatus('unavailable');
      }
    };

    loadSavedGames();

    return () => {
      isMounted = false;
    };
  }, [sessionId, info]);

  const addPlayer = () => {
    setPlayers((currentPlayers) => [...currentPlayers, createPlayer()]);
    setShouldFocusLast(true);
  };

  const removePlayer = (index) => {
    setPlayers((currentPlayers) => currentPlayers.filter((_, i) => i !== index));
  };

  const updatePlayer = (index, name) => {
    setPlayers((currentPlayers) => {
      const newPlayers = [...currentPlayers];
      newPlayers[index] = { ...newPlayers[index], name };
      return newPlayers;
    });
  };

  const updatePlayerPreferredModes = (index, preference) => {
    if (teams.length > 0) {
      clearCurrentTeams();
    }

    setPlayers((currentPlayers) => currentPlayers.map((player, playerIndex) => {
      if (playerIndex !== index) {
        return player;
      }

      const currentPreferredModes = normalizePreferredModes(player.preferredModes);

      if (preference === ALL_MODE_PREFERENCE) {
        return {
          ...player,
          preferredModes: [...GAME_MODES]
        };
      }

      const nextPreferredModes = currentPreferredModes.includes(preference)
        ? currentPreferredModes.filter((mode) => mode !== preference)
        : [...currentPreferredModes, preference];

      return {
        ...player,
        preferredModes: normalizePreferredModes(nextPreferredModes)
      };
    }));
  };

  const handlePlayerKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      if (index === players.length - 1 && e.target.value.trim() !== '') {
        addPlayer();
      }
    }
  };

  useEffect(() => {
    if (shouldFocusLast && inputRefs.current[players.length - 1]) {
      inputRefs.current[players.length - 1].focus();
      setShouldFocusLast(false);
    }
  }, [players.length, shouldFocusLast]);

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  /**
   * Save a game to database using persistence service
   * Handles errors gracefully - game still works locally even if database is down
   */
  const saveGame = async (game) => {
    if (!sessionId) {
      return;
    }

    const result = await persistSaveGame(sessionId, serializeGame(game));
    setPersistenceStatus(result.persistence);

    if (!result.success) {
      console.error('Failed to save game');
    }
  };

  const clearCurrentTeams = () => {
    setTeams([]);
  };

  const handleCourtModeChange = (courtIndex, newMode) => {
    if (teams.length > 0) {
      clearCurrentTeams();
    }

    setCourtModes((currentModes) => (
      currentModes.map((mode, index) => (index === courtIndex ? newMode : mode))
    ));
  };

  const updateCourts = (newCourtCount) => {
    const clampedCourtCount = Math.max(1, Math.min(newCourtCount, MAX_COURTS));

    if (clampedCourtCount !== courts && teams.length > 0) {
      clearCurrentTeams();
    }

    setCourts(clampedCourtCount);
  };

  const generateTeams = () => {
    if (shortageMessage) {
      error(shortageMessage);
      return;
    }

    if (!canGenerateTeams) {
      error(`Need at least ${totalSpotsRequired} players for the selected courts.`);
      return;
    }

    const activeCourts = Math.max(1, Math.min(courts, MAX_COURTS));
    const activeModes = courtModes.slice(0, activeCourts);
    const totalSpotsAvailable = activeModes.reduce(
      (totalSpots, mode) => totalSpots + getPlayersPerCourt(mode),
      0
    );
    const lastGameSitting = gameHistory.length > 0 ? gameHistory[gameHistory.length - 1].sittingOut : [];
    const validPlayersById = new Map(validPlayers.map((player) => [player.id, player]));
    const waitingPlayerIds = new Set(waitingQueue.map((player) => player.id));
    const lastSittingIds = new Set(lastGameSitting.map((player) => player.id));
    const priorityPlayers = Array.from(waitingPlayerIds)
      .map((playerId) => validPlayersById.get(playerId))
      .filter(Boolean);
    const secondPriorityPlayers = Array.from(lastSittingIds)
      .filter((playerId) => !waitingPlayerIds.has(playerId))
      .map((playerId) => validPlayersById.get(playerId))
      .filter(Boolean);
    const otherPlayers = validPlayers.filter(
      (player) => !waitingPlayerIds.has(player.id) && !lastSittingIds.has(player.id)
    );
    const allPlayersOrdered = [
      ...shuffleArray(priorityPlayers),
      ...shuffleArray(secondPriorityPlayers),
      ...shuffleArray(otherPlayers)
    ];

    const remainingPlayers = [...allPlayersOrdered];
    const playingPlayers = [];
    const newTeams = [];
    const playerRoundStats = getPlayerRoundStats(gameHistory);
    const playerPriorityIndex = new Map(
      allPlayersOrdered.map((player, index) => [player.id, index])
    );
    const playerPriorityTier = new Map([
      ...priorityPlayers.map((player) => [player.id, 0]),
      ...secondPriorityPlayers.map((player) => [player.id, 1]),
      ...otherPlayers.map((player) => [player.id, 2])
    ]);
    const courtConfigs = activeModes.map((mode, index) => ({
      court: index + 1,
      mode,
      playersPerCourt: getPlayersPerCourt(mode),
      eligibleCount: validPlayers.filter((player) => isPlayerEligibleForMode(player, mode)).length
    })).sort((courtA, courtB) => {
      if (courtA.eligibleCount !== courtB.eligibleCount) {
        return courtA.eligibleCount - courtB.eligibleCount;
      }

      return courtB.playersPerCourt - courtA.playersPerCourt;
    });

    const takeEligiblePlayers = (mode, count) => {
      const selectedPlayers = remainingPlayers
        .filter((player) => isPlayerEligibleForMode(player, mode))
        .sort((playerA, playerB) => {
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

          const lastSatOutDifference = playerBStats.lastSatOutGame - playerAStats.lastSatOutGame;

          if (lastSatOutDifference !== 0) {
            return lastSatOutDifference;
          }

          const flexibilityDifference = normalizePreferredModes(playerA.preferredModes).length -
            normalizePreferredModes(playerB.preferredModes).length;

          if (flexibilityDifference !== 0) {
            return flexibilityDifference;
          }

          return playerPriorityIndex.get(playerA.id) - playerPriorityIndex.get(playerB.id);
        })
        .slice(0, count);
      const selectedPlayerIds = new Set(selectedPlayers.map((player) => player.id));

      for (let index = remainingPlayers.length - 1; index >= 0; index--) {
        if (selectedPlayerIds.has(remainingPlayers[index].id)) {
          remainingPlayers.splice(index, 1);
        }
      }

      return shuffleArray(selectedPlayers);
    };

    courtConfigs.forEach(({ court, mode, playersPerCourt }) => {
      const courtPlayers = takeEligiblePlayers(mode, playersPerCourt);

      if (courtPlayers.length === playersPerCourt) {
        const shuffledCourtPlayers = shuffleArray(courtPlayers);
        const teamSize = playersPerCourt / 2;
        playingPlayers.push(...courtPlayers);
        newTeams.push({
          court,
          gameMode: mode,
          team1: shuffledCourtPlayers.slice(0, teamSize),
          team2: shuffledCourtPlayers.slice(teamSize)
        });
      }
    });

    newTeams.sort((courtA, courtB) => courtA.court - courtB.court);

    if (playingPlayers.length !== totalSpotsAvailable || newTeams.length !== activeCourts) {
      error('Unable to fill courts. Check player preferences and try again.');
      return;
    }

    const playingPlayerIds = new Set(playingPlayers.map((player) => player.id));
    const newSittingOut = allPlayersOrdered.filter((player) => !playingPlayerIds.has(player.id));

    const newGame = {
      gameNumber: gameHistory.length + 1,
      gameMode: activeModes[0],
      courtModes: activeModes,
      courts: activeCourts,
      playing: playingPlayers,
      sittingOut: newSittingOut,
      teams: newTeams,
      playersSnapshot: validPlayers,
      createdAt: new Date().toISOString()
    };

    setCourts(activeCourts);
    setTeams(newTeams);
    setSittingOut(newSittingOut);
    setWaitingQueue(newSittingOut);
    setGameHistory((previousGames) => [...previousGames, newGame]);
    success(`Game ${newGame.gameNumber} generated successfully!`);
    saveGame(newGame);
  };

  /**
   * Reset all games and clear database using persistence service
   * Clears both local state and database
   */
  const reset = async () => {
    setTeams([]);
    setSittingOut([]);
    setWaitingQueue([]);
    setGameHistory([]);
    success('All games reset successfully!');

    if (!sessionId) {
      return;
    }

    const result = await persistDeleteGames(sessionId);
    setPersistenceStatus(result.persistence);
  };

  const renderNames = (playerList) => playerList.map(getPlayerName).join(', ');
  const renderTeamGroup = (players) => players.map(getPlayerName).join(' + ');
  const teamGroupStats = useMemo(() => getTeamGroupStats(gameHistory), [gameHistory]);
  const teamGroupSizes = new Set(teamGroupStats.map((teamGroup) => teamGroup.players.length));
  const teamGroupHistoryTitle = teamGroupSizes.size === 1 && teamGroupSizes.has(2)
    ? 'Teammate Pair History'
    : 'Teammate Group History';
  const selectedCourtSummary = activeCourtModes
    .map((mode, index) => `Court ${index + 1}: ${mode}`)
    .join(' | ');
  const persistenceMessage = {
    idle: '',
    loaded: 'Saved history loaded for this browser.',
    saving: 'Saving game history...',
    saved: 'Game history saved.',
    reset: 'Saved history reset.',
    unavailable: 'Database unavailable; games still work locally.'
  }[persistenceStatus];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-amber-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl rounded-lg bg-white p-5 shadow-lg sm:p-8">
        <div className="mb-8 text-center">
          <h1 className="mb-2 flex items-center justify-center gap-2 text-3xl font-bold text-blue-900">
            <Users className="h-8 w-8" />
            Beach Volleyball Team Randomizer
          </h1>
          <p className="text-gray-600">Fair and random team selection across up to {MAX_COURTS} courts</p>
          {persistenceMessage && (
            <p className="mt-2 text-xs text-gray-500">{persistenceMessage}</p>
          )}
        </div>

        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Courts</h2>
          <div className="mb-5 flex items-center gap-4">
            <button
              onClick={() => updateCourts(courts - 1)}
              disabled={courts <= 1}
              className="rounded-lg bg-gray-500 px-3 py-2 text-white hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Remove court"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[3rem] text-center text-2xl font-bold text-blue-900">{courts}</span>
            <button
              onClick={() => updateCourts(courts + 1)}
              disabled={courts >= MAX_COURTS}
              className="rounded-lg bg-gray-500 px-3 py-2 text-white hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Add court"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {activeCourtModes.map((mode, courtIndex) => (
              <div key={courtIndex} className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-blue-900">Court {courtIndex + 1}</h3>
                  <span className="text-xs font-medium text-blue-700">{getPlayersPerCourt(mode)} players</span>
                </div>
                <div className="flex gap-2">
                  {GAME_MODES.map((availableMode) => (
                    <button
                      key={availableMode}
                      onClick={() => handleCourtModeChange(courtIndex, availableMode)}
                      className={`flex-1 rounded-lg px-3 py-2 font-medium transition-colors ${
                        mode === availableMode
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {availableMode}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-gray-500">{getGameModeDescription(mode)}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-gray-500">
            Selected courts need {totalSpotsRequired} players total. {selectedCourtSummary}
          </p>
          {shortageMessage && (
            <p className="mt-2 text-sm font-medium text-red-600">{shortageMessage}</p>
          )}
        </div>

        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Add Players</h2>
          <div className="space-y-3">
            {players.map((player, index) => (
              <div key={player.id} className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:flex-row sm:items-center">
                <input
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  placeholder={`Player ${index + 1} name`}
                  value={player.name}
                  onChange={(e) => updatePlayer(index, e.target.value)}
                  onKeyDown={(e) => handlePlayerKeyDown(e, index)}
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex flex-wrap gap-1 sm:flex-nowrap" aria-label={`Player ${index + 1} mode preferences`}>
                  {[ALL_MODE_PREFERENCE, ...GAME_MODES].map((preference) => {
                    const isSelected = preference === ALL_MODE_PREFERENCE
                      ? hasAnyModePreference(player)
                      : isPlayerEligibleForMode(player, preference);

                    return (
                      <button
                        key={preference}
                        type="button"
                        onClick={() => updatePlayerPreferredModes(index, preference)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100'
                        }`}
                        aria-pressed={isSelected}
                        title={`${getPlayerName(player) || `Player ${index + 1}`} preferences: ${getPreferenceLabel(player)}`}
                      >
                        {preference}
                      </button>
                    );
                  })}
                </div>
                {players.length > 1 && (
                  <button
                    onClick={() => removePlayer(index)}
                    className="self-start rounded-lg bg-red-500 px-3 py-2 text-white transition-colors hover:bg-red-600 sm:self-auto"
                    aria-label={`Remove player ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addPlayer}
            className="mt-3 flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600"
          >
            <Plus className="h-4 w-4" />
            Add Player
          </button>
          <p className="mt-2 text-sm text-gray-500">Total players: {totalPlayers}</p>
        </div>

        <div className="mb-8 flex gap-4">
          <button
            onClick={generateTeams}
            disabled={!canGenerateTeams}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Shuffle className="h-5 w-5" />
            {gameHistory.length === 0 ? 'Generate Random Teams' : `Generate Game ${gameHistory.length + 1}`}
          </button>
          {gameHistory.length > 0 && (
            <button
              onClick={reset}
              className="flex items-center gap-2 rounded-lg bg-gray-500 px-6 py-3 text-white transition-colors hover:bg-gray-600"
            >
              <RotateCcw className="h-5 w-5" />
              Reset All
            </button>
          )}
        </div>

        {waitingQueue.length > 0 && teams.length === 0 && (
          <div className="mb-8 rounded-lg border-2 border-blue-300 bg-blue-100 p-4">
            <h3 className="mb-2 font-bold text-blue-800">Guaranteed Next Game</h3>
            <div className="flex flex-wrap gap-2">
              {waitingQueue.map((player) => (
                <span key={player.id} className="rounded-full bg-blue-200 px-3 py-1 font-medium text-blue-800">
                  {getPlayerName(player)}
                </span>
              ))}
            </div>
            <p className="mt-2 text-sm text-blue-700">
              These players sat out last game and will be prioritized for the next game.
            </p>
          </div>
        )}

        {gameHistory.length > 0 && teams.length === 0 && (
          <div className="mb-8 rounded-lg border-2 border-green-300 bg-green-100 p-4">
            <h3 className="mb-2 font-bold text-green-800">Fair Rotation System Active</h3>
            <p className="text-sm text-green-700">
              Priority order: <strong>1st</strong> players who sat out last game,{' '}
              <strong>2nd</strong> players who sat out before that, <strong>3rd</strong> everyone else randomly.
            </p>
            <p className="mt-1 text-xs text-green-600">
              Player mode preferences are hard rules, so only eligible players are assigned to each court.
            </p>
          </div>
        )}

        {teams.length > 0 && (
          <div className="space-y-6">
            <h2 className="mb-6 text-center text-2xl font-bold text-green-700">
              Game {gameHistory.length} Teams
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              {teams.map((court) => (
                <div key={court.court} className="rounded-lg border-2 border-blue-300 bg-gradient-to-br from-blue-100 to-blue-200 p-6">
                  <h3 className="mb-4 text-center text-xl font-bold text-blue-800">
                    Court {court.court} <span className="text-base font-semibold text-blue-600">({court.gameMode || '2v2'})</span>
                  </h3>

                  <div className="space-y-4">
                    <div className="rounded-lg bg-white p-4 shadow-sm">
                      <h4 className="mb-2 font-semibold text-blue-700">Team A</h4>
                      <div className="flex flex-col gap-1">
                        {court.team1.map((player) => (
                          <span key={player.id} className="font-medium text-gray-800">{getPlayerName(player)}</span>
                        ))}
                      </div>
                    </div>

                    <div className="text-center text-2xl font-bold text-blue-600">VS</div>

                    <div className="rounded-lg bg-white p-4 shadow-sm">
                      <h4 className="mb-2 font-semibold text-blue-700">Team B</h4>
                      <div className="flex flex-col gap-1">
                        {court.team2.map((player) => (
                          <span key={player.id} className="font-medium text-gray-800">{getPlayerName(player)}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {sittingOut.length > 0 && (
              <div className="rounded-lg border-2 border-yellow-300 bg-yellow-100 p-6">
                <h3 className="mb-3 text-lg font-bold text-yellow-800">Sitting Out This Round</h3>
                <div className="flex flex-wrap gap-2">
                  {sittingOut.map((player) => (
                    <span key={player.id} className="rounded-full bg-yellow-200 px-3 py-1 font-medium text-yellow-800">
                      {getPlayerName(player)}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-sm text-yellow-700">
                  <strong>Guaranteed to play next game.</strong> They'll be prioritized when you generate the next round.
                </p>
              </div>
            )}
          </div>
        )}

        {gameHistory.length > 0 && (
          <div className="mt-8 rounded-lg bg-gray-50 p-6">
            <h3 className="mb-4 text-lg font-bold text-gray-800">Game History</h3>
            <div className="space-y-3">
              {gameHistory.map((game) => (
                <div key={`${game.gameNumber}-${game.createdAt || ''}`} className="rounded border bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-semibold text-gray-700">Game {game.gameNumber}</span>
                    <span className="text-sm text-gray-500">
                      {game.playing.length} playing, {game.sittingOut.length} sitting out
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-green-700">Playing: </span>
                      <span className="text-gray-700">{renderNames(game.playing)}</span>
                    </div>

                    {(game.teams || []).length > 0 && (
                      <div>
                        <span className="font-medium text-blue-700">Teams: </span>
                        <div className="mt-1 space-y-1 text-gray-600">
                          {game.teams.map((court) => (
                            <div key={court.court}>
                              Court {court.court}:{' '}
                              <span className="font-medium text-gray-700">({court.gameMode || game.gameMode || '2v2'})</span>{' '}
                              <span className="font-medium text-gray-700">Team A</span> {renderNames(court.team1)}
                              {' '}vs{' '}
                              <span className="font-medium text-gray-700">Team B</span> {renderNames(court.team2)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {game.sittingOut.length > 0 && (
                      <div>
                        <span className="font-medium text-orange-700">Sat out: </span>
                        <span className="text-gray-600">{renderNames(game.sittingOut)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {teamGroupStats.length > 0 && (
              <div className="mt-6 rounded border bg-white p-4">
                <h4 className="mb-3 font-semibold text-gray-800">{teamGroupHistoryTitle}</h4>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  {teamGroupStats.map((teamGroup) => (
                    <div key={teamGroup.key} className="flex items-center justify-between gap-3 rounded bg-blue-50 px-3 py-2">
                      <span className="font-medium text-blue-900">
                        {renderTeamGroup(teamGroup.players)}
                      </span>
                      <span className="text-right text-gray-600">
                        {teamGroup.count} {teamGroup.count === 1 ? 'game' : 'games'} · Games {teamGroup.games.join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

// Export helper functions for testing
export {
  getPlayersPerCourt,
  normalizePreferredModes,
  isPlayerEligibleForMode,
  getPlayerRoundStats,
  getTeamGroupStats
};
