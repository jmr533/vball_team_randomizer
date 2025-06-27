import React, { useState } from 'react';
import { Shuffle, Users, Plus, Minus, Trash2, RotateCcw } from 'lucide-react';

function App() {
  const [players, setPlayers] = useState(['']);
  const [courts, setCourts] = useState(1);
  const [teams, setTeams] = useState([]);
  const [sittingOut, setSittingOut] = useState([]);

  const addPlayer = () => {
    setPlayers([...players, '']);
  };

  const removePlayer = (index) => {
    setPlayers(players.filter((_, i) => i !== index));
  };

  const updatePlayer = (index, name) => {
    const newPlayers = [...players];
    newPlayers[index] = name;
    setPlayers(newPlayers);
  };

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const generateTeams = () => {
    const validPlayers = players.filter(p => p.trim() !== '');
    
    if (validPlayers.length < 4) {
      alert('Need at least 4 players to form teams!');
      return;
    }

    const shuffledPlayers = shuffleArray(validPlayers);
    const playersPerCourt = 4;
    const maxPlayingPlayers = courts * playersPerCourt;
    
    const playingPlayers = shuffledPlayers.slice(0, maxPlayingPlayers);
    const sitting = shuffledPlayers.slice(maxPlayingPlayers);

    const newTeams = [];
    for (let court = 0; court < courts; court++) {
      const startIndex = court * playersPerCourt;
      const courtPlayers = playingPlayers.slice(startIndex, startIndex + playersPerCourt);
      
      if (courtPlayers.length === 4) {
        newTeams.push({
          court: court + 1,
          team1: [courtPlayers[0], courtPlayers[1]],
          team2: [courtPlayers[2], courtPlayers[3]]
        });
      }
    }

    setTeams(newTeams);
    setSittingOut(sitting);
  };

  const reset = () => {
    setTeams([]);
    setSittingOut([]);
  };

  const totalPlayers = players.filter(p => p.trim() !== '').length;
  const maxCourts = Math.floor(totalPlayers / 4);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-yellow-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2 flex items-center justify-center gap-2">
            <Users className="w-8 h-8" />
            Beach Volleyball Team Randomizer
          </h1>
          <p className="text-gray-600">Fair and random 2v2 team selection for multiple courts</p>
        </div>

        {/* Player Input Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Add Players</h2>
          <div className="space-y-3">
            {players.map((player, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  placeholder={`Player ${index + 1} name`}
                  value={player}
                  onChange={(e) => updatePlayer(index, e.target.value)}
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
            {maxCourts === 0 && totalPlayers > 0 && " (need at least 4 players)"}
          </p>
        </div>

        {/* Generate Teams Button */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={generateTeams}
            disabled={totalPlayers < 4}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-lg font-semibold"
          >
            <Shuffle className="w-5 h-5" />
            Generate Random Teams
          </button>
          {teams.length > 0 && (
            <button
              onClick={reset}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
          )}
        </div>

        {/* Teams Display */}
        {teams.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center text-green-700 mb-6">
              🏐 Teams Generated! 🏐
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
                  These players will rotate in next round or when someone needs a break!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;