import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPPORTED_LEAGUE_IDS = [
  "4387", // NBA
  "4328", // NFL
]

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
  const status = apiStatus.toLowerCase()
  if (status.includes('live')) return 'Live'
  if (status.includes('finished') || status.includes('complete')) return 'Completed'
  return 'Upcoming'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('game-tick function invoked.');

  try {
    const SPORTS_API_KEY = Deno.env.get('SPORTS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SPORTS_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables (Secrets).');
      throw new Error('Missing environment variables (Secrets).');
    }
    console.log('Secrets loaded successfully.');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('Supabase client created.');

    let allGames = [];
    console.log(`Fetching from TheSportsDB for ${SUPPORTED_LEAGUE_IDS.length} leagues...`);

    for (const leagueId of SUPPORTED_LEAGUE_IDS) {
      // Fetch upcoming games
      const nextUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTS_API_KEY}/eventsnextleague.php?id=${leagueId}`;
      const nextResponse = await fetch(nextUrl);
      if (!nextResponse.ok) throw new Error(`Failed to fetch next events for league ${leagueId}`);
      const nextData = await nextResponse.json();
      if (nextData.events) allGames.push(...nextData.events);

      // Fetch recent games
      const lastUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTS_API_KEY}/eventslastleague.php?id=${leagueId}`;
      const lastResponse = await fetch(lastUrl);
      if (!lastResponse.ok) throw new Error(`Failed to fetch last events for league ${leagueId}`);
      const lastData = await lastResponse.json();
      if (lastData.events) allGames.push(...lastData.events);
    }

    console.log(`Found ${allGames.length} total games.`);

    let gamesToUpsert;
    try {
      gamesToUpsert = allGames.map((apiGame) => {
        const startTime = parseGameTime(apiGame.dateEvent, apiGame.strTime)
        const status = getGameStatus(apiGame.strStatus)
        
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
          watch_links: { 'US': apiGame.strVideo }
        }
      })
    } catch (mapError) {
      console.error('Error during data mapping:', mapError);
      throw new Error(`Error during data mapping: ${mapError.message}`);
    }

    console.log(`Upserting ${gamesToUpsert.length} games...`);
    const { error } = await supabase
      .from('games')
      .upsert(gamesToUpsert, { onConflict: 'api_game_id' })

    if (error) {
      console.error('Supabase upsert error:', error);
      throw new Error(`Supabase upsert error: ${error.message}`);
    }

    console.log('Updating old live games...');
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString()
    await supabase
      .from('games')
      .update({ status: 'Completed', current_question_id: null })
      .eq('status', 'Live')
      .lt('start_time', oneHourAgo)

    console.log('Function complete.');
    return new Response(JSON.stringify({ message: 'Game tick successful', updated: gamesToUpsert.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('CRITICAL ERROR in game-tick:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})