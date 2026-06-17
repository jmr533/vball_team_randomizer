import { useState, useCallback, useEffect } from 'react';
import { loadGames, saveGame, deleteGames } from '../services/persistenceService';

/**
 * Custom hook for managing game persistence
 * Handles loading, saving, and deleting games with proper state management
 * 
 * @returns {Object} Object containing:
 *   - status: Current persistence status (idle, loading, saving, saved, unavailable)
 *   - games: Loaded games array
 *   - load: Function to load games for a session
 *   - save: Function to save a game
 *   - delete: Function to delete all games for a session
 */
export function usePersistence() {
  const [status, setStatus] = useState('idle');
  const [games, setGames] = useState([]);

  /**
   * Load all games for a session from database
   * @param {string} sessionId - Session identifier
   */
  const load = useCallback(async (sessionId) => {
    if (!sessionId) {
      setStatus('unavailable');
      return;
    }

    setStatus('loading');
    const result = await loadGames(sessionId);
    setGames(result.games);
    setStatus(result.persistence);
  }, []);

  /**
   * Save a single game to database
   * @param {string} sessionId - Session identifier
   * @param {Object} game - Game object to save
   */
  const save = useCallback(async (sessionId, game) => {
    if (!sessionId) {
      return;
    }

    setStatus('saving');
    const result = await saveGame(sessionId, game);
    setStatus(result.persistence);
  }, []);

  /**
   * Delete all games for a session
   * @param {string} sessionId - Session identifier
   */
  const deleteSession = useCallback(async (sessionId) => {
    if (!sessionId) {
      return;
    }

    setStatus('deleting');
    const result = await deleteGames(sessionId);
    setGames([]);
    setStatus(result.persistence);
  }, []);

  return {
    status,
    games,
    setGames,
    load,
    save,
    delete: deleteSession
  };
}
