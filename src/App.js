import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Monitor, Moon, Plus, RotateCcw, Shuffle, Sun, Trash2, X } from 'lucide-react';
import { BallMark, Court, MODE_NAMES } from './CourtDiagram';
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
  getPlayersPerCourt,
  getPlayerName,
  normalizePreferredModes,
  createPlayer,
  isPlayerEligibleForMode,
  canPlayerPlaySelectedModes,
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
const THEME_COLORS = { light: '#f4e9d4', dark: '#0c1a24' };
const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor };

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
  const [tossCount, setTossCount] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const inputRefs = useRef([]);
  const stageRef = useRef(null);
  const stageHeadingRef = useRef(null);
  const revealPendingRef = useRef(false);
  const storageErrorShownRef = useRef(false);
  const [shouldFocusLast, setShouldFocusLast] = useState(false);
  const { toasts, dismiss, success, error, info } = useToast();

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
      themeColor?.setAttribute('content', THEME_COLORS[resolvedTheme]);
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
      `Need ${shortage} more ${shortage === 1 ? 'player' : 'players'} for ${MODE_NAMES[mode]} (${mode})`
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
    const removedPlayer = players[index];
    setPlayers((currentPlayers) => currentPlayers.filter((_, i) => i !== index));

    if (getPlayerName(removedPlayer)) {
      info(`Removed ${getPlayerName(removedPlayer)}.`, {
        label: 'Undo',
        onClick: () => setPlayers((currentPlayers) => {
          if (currentPlayers.some((player) => player.id === removedPlayer.id)) {
            return currentPlayers;
          }

          const restoredPlayers = [...currentPlayers];
          restoredPlayers.splice(Math.min(index, restoredPlayers.length), 0, removedPlayer);
          return restoredPlayers;
        })
      });
    }
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
      const nextPreferredModes = currentPreferredModes.includes(preference)
        ? currentPreferredModes.filter((mode) => mode !== preference)
        : [...currentPreferredModes, preference];

      // Every player keeps at least one format; tapping the last one is a no-op.
      if (nextPreferredModes.length === 0) {
        return player;
      }

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
    setTossCount((count) => count + 1);
    revealPendingRef.current = true;
    // The reveal itself is the visual feedback; screen readers get the summary.
    setAnnouncement(`Game ${newGame.gameNumber} is set. ${newSittingOut.length > 0
      ? `Bench: ${newSittingOut.map(getPlayerName).join(', ')}.`
      : 'Everyone is playing.'}`);
  };

  // Lopsided teams? Re-deal partners within each court. Same players, same
  // bench, same game number, so the rotation and sit-out history are untouched.
  const redealTeams = () => {
    if (teams.length === 0) {
      return;
    }

    const idsOf = (team) => team.map((player) => player.id).sort().join(':');
    const redealtTeams = teams.map((court) => {
      const courtPlayers = [...court.team1, ...court.team2];
      const teamSize = court.team1.length;
      const previousSplit = new Set([idsOf(court.team1), idsOf(court.team2)]);
      let shuffledPlayers = shuffleArray(courtPlayers);

      for (let attempt = 0; attempt < 12 && previousSplit.has(idsOf(shuffledPlayers.slice(0, teamSize))); attempt += 1) {
        shuffledPlayers = shuffleArray(courtPlayers);
      }

      return {
        ...court,
        team1: shuffledPlayers.slice(0, teamSize),
        team2: shuffledPlayers.slice(teamSize)
      };
    });

    setTeams(redealtTeams);
    setGameHistory((previousGames) => previousGames.map((game, index) => (
      index === previousGames.length - 1 ? { ...game, teams: redealtTeams } : game
    )));
    setTossCount((count) => count + 1);
    setAnnouncement(`Game ${gameHistory.length} re-dealt. Same players on each court, new teams.`);
  };

  // Bring the freshly dealt courts to the player instead of leaving them off-screen.
  useEffect(() => {
    if (!revealPendingRef.current || teams.length === 0) {
      return;
    }

    revealPendingRef.current = false;
    // Jump, don't glide: the deal-in animation is the motion, and an instant
    // scroll can't be cancelled by focus changes or throttled frames.
    stageRef.current?.scrollIntoView?.({ block: 'start' });
    stageHeadingRef.current?.focus({ preventScroll: true });
  }, [teams]);

  const reset = () => {
    const resetSession = createRoundResetSession({ players, courts, courtModes, theme });
    setTeams(resetSession.teams);
    setSittingOut(resetSession.sittingOut);
    setGameHistory(resetSession.gameHistory);
    success('Rounds cleared. Roster and courts kept.');
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
  const repeatTeamGroups = teamGroupStats.filter((teamGroup) => teamGroup.count > 1);
  const hasTeams = teams.length > 0;
  const stageGameNumber = hasTeams ? gameHistory.length : gameHistory.length + 1;
  const benchCount = Math.max(0, totalPlayers - totalSpotsRequired);
  const missingPlayers = Math.max(0, totalSpotsRequired - totalPlayers);
  const formatsLimitPlayers = validPlayers.some((player) => (
    activeCourtModes.some((mode) => !isPlayerEligibleForMode(player, mode))
  ));
  const readiness = !isHydrated
    ? { tone: 'muted', text: 'Loading your session…' }
    : missingPlayers > 0 && !formatsLimitPlayers
      ? { tone: 'warn', text: `Add ${missingPlayers} more ${missingPlayers === 1 ? 'player' : 'players'} to fill ${courts === 1 ? 'the court' : 'every court'}.` }
      : shortageMessage
        ? { tone: 'warn', text: shortageMessage }
        : { tone: 'ok', text: `${totalSpotsRequired} play · ${benchCount} sit out` };
  const benchIsGuaranteed = sittingOut.every((player) => canPlayerPlaySelectedModes(player, activeCourtModes));

  return (
    <div className={`beach-app ${gameHistory.length > 0 ? 'has-history' : ''}`}>
      <header className="topbar">
        <h1 className="brand">
          <BallMark className="brand-mark" />
          <span className="brand-text">
            <span className="brand-kicker">Beach Volleyball</span>
            <span className="brand-name">Team Randomizer</span>
          </span>
        </h1>

      </header>

      <main aria-busy={!isHydrated} className="layout">
        {/* Sideline: everything you set before the serve */}
        <div className="sideline">
          <section className="panel" aria-labelledby="courts-title">
            <div className="panel-head">
              <h2 id="courts-title" className="panel-title">Courts</h2>
              <span className="panel-count">{courts} of {MAX_COURTS}</span>
            </div>

            <ol className="court-setup">
              {activeCourtModes.map((mode, courtIndex) => (
                <li key={courtIndex} className="court-setup-row">
                  <span className="court-setup-no" aria-hidden="true">{courtIndex + 1}</span>
                  <div className="segmented" role="group" aria-label={`Court ${courtIndex + 1} format`}>
                    {GAME_MODES.map((availableMode) => (
                      <button
                        key={availableMode}
                        type="button"
                        onClick={() => handleCourtModeChange(courtIndex, availableMode)}
                        className="segment"
                        aria-pressed={mode === availableMode}
                        aria-label={`${MODE_NAMES[availableMode]} (${availableMode})`}
                      >
                        <span className="segment-name">{MODE_NAMES[availableMode]}</span>
                        <span className="segment-mode">{availableMode}</span>
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ol>

            <div className="court-count-actions">
              <button
                type="button"
                onClick={() => updateCourts(courts + 1)}
                disabled={courts >= MAX_COURTS}
                className="text-btn"
                aria-label="Add court"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add court
              </button>
              {courts > 1 && (
                <button
                  type="button"
                  onClick={() => updateCourts(courts - 1)}
                  className="text-btn text-btn-quiet"
                  aria-label="Remove court"
                >
                  Remove court {courts}
                </button>
              )}
            </div>
          </section>

          <section className="panel" aria-labelledby="roster-title">
            <div className="panel-head">
              <h2 id="roster-title" className="panel-title">Roster</h2>
              <span className="panel-count">{totalPlayers} {totalPlayers === 1 ? 'player' : 'players'}</span>
            </div>
            <p className="panel-hint">Tap a format to rule a player out of it.</p>

            <ol className="roster">
              {players.map((player, index) => {
                const playerLabel = getPlayerName(player) || `Player ${index + 1}`;
                const preferredModes = normalizePreferredModes(player.preferredModes);

                return (
                  <li key={player.id} className="roster-row">
                    <span className="roster-no" aria-hidden="true">{pad2(index + 1)}</span>
                    <input
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      placeholder={`Player ${index + 1}`}
                      aria-label={`Player ${index + 1} name`}
                      value={player.name}
                      onChange={(e) => updatePlayer(index, e.target.value)}
                      onKeyDown={(e) => handlePlayerKeyDown(e, index)}
                      className="player-input"
                      autoComplete="off"
                      autoCapitalize="words"
                      enterKeyHint="next"
                    />
                    <div className="format-toggles" role="group" aria-label={`${playerLabel} plays`}>
                      {GAME_MODES.map((mode) => {
                        const isSelected = isPlayerEligibleForMode(player, mode);
                        const isLastSelected = isSelected && preferredModes.length === 1;

                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => updatePlayerPreferredModes(index, mode)}
                            className="format-toggle"
                            aria-pressed={isSelected}
                            aria-label={`${MODE_NAMES[mode]} (${mode})`}
                            title={isLastSelected
                              ? `${playerLabel} needs at least one format`
                              : `${playerLabel}: ${getPreferenceLabel(player)}`}
                          >
                            {mode}
                          </button>
                        );
                      })}
                    </div>
                    {players.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePlayer(index)}
                        className="remove-btn"
                        aria-label={`Remove ${playerLabel}`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>

            <button type="button" onClick={addPlayer} className="text-btn add-player">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add player
            </button>
          </section>

          {/* Serve bar: fixed to the thumb zone on phones, sticky in the sideline on desktop */}
          <div className="serve-bar">
            <p className={`serve-status serve-status-${readiness.tone}`} aria-live="polite">
              {readiness.text}
            </p>
            <button
              type="button"
              onClick={generateTeams}
              disabled={!isHydrated || !canGenerateTeams}
              className="serve-btn"
            >
              <BallMark key={tossCount} className={tossCount > 0 ? 'is-tossed' : ''} />
              {gameHistory.length === 0 ? 'Shuffle teams' : `Shuffle game ${gameHistory.length + 1}`}
            </button>
          </div>
        </div>

        {/* Stage: the courts as they'll be played */}
        <div className="stage" ref={stageRef}>
          <section aria-labelledby="stage-title">
            <div className="stage-head">
              <h2
                id="stage-title"
                ref={stageHeadingRef}
                tabIndex={-1}
                className="stage-title"
                aria-label={`Game ${stageGameNumber}, ${hasTeams ? 'on court' : 'up next'}`}
              >
                <span className="stage-label">Game</span> {pad2(stageGameNumber)}
              </h2>
              <span className={`stage-state ${hasTeams ? 'is-live' : ''}`}>
                {hasTeams ? 'On court' : 'Up next'}
              </span>
            </div>

            {!hasTeams && guaranteedWaitingPlayers.length > 0 && (
              <div className="callout callout-good">
                <span className="callout-label">First call</span>
                <p className="callout-names">{renderNames(guaranteedWaitingPlayers)}</p>
                <p className="callout-note">Sat out last game, so they're in this one.</p>
              </div>
            )}

            {!hasTeams && ineligibleWaitingPlayers.length > 0 && (
              <div className="callout callout-bad">
                <span className="callout-label">Can't get first call</span>
                <p className="callout-names">
                  {ineligibleWaitingPlayers.map((player) => `${getPlayerName(player)} (${getPreferenceLabel(player)})`).join(', ')}
                </p>
                <p className="callout-note">No court is set to a format they play. Change a court or their formats first.</p>
              </div>
            )}

            <div className="court-grid">
              {hasTeams
                ? teams.map((court) => (
                  <Court key={`${gameHistory.length}-${court.court}`} court={court} />
                ))
                : activeCourtModes.map((mode, index) => (
                  <Court key={`preview-${index}`} mode={mode} number={index + 1} />
                ))}
            </div>

            {hasTeams && (
              <div className="redeal">
                <button type="button" onClick={redealTeams} className="text-btn">
                  <Shuffle className="h-4 w-4" aria-hidden="true" />
                  Re-deal teams
                </button>
                <p>Same players on each court, new partners. Doesn't count as a game.</p>
              </div>
            )}

            {hasTeams && sittingOut.length > 0 && (
              <div className={`bench ${benchIsGuaranteed ? '' : 'bench-warn'}`}>
                <span className="bench-label">Bench · {sittingOut.length}</span>
                <p className="bench-names">{renderNames(sittingOut)}</p>
                <p className="bench-note">
                  {benchIsGuaranteed
                    ? 'First on court next game.'
                    : 'Only guaranteed next game if a court is set to a format they play.'}
                </p>
              </div>
            )}

            {!hasTeams && gameHistory.length === 0 && (
              <p className="stage-hint">
                Fill the roster and shuffle. Whoever sits out gets first call next game, so the rotation stays fair all session.
              </p>
            )}

            {gameHistory.length > 0 && (
              <details className="how-fair">
                <summary>How the rotation stays fair</summary>
                <p>
                  Players who sat out last game are picked first, then anyone who has sat out more often, then everyone else at random. Formats are hard rules: nobody is put on a court they ruled out.
                </p>
              </details>
            )}
          </section>

          {gameHistory.length > 0 && (
            <section className="game-history-panel" aria-labelledby="history-title">
              <div className="log-head">
                <h3 id="history-title">Game History</h3>
                <span className="log-count">{gameHistory.length} {gameHistory.length === 1 ? 'round' : 'rounds'}</span>
              </div>

              <ol className="log-list" reversed>
                {[...gameHistory].reverse().map((game) => (
                  <li key={`${game.gameNumber}-${game.createdAt || ''}`} className="history-game-card">
                    <span className="log-round">Game {game.gameNumber}</span>
                    <div className="log-body">
                      {(game.teams || []).map((court) => (
                        <div key={court.court} className="log-court">
                          <span className="log-court-no">C{court.court}</span>
                          <span className="log-teams">
                            <span className="log-team log-team-a">{renderTeamGroup(court.team1)}</span>
                            <span className="sr-only">versus</span>
                            <span className="log-team log-team-b">{renderTeamGroup(court.team2)}</span>
                          </span>
                        </div>
                      ))}
                      {(game.teams || []).length === 0 && game.playing.length > 0 && (
                        <p className="log-court">{renderNames(game.playing)}</p>
                      )}
                      {game.sittingOut.length > 0 && (
                        <p className="log-bench">Bench: {renderNames(game.sittingOut)}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>

              {teamGroupStats.length > 0 && (
                <div className="history-summary-card">
                  <h4>Repeat partners</h4>
                  {repeatTeamGroups.length === 0 && (
                    <p className="pair-empty">None yet. Every team so far has been a new combination.</p>
                  )}
                  <ul className="pair-list">
                    {repeatTeamGroups.map((teamGroup) => (
                      <li key={teamGroup.key} className="history-pair-row">
                        <span className="pair-names">{renderTeamGroup(teamGroup.players)}</span>
                        <span
                          className="pair-count"
                          title={`Games ${teamGroup.games.join(', ')}`}
                          aria-label={`${teamGroup.count} ${teamGroup.count === 1 ? 'game' : 'games'} together`}
                        >
                          ×{teamGroup.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>

        <footer className="session-footer">
          <h2 className="session-title">Session</h2>
          <div className="session-display">
            <span id="theme-label">Display</span>
            <div className="theme-switcher" role="group" aria-labelledby="theme-label">
              {THEME_OPTIONS.map((themeOption) => {
                const ThemeIcon = THEME_ICONS[themeOption];
  
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
                    <ThemeIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
          {gameHistory.length > 0 && (
            <div className="session-action">
              <button type="button" onClick={reset} className="text-btn">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reset rounds
              </button>
              <p>Clears game history and the rotation. Keeps the roster and courts.</p>
            </div>
          )}
          <div className="session-action">
            <button
              type="button"
              onClick={() => setIsStartOverOpen(true)}
              disabled={!isHydrated}
              className="text-btn text-btn-danger"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Start over
            </button>
            <p>Clears everything saved on this device.</p>
          </div>
        </footer>
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
                type="button"
                autoFocus
                onClick={() => setIsStartOverOpen(false)}
                className="modal-btn"
              >
                Keep session
              </button>
              <button
                type="button"
                onClick={startOver}
                className="modal-btn modal-danger"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Clear everything
              </button>
            </div>
          </section>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
