import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Minus, Monitor, Moon, Plus, RotateCcw, Sun, Trash2 } from 'lucide-react';
import { ToastContainer } from './Toast';
import { useToast } from './useToast';
import {
  createInitialSession,
  createRoundResetSession,
  sessionStore
} from './sessionPersistence';
import { applyTheme, resolveTheme, subscribeToSystemTheme, THEME_OPTIONS } from './theme';
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
  allocateFairRound
} from './gameHelpers';

/**
 * Beach Volleyball Team Randomizer
 *
 * A fair, random team assignment system that ensures:
 * 1. Players who sat out last game get priority to play next game
 * 2. Mode preferences are respected as hard rules (can't force someone into incompatible mode)
 * 3. Overall playing time is balanced across sessions
 * 4. Teammate-pairing history is tracked and displayed
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

const pad2 = (value) => String(value).padStart(2, '0');

function VolleyballMark({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2 C 8.2 7.4, 5.4 10.6, 3.3 13.2" />
      <path d="M3.3 13.2 C 8.6 15.6, 15.4 15.6, 20.7 13.2" />
      <path d="M20.7 13.2 C 18.6 10.6, 15.8 7.4, 12 2" />
    </svg>
  );
}

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
    const syncTheme = () => {
      const resolvedTheme = resolveTheme(theme, window.matchMedia);
      applyTheme(resolvedTheme);
      applyNativeTheme(resolvedTheme).catch(() => undefined);

      const themeColor = document.querySelector('meta[name="theme-color"]');
      themeColor?.setAttribute('content', resolvedTheme === 'dark' ? '#070d16' : '#f6f1e3');
    };

    syncTheme();

    if (theme !== 'system') {
      return undefined;
    }

    return subscribeToSystemTheme(syncTheme);
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
    const assignments = allocateFairRound({
      players: validPlayers,
      courtModes: activeModes,
      gameHistory
    });

    if (!assignments) {
      error('Unable to fill courts. Check player preferences and try again.');
      return;
    }

    const playingPlayers = assignments.flatMap(({ players: courtPlayers }) => courtPlayers);
    const newTeams = assignments.map(({ court, mode, players: courtPlayers }) => {
      const shuffledCourtPlayers = shuffleArray(courtPlayers);
      const teamSize = courtPlayers.length / 2;

      return {
        court,
        gameMode: mode,
        team1: shuffledCourtPlayers.slice(0, teamSize),
        team2: shuffledCourtPlayers.slice(teamSize)
      };
    });

    const playingPlayerIds = new Set(playingPlayers.map((player) => player.id));
    const newSittingOut = validPlayers.filter((player) => !playingPlayerIds.has(player.id));

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
      <main aria-busy={!isHydrated} className="app-shell mx-auto max-w-5xl">
        <header className="scoreboard">
          <div className="scoreboard-top">
            <div className="wordmark">
              <VolleyballMark className="wordmark-mark" />
              <span className="wordmark-text">
                <span className="wordmark-eyebrow">Beach Volleyball</span>
                <span className="wordmark-title">Team Randomizer</span>
              </span>
            </div>

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
                    <ThemeIcon className="h-3.5 w-3.5" />
                    <span>{themeOption}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="scoreboard-tagline">
            <h1 className="tagline">
              Rally. Rotate.<br /><span className="tagline-accent">Play fair.</span>
            </h1>
            <p className="tagline-sub">
              Fair, random courts in one tap — 2v2, 3v3 or 4v4 across up to four courts. Players who sit out get priority next round.
            </p>
          </div>

          <div className="ticker" aria-label="Session stats">
            <div className="ticker-cell">
              <span className="ticker-value">{pad2(courts)}</span>
              <span className="ticker-label">Courts</span>
            </div>
            <div className="ticker-cell">
              <span className="ticker-value">{pad2(totalPlayers)}</span>
              <span className="ticker-label">Players</span>
            </div>
            <div className="ticker-cell">
              <span className="ticker-value">{pad2(gameHistory.length)}</span>
              <span className="ticker-label">Rounds</span>
            </div>
          </div>
        </header>

        <div className="p-5 sm:p-8 lg:p-9">
          {/* 01 — Court setup */}
          <section className="section">
            <div className="section-head">
              <span className="section-no">01</span>
              <div>
                <h2 className="section-title">Set the courts</h2>
                <p className="section-sub">Choose how many games run at once and the format for each.</p>
              </div>
            </div>

            <div className="court-counter" role="group" aria-label="Court count">
              <button
                onClick={() => updateCourts(courts - 1)}
                disabled={courts <= 1}
                className="court-counter-btn"
                aria-label="Remove court"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="court-counter-value" aria-live="polite">{pad2(courts)}</span>
              <button
                onClick={() => updateCourts(courts + 1)}
                disabled={courts >= MAX_COURTS}
                className="court-counter-btn"
                aria-label="Add court"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="court-grid">
              {activeCourtModes.map((mode, courtIndex) => (
                <div key={courtIndex} className="court-card">
                  <div className="court-card-head">
                    <h3 className="court-name">Court {courtIndex + 1}</h3>
                    <span className="court-tag">{getPlayersPerCourt(mode)} PLAYERS</span>
                  </div>
                  <div className="chip-row">
                    {GAME_MODES.map((availableMode) => (
                      <button
                        key={availableMode}
                        onClick={() => handleCourtModeChange(courtIndex, availableMode)}
                        className="mode-chip"
                        aria-pressed={mode === availableMode}
                      >
                        {availableMode}
                      </button>
                    ))}
                  </div>
                  <p className="court-note">{getGameModeDescription(mode)}</p>
                </div>
              ))}
            </div>

            <p className="need-line">
              <strong>{pad2(totalSpotsRequired)}</strong> players needed · {selectedCourtSummary}
            </p>
            {shortageMessage && (
              <p className="need-warn">{shortageMessage}</p>
            )}
          </section>

          {/* 02 — Lineup */}
          <section className="section">
            <div className="section-head">
              <span className="section-no">02</span>
              <div>
                <h2 className="section-title">Build the lineup</h2>
                <p className="section-sub">Add everyone playing and tap their preferred formats.</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {players.map((player, index) => (
                <div key={player.id} className="player-row">
                  <input
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    placeholder={`Player ${index + 1} name`}
                    value={player.name}
                    onChange={(e) => updatePlayer(index, e.target.value)}
                    onKeyDown={(e) => handlePlayerKeyDown(e, index)}
                    className="player-input"
                  />
                  <div className="pref-chips" aria-label={`Player ${index + 1} mode preferences`}>
                    {[ALL_MODE_PREFERENCE, ...GAME_MODES].map((preference) => {
                      const isSelected = preference === ALL_MODE_PREFERENCE
                        ? hasAnyModePreference(player)
                        : isPlayerEligibleForMode(player, preference);

                      return (
                        <button
                          key={preference}
                          type="button"
                          onClick={() => updatePlayerPreferredModes(index, preference)}
                          className={`jersey-chip ${preference === ALL_MODE_PREFERENCE ? 'jersey-chip-any' : ''}`}
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
                      className="remove-btn"
                      aria-label={`Remove player ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button onClick={addPlayer} className="add-player">
              <Plus className="h-4 w-4" />
              Add Player
            </button>
            <p className="roster-count">Total {pad2(totalPlayers)} players</p>
          </section>

          {/* Control deck */}
          <div className="deck">
            <button
              onClick={generateTeams}
              disabled={!isHydrated || !canGenerateTeams}
              className="deck-action deck-cta"
            >
              <span className="live-dot" aria-hidden="true" />
              {gameHistory.length === 0 ? 'Generate Teams' : `Generate Game ${gameHistory.length + 1}`}
              <ArrowRight className="h-5 w-5" />
            </button>
            {gameHistory.length > 0 && (
              <button
                onClick={reset}
                className="deck-action deck-btn"
              >
                <RotateCcw className="h-4 w-4" />
                Reset Rounds
              </button>
            )}
            <button
              onClick={() => setIsStartOverOpen(true)}
              disabled={!isHydrated}
              className="deck-action deck-danger"
            >
              <Trash2 className="h-4 w-4" />
              Start Over
            </button>
          </div>

          {/* 03 — Matchups */}
          <section className="section">
            <div className="section-head">
              <span className="section-no">03</span>
              <div>
                <h2 className="section-title">Live matchups</h2>
                <p className="section-sub">
                  {teams.length > 0 ? 'Fair courts, straight from the rotation.' : 'One tap away from the first serve.'}
                </p>
              </div>
            </div>

            {teams.length === 0 && (
              <>
                {guaranteedWaitingPlayers.length > 0 && (
                  <div className="notice notice-good">
                    <h3 className="notice-title">Guaranteed next game</h3>
                    <div className="notice-pills">
                      {guaranteedWaitingPlayers.map((player) => (
                        <span key={player.id} className="pill">{getPlayerName(player)}</span>
                      ))}
                    </div>
                    <p className="notice-note">
                      These players sat out last game and will be prioritized for the next game.
                    </p>
                  </div>
                )}

                {ineligibleWaitingPlayers.length > 0 && (
                  <div className="notice notice-bad">
                    <h3 className="notice-title">Preferences prevent next-game priority</h3>
                    <div className="notice-pills">
                      {ineligibleWaitingPlayers.map((player) => (
                        <span key={player.id} className="pill">
                          {getPlayerName(player)} ({getPreferenceLabel(player)})
                        </span>
                      ))}
                    </div>
                    <p className="notice-note">
                      None of the selected court modes match these players. Change a court mode or their preferences before generating.
                    </p>
                  </div>
                )}

                {gameHistory.length > 0 && (
                  <div className="notice notice-info">
                    <h3 className="notice-title">Fair rotation active</h3>
                    <p className="notice-note">
                      Priority order: <strong>1st</strong> players who sat out last game,{' '}
                      <strong>2nd</strong> players who sat out before that,{' '}
                      <strong>3rd</strong> everyone else randomly. Mode preferences are hard rules, so only eligible players are assigned to each court.
                    </p>
                  </div>
                )}

                <div className="ready-panel">
                  <VolleyballMark className="ready-mark" />
                  <h3 className="ready-title">Waiting for the whistle</h3>
                  <p className="ready-note">
                    Set your courts, build the lineup, then hit Generate to drop the first matchups. Whoever sits out gets priority next round — the rotation stays fair all night.
                  </p>
                </div>
              </>
            )}

            {teams.length > 0 && (
              <>
                <div className="match-grid">
                  {teams.map((court) => (
                    <section
                      key={court.court}
                      className="matchup-card"
                      style={{ animationDelay: `${40 + court.court * 70}ms` }}
                      aria-label={`Court ${court.court} ${court.gameMode || '2v2'} matchup`}
                    >
                      <header className="match-head">
                        <span className="match-court">Court <em>{pad2(court.court)}</em></span>
                        <span className="match-meta">{court.gameMode || '2v2'} · {getPlayersPerCourt(court.gameMode || '2v2')} ON</span>
                      </header>

                      <div className="team-block">
                        <span className="team-label"><span className="team-jersey">A</span> Team A</span>
                        <ul className="team-names">
                          {court.team1.map((player) => (
                            <li key={player.id}>{getPlayerName(player)}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="net" role="separator" aria-label="net">
                        <span className="net-antenna net-antenna-l" aria-hidden="true" />
                        <span className="net-antenna net-antenna-r" aria-hidden="true" />
                      </div>

                      <div className="team-block">
                        <span className="team-label"><span className="team-jersey">B</span> Team B</span>
                        <ul className="team-names">
                          {court.team2.map((player) => (
                            <li key={player.id}>{getPlayerName(player)}</li>
                          ))}
                        </ul>
                      </div>
                    </section>
                  ))}
                </div>

                {sittingOut.length > 0 && (
                  <div className="bench">
                    <span className="bench-label">Sitting out this round · {sittingOut.length}</span>
                    <div className="bench-list">
                      {sittingOut.map((player) => (
                        <span key={player.id} className="pill">{getPlayerName(player)}</span>
                      ))}
                    </div>
                    <p className="bench-note">
                      {sittingOut.every((player) => canPlayerPlaySelectedModes(player, activeCourtModes)) ? (
                        <><strong>Guaranteed to play next game.</strong> They'll be prioritized when you generate the next round.</>
                      ) : (
                        <><strong>Preference check needed.</strong> A player is only guaranteed a spot when a selected court mode matches their preferences.</>
                      )}
                    </p>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Game log */}
          {gameHistory.length > 0 && (
            <section className="section">
              <div className="game-history-panel">
                <div className="log-head">
                  <h3>Game History</h3>
                  <span className="log-count">{gameHistory.length} {gameHistory.length === 1 ? 'round' : 'rounds'}</span>
                </div>

                <div className="log-list">
                  {gameHistory.map((game) => (
                    <article key={`${game.gameNumber}-${game.createdAt || ''}`} className="history-game-card">
                      <header className="log-row-top">
                        <span className="log-round">Game {game.gameNumber}</span>
                        <span className="log-meta">{game.playing.length} playing · {game.sittingOut.length} sitting out</span>
                      </header>

                      <div className="log-body">
                        <div className="log-line">
                          <span className="log-label">Playing</span>
                          <span>{renderNames(game.playing)}</span>
                        </div>

                        {(game.teams || []).length > 0 && (
                          <div className="log-line log-line-stack">
                            <span className="log-label">Teams</span>
                            <div className="log-courts">
                              {game.teams.map((court) => (
                                <div key={court.court} className="log-court">
                                  <em>Court {court.court}</em>{' '}
                                  <b>Team A</b> {renderNames(court.team1)} vs <b>Team B</b> {renderNames(court.team2)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {game.sittingOut.length > 0 && (
                          <div className="log-line">
                            <span className="log-label">Sat out</span>
                            <span>{renderNames(game.sittingOut)}</span>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>

                {teamGroupStats.length > 0 && (
                  <div className="history-summary-card">
                    <h4>{teamGroupHistoryTitle}</h4>
                    <div className="pair-grid">
                      {teamGroupStats.map((teamGroup) => (
                        <div key={teamGroup.key} className="history-pair-row">
                          <span className="pair-names">{renderTeamGroup(teamGroup.players)}</span>
                          <span className="pair-count">
                            {teamGroup.count} {teamGroup.count === 1 ? 'game' : 'games'} · Games {teamGroup.games.join(', ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
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
            className="modal-card"
          >
            <h2 id="start-over-title" className="modal-title">Start a new session?</h2>
            <p id="start-over-description" className="modal-note">
              This clears every player, court setting, matchup, and round from this device. It cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                onClick={() => setIsStartOverOpen(false)}
                className="deck-action deck-btn modal-btn"
              >
                Keep Session
              </button>
              <button
                autoFocus
                onClick={startOver}
                className="modal-danger"
              >
                <Trash2 className="h-4 w-4" />
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