import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useRealtimeGameList() {
  const [loading, setLoading] = useState(true)
  const [games, setGames] = useState([])

  const fetchGames = async () => {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('is_live', true)
    
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
        (payload) => {
          fetchGames()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { loading, games }
}