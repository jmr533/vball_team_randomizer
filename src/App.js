import React, { useState, useRef, useEffect } from 'react';
import { Shuffle, Users, Plus, Minus, Trash2, RotateCcw } from 'lucide-react';

export default function VolleyballTeamRandomizer() {
  const [players, setPlayers] = useState(['']);
  const [courts, setCourts] = useState(1);
  const [teams, setTeams] = useState([]);
  const [sittingOut, setSittingOut] = useState([]);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [gameMode, setGameMode] = useState('2v2');
  const inputRefs = useRef([]);
  const [shouldFocusLast, setShouldFocusLast] = useState(false);

  const addPlayer = () => {
    setPlayers([...players, '']);
    setShouldFocusLast(true);
  };

  const removePlayer = (index) => {
    setPlayers(players.filter((_, i) => i !== index));
  };

  const updatePlayer = (index, name) => {
    const newPlayers = [...players];
    newPlayers[index] = name;
    setPlayers(newPlayers);
  };

  const handlePlayerKeyPress = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If this is the last input and it has content, add a new player
      if (index === players.length - 1 && e.target.value.trim() !== '') {
        addPlayer();
      }
    }
  };

  // Focus on the last input when a new player is added
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

  const getPlayersPerCourt = (mode) => {
    return mode === '2v2' ? 4 : mode === '3v3' ? 6 : 8;
  };

  const handleGameModeChange = (newMode) => {
    // Reset current game state when changing modes
    if (teams.length > 0) {
      setTeams([]);
      setSittingOut([]);
      setWaitingQueue([]);
      setGameHistory([]);
    }
    setGameMode(newMode);
    
    // Adjust courts if current number exceeds new maximum
    const newPlayersPerCourt = getPlayersPerCourt(newMode);
    const newMaxCourts = Math.floor(totalPlayers / newPlayersPerCourt);
    if (courts > newMaxCourts) {
      setCourts(Math.max(1, newMaxCourts));
    }
  };

  const generateTeams = () => {
    const validPlayers = players.filter(p => p.trim() !== '');
    
    const playersPerCourt = getPlayersPerCourt(gameMode);
    const minPlayers = playersPerCourt;
    
    if (validPlayers.length < minPlayers) {
      alert(`Need at least ${minPlayers} players to form teams for ${gameMode} mode!`);
      return;
    }
    const totalSpotsAvailable = courts * playersPerCourt;
    
    // Get the most recent game's sitting players (they have priority after guaranteed queue)
    const lastGameSitting = gameHistory.length > 0 ? gameHistory[gameHistory.length - 1].sittingOut : [];
    
    // Start with players who were sitting out (guaranteed to play)
    let priorityPlayers = [...waitingQueue];
    
    // If we need more players after guaranteed queue, prioritize those who sat out last game
    let secondPriorityPlayers = lastGameSitting.filter(p => !waitingQueue.includes(p) && validPlayers.includes(p));
    
    // Add remaining players who haven't sat out recently
    const otherPlayers = validPlayers.filter(p => 
      !waitingQueue.includes(p) && 
      !lastGameSitting.includes(p)
    );
    
    // Build the playing order with fairness priority
    let allPlayersOrdered = [];
    
    // If we have more guaranteed players than total spots, shuffle just them
    if (priorityPlayers.length >= totalSpotsAvailable) {
      allPlayersOrdered = shuffleArray(priorityPlayers);
    } else {
      // Add guaranteed players first
      allPlayersOrdered = [...priorityPlayers];
      
      const remainingSpots = totalSpotsAvailable - priorityPlayers.length;
      
      // If we need more players, prioritize recent sitters
      if (secondPriorityPlayers.length >= remainingSpots) {
        // Enough recent sitters to fill remaining spots
        allPlayersOrdered = [...priorityPlayers, ...shuffleArray(secondPriorityPlayers)];
      } else {
        // Need some recent sitters + some others
        const shuffledOthers = shuffleArray(otherPlayers);
        allPlayersOrdered = [...priorityPlayers, ...shuffleArray(secondPriorityPlayers), ...shuffledOthers];
      }
    }
    
    const playingPlayers = allPlayersOrdered.slice(0, totalSpotsAvailable);
    const newSittingOut = allPlayersOrdered.slice(totalSpotsAvailable);

    // Create teams
    const newTeams = [];
    for (let court = 0; court < courts; court++) {
      const startIndex = court * playersPerCourt;
      const courtPlayers = playingPlayers.slice(startIndex, startIndex + playersPerCourt);
      
      if (courtPlayers.length === playersPerCourt) {
        // Shuffle the players for this court to randomize team assignments
        const shuffledCourtPlayers = shuffleArray(courtPlayers);
        const teamSize = playersPerCourt / 2;
        newTeams.push({
          court: court + 1,
          team1: shuffledCourtPlayers.slice(0, teamSize),
          team2: shuffledCourtPlayers.slice(teamSize)
        });
      }
    }

    setTeams(newTeams);
    setSittingOut(newSittingOut);
    setWaitingQueue(newSittingOut); // Update queue for next round
    
    // Add to game history
    setGameHistory(prev => [...prev, {
      gameNumber: prev.length + 1,
      playing: playingPlayers,
      sittingOut: newSittingOut,
      teams: newTeams
    }]);
  };

  const reset = () => {
    setTeams([]);
    setSittingOut([]);
    setWaitingQueue([]);
    setGameHistory([]);
  };

  const totalPlayers = players.filter(p => p.trim() !== '').length;
  const playersPerCourt = getPlayersPerCourt(gameMode);
  const maxCourts = Math.floor(totalPlayers / playersPerCourt);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-yellow-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2 flex items-center justify-center gap-2">
            <Users className="w-8 h-8" />
            Beach Volleyball Team Randomizer
          </h1>
          <p className="text-gray-600">Fair and random {gameMode} team selection for multiple courts</p>
        </div>

        {/* Game Mode Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Game Mode</h2>
          <div className="flex gap-2 justify-center">
            {['2v2', '3v3', '4v4'].map((mode) => (
              <button
                key={mode}
                onClick={() => handleGameModeChange(mode)}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  gameMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-2 text-center">
            {gameMode === '2v2' && 'Teams of 2 players each (4 per court)'}
            {gameMode === '3v3' && 'Teams of 3 players each (6 per court)'}
            {gameMode === '4v4' && 'Teams of 4 players each (8 per court)'}
          </p>
        </div>

        {/* Player Input Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Add Players</h2>
          <div className="space-y-3">
            {players.map((player, index) => (
              <div key={index} className="flex gap-2">
                <input
                  ref={(el) => inputRefs.current[index] = el}
                  type="text"
                  placeholder={`Player ${index + 1} name`}
                  value={player}
                  onChange={(e) => updatePlayer(index, e.target.value)}
                  onKeyPress={(e) => handlePlayerKeyPress(e, index)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {players.length > 1 && (
                  <button
                    onClick={() => removePlayer(index)}
                    className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addPlayer}
            className="mt-3 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Player
          </button>
          <p className="text-sm text-gray-500 mt-2">Total players: {totalPlayers}</p>
        </div>

        {/* Court Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Number of Courts</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCourts(Math.max(1, courts - 1))}
              disabled={courts <= 1}
              className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-2xl font-bold text-blue-900 min-w-[3rem] text-center">{courts}</span>
            <button
              onClick={() => setCourts(Math.min(maxCourts, courts + 1))}
              disabled={courts >= maxCourts || maxCourts === 0}
              className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Max courts with current players: {maxCourts} 
            {maxCourts === 0 && totalPlayers > 0 && ` (need at least ${playersPerCourt} players for ${gameMode})`}
          </p>
        </div>

        {/* Generate Teams Button */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={generateTeams}
            disabled={totalPlayers < playersPerCourt}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-lg font-semibold"
          >
            <Shuffle className="w-5 h-5" />
            {gameHistory.length === 0 ? 'Generate Random Teams' : `Generate Game ${gameHistory.length + 1}`}
          </button>
          {teams.length > 0 && (
            <button
              onClick={reset}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Reset All
            </button>
          )}
        </div>

        {/* Waiting Queue Display */}
        {waitingQueue.length > 0 && teams.length === 0 && (
          <div className="mb-8 bg-blue-100 p-4 rounded-lg border-2 border-blue-300">
            <h3 className="font-bold text-blue-800 mb-2">🎯 Guaranteed Next Game</h3>
            <div className="flex flex-wrap gap-2">
              {waitingQueue.map((player, idx) => (
                <span key={idx} className="bg-blue-200 px-3 py-1 rounded-full text-blue-800 font-medium">
                  {player}
                </span>
              ))}
            </div>
            <p className="text-sm text-blue-700 mt-2">
              These players sat out last game and will be prioritized for the next game!
            </p>
          </div>
        )}

        {/* Recent Sitters Info */}
        {gameHistory.length > 0 && teams.length === 0 && (
          <div className="mb-8 bg-green-100 p-4 rounded-lg border-2 border-green-300">
            <h3 className="font-bold text-green-800 mb-2">📊 Fair Rotation System Active</h3>
            <p className="text-sm text-green-700">
              Priority order: <strong>1st)</strong> Players who sat out last game{' '}
              <strong>2nd)</strong> Players who sat out before that{' '}
              <strong>3rd)</strong> Everyone else randomly
            </p>
            <p className="text-xs text-green-600 mt-1">
              This minimizes total sitting time and ensures maximum fairness!
            </p>
          </div>
        )}

        {/* Teams Display */}
        {teams.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center text-green-700 mb-6">
              🏐 Game {gameHistory.length} Teams! 🏐
            </h2>
            
            <div className="grid gap-6 md:grid-cols-2">
              {teams.map((court) => (
                <div key={court.court} className="bg-gradient-to-br from-blue-100 to-blue-200 p-6 rounded-lg border-2 border-blue-300">
                  <h3 className="text-xl font-bold text-center mb-4 text-blue-800">
                    Court {court.court}
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <h4 className="font-semibold text-blue-700 mb-2">Team A</h4>
                      <div className="flex flex-col gap-1">
                        {court.team1.map((player, idx) => (
                          <span key={idx} className="text-gray-800 font-medium">{player}</span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="text-center text-2xl font-bold text-blue-600">VS</div>
                    
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <h4 className="font-semibold text-blue-700 mb-2">Team B</h4>
                      <div className="flex flex-col gap-1">
                        {court.team2.map((player, idx) => (
                          <span key={idx} className="text-gray-800 font-medium">{player}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {sittingOut.length > 0 && (
              <div className="bg-yellow-100 p-6 rounded-lg border-2 border-yellow-300">
                <h3 className="text-lg font-bold text-yellow-800 mb-3">Sitting Out This Round</h3>
                <div className="flex flex-wrap gap-2">
                  {sittingOut.map((player, idx) => (
                    <span key={idx} className="bg-yellow-200 px-3 py-1 rounded-full text-yellow-800 font-medium">
                      {player}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-yellow-700 mt-2">
                  ✅ <strong>Guaranteed to play next game!</strong> They'll be prioritized when you generate the next round.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Game History */}
        {gameHistory.length > 0 && (
          <div className="mt-8 bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Game History</h3>
            <div className="space-y-3">
              {gameHistory.map((game, idx) => (
                <div key={idx} className="bg-white p-4 rounded border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-700">Game {game.gameNumber}</span>
                    <span className="text-sm text-gray-500">
                      {game.playing.length} playing, {game.sittingOut.length} sitting out
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-green-700">Playing: </span>
                      <span className="text-gray-700">{game.playing.join(', ')}</span>
                    </div>
                    
                    {game.sittingOut.length > 0 && (
                      <div>
                        <span className="font-medium text-orange-700">Sat out: </span>
                        <span className="text-gray-600">{game.sittingOut.join(', ')}</span>
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