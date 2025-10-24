import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getGameStatus(apiStatus) {
  if (!apiStatus) return 'Upcoming'
  const status = apiStatus.toLowerCase()
  if (status.includes('live')) return 'Live'
  if (status.includes('finished') || status.includes('complete')) return 'Completed'
  return 'Upcoming'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const [SPORTS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY] = [
      Deno.env.get('SPORTS_API_KEY')!,
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    ]
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Find games in our DB that should be live or are upcoming
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    
    const { data: activeGames, error: activeGamesError } = await supabase
      .from('games')
      .select('id, api_game_id, current_question_id, question_start_time')
      .neq('status', 'Completed')
      .gte('start_time', oneHourAgo)
    
    if (activeGamesError) throw activeGamesError
    if (!activeGames || activeGames.length === 0) {
      return new Response(JSON.stringify({ message: 'No active games to update.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    // 2. Loop through only our active games and get live data
    for (const game of activeGames) {
      const url = `https://www.thesportsdb.com/api/v1/json/${SPORTS_API_KEY}/lookupevent.php?id=${game.api_game_id}`
      const response = await fetch(url)
      
      if (!response.ok) continue
      const data = await response.json()
      if (!data.events || data.events.length === 0) continue

      const apiGame = data.events[0]
      const newStatus = getGameStatus(apiGame.strStatus)
      
      await supabase
        .from('games')
        .update({
          status: newStatus,
          real_score_a: Number(apiGame.intHomeScore) || 0,
          real_score_b: Number(apiGame.intAwayScore) || 0,
        })
        .eq('id', game.id)

      // 3. Serve questions if the game is live
      if (newStatus === 'Live') {
        const questionTime = game.question_start_time ? new Date(game.question_start_time) : null
        
        if (!questionTime || questionTime < fiveMinutesAgo) {
          const { data: questions, error: qError } = await supabase
            .from('questions')
            .select('id')
            .eq('game_id', game.id)

          if (qError) console.error(`Error fetching questions for game ${game.id}:`, qError)

          if (questions && questions.length > 0) {
            const randomQuestion = questions[Math.floor(Math.random() * questions.length)]
            
            await supabase
              .from('games')
              .update({
                current_question_id: randomQuestion.id,
                question_start_time: new Date().toISOString()
              })
              .eq('id', game.id)
          }
        }
      }
    }

    return new Response(JSON.stringify({ message: 'Live tick successful.', checked_games: activeGames.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})