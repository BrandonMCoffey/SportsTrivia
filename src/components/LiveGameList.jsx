import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import GamePanel from './GamePanel'
import GameLobby from './GameLobby'
import Header from './Header'

function useRealtimeGameList() {
  const [loading, setLoading] = useState(true)
  const [games, setGames] = useState([])

  const fetchGames = async () => {
    const now = new Date()
    const soon = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString()
    const recent = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .or(
        `status.eq.Live,` +
        `and(status.eq.Upcoming,start_time.lte.${soon},start_time.gte.${now.toISOString()}),` +
        `and(status.eq.Completed,start_time.gte.${recent})`
      )
    
    if (error) console.error('Error fetching games:', error)
    else setGames(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchGames()
    const channel = supabase
      .channel('live-games-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        (payload) => fetchGames()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { loading, games }
}

function formatGameTime(startTimeStr) {
  const date = new Date(startTimeStr)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function GameCard({ game, onClick }) {
  const now = new Date()
  const startTime = new Date(game.start_time)
  const minutesUntilStart = (startTime.getTime() - now.getTime()) / 60000

  const isJoinable = (game.status === 'Live') || (game.status === 'Upcoming' && minutesUntilStart <= 30)

  let cardStyles = "bg-gray-800 transition-transform hover:scale-105"
  let timeLabel = `Starts: ${formatGameTime(game.start_time)}`

  if (game.status === 'Live') {
    cardStyles = "bg-red-700 animate-pulse transition-transform hover:scale-105"
    timeLabel = "LIVE NOW"
  } else if (game.status === 'Completed') {
    cardStyles = "bg-gray-600 opacity-70"
    timeLabel = `Completed: ${formatGameTime(game.start_time)}`
  } else if (isJoinable) {
    cardStyles = "bg-green-600 transition-transform hover:scale-105"
    timeLabel = `Starts in ${Math.round(minutesUntilStart)} mins!`
  } else {
    cardStyles = "bg-gray-800 opacity-60 cursor-not-allowed"
  }

  return (
    <button
      onClick={() => onClick(game)}
      disabled={!isJoinable}
      className={`${cardStyles} p-4 rounded-lg shadow-lg text-white`}
    >
      <div className="flex justify-between items-center">
        <img src={game.team_a_logo} alt={game.team_a_name} className="h-16 w-16 object-contain" />
        <div className="text-center">
          <span className="text-3xl font-bold">
            {game.real_score_a} - {game.real_score_b}
          </span>
          <div className="text-sm font-semibold text-yellow-300">{timeLabel}</div>
        </div>
        <img src={game.team_b_logo} alt={game.team_b_name} className="h-16 w-16 object-contain" />
      </div>
      <div className="mt-3 font-semibold">
        {game.team_a_name} vs. {game.team_b_name}
      </div>
    </button>
  )
}

export default function LiveGameList({ session, onGameJoined }) {
  const { loading, games } = useRealtimeGameList() 
  const [selectedGame, setSelectedGame] = useState(null)
  const [view, setView] = useState('list') 

  const liveGames = games
    .filter(g => g.status === 'Live')
  
  const upcomingGames = games
    .filter(g => g.status === 'Upcoming')
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    
  const completedGames = games
    .filter(g => g.status === 'Completed')
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))

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
        {loading && <div className="text-center">Loading live games...</div>}
        {!loading && games.length === 0 && (
          <div className="text-center text-gray-500">
            No games on the schedule. Check back soon!
          </div>
        )}

        {liveGames.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Live Now</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveGames.map((game) => (
                <GameCard key={game.id} game={game} onClick={handleGameClick} />
              ))}
            </div>
          </section>
        )}

        {upcomingGames.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Starting Soon</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingGames.map((game) => (
                <GameCard key={game.id} game={game} onClick={handleGameClick} />
              ))}
            </div>
          </section>
        )}

        {completedGames.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Recently Completed</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedGames.map((game) => (
                <GameCard key={game.id} game={game} onClick={handleGameClick} />
              ))}
            </div>
          </section>
        )}
      </div>

      {selectedGame && (
        <GamePanel
          game={selectedGame}
          onClose={handlePanelClose}
          onPlay={handlePanelPlay}
        />
      )}
    </div>
  )
}