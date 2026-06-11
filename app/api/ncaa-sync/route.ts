import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchNcaaScoreboard, matchTeam, ncaaRoundToOurs, DbTeam, NcaaGame } from '@/lib/ncaa'

export const dynamic = 'force-dynamic'

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Auto-sync completed tournament games from NCAA.com into the games table.
// Auth: admin password (Sync Now button) or public sync token (leaderboard auto-sync).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const adminPass = process.env.ADMIN_PASSWORD || ''
  const syncToken = process.env.NEXT_PUBLIC_SYNC_TOKEN || 'madness-sync-2026'
  const validTokens = [adminPass, syncToken].filter(Boolean)
  const token = authHeader ? authHeader.replace('Bearer ', '') : ''

  if (!validTokens.includes(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()

  const { data: dbTeamsRaw } = await supabase
    .from('teams')
    .select('id, name, seed, region, ncaa_slug, eliminated_round')
    .eq('year', YEAR)

  if (!dbTeamsRaw) {
    return NextResponse.json({ error: 'Could not load teams' }, { status: 500 })
  }
  const dbTeams: DbTeam[] = dbTeamsRaw as any

  // Existing games (dedupe)
  const { data: existingGames } = await supabase
    .from('games')
    .select('winner_team_id, loser_team_id, round')
    .eq('year', YEAR)

  const existingKeys = new Set(
    (existingGames || []).map(g => g.winner_team_id + '-' + g.loser_team_id + '-' + g.round)
  )

  // Count picks per team for elimination alerts
  const { data: pickRows } = await supabase
    .from('picks')
    .select('team_id')
    .eq('year', YEAR)
  const pickCounts: Record<string, number> = {}
  for (const p of pickRows || []) {
    pickCounts[p.team_id] = (pickCounts[p.team_id] || 0) + 1
  }

  // Fetch yesterday + today (late tips cross midnight UTC)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const fetched = await Promise.all([
    fetchNcaaScoreboard(yesterday).catch(() => [] as NcaaGame[]),
    fetchNcaaScoreboard(today).catch(() => [] as NcaaGame[]),
  ])
  const allGames = fetched[0].concat(fetched[1])

  const inserted: any[] = []
  const unmatched: string[] = []
  const errors: string[] = []
  const learnedSlugs: string[] = []

  for (const g of allGames) {
    if (g.state !== 'final') continue

    const round = ncaaRoundToOurs(g.bracketRound)
    if (round < 1 || round > 6) continue // skip play-in/opening round and non-tournament games

    const homeTeam = matchTeam(g.home, dbTeams)
    const awayTeam = matchTeam(g.away, dbTeams)

    if (!homeTeam || !awayTeam) {
      if (!homeTeam) unmatched.push(g.home.short + ' (seed ' + (g.home.seed || '?') + ')')
      if (!awayTeam) unmatched.push(g.away.short + ' (seed ' + (g.away.seed || '?') + ')')
      continue
    }

    // Self-learning: persist the NCAA slug so future matches are exact
    if (g.home.seo && homeTeam.ncaa_slug !== g.home.seo) {
      await supabase.from('teams').update({ ncaa_slug: g.home.seo }).eq('id', homeTeam.id)
      learnedSlugs.push(homeTeam.name + ' -> ' + g.home.seo)
    }
    if (g.away.seo && awayTeam.ncaa_slug !== g.away.seo) {
      await supabase.from('teams').update({ ncaa_slug: g.away.seo }).eq('id', awayTeam.id)
      learnedSlugs.push(awayTeam.name + ' -> ' + g.away.seo)
    }

    const homeWon = g.home.score > g.away.score
    const winnerTeam = homeWon ? homeTeam : awayTeam
    const loserTeam = homeWon ? awayTeam : homeTeam
    const winnerScore = homeWon ? g.home.score : g.away.score
    const loserScore = homeWon ? g.away.score : g.home.score
    if (!winnerScore || !loserScore) continue

    const key = winnerTeam.id + '-' + loserTeam.id + '-' + round
    if (existingKeys.has(key)) continue

    const margin = winnerScore - loserScore

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
      errors.push('Insert failed: ' + winnerTeam.name + ' vs ' + loserTeam.name + ' — ' + insertErr.message)
      continue
    }

    await supabase.from('teams')
      .update({ eliminated_round: round })
      .eq('id', loserTeam.id)
      .is('eliminated_round', null)

    existingKeys.add(key)
    inserted.push({
      winner: winnerTeam.name,
      loser: loserTeam.name,
      round,
      score: winnerScore + '-' + loserScore,
    })

    // System chat messages for drama
    try {
      const loserPickCount = pickCounts[loserTeam.id] || 0
      const isUpset = winnerTeam.seed > loserTeam.seed
      let msg = ''
      if (isUpset && winnerTeam.seed - loserTeam.seed >= 4) {
        msg = '🚨 UPSET! #' + winnerTeam.seed + ' ' + winnerTeam.name + ' takes down #' + loserTeam.seed + ' ' + loserTeam.name + ' ' + winnerScore + '-' + loserScore
      } else {
        msg = '🏀 FINAL: ' + winnerTeam.name + ' beats ' + loserTeam.name + ' ' + winnerScore + '-' + loserScore
      }
      if (loserPickCount > 0) {
        msg += ' — ' + loserPickCount + (loserPickCount === 1 ? ' entry loses' : ' entries lose') + ' a team 💀'
      }
      await supabase.from('chat_messages').insert({
        year: YEAR,
        nickname: 'Madness Bot',
        body: msg,
        is_system: true,
      })
    } catch (e) {
      // chat table may not exist yet — don't fail the sync
    }
  }

  return NextResponse.json({
    inserted: inserted.length,
    games: inserted,
    unmatched: Array.from(new Set(unmatched)),
    learnedSlugs,
    errors,
    syncedAt: new Date().toISOString(),
  })
}
