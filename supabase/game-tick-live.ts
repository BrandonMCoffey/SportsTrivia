import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPPORTED_LEAGUE_IDS = [
  "NFL",
  "NBA"
];

function parseGameTime(date, time) {
  if (!date) {
    console.warn('Missing dateEvent, using current time');
    return new Date().toISOString();
  }
  const dateTime = `${date} ${time || '00:00:00'}`;
  const parsedDate = new Date(dateTime);
  if (isNaN(parsedDate.getTime())) {
    console.warn(`Invalid dateTime string: ${dateTime}, using current time`);
    return new Date().toISOString();
  }
  return parsedDate.toISOString();
}

function getGameStatus(apiStatus) {
  if (!apiStatus) {
    return 'Upcoming';
  }
  const status = apiStatus.toLowerCase();
  if (status.includes('live')) return 'Live';
  if (status.includes('finished') || status.includes('complete')) return 'Completed';
  return 'Upcoming';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SPORTS_API_KEY = Deno.env.get('SPORTS_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    let allGames = []
    
    for (const leagueId of SUPPORTED_LEAGUE_IDS) {
      const date = new Date()
        date.setDate(date.getDate())
        const dateString = date.toISOString().split('T')[0]
        
        const url = `https://www.thesportsdb.com/api/v1/json/${SPORTS_API_KEY}/eventsday.php?d=${dateString}&l=${leagueId}`
        const response = await fetch(url)
        
        if (response.ok) {
          const data = await response.json()
          if (data.events) allGames.push(...data.events)
        }
    }

    if (allGames.length > 0) {
      const gamesToUpsert = allGames.map((apiGame) => ({
        api_game_id: apiGame.idEvent,
        sport: apiGame.strSport,
        status: getGameStatus(apiGame.strStatus),
        start_time: parseGameTime(apiGame.dateEvent, apiGame.strTime),
        team_a_name: apiGame.strHomeTeam,
        team_b_name: apiGame.strAwayTeam,
        team_a_logo: apiGame.strHomeTeamBadge || 'default_logo_url',
        team_b_logo: apiGame.strAwayTeamBadge || 'default_logo_url',
        real_score_a: Number(apiGame.intHomeScore) || 0,
        real_score_b: Number(apiGame.intAwayScore) || 0,
        watch_links: { 'US': apiGame.strVideo }
      }))
      
      const uniqueGames = Array.from(new Map(gamesToUpsert.map(game => [game.api_game_id, game])).values())
      
      const { error } = await supabase
        .from('games')
        .upsert(uniqueGames, { onConflict: 'api_game_id' })
      if (error) throw new Error(`Supabase upsert error: ${error.message}`)
    }

    const { data: liveGames, error: liveGamesError } = await supabase
      .from('games')
      .select('id, current_question_id, question_start_time')
      .eq('status', 'Live')
      
    if (liveGamesError) throw new Error(`Error fetching live games: ${liveGamesError.message}`)

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    for (const game of liveGames) {
      const questionTime = game.question_start_time ? new Date(game.question_start_time) : null
      
      if (!questionTime || questionTime < fiveMinutesAgo) {
        const { data: newQuestion, error: qError } = await supabase
          .from('questions')
          .select('id')
          .limit(1)
        
        if (newQuestion && newQuestion.length > 0) {
          await supabase
            .from('games')
            .update({
              current_question_id: newQuestion[0].id,
              question_start_time: new Date().toISOString()
            })
            .eq('id', game.id)
        }
      }
    }

    return new Response(JSON.stringify({ message: 'Live tick successful.', updated_games: allGames.length }), {
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