import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const SUPPORTED_LEAGUE_IDS = [
  "NFL",
  "NBA"
];
const DAY_OFFSETS = [0, 1, 2, 3, 4, 5, 6, 7]

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
    const SPORTS_API_KEY = Deno.env.get('SPORTS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SPORTS_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables (Secrets).');
      throw new Error('Missing environment variables (Secrets).');
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let allGames = []
    
    for (const leagueId of SUPPORTED_LEAGUE_IDS) {
      for (const dayOffset of DAY_OFFSETS) {
        const date = new Date()
        date.setDate(date.getDate() + dayOffset)
        const dateString = date.toISOString().split('T')[0] // "YYYY-MM-DD"
        
        const url = `https://www.thesportsdb.com/api/v1/json/${SPORTS_API_KEY}/eventsday.php?d=${dateString}&l=${leagueId}`;
        console.log(`Fetching league ${leagueId}from: ${url}`);
        const response = await fetch(url)
        
        if (!response.ok) {
          console.error(`Failed to fetch events for ${dateString}, league ${leagueId}`);
        } else {
          const data = await response.json();
          if (data.events) {
            allGames.push(...data.events);
          }
        }
      }
    }

    if (allGames.length === 0) {
      return new Response(JSON.stringify({
        message: 'No upcoming games found.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`Found ${allGames.length} total games.`);
    
    let gamesToUpsert;
    try {
      gamesToUpsert = allGames.map((apiGame) => {
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
    } catch (mapError) {
      console.error('Error during data mapping:', mapError);
      throw new Error(`Error during data mapping: ${mapError.message}`);
    }

    const uniqueGames = Array.from(new Map(gamesToUpsert.map(game => [game.api_game_id, game])).values());
    console.log(`Upserting ${uniqueGames.length} unique games...`);

    const { error } = await supabase.from('games').upsert(uniqueGames, {
      onConflict: 'api_game_id'
    });

    if (error) {
      console.error('Supabase upsert error:', error);
      throw new Error(`Supabase upsert error: ${error.message}`);
    }

    return new Response(JSON.stringify({ message: 'Daily schedule populated.', updated: uniqueGames.length }), {
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