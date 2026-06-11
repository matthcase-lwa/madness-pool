import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchNcaaScoreboard, matchTeam, ncaaRoundToOurs, DbTeam, NcaaGame } from '@/lib/ncaa'

export const dynamic = 'force-dynamic'

// ============================================
// LIVE SCORES (public, cached 30s)
// Data source: NCAA.com's free scoreboard JSON feed — the same data
// that powers ncaa.com. Includes seeds, bracket round labels, and
// stable team slugs, which makes team matching reliable.
// Returns games in the shape LiveScoreboard.tsx expects, plus
// pendingSync=true when a final game hasn't been recorded yet.
// ============================================

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')

let _cache: { at: number, payload: any } | null = null
const CACHE_MS = 30000

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ROUND_LABELS: Record<number, string> = {
  0: 'Opening Round',
  1: 'First Round',
  2: 'Second Round',
  3: 'Sweet 16',
  4: 'Elite Eight',
  5: 'Final Four',
  6: 'Championship',
}

function mapState(ncaaState: string): string {
  // Normalize NCAA states to the 'pre' | 'in' | 'post' convention the UI uses
  if (ncaaState === 'live' || ncaaState === 'in') return 'in'
  if (ncaaState === 'final' || ncaaState === 'post') return 'post'
  return 'pre'
}

export async function GET() {
  try {
    if (_cache && Date.now() - _cache.at < CACHE_MS) {
      return NextResponse.json(_cache.payload)
    }

    const supabase = getAdminClient()

    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const [teamsRes, picksRes, gamesRes, gamesYesterday, gamesToday] = await Promise.all([
      supabase.from('teams')
        .select('id, name, seed, region, ncaa_slug, eliminated_round')
        .eq('year', YEAR),
      supabase.from('picks').select('team_id').eq('year', YEAR),
      supabase.from('games')
        .select('winner_team_id, loser_team_id, round')
        .eq('year', YEAR),
      fetchNcaaScoreboard(yesterday).catch(() => [] as NcaaGame[]),
      fetchNcaaScoreboard(today).catch(() => [] as NcaaGame[]),
    ])

    const dbTeams: DbTeam[] = (teamsRes.data || []) as any

    const pickCounts: Record<string, number> = {}
    for (const p of picksRes.data || []) {
      pickCounts[p.team_id] = (pickCounts[p.team_id] || 0) + 1
    }

    const recordedKeys = new Set(
      (gamesRes.data || []).map(g => g.winner_team_id + '-' + g.loser_team_id + '-' + g.round)
    )

    const allGames = gamesYesterday.concat(gamesToday)
    const out: any[] = []
    const finalized: string[] = []
    let pendingSync = false

    for (const g of allGames) {
      const home = matchTeam(g.home, dbTeams)
      const away = matchTeam(g.away, dbTeams)
      // Only show games involving at least one team from our tournament field
      if (!home && !away) continue

      const round = ncaaRoundToOurs(g.bracketRound)
      const state = mapState(g.state)

      let statusDetail = ''
      if (state === 'in') {
        statusDetail = (g.currentPeriod || 'LIVE') + (g.contestClock ? ' ' + g.contestClock : '')
      } else if (state === 'post') {
        statusDetail = 'FINAL'
      } else {
        statusDetail = g.startTime || 'Upcoming'
      }

      // Detect finals that haven't been synced into the games table yet
      if (state === 'post' && home && away && round >= 1 && round <= 6) {
        const homeWon = g.home.score > g.away.score
        const wId = homeWon ? home.id : away.id
        const lId = homeWon ? away.id : home.id
        const key = wId + '-' + lId + '-' + round
        if (!recordedKeys.has(key)) {
          pendingSync = true
          finalized.push(g.gameID)
        }
      }

      out.push({
        eventId: g.gameID,
        round,
        roundLabel: ROUND_LABELS[round] || g.bracketRound || 'NCAA',
        state,
        statusDetail,
        startTime: g.startTime || null,
        home: {
          espnName: g.home.short,
          score: g.home.score,
          dbId: home ? home.id : null,
          dbName: home ? home.name : null,
          seed: g.home.seed || (home ? home.seed : null),
          pickedBy: home ? (pickCounts[home.id] || 0) : 0,
        },
        away: {
          espnName: g.away.short,
          score: g.away.score,
          dbId: away ? away.id : null,
          dbName: away ? away.name : null,
          seed: g.away.seed || (away ? away.seed : null),
          pickedBy: away ? (pickCounts[away.id] || 0) : 0,
        },
      })
    }

    // Live first, then upcoming, then finals
    const order: Record<string, number> = { in: 0, pre: 1, post: 2 }
    out.sort((a, b) => {
      const sa = order[a.state] !== undefined ? order[a.state] : 3
      const sb = order[b.state] !== undefined ? order[b.state] : 3
      return sa - sb
    })

    const payload = {
      games: out,
      finalized,
      pendingSync,
      fetchedAt: new Date().toISOString(),
    }
    _cache = { at: Date.now(), payload }
    return NextResponse.json(payload)
  } catch (e: any) {
    return NextResponse.json({ games: [], finalized: [], pendingSync: false, error: e.message })
  }
}
