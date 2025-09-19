import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function PostGameAwards({ game }) {
  const [mvps, setMvps] = useState({ a: null, b: null })
  
  const triviaWinner = game.team_a_trivia_score > game.team_b_trivia_score ? game.team_a_name : game.team_b_name
  
  useEffect(() => {
    const fetchMvps = async () => {
      // Get Team A MVP
      const { data: mvpA } = await supabase
        .from('profiles')
        .select('display_name, current_game_score')
        .eq('current_game_id', game.id)
        .eq('current_team', 'team_a')
        .order('current_game_score', { ascending: false })
        .limit(1)
        .single()
      
      // Get Team B MVP
      const { data: mvpB } = await supabase
        .from('profiles')
        .select('display_name, current_game_score')
        .eq('current_game_id', game.id)
        .eq('current_team', 'team_b')
        .order('current_game_score', { ascending: false })
        .limit(1)
        .single()
        
      setMvps({ a: mvpA, b: mvpB })
    }
    fetchMvps()
  }, [game.id])

  // TODO: Add social share button logic
  const handleShare = () => {
    alert(`I played in the ${game.team_a_name} vs ${game.team_b_name} trivia game! ${triviaWinner} won!`)
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <div className="bg-white p-6 rounded-lg shadow-lg text-center">
        <h2 className="text-4xl font-bold text-center mb-4">Game Over!</h2>
        <h3 className="text-2xl text-blue-600 font-semibold mb-6">
          🏆 {triviaWinner} Wins the Trivia! 🏆
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-100 p-4 rounded-lg">
            <h4 className="text-xl font-bold">{game.team_a_name}</h4>
            <div className="text-lg">Trivia MVP 🥇</div>
            <div className="text-2xl font-semibold">{mvps.a?.display_name || '...'}</div>
            <div className="text-gray-600">{mvps.a?.current_game_score.toLocaleString()} pts</div>
          </div>
          <div className="bg-gray-100 p-4 rounded-lg">
            <h4 className="text-xl font-bold">{game.team_b_name}</h4>
            <div className="text-lg">Trivia MVP 🥇</div>
            <div className="text-2xl font-semibold">{mvps.b?.display_name || '...'}</div>
            <div className="text-gray-600">{mvps.b?.current_game_score.toLocaleString()} pts</div>
          </div>
        </div>
        
        <button
          onClick={handleShare}
          className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg text-lg transition-transform hover:scale-105"
        >
          Share Your Results
        </button>
      </div>
    </div>
  )
}