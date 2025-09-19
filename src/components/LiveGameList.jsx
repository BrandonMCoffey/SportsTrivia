import React, { useState } from 'react'
import { useRealtimeGameList } from '../hooks/useRealtimeGameList'
import GamePanel from './GamePanel'
import GameLobby from './GameLobby'
import Header from './Header'

export default function LiveGameList({ session, onGameJoined }) {
  const { loading, games } = useRealtimeGameList() 
  
  const [selectedGame, setSelectedGame] = useState(null)
  const [view, setView] = useState('list')

  const handleGameClick = (game) => {
    setSelectedGame(game)
  }

  const handlePanelClose = () => {
    setSelectedGame(null)
  }

  const handlePanelPlay = () => {
    setView('lobby')
  }

  const handleLobbyJoin = (gameId) => {
    onGameJoined(gameId)
  }

  if (view === 'lobby') {
    return <GameLobby game={selectedGame} onGameJoined={handleLobbyJoin} />
  }

  return (
    <div>
      <Header session={session} />

      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-6">Live Trivia Games</h1>
        {loading && <div className="text-center">Loading live games...</div>}

        {!loading && games.length === 0 && (
          <div className="text-center text-gray-500">
            No live games right now. Check back soon!
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => handleGameClick(game)}
              className="bg-gray-800 p-4 rounded-lg shadow-lg text-white transition-transform hover:scale-105"
            >
              <div className="flex justify-between items-center">
                <img src={game.team_a_logo} alt={game.team_a_name} className="h-16 w-16 object-contain" />
                <div className="text-center">
                  <span className="text-3xl font-bold">
                    {game.real_score_a} - {game.real_score_b}
                  </span>
                  <div className="text-sm">{game.sport}</div>
                </div>
                <img src={game.team_b_logo} alt={game.team_b_name} className="h-16 w-16 object-contain" />
              </div>
              <div className="mt-3 font-semibold">
                {game.team_a_name} vs. {game.team_b_name}
              </div>
            </button>
          ))}
        </div>

        {selectedGame && (
          <GamePanel
            game={selectedGame}
            onClose={handlePanelClose}
            onPlay={handlePanelPlay}
          />
        )}
      </div>
    </div>
  )
}