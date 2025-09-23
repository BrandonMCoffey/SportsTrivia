import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function GameLobby({ game, onGameJoined }) {
  const [playerCounts, setPlayerCounts] = useState({
    a: game.team_a_player_count,
    b: game.team_b_player_count,
  })

  useEffect(() => {
    const channel = supabase
      .channel(`game-lobby-${game.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${game.id}`,
        },
        (payload) => {
          setPlayerCounts({
            a: payload.new.team_a_player_count,
            b: payload.new.team_b_player_count,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [game.id])

  const handleJoin = async (team) => {
    try {
      const { error } = await supabase.functions.invoke('join-team', {
        body: {
          gameId: game.id,
          team: team,
        }
      })
      if (error) throw error

      onGameJoined(game.id)

    } catch (error) {
      console.error('Error joining team:', error.message)
      alert(`Error joining team: ${error.message}`)
    }
  }

  return (
    <div className="flex h-screen w-full">
      {/* Team A Side */}
      <div className="w-1/2 bg-blue-700 text-white flex flex-col items-center justify-center p-8 text-center">
        <img src={game.team_a_logo} alt={game.team_a_name} className="h-32 lg:h-48 mb-6 object-contain" />
        <h2 className="text-3xl lg:text-5xl font-bold mb-4">{game.team_a_name}</h2>
        <button
          onClick={() => handleJoin('team_a')}
          className="bg-white text-blue-700 font-bold py-3 px-8 rounded-lg text-lg transition-transform hover:scale-105"
        >
          Join Team
        </button>
        <div className="mt-4 text-xl font-semibold">
          🔥 {playerCounts.a.toLocaleString()} Fans on this team
        </div>
      </div>

      {/* Team B Side */}
      <div className="w-1/2 bg-gray-200 text-black flex flex-col items-center justify-center p-8 text-center">
        <img src={game.team_b_logo} alt={game.team_b_name} className="h-32 lg:h-48 mb-6 object-contain" />
        <h2 className="text-3xl lg:text-5xl font-bold mb-4">{game.team_b_name}</h2>
        <button
          onClick={() => handleJoin('team_b')}
          className="bg-black text-white font-bold py-3 px-8 rounded-lg text-lg transition-transform hover:scale-105"
        >
          Join Team
        </button>
        <div className="mt-4 text-xl font-semibold">
          🔥 {playerCounts.b.toLocaleString()} Fans on this team
        </div>
      </div>
    </div>
  )
}