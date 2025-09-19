import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function GamePanel({ game, onClose, onPlay }) {
  const [liveScore, setLiveScore] = useState({
    a: game.real_score_a,
    b: game.real_score_b,
  })

  useEffect(() => {
    const channel = supabase
      .channel(`game-panel-${game.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${game.id}`,
        },
        (payload) => {
          setLiveScore({
            a: payload.new.real_score_a,
            b: payload.new.real_score_b,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [game.id])

  // Handle "where to watch" links, which are a JSON object
  const watchLinks = game.watch_links ? Object.entries(game.watch_links) : []

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-2xl font-bold text-gray-500 hover:text-gray-800"
        >
          &times;
        </button>

        <h2 className="text-2xl font-bold mb-2">{game.sport}: {game.team_a_name} vs. {game.team_b_name}</h2>
        
        <div className="text-center my-4">
          <span className="text-5xl font-bold">
            {liveScore.a} - {liveScore.b}
          </span>
          <div className="text-sm text-gray-600">Live Score</div>
        </div>
        
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Where to Watch:</h3>
          {watchLinks.length > 0 ? (
            <div className="flex flex-col space-y-2">
              {watchLinks.map(([region, link]) => (
                <a
                  key={region}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Watch in {region}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No watch links available.</p>
          )}
        </div>
        
        <button
          onClick={onPlay}
          className="w-full bg-green-500 text-white font-bold py-3 rounded-lg text-lg transition-transform hover:scale-105"
        >
          Play Trivia
        </button>
      </div>
    </div>
  )
}