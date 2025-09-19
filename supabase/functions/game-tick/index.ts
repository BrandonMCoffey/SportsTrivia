import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApiGame {
  idEvent: string
  strSport: string
  strHomeTeam: string
  strAwayTeam:string
  intHomeScore: string | null
  intAwayScore: string | null
  strStatus: string
  strVideo: string
  strHomeTeamBadge?: string 
  strAwayTeamBadge?: string
}

Deno.serve(async (req) => {
  // 1. Handle CORS preflight request (for browser-based calls)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Get Supabase and Sports API keys from environment variables
    const SPORTS_API_KEY = Deno.env.get('SPORTS_API_KEY')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 3. Fetch live games from TheSportsDB
    const today = new Date().toISOString().split('T')[0];
    const sportsApiUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTS_API_KEY}/eventsday.php?d=${today}&s=American%20Football`;
    
    const sportsResponse = await fetch(sportsApiUrl);
    if (!sportsResponse.ok) throw new Error('Failed to fetch from TheSportsDB');
    
    const sportsData = await sportsResponse.json();
    const liveApiGames: ApiGame[] = sportsData.events || [];

    // 4. Process and "upsert" each game into our database
    for (const apiGame of liveApiGames) {
      const isLive = apiGame.strStatus.toLowerCase().includes('live') || 
                     apiGame.strStatus === "Not Started";
      
      const gameUpdateData = {
        api_game_id: apiGame.idEvent,
        sport: apiGame.strSport,
        is_live: isLive,
        team_a_name: apiGame.strHomeTeam,
        team_b_name: apiGame.strAwayTeam,
        team_a_logo: apiGame.strHomeTeamBadge || 'default_logo_url', 
        team_b_logo: apiGame.strAwayTeamBadge || 'default_logo_url',
        real_score_a: Number(apiGame.intHomeScore) || 0,
        real_score_b: Number(apiGame.intAwayScore) || 0,
        watch_links: { 'US': apiGame.strVideo }
      };

      const { data: upsertedGame, error: upsertError } = await supabase
        .from('games')
        .upsert(gameUpdateData, { onConflict: 'api_game_id' })
        .select()
        .single();
      
      if (upsertError) {
        console.error('Error upserting game:', upsertError.message);
        continue;
      }

      // 5. Check if it's time for a new question
      if (!upsertedGame) continue;

      const game = upsertedGame;
      const questionStartTime = game.question_start_time ? new Date(game.question_start_time) : null;
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // If game is live AND (it has no question OR its last question was over 5 mins ago)
      if (game.is_live && (!questionStartTime || questionStartTime < fiveMinutesAgo)) {
        
        const { data: newQuestion, error: qError } = await supabase
          .from('questions')
          .select('id')
          .limit(1)
          .single();

        if (qError || !newQuestion) {
          console.error('Failed to get new question:', qError?.message);
          continue;
        }

        await supabase
          .from('games')
          .update({
            current_question_id: newQuestion.id,
            question_start_time: new Date().toISOString()
          })
          .eq('id', game.id);
      }
    }

    // 6. Return a success response
    return new Response(JSON.stringify({ message: 'Game tick successful' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})