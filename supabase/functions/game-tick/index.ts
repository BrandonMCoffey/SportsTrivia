import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const SUPPORTED_LEAGUE_IDS = [
  "4387",
  "4328"
];

function parseGameTime(date, time) {
  if (!date) return new Date().toISOString();
  const dateTime = `${date} ${time || '00:00:00'}`;
  return new Date(dateTime).toISOString();
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
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const SPORTS_API_KEY = Deno.env.get('SPORTS_API_KEY');
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    let allGames = [];
    for (const leagueId of SUPPORTED_LEAGUE_IDS){
      // 1. Fetch upcoming games
      const nextUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTS_API_KEY}/eventsnextleague.php?id=${leagueId}`;
      const nextResponse = await fetch(nextUrl);
      const nextData = await nextResponse.json();
      if (nextData.events) allGames.push(...nextData.events);
      // 2. Fetch recent games
      const lastUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTS_API_KEY}/eventslastleague.php?id=${leagueId}`;
      const lastResponse = await fetch(lastUrl);
      const lastData = await lastResponse.json();
      if (lastData.events) allGames.push(...lastData.events);
    }
    if (allGames.length === 0) {
      return new Response(JSON.stringify({
        message: 'No games found to update.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // 3. Prepare game data for upsert
    const gamesToUpsert = allGames.map((apiGame)=>{
      const startTime = parseGameTime(apiGame.dateEvent, apiGame.strTime);
      const status = getGameStatus(apiGame.strStatus);
      return {
        api_game_id: apiGame.idEvent,
        sport: apiGame.strSport,
        status: status,
        start_time: startTime,
        team_a_name: apiGame.strHomeTeam,
        team_b_name: apiGame.strAwayTeam,
        team_a_logo: apiGame.strHomeTeamBadge || 'default_logo_url',
        team_b_logo: apiGame.strAwayTeamBadge || 'default_logo_url',
        real_score_a: Number(apiGame.intHomeScore) || 0,
        real_score_b: Number(apiGame.intAwayScore) || 0,
        watch_links: {
          'US': apiGame.strVideo
        }
      };
    });
    // 4. Upsert all games into the database
    const { error } = await supabase.from('games').upsert(gamesToUpsert, {
      onConflict: 'api_game_id'
    });
    if (error) throw error;
    // 5. Update any "Live" games that are now "Completed"
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    await supabase.from('games').update({
      status: 'Completed',
      current_question_id: null
    }).eq('status', 'Live').lt('start_time', oneHourAgo);
    return new Response(JSON.stringify({
      message: 'Game tick successful',
      updated: gamesToUpsert.length
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
