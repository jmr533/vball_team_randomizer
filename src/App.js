import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Shuffle, Users, Plus, Minus, Trash2, RotateCcw, Waves, Sun, Moon, Monitor, Trophy, MapPin } from 'lucide-react';
import { ToastContainer } from './Toast';
import { useToast } from './useToast';
import {
  createInitialSession,
  createRoundResetSession,
  sessionStore
} from './sessionPersistence';
import { applyTheme, resolveTheme, THEME_OPTIONS } from './theme';
import { applyNativeTheme } from './nativeTheme';
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
  canPlayerPlaySelectedModes,
  hasAnyModePreference,
  getPreferenceLabel,
  getTeamGroupStats,
  getPlayerRoundStats
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
  const [gameHistory, setGameHistory] = useState([]);
  const [theme, setTheme] = useState('system');
  const [isHydrated, setIsHydrated] = useState(false);
  const [isStartOverOpen, setIsStartOverOpen] = useState(false);
  const inputRefs = useRef([]);
  const storageErrorShownRef = useRef(false);
  const [shouldFocusLast, setShouldFocusLast] = useState(false);
  const { toasts, dismiss, success, error } = useToast();

  useEffect(() => {
    let isMounted = true;

    sessionStore.load()
      .then((storedSession) => {
        if (!isMounted || !storedSession) {
          return;
        }

        setPlayers(storedSession.players);
        setCourts(storedSession.courts);
        setCourtModes(storedSession.courtModes);
        setTeams(storedSession.teams);
        setSittingOut(storedSession.sittingOut);
        setGameHistory(storedSession.gameHistory);
        setTheme(storedSession.theme);
      })
      .catch(() => {
        if (isMounted) {
          storageErrorShownRef.current = true;
          error('Saved session could not be restored. Starting fresh.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsHydrated(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [error]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    sessionStore.save({ players, courts, courtModes, teams, sittingOut, gameHistory, theme })
      .catch(() => {
        if (!storageErrorShownRef.current) {
          storageErrorShownRef.current = true;
          error('Changes could not be saved on this device.');
        }
      });
  }, [players, courts, courtModes, teams, sittingOut, gameHistory, theme, isHydrated, error]);

  useEffect(() => {
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncTheme = () => {
      const resolvedTheme = resolveTheme(theme, window.matchMedia);
      applyTheme(resolvedTheme);
      applyNativeTheme(resolvedTheme).catch(() => undefined);

      const themeColor = document.querySelector('meta[name="theme-color"]');
      themeColor?.setAttribute('content', resolvedTheme === 'dark' ? '#071827' : '#075985');
    };

    syncTheme();

    if (theme !== 'system') {
      return undefined;
    }

    colorSchemeQuery.addEventListener('change', syncTheme);
    return () => colorSchemeQuery.removeEventListener('change', syncTheme);
  }, [theme]);

  useEffect(() => {
    if (!isStartOverOpen) {
      return undefined;
    }

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setIsStartOverOpen(false);
      }
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isStartOverOpen]);

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
  const waitingQueue = teams.length === 0 && gameHistory.length > 0
    ? gameHistory[gameHistory.length - 1].sittingOut || []
    : [];
  const guaranteedWaitingPlayers = waitingQueue.filter((player) =>
    canPlayerPlaySelectedModes(player, activeCourtModes)
  );
  const ineligibleWaitingPlayers = waitingQueue.filter((player) =>
    !canPlayerPlaySelectedModes(player, activeCourtModes)
  );

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
    const waitingPlayerIds = new Set(lastGameSitting.map((player) => player.id));
    const priorityPlayers = Array.from(waitingPlayerIds)
      .map((playerId) => validPlayersById.get(playerId))
      .filter(Boolean);
    const otherPlayers = validPlayers.filter(
      (player) => !waitingPlayerIds.has(player.id)
    );
    const allPlayersOrdered = [
      ...shuffleArray(priorityPlayers),
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
      ...otherPlayers.map((player) => [player.id, 1])
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

      return selectedPlayers;
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
      courtModes: activeModes,
      courts: activeCourts,
      playing: playingPlayers,
      sittingOut: newSittingOut,
      teams: newTeams,
      createdAt: new Date().toISOString()
    };

    setCourts(activeCourts);
    setTeams(newTeams);
    setSittingOut(newSittingOut);
    setGameHistory((previousGames) => [...previousGames, newGame]);
    success(`Game ${newGame.gameNumber} generated successfully!`);
  };

  const reset = () => {
    const resetSession = createRoundResetSession({ players, courts, courtModes, theme });
    setTeams(resetSession.teams);
    setSittingOut(resetSession.sittingOut);
    setGameHistory(resetSession.gameHistory);
    success('All games reset successfully!');
  };

  const startOver = () => {
    const initialSession = createInitialSession();

    sessionStore.clear().catch(() => {
      if (!storageErrorShownRef.current) {
        storageErrorShownRef.current = true;
        error('Saved session could not be cleared from this device.');
      }
    });
    setPlayers(initialSession.players);
    setCourts(initialSession.courts);
    setCourtModes(initialSession.courtModes);
    setTeams(initialSession.teams);
    setSittingOut(initialSession.sittingOut);
    setGameHistory(initialSession.gameHistory);
    setTheme(initialSession.theme);
    setShouldFocusLast(false);
    setIsStartOverOpen(false);
    success('Started a new session.');
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

  return (
    <div className="beach-app min-h-screen p-3 sm:p-6 lg:p-10">
      <div className="beach-orb beach-orb-one" aria-hidden="true" />
      <div className="beach-orb beach-orb-two" aria-hidden="true" />
      <main aria-busy={!isHydrated} className="app-shell relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-2xl shadow-sky-950/15 backdrop-blur-xl">
        <header className="hero-panel relative overflow-hidden px-5 py-10 text-white sm:px-10 sm:py-14">
          <div className="theme-switcher" role="group" aria-label="Color theme">
            {THEME_OPTIONS.map((themeOption) => {
              const ThemeIcon = themeOption === 'light' ? Sun : themeOption === 'dark' ? Moon : Monitor;

              return (
                <button
                  key={themeOption}
                  type="button"
                  className="theme-option"
                  aria-label={`Use ${themeOption} theme`}
                  aria-pressed={theme === themeOption}
                  title={`${themeOption[0].toUpperCase()}${themeOption.slice(1)} theme`}
                  onClick={() => setTheme(themeOption)}
                >
                  <ThemeIcon className="h-4 w-4" />
                  <span>{themeOption}</span>
                </button>
              );
            })}
          </div>
          <div className="relative z-10 max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] backdrop-blur">
              <Sun className="h-4 w-4 text-amber-200" /> Game day, simplified
            </div>
            <h1 className="font-display text-4xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              Rally. Rotate.<br /><span className="text-amber-200">Play fair.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-sky-50 sm:text-lg">Beautifully balanced beach volleyball teams, ready in a single tap.</p>
            <div className="mt-7 flex flex-wrap gap-3 text-sm font-semibold">
              <span className="hero-stat"><MapPin className="h-4 w-4" /> {courts} {courts === 1 ? 'court' : 'courts'}</span>
              <span className="hero-stat"><Users className="h-4 w-4" /> {totalPlayers} players</span>
              <span className="hero-stat"><Trophy className="h-4 w-4" /> {gameHistory.length} rounds</span>
            </div>
          </div>
          <div className="volleyball-mark" aria-hidden="true"><span /></div>
          <Waves className="absolute -bottom-9 left-0 h-24 w-full text-white/15" strokeWidth={1} aria-hidden="true" />
        </header>

        <div className="p-5 sm:p-8 lg:p-10">
        <div className="mb-10">
          <div className="section-heading">
            <span className="section-number">01</span>
            <div><h2>Set your courts</h2><p>Choose how many games run at once and the format for each.</p></div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Courts</h2>
          <div className="mb-6 flex items-center gap-3 rounded-2xl bg-sky-50 p-2 w-fit">
            <button
              onClick={() => updateCourts(courts - 1)}
              disabled={courts <= 1}
              className="round-control"
              aria-label="Remove court"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[3rem] text-center text-2xl font-black text-sky-950">{courts}</span>
            <button
              onClick={() => updateCourts(courts + 1)}
              disabled={courts >= MAX_COURTS}
              className="round-control"
              aria-label="Add court"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {activeCourtModes.map((mode, courtIndex) => (
              <div key={courtIndex} className="court-config-card">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-display text-lg font-black text-sky-950">Court {courtIndex + 1}</h3>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-sky-700 shadow-sm">{getPlayersPerCourt(mode)} players</span>
                </div>
                <div className="flex gap-2">
                  {GAME_MODES.map((availableMode) => (
                    <button
                      key={availableMode}
                      onClick={() => handleCourtModeChange(courtIndex, availableMode)}
                      className={`flex-1 rounded-lg px-3 py-2 font-medium transition-colors ${
                        mode === availableMode
                          ? 'bg-sky-700 text-white shadow-md shadow-sky-900/20'
                          : 'bg-white/80 text-slate-600 ring-1 ring-sky-100 hover:bg-white hover:text-sky-800'
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

        <div className="mb-10">
          <div className="section-heading">
            <span className="section-number">02</span>
            <div><h2>Build your lineup</h2><p>Add everyone playing and tap their preferred formats.</p></div>
          </div>
          <div className="space-y-3">
            {players.map((player, index) => (
              <div key={player.id} className="player-row flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <input
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  placeholder={`Player ${index + 1} name`}
                  value={player.name}
                  onChange={(e) => updatePlayer(index, e.target.value)}
                  onKeyDown={(e) => handlePlayerKeyDown(e, index)}
                  className="player-input min-w-0 flex-1"
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
                            ? 'bg-sky-700 text-white shadow-sm'
                            : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:text-sky-700'
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
                    className="self-start rounded-xl bg-rose-50 px-3 py-2 text-rose-500 transition-colors hover:bg-rose-500 hover:text-white sm:self-auto"
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
            className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-sky-300 bg-sky-50 px-4 py-2.5 font-bold text-sky-700 transition hover:border-sky-500 hover:bg-sky-100"
          >
            <Plus className="h-4 w-4" />
            Add Player
          </button>
          <p className="mt-2 text-sm text-gray-500">Total players: {totalPlayers}</p>
        </div>

        <div className="action-dock mb-10 flex flex-col gap-3 rounded-2xl p-3 sm:flex-row">
          <button
            onClick={generateTeams}
            disabled={!isHydrated || !canGenerateTeams}
            className="generate-button flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-4 text-lg font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Shuffle className="h-5 w-5" />
            {gameHistory.length === 0 ? 'Generate Random Teams' : `Generate Game ${gameHistory.length + 1}`}
          </button>
          {gameHistory.length > 0 && (
            <button
              onClick={reset}
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-5 w-5" />
              Reset All
            </button>
          )}
          <button
            onClick={() => setIsStartOverOpen(true)}
            disabled={!isHydrated}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-6 py-3 font-bold text-rose-600 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-5 w-5" />
            Start Over
          </button>
        </div>

        {guaranteedWaitingPlayers.length > 0 && teams.length === 0 && (
          <div className="mb-8 rounded-lg border-2 border-blue-300 bg-blue-100 p-4">
            <h3 className="mb-2 font-bold text-blue-800">Guaranteed Next Game</h3>
            <div className="flex flex-wrap gap-2">
              {guaranteedWaitingPlayers.map((player) => (
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

        {ineligibleWaitingPlayers.length > 0 && teams.length === 0 && (
          <div className="mb-8 rounded-lg border-2 border-red-300 bg-red-100 p-4">
            <h3 className="mb-2 font-bold text-red-800">Preferences Prevent Next-Game Priority</h3>
            <div className="flex flex-wrap gap-2">
              {ineligibleWaitingPlayers.map((player) => (
                <span key={player.id} className="rounded-full bg-red-200 px-3 py-1 font-medium text-red-800">
                  {getPlayerName(player)} ({getPreferenceLabel(player)})
                </span>
              ))}
            </div>
            <p className="mt-2 text-sm text-red-700">
              None of the selected court modes match these players. Change a court mode or their preferences before generating.
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
            <h2 className="font-display mb-6 text-center text-3xl font-black text-sky-950">
              Game {gameHistory.length} <span className="text-coral">matchups</span>
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              {teams.map((court) => (
                <div key={court.court} className="match-card p-5 sm:p-6">
                  <h3 className="mb-4 text-center text-xl font-bold text-blue-800">
                    Court {court.court} <span className="text-base font-semibold text-sky-600">· {court.gameMode || '2v2'}</span>
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

                    <div className="vs-badge">VS</div>

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
                  {sittingOut.every((player) => canPlayerPlaySelectedModes(player, activeCourtModes)) ? (
                    <><strong>Guaranteed to play next game.</strong> They'll be prioritized when you generate the next round.</>
                  ) : (
                    <><strong>Preference check needed.</strong> A player is only guaranteed a spot when a selected court mode matches their preferences.</>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {gameHistory.length > 0 && (
          <div className="game-history-panel mt-8 rounded-lg bg-gray-50 p-6">
            <h3 className="mb-4 text-lg font-bold text-gray-800">Game History</h3>
            <div className="space-y-3">
              {gameHistory.map((game) => (
                <div key={`${game.gameNumber}-${game.createdAt || ''}`} className="history-game-card rounded border bg-white p-4">
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
                              <span className="font-medium text-gray-700">({court.gameMode})</span>{' '}
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
              <div className="history-summary-card mt-6 rounded border bg-white p-4">
                <h4 className="mb-3 font-semibold text-gray-800">{teamGroupHistoryTitle}</h4>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  {teamGroupStats.map((teamGroup) => (
                    <div key={teamGroup.key} className="history-pair-row flex items-center justify-between gap-3 rounded bg-blue-50 px-3 py-2">
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
      </main>
      {isStartOverOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsStartOverOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-over-title"
            aria-describedby="start-over-description"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <h2 id="start-over-title" className="font-display text-2xl font-black text-sky-950">Start a new session?</h2>
            <p id="start-over-description" className="mt-3 leading-relaxed text-slate-600">
              This clears every player, court setting, matchup, and round from this device. It cannot be undone.
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setIsStartOverOpen(false)}
                className="rounded-xl bg-white px-5 py-3 font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Keep Session
              </button>
              <button
                autoFocus
                onClick={startOver}
                className="rounded-xl bg-rose-600 px-5 py-3 font-bold text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700"
              >
                Clear Everything
              </button>
            </div>
          </section>
        </div>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
