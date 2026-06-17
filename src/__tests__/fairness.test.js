/**
 * Tests for fairness algorithm and team generation logic
 * Validates player selection, priority tiers, eligibility filtering, and edge cases
 */

import {
  getPlayersPerCourt,
  normalizePreferredModes,
  isPlayerEligibleForMode,
  getPlayerRoundStats,
  getTeamGroupStats
} from '../gameHelpers';

describe('Fairness Algorithm - Helper Functions', () => {
  describe('getPlayersPerCourt', () => {
    it('should return 4 players for 2v2 mode', () => {
      expect(getPlayersPerCourt('2v2')).toBe(4);
    });

    it('should return 6 players for 3v3 mode', () => {
      expect(getPlayersPerCourt('3v3')).toBe(6);
    });

    it('should return 8 players for 4v4 mode', () => {
      expect(getPlayersPerCourt('4v4')).toBe(8);
    });
  });

  describe('normalizePreferredModes', () => {
    const GAME_MODES = ['2v2', '3v3', '4v4'];

    it('should return all modes when given empty array', () => {
      expect(normalizePreferredModes([])).toEqual(GAME_MODES);
    });

    it('should return all modes when given non-array', () => {
      expect(normalizePreferredModes(null)).toEqual(GAME_MODES);
      expect(normalizePreferredModes(undefined)).toEqual(GAME_MODES);
    });

    it('should filter modes to only valid ones', () => {
      expect(normalizePreferredModes(['2v2', 'invalid'])).toEqual(['2v2']);
    });

    it('should return modes in GAME_MODES order for consistency', () => {
      // normalizePreferredModes filters using GAME_MODES order (2v2, 3v3, 4v4),
      // not input order, to ensure consistent ordering across the app
      expect(normalizePreferredModes(['4v4', '2v2'])).toEqual(['2v2', '4v4']);
    });

    it('should return all modes as fallback if no valid modes', () => {
      expect(normalizePreferredModes(['invalid1', 'invalid2'])).toEqual(GAME_MODES);
    });
  });

  describe('isPlayerEligibleForMode', () => {
    it('should return true when player has no mode restrictions', () => {
      const player = {
        id: '1',
        name: 'John',
        preferredModes: ['2v2', '3v3', '4v4']
      };
      expect(isPlayerEligibleForMode(player, '2v2')).toBe(true);
      expect(isPlayerEligibleForMode(player, '3v3')).toBe(true);
    });

    it('should return true when mode is in preferences', () => {
      const player = {
        id: '1',
        name: 'John',
        preferredModes: ['2v2', '3v3']
      };
      expect(isPlayerEligibleForMode(player, '2v2')).toBe(true);
      expect(isPlayerEligibleForMode(player, '3v3')).toBe(true);
    });

    it('should return false when mode is not in preferences', () => {
      const player = {
        id: '1',
        name: 'John',
        preferredModes: ['2v2']
      };
      expect(isPlayerEligibleForMode(player, '3v3')).toBe(false);
      expect(isPlayerEligibleForMode(player, '4v4')).toBe(false);
    });
  });

  describe('getPlayerRoundStats', () => {
    it('should return empty map for empty game history', () => {
      const stats = getPlayerRoundStats([]);
      expect(stats.size).toBe(0);
    });

    it('should track played count for playing players', () => {
      const game = {
        gameNumber: 1,
        playing: [
          { id: '1', name: 'John', preferredModes: ['2v2', '3v3', '4v4'] },
          { id: '2', name: 'Jane', preferredModes: ['2v2', '3v3', '4v4'] }
        ],
        sittingOut: [],
        teams: [],
        courtModes: ['2v2'],
        playersSnapshot: []
      };

      const stats = getPlayerRoundStats([game]);
      expect(stats.get('1').played).toBe(1);
      expect(stats.get('2').played).toBe(1);
    });

    it('should track satOut count for sitting players', () => {
      const game = {
        gameNumber: 1,
        playing: [],
        sittingOut: [
          { id: '1', name: 'John', preferredModes: ['2v2', '3v3', '4v4'] }
        ],
        teams: [],
        courtModes: ['2v2'],
        playersSnapshot: [
          { id: '1', name: 'John', preferredModes: ['2v2', '3v3', '4v4'] }
        ]
      };

      const stats = getPlayerRoundStats([game]);
      expect(stats.get('1').satOut).toBe(1);
      expect(stats.get('1').lastSatOutGame).toBe(1);
    });

    it('should track multiple games correctly', () => {
      const player1 = { id: '1', name: 'John', preferredModes: ['2v2', '3v3', '4v4'] };
      const player2 = { id: '2', name: 'Jane', preferredModes: ['2v2', '3v3', '4v4'] };

      const games = [
        {
          gameNumber: 1,
          playing: [player1],
          sittingOut: [player2],
          teams: [],
          courtModes: ['2v2'],
          playersSnapshot: [player1, player2]
        },
        {
          gameNumber: 2,
          playing: [player2],
          sittingOut: [player1],
          teams: [],
          courtModes: ['2v2'],
          playersSnapshot: [player1, player2]
        }
      ];

      const stats = getPlayerRoundStats(games);
      expect(stats.get('1').played).toBe(1);
      expect(stats.get('1').satOut).toBe(1);
      expect(stats.get('2').played).toBe(1);
      expect(stats.get('2').satOut).toBe(1);
    });

    it('should ignore ineligible players sitting out', () => {
      const eligiblePlayer = { id: '1', name: 'John', preferredModes: ['2v2'] };
      const ineligiblePlayer = { id: '2', name: 'Jane', preferredModes: ['3v3'] };

      const game = {
        gameNumber: 1,
        playing: [],
        sittingOut: [ineligiblePlayer],
        teams: [],
        courtModes: ['2v2'], // Only 2v2 is active
        playersSnapshot: [eligiblePlayer, ineligiblePlayer]
      };

      const stats = getPlayerRoundStats([game]);
      // Ineligible player should not be tracked since they can't play 2v2 anyway
      expect(stats.has('2')).toBe(false);
    });
  });

  describe('getTeamGroupStats', () => {
    it('should return empty array for empty game history', () => {
      const stats = getTeamGroupStats([]);
      expect(stats).toEqual([]);
    });

    it('should track teammate pairs', () => {
      const player1 = { id: '1', name: 'John', preferredModes: ['2v2', '3v3', '4v4'] };
      const player2 = { id: '2', name: 'Jane', preferredModes: ['2v2', '3v3', '4v4'] };

      const game = {
        gameNumber: 1,
        teams: [
          {
            court: 1,
            gameMode: '2v2',
            team1: [player1, player2],
            team2: []
          }
        ]
      };

      const stats = getTeamGroupStats([game]);
      expect(stats.length).toBe(1);
      expect(stats[0].count).toBe(1);
      expect(stats[0].players.length).toBe(2);
    });

    it('should count repeated teammate pairs', () => {
      const player1 = { id: '1', name: 'John', preferredModes: ['2v2', '3v3', '4v4'] };
      const player2 = { id: '2', name: 'Jane', preferredModes: ['2v2', '3v3', '4v4'] };

      const games = [
        {
          gameNumber: 1,
          teams: [
            {
              court: 1,
              gameMode: '2v2',
              team1: [player1, player2],
              team2: []
            }
          ]
        },
        {
          gameNumber: 2,
          teams: [
            {
              court: 1,
              gameMode: '2v2',
              team1: [player2, player1], // Different order but same pair
              team2: []
            }
          ]
        }
      ];

      const stats = getTeamGroupStats(games);
      expect(stats.length).toBe(1);
      expect(stats[0].count).toBe(2);
      expect(stats[0].games).toEqual([1, 2]);
    });

    it('should sort by frequency (most common pairs first)', () => {
      const p1 = { id: '1', name: 'Player1', preferredModes: ['2v2', '3v3', '4v4'] };
      const p2 = { id: '2', name: 'Player2', preferredModes: ['2v2', '3v3', '4v4'] };
      const p3 = { id: '3', name: 'Player3', preferredModes: ['2v2', '3v3', '4v4'] };

      const games = [
        {
          gameNumber: 1,
          teams: [
            { court: 1, gameMode: '2v2', team1: [p1, p2], team2: [] }
          ]
        },
        {
          gameNumber: 2,
          teams: [
            { court: 1, gameMode: '2v2', team1: [p1, p2], team2: [] }
          ]
        },
        {
          gameNumber: 3,
          teams: [
            { court: 1, gameMode: '2v2', team1: [p1, p3], team2: [] }
          ]
        }
      ];

      const stats = getTeamGroupStats(games);
      expect(stats[0].count).toBe(2); // p1+p2 appears twice
      expect(stats[1].count).toBe(1); // p1+p3 appears once
    });
  });
});
