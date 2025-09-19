import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

// A simple hook for the timer bar
function useTimer(startTime, duration) {
  const [width, setWidth] = useState(100)

  useEffect(() => {
    const start = new Date(startTime).getTime()
    const end = start + duration
    
    const interval = setInterval(() => {
      const now = Date.now()
      const percentage = Math.max(0, (end - now) / duration) * 100
      setWidth(percentage)
      if (percentage === 0) clearInterval(interval)
    }, 100)

    return () => clearInterval(interval)
  }, [startTime, duration])

  return width
}

export default function Question({ question, game }) {
  const [answered, setAnswered] = useState(false)
  const [selected, setSelected] = useState(null)
  
  // 60-second timer
  const timerWidth = useTimer(game.question_start_time, 60000)
  const options = question.options.split('|')

  const handleAnswer = async (option) => {
    if (answered) return
    setAnswered(true)
    setSelected(option)

    await supabase.functions.invoke('submit-answer', {
      questionId: question.id,
      gameId: game.id,
      answer: option,
    })
  }

  const getButtonClass = (option) => {
    if (!answered) {
      return 'bg-white hover:bg-gray-200'
    }
    if (option === question.correct_answer) {
      return 'bg-green-500 text-white'
    }
    if (option === selected) {
      return 'bg-red-500 text-white'
    }
    return 'bg-gray-300 opacity-50'
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <div className="w-full h-4 bg-gray-300 rounded-full overflow-hidden mb-4">
        <div 
          className="h-full bg-blue-500 transition-all duration-100" 
          style={{ width: `${timerWidth}%` }}
        />
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-6">
          {question.question_text.replace(/;/g, ',')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {options.map((option) => (
            <button
              key={option}
              disabled={answered}
              onClick={() => handleAnswer(option)}
              className={`p-4 rounded-lg font-semibold text-lg transition-all duration-300 ${getButtonClass(option)}`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}