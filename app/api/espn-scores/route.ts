import { NextRequest, NextResponse } from 'next/server'

// ESPN's undocumented but stable scoreboard API for men's college basketball
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'
const ESPN_BRACKET = 'https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/tournaments/22/seasons/2026/bracket'

export async function GET(req: NextRequest) {
  try {
    // Try the bracket endpoint first
    let bracketData = null
    try {
      const bracketRes = await fetch(ESPN_BRACKET, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 120 } // cache 2 minutes
      })
      if (bracketRes.ok) {
        bracketData = await bracketRes.json()
      }
    } catch {}

    // Get today's scoreboard for live/recent scores
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '')
    let scoreboardData = null
    try {
      const scoreRes = await fetch(`${ESPN_SCOREBOARD}?dates=${dateStr}&limit=50`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 60 } // cache 1 minute for live scores
      })
      if (scoreRes.ok) {
        scoreboardData = await scoreRes.json()
      }
    } catch {}

    // Parse scoreboard into game results
    const liveGames: Record<string, any> = {}
    if (scoreboardData?.events) {
      for (const event of scoreboardData.events) {
        const competition = event.competitions?.[0]
        if (!competition) continue

        const competitors = competition.competitors || []
        const home = competitors.find((c: any) => c.homeAway === 'home')
        const away = competitors.find((c: any) => c.homeAway === 'away')

        if (!home || !away) continue

        const status = event.status?.type
        const gameKey = `${away.team?.shortDisplayName?.toLowerCase()}-${home.team?.shortDisplayName?.toLowerCase()}`

        liveGames[gameKey] = {
          id: event.id,
          status: status?.state, // 'pre', 'in', 'post'
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
        }
      }
    }

    return NextResponse.json({
      liveGames,
      bracketData,
      fetchedAt: new Date().toISOString(),
      source: bracketData ? 'espn-bracket+scoreboard' : scoreboardData ? 'espn-scoreboard' : 'unavailable'
    })
  } catch (err: any) {
    return NextResponse.json({
      liveGames: {},
      bracketData: null,
      fetchedAt: new Date().toISOString(),
      source: 'error',
      error: err.message
    }, { status: 200 }) // Always 200 so client gracefully falls back
  }
}
