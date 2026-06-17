/**
 * Persistence Service
 * 
 * Handles all database operations for saving/loading game history
 * Provides a clean abstraction over API calls with consistent error handling
 * Makes the app resilient to database failures - games still work locally
 */

/**
 * Load game history from the database
 * @param {string} sessionId - Unique session identifier
 * @returns {Promise<Object>} Object with games array and persistence status
 */
export async function loadGames(sessionId) {
  if (!sessionId) {
    return { games: [], persistence: 'disabled' };
  }

  try {
    const response = await fetch(`/api/games?sessionId=${encodeURIComponent(sessionId)}`);

    if (!response.ok) {
      return { games: [], persistence: 'unavailable' };
    }

    const data = await response.json();
    const games = Array.isArray(data.games) ? data.games : [];
    const persistence = data.persistence || 'unknown';

    return { games, persistence };
  } catch (error) {
    console.error('Failed to load games:', error);
    return { games: [], persistence: 'error' };
  }
}

/**
 * Save a single game to the database
 * @param {string} sessionId - Unique session identifier
 * @param {Object} game - Game object to save
 * @returns {Promise<Object>} Object with success status and persistence info
 */
export async function saveGame(sessionId, game) {
  if (!sessionId) {
    return { success: false, persistence: 'disabled' };
  }

  try {
    const response = await fetch('/api/games', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId,
        game
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn('Failed to save game to database:', response.statusText);
      return {
        success: true, // Still saved locally
        persistence: 'unavailable'
      };
    }

    return {
      success: true,
      persistence: data.persistence || 'unknown'
    };
  } catch (error) {
    console.error('Error saving game:', error);
    return {
      success: true, // Still saved locally
      persistence: 'error'
    };
  }
}

/**
 * Delete all games from the database for a session
 * @param {string} sessionId - Unique session identifier
 * @returns {Promise<Object>} Object with success status and persistence info
 */
export async function deleteGames(sessionId) {
  if (!sessionId) {
    return { success: true, persistence: 'disabled' };
  }

  try {
    const response = await fetch(`/api/games?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'DELETE'
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn('Failed to delete games from database:', response.statusText);
      return {
        success: true, // Still cleared locally
        persistence: 'unavailable'
      };
    }

    return {
      success: true,
      persistence: data.persistence || 'unknown'
    };
  } catch (error) {
    console.error('Error deleting games:', error);
    return {
      success: true, // Still cleared locally
      persistence: 'error'
    };
  }
}

/**
 * Get user-friendly persistence status message
 * @param {string} status - Persistence status: 'enabled', 'unavailable', 'error', 'disabled'
 * @param {string} context - Context for the message: 'loading', 'saving', 'saved', 'reset'
 * @returns {string} User-friendly message or empty string
 */
export function getPersistenceMessage(status, context) {
  if (status === 'disabled') {
    return '';
  }

  const messages = {
    loading: {
      unavailable: 'Saved history not available',
      error: 'Connection error loading history',
      enabled: 'Saved history loaded'
    },
    saving: {
      unavailable: 'Saving locally (database unavailable)',
      error: 'Saving locally (connection error)',
      enabled: 'Game saved to database'
    },
    saved: {
      unavailable: 'Game saved locally only',
      error: 'Game saved locally',
      enabled: 'Game saved'
    },
    reset: {
      unavailable: 'History cleared locally',
      error: 'History cleared locally',
      enabled: 'History cleared'
    }
  };

  return messages[context]?.[status] || '';
}
