import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Leaderboard({ game }) {
  const [scores, setScores] = useState([])

  useEffect(() => {
    const fetchScores = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, current_game_score, current_streak')
        .eq('current_game_id', game.id)
        .order('current_game_score', { ascending: false })
        .limit(10)
      
      if (data) setScores(data)
    }
    fetchScores()
  }, [game.id])

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold text-center mb-6">Leaderboard</h2>
        <div className="text-xl text-center text-gray-600 mb-6">
          Waiting for the next question...
        </div>
        
        <div className="space-y-3">
          {scores.map((player, index) => (
            <div 
              key={player.id} 
              className="flex justify-between items-center bg-gray-100 p-4 rounded-lg"
            >
              <span className="text-lg font-bold">#{index + 1} {player.display_name}</span>
              <div className="flex items-center">
                {player.current_streak >= 3 && <span className="mr-3">🔥</span>}
                <span className="text-lg font-bold">{player.current_game_score.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}