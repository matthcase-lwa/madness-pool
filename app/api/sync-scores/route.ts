import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'

// Supabase admin client (service role - can write)
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ESPN name -> our DB team name
// Covers displayName, shortDisplayName, and common abbreviations
const ESPN_NAME_MAP: Record<string, string> = {
  'Duke': 'Duke', 'Duke Blue Devils': 'Duke',
  'Michigan': 'Michigan', 'Michigan Wolverines': 'Michigan',
  'Arizona': 'Arizona', 'Arizona Wildcats': 'Arizona',
  'Florida': 'Florida', 'Florida Gators': 'Florida',
  'UConn': 'UConn', 'Connecticut': 'UConn', 'Connecticut Huskies': 'UConn',
  'Iowa State': 'Iowa State', 'Iowa State Cyclones': 'Iowa State',
  'Houston': 'Houston', 'Houston Cougars': 'Houston',
  'Purdue': 'Purdue', 'Purdue Boilermakers': 'Purdue',
  'Gonzaga': 'Gonzaga', 'Gonzaga Bulldogs': 'Gonzaga',
  'Alabama': 'Alabama', 'Alabama Crimson Tide': 'Alabama',
  'Virginia': 'Virginia', 'Virginia Cavaliers': 'Virginia',
  'Illinois': 'Illinois', 'Illinois Fighting Illini': 'Illinois',
  'Tennessee': 'Tennessee', 'Tennessee Volunteers': 'Tennessee',
  'Arkansas': 'Arkansas', 'Arkansas Razorbacks': 'Arkansas',
  'Texas Tech': 'Texas Tech', 'Texas Tech Red Raiders': 'Texas Tech',
  'Michigan State': 'Michigan State', 'Michigan State Spartans': 'Michigan State',
  'BYU': 'BYU', 'BYU Cougars': 'BYU',
  'Kentucky': 'Kentucky', 'Kentucky Wildcats': 'Kentucky',
  'Ohio State': 'Ohio State', 'Ohio State Buckeyes': 'Ohio State',
  'UCLA': 'UCLA', 'UCLA Bruins': 'UCLA',
  'Wisconsin': 'Wisconsin', 'Wisconsin Badgers': 'Wisconsin',
  'Kansas': 'Kansas', 'Kansas Jayhawks': 'Kansas',
  'Nebraska': 'Nebraska', 'Nebraska Cornhuskers': 'Nebraska',
  'Missouri': 'Missouri', 'Missouri Tigers': 'Missouri',
  'Villanova': 'Villanova', 'Villanova Wildcats': 'Villanova',
  'Vanderbilt': 'Vanderbilt', 'Vanderbilt Commodores': 'Vanderbilt',
  'Iowa': 'Iowa', 'Iowa Hawkeyes': 'Iowa',
  'Utah State': 'Utah State', 'Utah State Aggies': 'Utah State',
  'Texas': 'Texas', 'Texas Longhorns': 'Texas',
  'Texas A&M': 'Texas A&M', 'Texas A&M Aggies': 'Texas A&M',
  'TCU': 'TCU', 'TCU Horned Frogs': 'TCU',
  'SMU': 'SMU', 'SMU Mustangs': 'SMU',
  "Saint Mary's": "Saint Mary's", "Saint Mary's Gaels": "Saint Mary's",
  'VCU': 'VCU', 'VCU Rams': 'VCU',
  'Saint Louis': 'Saint Louis', 'Saint Louis Billikens': 'Saint Louis',
  'Louisville': 'Louisville', 'Louisville Cardinals': 'Louisville',
  'Santa Clara': 'Santa Clara', 'Santa Clara Broncos': 'Santa Clara',
  'Georgia': 'Georgia', 'Georgia Bulldogs': 'Georgia',
  'North Carolina': 'North Carolina', 'North Carolina Tar Heels': 'North Carolina', 'UNC': 'North Carolina',
  'Clemson': 'Clemson', 'Clemson Tigers': 'Clemson',
  'Miami FL': 'Miami (FL)', 'Miami (FL)': 'Miami (FL)', 'Miami Hurricanes': 'Miami (FL)',
  'North Dakota State': 'North Dakota State', 'North Dakota St.': 'North Dakota State', 'NDSU': 'North Dakota State',
  'Northern Iowa': 'Northern Iowa', 'Northern Iowa Panthers': 'Northern Iowa', 'UNI': 'Northern Iowa',
  'South Florida': 'South Florida', 'South Florida Bulls': 'South Florida', 'USF': 'South Florida',
  'Wright State': 'Wright State', 'Wright State Raiders': 'Wright State',
  'Tennessee State': 'Tennessee State', 'Tennessee State Tigers': 'Tennessee State',
  'Kennesaw State': 'Kennesaw State', 'Kennesaw St.': 'Kennesaw State',
  'Hofstra': 'Hofstra', 'Hofstra Pride': 'Hofstra',
  'Akron': 'Akron', 'Akron Zips': 'Akron',
  'Hawaii': 'Hawaii', "Hawai'i": 'Hawaii', 'Hawaii Rainbow Warriors': 'Hawaii',
  'High Point': 'High Point', 'High Point Panthers': 'High Point',
  'Cal Baptist': 'Cal Baptist', 'California Baptist': 'Cal Baptist', 'Cal Baptist Lancers': 'Cal Baptist',
  'UCF': 'UCF', 'UCF Knights': 'UCF',
  'Siena': 'Siena', 'Siena Saints': 'Siena',
  'Furman': 'Furman', 'Furman Paladins': 'Furman',
  'LIU': 'LIU', 'Long Island University': 'LIU',
  'UMBC': 'UMBC', 'UMBC Retrievers': 'UMBC',
  'Howard': 'Howard', 'Howard Bison': 'Howard',
  'Queens': 'Queens', 'Queens Royals': 'Queens',
  'McNeese': 'McNeese', 'McNeese State': 'McNeese', 'McNeese Cowboys': 'McNeese',
  'Troy': 'Troy', 'Troy Trojans': 'Troy',
  'Penn': 'Penn', 'Pennsylvania': 'Penn', 'Penn Quakers': 'Penn',
  'Idaho': 'Idaho', 'Idaho Vandals': 'Idaho',
  'Prairie View A&M': 'Prairie View A&M', 'Prairie View': 'Prairie View A&M',
  'Lehigh': 'Lehigh', 'Lehigh Mountain Hawks': 'Lehigh',
  "St. John's": "St. John's", "Saint John's": "St. John's", "St. John's Red Storm": "St. John's",
  'NC State': 'Texas', 'North Carolina State': 'Texas', // play-in: Texas won West 11
  'Miami OH': 'SMU', 'Miami (OH)': 'SMU',               // play-in: resolve after game
  'UMBC/Howard': 'UMBC', 'Howard/UMBC': 'UMBC',         // play-in: resolve after game
  'Prairie View A&M/Lehigh': 'Prairie View A&M',         // play-in: resolve after game
}

// Map ESPN round number to our round number
// NCAA tournament: first round games are labelled differently in ESPN
function espnRoundToOurs(espnRound: number, groupName?: string): number {
  // ESPN uses: 1=First Four, 2=R64, 3=R32, 4=S16, 5=E8, 6=F4, 7=Championship
  // But scoreboard events don't always have round numbers cleanly
  // We'll infer from the group/round name when available
  const map: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 }
  return map[espnRound] ?? espnRound
}

function resolveTeamName(espnName: string): string | null {
  // Direct lookup
  if (ESPN_NAME_MAP[espnName]) return ESPN_NAME_MAP[espnName]
  
  // Try trimming common suffixes
  const cleaned = espnName
    .replace(/ (Blue Devils|Wildcats|Gators|Huskies|Cyclones|Cougars|Boilermakers|Bulldogs|Tide|Cavaliers|Illini|Volunteers|Razorbacks|Raiders|Spartans|Jayhawks|Tigers|Cardinals|Hurricanes|Buckeyes|Bruins|Badgers|Cornhuskers|Commodores|Hawkeyes|Aggies|Longhorns|Frogs|Mustangs|Gaels|Rams|Billikens|Broncos|Terrapins|Nittany Lions|Panthers|Retrievers|Royals|Cowboys|Trojans|Quakers|Vandals)$/i, '')
    .trim()
  if (ESPN_NAME_MAP[cleaned]) return ESPN_NAME_MAP[cleaned]
  
  return null
}

export async function GET(req: NextRequest) {
  // Accept: Vercel cron secret, or admin password (for manual Sync Now)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || ''
  const adminPass = process.env.ADMIN_PASSWORD || ''

  const validTokens = [adminPass, cronSecret].filter(Boolean)
  const token = authHeader?.replace('Bearer ', '') || ''
  
  if (!validTokens.includes(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()

  // Fetch teams from DB
  const { data: dbTeams } = await supabase
    .from('teams')
    .select('id, name, seed, region, is_playin_pair, playin_partner, eliminated_round')
    .eq('year', YEAR)

  if (!dbTeams) return NextResponse.json({ error: 'Could not load teams' }, { status: 500 })

  // Build name -> team lookup
  const teamByName: Record<string, any> = {}
  for (const t of dbTeams) {
    teamByName[t.name.toLowerCase()] = t
    // Also index playin_partner name to the same row
    if (t.playin_partner) {
      teamByName[t.playin_partner.toLowerCase()] = t
    }
  }

  // Get already-recorded games so we don't double-insert
  const { data: existingGames } = await supabase
    .from('games')
    .select('winner_team_id, loser_team_id, round')
    .eq('year', YEAR)

  const existingKeys = new Set(
    (existingGames || []).map(g => `${g.winner_team_id}-${g.loser_team_id}-${g.round}`)
  )

  // Fetch multiple days from ESPN (tournament spans ~3 weeks)
  const today = new Date()
  const results: any[] = []
  const errors: string[] = []
  const unmatched: string[] = []

  // Fetch last 2 days + today to catch any we missed
  const dates = [-1, 0, 1].map(offset => {
    const d = new Date(today)
    d.setDate(d.getDate() + offset)
    return d.toISOString().split('T')[0].replace(/-/g, '')
  })

  for (const dateStr of dates) {
    let data: any = null
    try {
      const res = await fetch(
        `${ESPN_SCOREBOARD}?dates=${dateStr}&limit=50`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
      )
      if (res.ok) data = await res.json()
    } catch (e: any) {
      errors.push(`ESPN fetch failed for ${dateStr}: ${e.message}`)
      continue
    }

    if (!data?.events) continue

    for (const event of data.events) {
      const status = event.status?.type?.state
      if (status !== 'post') continue // only completed games

      const comp = event.competitions?.[0]
      if (!comp) continue

      const competitors = comp.competitors || []
      const winner = competitors.find((c: any) => c.winner === true)
      const loser = competitors.find((c: any) => c.winner === false)
      if (!winner || !loser) continue

      const winnerScore = parseInt(winner.score || '0')
      const loserScore = parseInt(loser.score || '0')
      if (!winnerScore || !loserScore) continue

      // Determine round from ESPN event notes or season type
      // NCAA tournament events have notes with round info
      const notes = comp.notes || []
      const roundNote = notes.find((n: any) => n.type === 'event')?.headline || ''
      
      // Parse ESPN round - they label: "First Round", "Second Round", "Sweet 16", etc.
      let round = 0
      const rl = roundNote.toLowerCase()
      if (rl.includes('first four')) round = 0
      else if (rl.includes('first round') || rl.includes('round of 64')) round = 1
      else if (rl.includes('second round') || rl.includes('round of 32')) round = 2
      else if (rl.includes('sweet') || rl.includes('regional semifinal')) round = 3
      else if (rl.includes('elite') || rl.includes('regional final')) round = 4
      else if (rl.includes('final four') || rl.includes('national semifinal')) round = 5
      else if (rl.includes('championship') || rl.includes('national final')) round = 6
      
      if (round === 0) continue // Skip First Four (play-in) and unrecognized

      // Match team names
      const winnerName = winner.team?.displayName || winner.team?.shortDisplayName || ''
      const loserName = loser.team?.displayName || loser.team?.shortDisplayName || ''

      const resolvedWinner = resolveTeamName(winnerName) ||
        teamByName[winnerName.toLowerCase()]?.name

      const resolvedLoser = resolveTeamName(loserName) ||
        teamByName[loserName.toLowerCase()]?.name

      if (!resolvedWinner) { unmatched.push(`winner: ${winnerName}`); continue }
      if (!resolvedLoser) { unmatched.push(`loser: ${loserName}`); continue }

      const winnerTeam = teamByName[resolvedWinner.toLowerCase()]
      const loserTeam = teamByName[resolvedLoser.toLowerCase()]

      if (!winnerTeam) { unmatched.push(`no DB row: ${resolvedWinner}`); continue }
      if (!loserTeam) { unmatched.push(`no DB row: ${resolvedLoser}`); continue }

      const key = `${winnerTeam.id}-${loserTeam.id}-${round}`
      if (existingKeys.has(key)) continue // already recorded

      const margin = winnerScore - loserScore

      // Insert game
      const { error: insertErr } = await supabase.from('games').insert({
        year: YEAR,
        round,
        winner_team_id: winnerTeam.id,
        loser_team_id: loserTeam.id,
        winner_score: winnerScore,
        loser_score: loserScore,
        margin,
      })

      if (insertErr) {
        errors.push(`Insert failed: ${winnerName} vs ${loserName} - ${insertErr.message}`)
        continue
      }

      // Mark loser as eliminated
      await supabase.from('teams')
        .update({ eliminated_round: round })
        .eq('id', loserTeam.id)
        .is('eliminated_round', null) // only if not already eliminated

      existingKeys.add(key) // prevent duplicate within same sync run
      results.push({ winner: resolvedWinner, loser: resolvedLoser, round, score: `${winnerScore}-${loserScore}` })
    }
  }

  return NextResponse.json({
    inserted: results.length,
    games: results,
    unmatched: [...new Set(unmatched)],
    errors,
    syncedAt: new Date().toISOString(),
  })
}
