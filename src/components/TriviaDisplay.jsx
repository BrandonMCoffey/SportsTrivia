import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useRealtimeGame } from '../hooks/useRealtimeGame'
import Question from './Question'
import Leaderboard from './Leaderboard'
import PostGameAwards from './PostGameAwards'

function Scoreboard({ game }) {
  const totalTriviaScore = game.team_a_trivia_score + game.team_b_trivia_score
  const teamAPercentage = totalTriviaScore > 0 ? (game.team_a_trivia_score / totalTriviaScore) * 100 : 50

  return (
    <div className="w-full bg-gray-900 text-white p-4">
      <div className="flex justify-between items-center max-w-4xl mx-auto">
        {/* Team A */}
        <div className="flex-1 text-left">
          <div className="flex items-center">
            <img src={game.team_a_logo} alt={game.team_a_name} className="h-10 w-10 md:h-14 md:w-14 mr-3" />
            <div>
              <div className="text-lg md:text-2xl font-bold">{game.team_a_name}</div>
              <div className="text-sm md:text-xl">Trivia: {game.team_a_trivia_score.toLocaleString()}</div>
            </div>
          </div>
        </div>
        
        {/* Real Score */}
        <div className="text-center px-4">
          <div className="text-xs text-gray-400">{game.status.toUpperCase()}</div>
          <div className="text-3xl md:text-5xl font-bold">{game.real_score_a} - {game.real_score_b}</div>
        </div>
        
        {/* Team B */}
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end">
            <div>
              <div className="text-lg md:text-2xl font-bold">{game.team_b_name}</div>
              <div className="text-sm md:text-xl">Trivia: {game.team_b_trivia_score.toLocaleString()}</div>
            </div>
            <img src={game.team_b_logo} alt={game.team_b_name} className="h-10 w-10 md:h-14 md:w-14 ml-3" />
          </div>
        </div>
      </div>
      
      {/* Tug of War */}
      <div className="w-full bg-gray-600 h-3 mt-4 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 transition-all duration-500" 
          style={{ width: `${teamAPercentage}%` }}
        />
      </div>
    </div>
  )
}

function CountdownTimer({ startTime }) {
  const [timeLeft, setTimeLeft] = useState('...')
  
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime()
      const start = new Date(startTime).getTime()
      const distance = start - now

      if (distance < 0) {
        setTimeLeft('Starting...')
        clearInterval(timer)
        return
      }

      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)
      setTimeLeft(`${minutes}m ${seconds}s`)
    }, 1000)

    return () => clearInterval(timer)
  }, [startTime])

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <div className="bg-white p-6 rounded-lg shadow-lg text-center">
        <h2 className="text-3xl font-bold text-center mb-6">Trivia Starting Soon!</h2>
        <div className="text-6xl font-bold text-blue-600 mb-6">
          {timeLeft}
        </div>
        <p className="text-xl text-gray-600">Get ready for the first question!</p>
      </div>
    </div>
  )
}

export default function TriviaDisplay({ gameId, onExit }) {
  const { loading, game } = useRealtimeGame(gameId)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [view, setView] = useState('leaderboard') 

  useEffect(() => {
    if (game) {
      if (game.status === 'Completed') {
        setView('postgame')
      } else if (game.status === 'Upcoming') {
        setView('countdown')
      } else if (game.status === 'Live' && game.current_question_id) {
        const fetchQuestion = async () => {
          const { data, error } = await supabase
            .from('questions')
            .select('*')
            .eq('id', game.current_question_id)
            .single()
          
          if (data) {
            setCurrentQuestion(data)
            setView('question')
          }
        }
        fetchQuestion()
      } else {
        setView('leaderboard') 
      }
    }
  }, [game?.status, game?.current_question_id])

  if (loading || !game) {
    return <div className="h-screen flex items-center justify-center">Loading Game...</div>
  }

  return (
    <div className="h-screen flex flex-col">
      <Scoreboard game={game} />
      
      <div className="flex-1 overflow-y-auto bg-gray-100 relative">
        <button 
          onClick={onExit}
          className="absolute top-4 right-4 bg-gray-700 text-white py-2 px-4 rounded-lg z-10"
        >
          &larr; Exit Game
        </button>

        {view === 'question' && currentQuestion && (
          <Question key={currentQuestion.id} question={currentQuestion} game={game} />
        )}
        {view === 'leaderboard' && (
          <Leaderboard game={game} />
        )}
        {view === 'postgame' && (
          <PostGameAwards game={game} />
        )}
        {view === 'countdown' && (
          <CountdownTimer startTime={game.start_time} />
        )}
      </div>
    </div>
  )
}