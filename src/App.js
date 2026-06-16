import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Shuffle, Users, Plus, Minus, Trash2, RotateCcw } from 'lucide-react';

const GAME_MODES = ['2v2', '3v3', '4v4'];
const SESSION_STORAGE_KEY = 'volleyball-randomizer-session-id';

const createId = (prefix) => {
  if (window.crypto && window.crypto.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const createPlayer = (name = '') => ({
  id: createId('player'),
  name
});

const getPlayersPerCourt = (mode) => {
  return mode === '2v2' ? 4 : mode === '3v3' ? 6 : 8;
};

const getPlayerName = (player) => player.name.trim();

const serializeGame = (game) => ({
  ...game,
  playing: game.playing.map((player) => ({ id: player.id, name: player.name })),
  sittingOut: game.sittingOut.map((player) => ({ id: player.id, name: player.name })),
  teams: game.teams.map((court) => ({
    ...court,
    team1: court.team1.map((player) => ({ id: player.id, name: player.name })),
    team2: court.team2.map((player) => ({ id: player.id, name: player.name }))
  })),
  playersSnapshot: game.playersSnapshot.map((player) => ({
    id: player.id,
    name: player.name
  }))
});

const deserializeGame = (game) => {
  const playersById = new Map(
    (game.playersSnapshot || []).map((player) => [
      player.id,
      { id: player.id || createId('player'), name: player.name || '' }
    ])
  );

  const fromSavedPlayer = (savedPlayer) => {
    if (savedPlayer && typeof savedPlayer === 'object') {
      const id = savedPlayer.id || createId('player');
      const player = playersById.get(id) || { id, name: savedPlayer.name || '' };
      playersById.set(id, player);
      return player;
    }

    return createPlayer(savedPlayer || '');
  };

  return {
    ...game,
    playing: (game.playing || []).map(fromSavedPlayer),
    sittingOut: (game.sittingOut || []).map(fromSavedPlayer),
    teams: (game.teams || []).map((court) => ({
      ...court,
      team1: (court.team1 || []).map(fromSavedPlayer),
      team2: (court.team2 || []).map(fromSavedPlayer)
    })),
    playersSnapshot: Array.from(playersById.values())
  };
};

const getSessionId = () => {
  const existingSessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (existingSessionId) {
    return existingSessionId;
  }

  const sessionId = createId('session');
  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  return sessionId;
};

export default function VolleyballTeamRandomizer() {
  const [players, setPlayers] = useState([createPlayer()]);
  const [courts, setCourts] = useState(1);
  const [teams, setTeams] = useState([]);
  const [sittingOut, setSittingOut] = useState([]);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [gameMode, setGameMode] = useState('2v2');
  const [sessionId, setSessionId] = useState('');
  const [persistenceStatus, setPersistenceStatus] = useState('idle');
  const inputRefs = useRef([]);
  const [shouldFocusLast, setShouldFocusLast] = useState(false);

  const validPlayers = useMemo(
    () => players.filter((player) => getPlayerName(player) !== ''),
    [players]
  );
  const totalPlayers = validPlayers.length;
  const playersPerCourt = getPlayersPerCourt(gameMode);
  const maxCourts = Math.floor(totalPlayers / playersPerCourt);

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
        setGameMode(latestGame.gameMode || '2v2');
        setCourts(Math.max(1, latestGame.courts || 1));

        if (latestGame.playersSnapshot && latestGame.playersSnapshot.length > 0) {
          setPlayers(latestGame.playersSnapshot);
        }

        setPersistenceStatus('loaded');
      } catch (error) {
        setPersistenceStatus('unavailable');
      }
    };

    loadSavedGames();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  useEffect(() => {
    const clampedCourts = Math.max(1, Math.min(courts, maxCourts || 1));

    if (courts !== clampedCourts) {
      setCourts(clampedCourts);
    }
  }, [courts, maxCourts]);

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

  const saveGame = async (game) => {
    if (!sessionId) {
      return;
    }

    try {
      setPersistenceStatus('saving');
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          game: serializeGame(game)
        })
      });

      const data = await response.json().catch(() => ({}));
      setPersistenceStatus(response.ok && data.persistence === 'enabled' ? 'saved' : 'unavailable');
    } catch (error) {
      setPersistenceStatus('unavailable');
    }
  };

  const handleGameModeChange = (newMode) => {
    if (teams.length > 0) {
      setTeams([]);
      setSittingOut([]);
      setWaitingQueue([]);
      setGameHistory([]);
    }

    setGameMode(newMode);
    const newMaxCourts = Math.floor(totalPlayers / getPlayersPerCourt(newMode));
    setCourts((currentCourts) => Math.max(1, Math.min(currentCourts, newMaxCourts || 1)));
  };

  const generateTeams = () => {
    const minPlayers = playersPerCourt;

    if (validPlayers.length < minPlayers) {
      alert(`Need at least ${minPlayers} players to form teams for ${gameMode} mode!`);
      return;
    }

    const activeCourts = Math.max(1, Math.min(courts, maxCourts));
    const totalSpotsAvailable = activeCourts * playersPerCourt;
    const lastGameSitting = gameHistory.length > 0 ? gameHistory[gameHistory.length - 1].sittingOut : [];
    const validPlayerIds = new Set(validPlayers.map((player) => player.id));
    const waitingPlayerIds = new Set(waitingQueue.map((player) => player.id));
    const lastSittingIds = new Set(lastGameSitting.map((player) => player.id));
    const priorityPlayers = waitingQueue.filter((player) => validPlayerIds.has(player.id));
    const secondPriorityPlayers = lastGameSitting.filter(
      (player) => !waitingPlayerIds.has(player.id) && validPlayerIds.has(player.id)
    );
    const otherPlayers = validPlayers.filter(
      (player) => !waitingPlayerIds.has(player.id) && !lastSittingIds.has(player.id)
    );
    let allPlayersOrdered = [];

    if (priorityPlayers.length >= totalSpotsAvailable) {
      allPlayersOrdered = shuffleArray(priorityPlayers);
    } else {
      const remainingSpots = totalSpotsAvailable - priorityPlayers.length;

      if (secondPriorityPlayers.length >= remainingSpots) {
        allPlayersOrdered = [...priorityPlayers, ...shuffleArray(secondPriorityPlayers)];
      } else {
        allPlayersOrdered = [
          ...priorityPlayers,
          ...shuffleArray(secondPriorityPlayers),
          ...shuffleArray(otherPlayers)
        ];
      }
    }

    const playingPlayers = allPlayersOrdered.slice(0, totalSpotsAvailable);
    const newSittingOut = allPlayersOrdered.slice(totalSpotsAvailable);
    const newTeams = [];

    for (let court = 0; court < activeCourts; court++) {
      const startIndex = court * playersPerCourt;
      const courtPlayers = playingPlayers.slice(startIndex, startIndex + playersPerCourt);

      if (courtPlayers.length === playersPerCourt) {
        const shuffledCourtPlayers = shuffleArray(courtPlayers);
        const teamSize = playersPerCourt / 2;
        newTeams.push({
          court: court + 1,
          team1: shuffledCourtPlayers.slice(0, teamSize),
          team2: shuffledCourtPlayers.slice(teamSize)
        });
      }
    }

    const newGame = {
      gameNumber: gameHistory.length + 1,
      gameMode,
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
    saveGame(newGame);
  };

  const reset = async () => {
    setTeams([]);
    setSittingOut([]);
    setWaitingQueue([]);
    setGameHistory([]);

    if (!sessionId) {
      return;
    }

    try {
      const response = await fetch(`/api/games?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE'
      });
      const data = await response.json().catch(() => ({}));
      setPersistenceStatus(response.ok && data.persistence === 'enabled' ? 'reset' : 'unavailable');
    } catch (error) {
      setPersistenceStatus('unavailable');
    }
  };

  const renderNames = (playerList) => playerList.map(getPlayerName).join(', ');
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
          <p className="text-gray-600">Fair and random {gameMode} team selection for multiple courts</p>
          {persistenceMessage && (
            <p className="mt-2 text-xs text-gray-500">{persistenceMessage}</p>
          )}
        </div>

        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Game Mode</h2>
          <div className="flex justify-center gap-2">
            {GAME_MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => handleGameModeChange(mode)}
                className={`rounded-lg px-6 py-2 font-medium transition-colors ${
                  gameMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-sm text-gray-500">
            {gameMode === '2v2' && 'Teams of 2 players each (4 per court)'}
            {gameMode === '3v3' && 'Teams of 3 players each (6 per court)'}
            {gameMode === '4v4' && 'Teams of 4 players each (8 per court)'}
          </p>
        </div>

        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Add Players</h2>
          <div className="space-y-3">
            {players.map((player, index) => (
              <div key={player.id} className="flex gap-2">
                <input
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  placeholder={`Player ${index + 1} name`}
                  value={player.name}
                  onChange={(e) => updatePlayer(index, e.target.value)}
                  onKeyDown={(e) => handlePlayerKeyDown(e, index)}
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                {players.length > 1 && (
                  <button
                    onClick={() => removePlayer(index)}
                    className="rounded-lg bg-red-500 px-3 py-2 text-white transition-colors hover:bg-red-600"
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

        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Number of Courts</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCourts((currentCourts) => Math.max(1, currentCourts - 1))}
              disabled={courts <= 1}
              className="rounded-lg bg-gray-500 px-3 py-2 text-white hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[3rem] text-center text-2xl font-bold text-blue-900">{courts}</span>
            <button
              onClick={() => setCourts((currentCourts) => Math.min(maxCourts || 1, currentCourts + 1))}
              disabled={courts >= maxCourts || maxCourts === 0}
              className="rounded-lg bg-gray-500 px-3 py-2 text-white hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Max courts with current players: {maxCourts}
            {maxCourts === 0 && totalPlayers > 0 && ` (need at least ${playersPerCourt} players for ${gameMode})`}
          </p>
        </div>

        <div className="mb-8 flex gap-4">
          <button
            onClick={generateTeams}
            disabled={totalPlayers < playersPerCourt}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Shuffle className="h-5 w-5" />
            {gameHistory.length === 0 ? 'Generate Random Teams' : `Generate Game ${gameHistory.length + 1}`}
          </button>
          {teams.length > 0 && (
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
              This minimizes total sitting time and keeps repeated names distinct.
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
                    Court {court.court}
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
          </div>
        )}
      </div>
    </div>
  );
}
