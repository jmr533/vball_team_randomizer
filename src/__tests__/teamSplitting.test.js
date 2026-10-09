/**
 * Tests for splitting a court's players into teams without repeating partners
 */

import { splitCourtIntoTeams } from '../gameHelpers';

const makePlayers = (...names) => names.map((name) => ({ id: name, name, preferredModes: ['2v2', '3v3', '4v4'] }));

const makeGame = (gameNumber, team1, team2) => ({
  gameNumber,
  courts: 1,
  courtModes: [`${team1.length}v${team2.length}`],
  playing: [...team1, ...team2],
  sittingOut: [],
  teams: [{ court: 1, gameMode: `${team1.length}v${team2.length}`, team1, team2 }]
});

const ids = (team) => team.map((player) => player.id).sort();

const areTeammates = ({ team1, team2 }, nameA, nameB) => [team1, team2].some((team) => (
  team.some((player) => player.id === nameA) && team.some((player) => player.id === nameB)
));

// Deterministic PRNG so failures are reproducible.
const seededRandom = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe('splitCourtIntoTeams', () => {
  const [jon, steph, matt, luke] = makePlayers('Jon', 'Steph', 'Matt', 'Luke');
  const court = [jon, steph, matt, luke];

  it('never repeats last game\'s partners when another split exists', () => {
    const history = [makeGame(1, [jon, steph], [matt, luke])];
    const random = seededRandom(1);

    for (let run = 0; run < 200; run++) {
      const teams = splitCourtIntoTeams({ players: court, gameHistory: history, random });
      expect(areTeammates(teams, 'Jon', 'Steph')).toBe(false);
      expect(areTeammates(teams, 'Matt', 'Luke')).toBe(false);
    }
  });

  it('prevents the reported Game 2 → Game 3 repeat', () => {
    const history = [
      makeGame(1, [matt, steph], [luke, jon]),
      makeGame(2, [matt, luke], [jon, steph])
    ];
    const random = seededRandom(2);

    for (let run = 0; run < 200; run++) {
      const teams = splitCourtIntoTeams({ players: court, gameHistory: history, random });
      // The only fresh split left: Jon + Matt v Steph + Luke.
      expect(areTeammates(teams, 'Jon', 'Matt')).toBe(true);
      expect(areTeammates(teams, 'Steph', 'Luke')).toBe(true);
    }
  });

  it('rotates every partner evenly over a long doubles session', () => {
    const history = [];
    const random = seededRandom(3);

    for (let gameNumber = 1; gameNumber <= 30; gameNumber++) {
      const { team1, team2 } = splitCourtIntoTeams({ players: court, gameHistory: history, random });
      history.push(makeGame(gameNumber, team1, team2));
    }

    const pairCounts = {};
    history.forEach(({ teams }) => {
      [teams[0].team1, teams[0].team2].forEach((team) => {
        const key = ids(team).join('+');
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      });
    });

    // 4 players have 6 possible pairs; each should be partnered exactly 10 times in 30 games.
    expect(Object.keys(pairCounts)).toHaveLength(6);
    Object.values(pairCounts).forEach((count) => expect(count).toBe(10));
  });

  it('still picks at random when there is no history', () => {
    const random = seededRandom(4);
    const seenSplits = new Set();

    for (let run = 0; run < 100; run++) {
      const { team1, team2 } = splitCourtIntoTeams({ players: court, gameHistory: [], random });
      seenSplits.add([ids(team1).join('+'), ids(team2).join('+')].sort().join(' v '));
    }

    expect(seenSplits.size).toBe(3);
  });

  it('splits 4v4 into two full teams using every player once', () => {
    const players = makePlayers('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H');
    const history = [makeGame(1, players.slice(0, 4), players.slice(4))];
    const { team1, team2 } = splitCourtIntoTeams({ players, gameHistory: history, random: seededRandom(5) });

    expect(team1).toHaveLength(4);
    expect(team2).toHaveLength(4);
    expect([...ids(team1), ...ids(team2)].sort()).toEqual(ids(players));
  });

  it('accepts a repeat only when no fresh split is possible', () => {
    // Partners can't all be fresh in 3v3 after a game with the same six players,
    // but no pair from last game should share a team if avoidable.
    const players = makePlayers('A', 'B', 'C', 'D', 'E', 'F');
    const history = [makeGame(1, players.slice(0, 3), players.slice(3))];
    const random = seededRandom(6);

    for (let run = 0; run < 50; run++) {
      const { team1, team2 } = splitCourtIntoTeams({ players, gameHistory: history, random });
      const lastGameRepeats = [team1, team2].reduce((total, team) => {
        const fromTeamA = team.filter((player) => ['A', 'B', 'C'].includes(player.id)).length;
        const fromTeamB = team.length - fromTeamA;
        return total + (fromTeamA * (fromTeamA - 1)) / 2 + (fromTeamB * (fromTeamB - 1)) / 2;
      }, 0);

      // Best possible is a 2/1 mix on each side: exactly two repeated pairs.
      expect(lastGameRepeats).toBe(2);
    }
  });
});
