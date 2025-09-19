import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Auth as SupabaseAuth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

// A simple Auth modal sub-component
function AuthModal() {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold text-center mb-4">Join the Game</h2>
        <p className="text-center text-gray-600 mb-6">Sign in to play trivia and pick your team!</p>
        <SupabaseAuth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']}
          theme="dark"
        />
      </div>
    </div>
  )
}

export default function GameLobby({ game }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [playerCounts, setPlayerCounts] = useState({
    a: game.team_a_player_count,
    b: game.team_b_player_count,
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

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
        gameId: game.id,
        team: team,
      })
      if (error) throw error
      
      // TODO: Navigate to the main trivia game screen
      alert(`You have joined ${team}! The trivia game will start soon.`)
      
    } catch (error) {
      console.error('Error joining team:', error.message)
    }
  }

  if (loading) {
    return <div className="text-center p-12">Loading...</div>
  }

  if (!session) {
    return <AuthModal />
  }

  return (
    <div className="flex h-screen w-full">
      <div className="w-1/2 bg-blue-700 text-white flex flex-col items-center justify-center p-8 text-center">
        <img src={game.team_a_logo} alt={game.team_a_name} className="h-32 lg:h-48 mb-6" />
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

      <div className="w-1/2 bg-gray-200 text-black flex flex-col items-center justify-center p-8 text-center">
        <img src={game.team_b_logo} alt={game.team_b_name} className="h-32 lg:h-48 mb-6" />
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