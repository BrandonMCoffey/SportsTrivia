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
  if (!apiStatus) return 'Upcoming'
  const status = apiStatus.toLowerCase()
  if (status.includes('live')) return 'Live'
  if (status.includes('finished') || status.includes('complete')) return 'Completed'
  return 'Upcoming'
}

function createGeminiPrompt(teamA, teamB, sport) {
  return `
    You are a sports trivia bot. Generate 20 trivia questions for an upcoming ${sport} game between the ${teamA} and the ${teamB}.
    
    Balance the categories between:
    - Current team/player stats
    - Team history
    - Head-to-head rivalry facts
    - Mascot/Arena trivia
    - Famous records or moments

    Return the output as a valid JSON array. Each object in the array must have four keys:
    1. "category": (string) The question category (e.g., "History", "Player")
    2. "question_text": (string) The question.
    3. "options": (string) A string of 4 answer options, separated by a pipe character "|".
    4. "correct_answer": (string) The exact text of the correct answer, which must be one of the options.

    Do not include any text before or after the JSON array.
  `
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

    // 1. Fetch upcoming games from TheSportsDB
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
    
    // 2. Upsert games into DB and get their IDs
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
    console.log(`Upserting ${uniqueGames.length} unique games...`);
    
    const { data: upsertedGames, error: upsertError } = await supabase
      .from('games')
      .upsert(uniqueGames, { onConflict: 'api_game_id' })
      .select('id, team_a_name, team_b_name, sport')
    
    if (upsertError)
    {
      console.error('Supabase upsert error:', upsertError);
      throw new Error(`Supabase upsert error: ${upsertError.message}`);
    }

    // 3. Generate Questions
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`
    
    for (const game of upsertedGames) {
      const { data: existingQuestions, count } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', game.api_game_id)

      if (count === 0) {
        const prompt = createGeminiPrompt(game.team_a_name, game.team_b_name, game.sport)
        const geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        })

        if (!geminiResponse.ok) continue // Skip this game if Gemini fails

        const geminiData = await geminiResponse.json()
        const jsonText = geminiData.candidates[0].content.parts[0].text
        const questions = JSON.parse(jsonText)

        const questionsToInsert = questions.map(q => ({
          game_id: game.id,
          category: q.category,
          question_text: q.question_text,
          options: q.options,
          correct_answer: q.correct_answer
        }))
        
        await supabase.from('questions').insert(questionsToInsert)
      }
    }

    // 4. Cleanup Old Games
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    const { data: completedGames, error: completedError } = await supabase
      .from('games')
      .select('id')
      .eq('status', 'Completed')
      .lt('start_time', threeDaysAgo)

    if (completedError) console.error('Error fetching completed games for cleanup:', completedError)

    if (completedGames && completedGames.length > 0) {
      const gameIdsToDelete = completedGames.map(g => g.id)
      
      await supabase.from('questions').delete().in('game_id', gameIdsToDelete)
      // await supabase.from('games').delete().in('id', gameIdsToDelete)
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