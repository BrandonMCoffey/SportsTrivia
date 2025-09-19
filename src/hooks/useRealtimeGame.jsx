import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useRealtimeGame(gameId) {
  const [loading, setLoading] = useState(true)
  const [game, setGame] = useState(null)

  useEffect(() => {
    if (!gameId) {
      setLoading(false)
      return
    }

    const fetchGame = async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()
      
      if (error) console.error('Error fetching game:', error)
      else setGame(data)
      setLoading(false)
    }

    fetchGame()

    const channel = supabase
      .channel(`realtime-game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          setGame(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  return { loading, game }
}