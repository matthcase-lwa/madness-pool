import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'

// Normalize team name for fuzzy matching
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(university|college|state|st\.?|the|of|at|&)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Score similarity between two strings (0-1)
function similarity(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.9
  // Word overlap
  const wa = new Set(na.split(' ').filter(w => w.length > 2))
  const wb = new Set(nb.split(' ').filter(w => w.length > 2))
  const intersection = [...wa].filter(w => wb.has(w)).length
  const union = new Set([...wa, ...wb]).size
  return union === 0 ? 0 : intersection / union
}

export async function POST(req: NextRequest) {
  try {
    const { password, year, dates } = await req.json()

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all our teams from DB
    const { data: dbTeams } = await adminSupabase
      .from('teams')
      .select('id, name, seed')
      .eq('year', year)

    if (!dbTeams || dbTeams.length === 0) {
      return NextResponse.json({ error: 'No teams found in database' }, { status: 400 })
    }

    // Fetch already-recorded game results so we don't double-insert
    const { data: existingGames } = await adminSupabase
      .from('games')
      .select('winner_team_id, loser_team_id, round')
      .eq('year', year)

    // Fetch ESPN scoreboard for the given dates (or today)
    const targetDates = dates || [new Date().toISOString().split('T')[0].replace(/-/g, '')]
    const allEvents: any[] = []

    for (const dateStr of targetDates) {
      try {
        const res = await fetch(`${ESPN_SCOREBOARD}?dates=${dateStr}&limit=50&groups=50`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        if (res.ok) {
          const data = await res.json()
          allEvents.push(...(data.events || []))
        }
      } catch {}
    }

    if (allEvents.length === 0) {
      return NextResponse.json({ error: 'No ESPN events found for these dates', imported: 0, skipped: 0, unmatched: [] })
    }

    // Filter to completed games only
    const completedGames = allEvents.filter(e =>
      e.status?.type?.state === 'post' || e.status?.type?.completed === true
    )

    // Determine round from ESPN event notes or group
    function getRound(event: any): number | null {
      const notes = event.notes?.[0]?.text?.toLowerCase() || ''
      const name = event.name?.toLowerCase() || ''
      const combined = notes + ' ' + name
      if (combined.includes('first round') || combined.includes('round of 64')) return 1
      if (combined.includes('second round') || combined.includes('round of 32')) return 2
      if (combined.includes('sweet 16') || combined.includes('sweet sixteen')) return 3
      if (combined.includes('elite eight') || combined.includes('elite 8')) return 4
      if (combined.includes('final four')) return 5
      if (combined.includes('national championship') || combined.includes('championship game')) return 6
      return null
    }

    // Match ESPN team name to our DB team
    function matchTeam(espnName: string) {
      let best = { team: null as any, score: 0 }
      for (const t of dbTeams!) {
        const s = similarity(espnName, t.name)
        if (s > best.score) best = { team: t, score: s }
      }
      return best.score >= 0.5 ? best.team : null
    }

    const imported: string[] = []
    const skipped: string[] = []
    const unmatched: string[] = []

    for (const event of completedGames) {
      const competition = event.competitions?.[0]
      if (!competition) continue

      const competitors = competition.competitors || []
      const winner = competitors.find((c: any) => c.winner === true)
      const loser = competitors.find((c: any) => c.winner === false)
      if (!winner || !loser) continue

      const round = getRound(event)
      if (!round) {
        skipped.push(`${event.name} — could not determine round`)
        continue
      }

      const winnerTeam = matchTeam(winner.team?.displayName || winner.team?.name || '')
      const loserTeam = matchTeam(loser.team?.displayName || loser.team?.name || '')

      if (!winnerTeam) { unmatched.push(`Winner: ${winner.team?.displayName}`); continue }
      if (!loserTeam) { unmatched.push(`Loser: ${loser.team?.displayName}`); continue }

      // Skip if already recorded
      const alreadyRecorded = existingGames?.some(g =>
        g.winner_team_id === winnerTeam.id && g.loser_team_id === loserTeam.id && g.round === round
      )
      if (alreadyRecorded) {
        skipped.push(`${winnerTeam.name} vs ${loserTeam.name} R${round} — already recorded`)
        continue
      }

      const winnerScore = parseInt(winner.score || '0')
      const loserScore = parseInt(loser.score || '0')
      const margin = Math.abs(winnerScore - loserScore)

      // Insert game result
      const { error: gameErr } = await adminSupabase
        .from('games')
        .insert({
          year,
          round,
          winner_team_id: winnerTeam.id,
          loser_team_id: loserTeam.id,
          winner_score: winnerScore,
          loser_score: loserScore,
          margin,
        })

      if (gameErr) { skipped.push(`${winnerTeam.name} — DB error: ${gameErr.message}`); continue }

      // Update loser team as eliminated
      await adminSupabase
        .from('teams')
        .update({ eliminated_round: round })
        .eq('id', loserTeam.id)
        .eq('year', year)

      imported.push(`${winnerTeam.name} def ${loserTeam.name} ${winnerScore}-${loserScore} (R${round})`)
    }

    return NextResponse.json({
      imported: imported.length,
      skipped: skipped.length,
      unmatched: [...new Set(unmatched)],
      results: imported,
      skippedList: skipped,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
