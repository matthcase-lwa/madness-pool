import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================
// KALSHI TITLE ODDS (public, cached)
// Pulls live championship-winner probabilities from Kalshi's public
// market data API (no auth required) and maps them to our teams.
//
// Kalshi market tickers change every season. Configure via env var:
//   KALSHI_CHAMP_EVENT_TICKER  (e.g. the 2027 "NCAA Men's Champion" event)
// If unset, this route attempts discovery against known series
// ticker patterns and falls back gracefully to an empty list.
// ============================================

export const dynamic = 'force-dynamic'

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')
const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2'

// Candidate series tickers for the men's national championship market.
// Verified ticker can be pinned with KALSHI_CHAMP_SERIES_TICKER.
const SERIES_CANDIDATES = ['KXNCAAMBCHAMP', 'KXMARMADCHAMP', 'KXNCAAMCHAMP', 'KXNCAABCHAMP']

// In-memory cache (per serverless instance) - 5 minutes
let _cache: { at: number, payload: any } | null = null
const CACHE_MS = 5 * 60 * 1000

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\bst\.?\b/g, 'state').replace(/[^a-z0-9]/g, '')
}

async function kalshiGet(path: string): Promise<any | null> {
  try {
    const res = await fetch(KALSHI_BASE + path, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function fetchChampMarkets(): Promise<any[]> {
  // 1. Pinned event ticker (most reliable)
  const eventTicker = process.env.KALSHI_CHAMP_EVENT_TICKER
  if (eventTicker) {
    const data = await kalshiGet('/events/' + encodeURIComponent(eventTicker) + '?with_nested_markets=true')
    if (data?.event?.markets?.length) return data.event.markets
    if (data?.markets?.length) return data.markets
  }

  // 2. Pinned or candidate series tickers
  const pinnedSeries = process.env.KALSHI_CHAMP_SERIES_TICKER
  const seriesList = pinnedSeries ? [pinnedSeries] : SERIES_CANDIDATES
  for (const series of seriesList) {
    const data = await kalshiGet('/markets?series_ticker=' + encodeURIComponent(series) + '&status=open&limit=200')
    if (data?.markets?.length) return data.markets
  }
  return []
}

export async function GET() {
  if (_cache && Date.now() - _cache.at < CACHE_MS) {
    return NextResponse.json(_cache.payload, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' },
    })
  }

  const supabase = getAdminClient()
  const { data: dbTeams } = await supabase
    .from('teams')
    .select('id, name, seed, region, eliminated_round, playin_partner')
    .eq('year', YEAR)

  const teams = dbTeams || []
  const byNorm: Record<string, any> = {}
  for (const t of teams) {
    byNorm[normalize(t.name)] = t
    if (t.playin_partner) byNorm[normalize(t.playin_partner)] = t
  }

  const markets = await fetchChampMarkets()

  const odds: any[] = []
  for (const m of markets) {
    // Team name lives in yes_sub_title (e.g. "Duke") or the market title
    const label: string = m.yes_sub_title || m.yes_subtitle || m.subtitle || m.title || ''
    if (!label) continue

    // Probability: midpoint of yes bid/ask, fallback to last price (cents)
    const yesBid = typeof m.yes_bid === 'number' ? m.yes_bid : null
    const yesAsk = typeof m.yes_ask === 'number' ? m.yes_ask : null
    let prob: number | null = null
    if (yesBid !== null && yesAsk !== null && yesAsk > 0) prob = (yesBid + yesAsk) / 2
    else if (typeof m.last_price === 'number') prob = m.last_price
    if (prob === null) continue

    const team = byNorm[normalize(label)] || null
    odds.push({
      label: label,
      probability: Math.round(prob * 10) / 10, // cents == percent
      teamId: team ? team.id : null,
      teamName: team ? team.name : null,
      seed: team ? team.seed : null,
      eliminated: team ? team.eliminated_round !== null : false,
      volume: m.volume || 0,
      ticker: m.ticker || '',
    })
  }

  odds.sort((a, b) => b.probability - a.probability)

  const payload = {
    odds: odds,
    available: odds.length > 0,
    source: 'Kalshi',
    fetchedAt: new Date().toISOString(),
  }
  _cache = { at: Date.now(), payload }

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' },
  })
}
