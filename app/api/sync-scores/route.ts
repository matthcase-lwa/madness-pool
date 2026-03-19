import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'
const YEAR = 2026

// Simple string overlap score
function similarity(a: string, b: string): number {
  const clean = (s: string) => s.toLowerCase()
    .replace(/\b(university|college|state|st\.?|the|of|at|&)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
  const na = clean(a), nb = clean(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.85
  const wa = new Set(na.split(' ').filter(w => w.length > 2))
  const wb = new Set(nb.split(' ').filter(w => w.length > 2))
  const intersection = [...wa].filter(w => wb.has(w)).length
  const union = new Set([...wa, ...wb]).size
  return union === 0 ? 0 : intersection / union
}

function getRound(event: any): number | null {
  const text = [
    event.notes?.[0]?.text,
    event.name,
    event.season?.slug,
    event.competitions?.[0]?.notes?.[0]?.text,
  ].filter(Boolean).join(' ').toLowerCase()
  if (text.includes('first round') || text.includes('round of 64')) return 1
  if (text.includes('second round') || text.includes('round of 32')) return 2
  if (text.includes('sweet 16') || text.includes('sweet sixteen')) return 3
  if (text.includes('elite eight') || text.includes('elite 8')) return 4
  if (text.includes('final four')) return 5
  if (text.includes('national championship') || text.includes('championship game')) return 6
  return null
}

// Rate limit: track last run time in memory (resets on cold start but that's fine)
let lastRunAt = 0
const MIN_INTERVAL_MS = 45_000 // 45 seconds minimum between runs

export async function GET() {
  try {
    // Rate limit — don't hammer ESPN
    const now = Date.now()
    if (now - lastRunAt < MIN_INTERVAL_MS) {
      return NextResponse.json({ skipped: true, reason: 'rate_limited', nextRunIn: Math.ceil((MIN_INTERVAL_MS - (now - lastRunAt)) / 1000) })
    }
    lastRunAt = now

    // Fetch teams
    const { data: dbTeams } = await adminSupabase
      .from('teams').select('id, name, seed').eq('year', YEAR)
    if (!dbTeams?.length) return NextResponse.json({ error: 'no teams' })

    // Fetch existing games to avoid duplicates
    const { data: existingGames } = await adminSupabase
      .from('games').select('winner_team_id, loser_team_id, round').eq('year', YEAR)

    // Fetch ESPN — today + yesterday to catch late finishers
    const dates = []
    for (let i = 0; i <= 1; i++) {
      const d = new Date(Date.now() - i * 86400000)
      dates.push(d.toISOString().split('T')[0].replace(/-/g, ''))
    }

    const allEvents: any[] = []
    for (const dateStr of dates) {
      try {
        const res = await fetch(`${ESPN_SCOREBOARD}?dates=${dateStr}&limit=50&groups=50`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 0 }
        })
        if (res.ok) {
          const data = await res.json()
          allEvents.push(...(data.events || []))
        }
      } catch {}
    }

    // Also fetch live games for bracket display (separate from DB sync)
    const liveGames: Record<string, any> = {}
    for (const event of allEvents) {
      const competition = event.competitions?.[0]
      if (!competition) continue
      const comps = competition.competitors || []
      const home = comps.find((c: any) => c.homeAway === 'home')
      const away = comps.find((c: any) => c.homeAway === 'away')
      if (!home || !away) continue
      const status = event.status?.type
      const key = event.id
      liveGames[key] = {
        id: event.id,
        status: status?.state,
        statusDetail: status?.shortDetail,
        homeTeam: home.team?.displayName,
        homeScore: parseInt(home.score || '0'),
        homeWinner: home.winner,
        awayTeam: away.team?.displayName,
        awayScore: parseInt(away.score || '0'),
        awayWinner: away.winner,
        period: event.status?.period,
        clock: event.status?.displayClock,
        startTime: event.date,
        round: getRound(event),
      }
    }

    // Process completed games for DB sync
    const completed = allEvents.filter(e =>
      e.status?.type?.state === 'post' || e.status?.type?.completed === true
    )

    function matchTeam(espnName: string) {
      let best = { team: null as any, score: 0 }
      for (const t of dbTeams!) {
        const s = similarity(espnName, t.name)
        if (s > best.score) best = { team: t, score: s }
      }
      return best.score >= 0.5 ? best.team : null
    }

    const imported: string[] = []
    const unmatched: string[] = []

    for (const event of completed) {
      const competition = event.competitions?.[0]
      if (!competition) continue
      const comps = competition.competitors || []
      const winner = comps.find((c: any) => c.winner === true)
      const loser = comps.find((c: any) => c.winner === false)
      if (!winner || !loser) continue

      const round = getRound(event)
      if (!round) continue

      const winnerTeam = matchTeam(winner.team?.displayName || '')
      const loserTeam = matchTeam(loser.team?.displayName || '')

      if (!winnerTeam) { unmatched.push(winner.team?.displayName); continue }
      if (!loserTeam) { unmatched.push(loser.team?.displayName); continue }

      // Skip if already in DB
      const exists = existingGames?.some(g =>
        g.winner_team_id === winnerTeam.id && g.loser_team_id === loserTeam.id && g.round === round
      )
      if (exists) continue

      const winnerScore = parseInt(winner.score || '0')
      const loserScore = parseInt(loser.score || '0')
      const margin = Math.abs(winnerScore - loserScore)

      const { error } = await adminSupabase.from('games').insert({
        year: YEAR, round,
        winner_team_id: winnerTeam.id,
        loser_team_id: loserTeam.id,
        winner_score: winnerScore,
        loser_score: loserScore,
        margin,
      })

      if (!error) {
        await adminSupabase.from('teams')
          .update({ eliminated_round: round })
          .eq('id', loserTeam.id).eq('year', YEAR)
        imported.push(`${winnerTeam.name} def ${loserTeam.name} (R${round})`)
      }
    }

    return NextResponse.json({
      imported: imported.length,
      newResults: imported,
      unmatched: [...new Set(unmatched)],
      liveGames,
      fetchedAt: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 200 })
  }
}
