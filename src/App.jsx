import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import LoginScreen from './components/LoginScreen'
import LiveGameList from './components/LiveGameList'
import TriviaDisplay from './components/TriviaDisplay'

function App() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [currentGameId, setCurrentGameId] = useState(null)

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

  const handleGameJoined = (gameId) => {
    setCurrentGameId(gameId)
  }

  const handleExitGame = () => {
    setCurrentGameId(null)
  }
  
  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {!session ? (
        <LoginScreen />
      ) : !currentGameId ? (
        <LiveGameList session={session} onGameJoined={handleGameJoined} />
      ) : (
        <TriviaDisplay gameId={currentGameId} onExit={handleExitGame} />
      )}
    </div>
  )
}

export default App