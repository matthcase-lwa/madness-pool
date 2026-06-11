// NCAA.com live data helpers (server-side only — used by API routes)
// Data source: https://data.ncaa.com/casablanca/scoreboard/basketball-men/d1/YYYY/MM/DD/scoreboard.json
// This is the same free public JSON feed that powers ncaa.com scoreboards.

export interface NcaaTeamInfo {
  score: number
  short: string // e.g. "Ohio St."
  full: string // e.g. "The Ohio State University"
  seo: string // stable slug, e.g. "ohio-st"
  seed: number | null
  winner: boolean
}

export interface NcaaGame {
  gameID: string
  state: string // 'pre' | 'live' | 'final'
  bracketRound: string // e.g. "First Round", "Sweet 16"
  bracketRegion: string
  startTime: string
  currentPeriod: string
  contestClock: string
  home: NcaaTeamInfo
  away: NcaaTeamInfo
}

function parseTeam(t: any): NcaaTeamInfo {
  const names = t?.names || {}
  return {
    score: parseInt(t?.score || '0') || 0,
    short: names.short || '',
    full: names.full || '',
    seo: names.seo || '',
    seed: t?.seed ? parseInt(t.seed) || null : null,
    winner: t?.winner === true,
  }
}

// Fetch scoreboard JSON for a specific date (Date object, uses ET-ish calendar date)
export async function fetchNcaaScoreboard(date: Date): Promise<NcaaGame[]> {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const url = 'https://data.ncaa.com/casablanca/scoreboard/basketball-men/d1/' + y + '/' + m + '/' + d + '/scoreboard.json'

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (madness-pool)' },
    cache: 'no-store',
  })
  if (!res.ok) return []

  const data = await res.json()
  const games: NcaaGame[] = []
  for (const wrapper of data?.games || []) {
    const g = wrapper?.game
    if (!g || !g.home || !g.away) continue
    games.push({
      gameID: String(g.gameID || ''),
      state: g.gameState || (g.finalMessage === 'FINAL' ? 'final' : 'pre'),
      bracketRound: g.bracketRound || '',
      bracketRegion: g.bracketRegion || '',
      startTime: g.startTime || '',
      currentPeriod: g.currentPeriod || '',
      contestClock: g.contestClock || '',
      home: parseTeam(g.home),
      away: parseTeam(g.away),
    })
  }
  return games
}

// Map NCAA bracketRound label to our internal round number (1=R64 ... 6=Championship, 0=play-in)
export function ncaaRoundToOurs(bracketRound: string): number {
  const rl = (bracketRound || '').toLowerCase()
  if (rl.includes('first four') || rl.includes('opening')) return 0
  if (rl.includes('first round') || rl.includes('round of 64') || rl.includes('1st round')) return 1
  if (rl.includes('second round') || rl.includes('round of 32') || rl.includes('2nd round')) return 2
  if (rl.includes('sweet')) return 3
  if (rl.includes('elite')) return 4
  if (rl.includes('final four') || rl.includes('semifinal')) return 5
  if (rl.includes('championship') || rl.includes('national final') || rl.includes('title')) return 6
  return -1 // not a recognized tournament round
}

// Normalize a school name for fuzzy comparison.
// Handles "St." vs "State" vs "Saint", punctuation, parentheticals, common aliases.
export function normalizeName(name: string): string {
  let n = (name || '').toLowerCase().trim()
  n = n.replace(/\(([^)]*)\)/g, ' $1 ') // keep parenthetical content
  n = n.replace(/['’.&-]/g, ' ')
  n = n.replace(/\bst\b/g, 'state') // ambiguous, handled below via alias pass too
  n = n.replace(/\bsaint\b/g, 'state') // collapse saint/state/st to one token for matching
  n = n.replace(/\buniversity\b|\bcollege\b|\bthe\b/g, ' ')
  n = n.replace(/\s+/g, ' ').trim()
  return n
}

export interface DbTeam {
  id: string
  name: string
  seed: number
  region: string
  ncaa_slug: string | null
  eliminated_round: number | null
}

// Match an NCAA team to a DB team.
// Priority: 1) stored ncaa_slug (exact, learned over time)
//           2) seed match + name similarity (seed nearly always present in tournament feed)
//           3) name similarity alone
export function matchTeam(ncaaTeam: NcaaTeamInfo, dbTeams: DbTeam[]): DbTeam | null {
  // 1. Exact slug
  if (ncaaTeam.seo) {
    const bySlug = dbTeams.find(t => t.ncaa_slug === ncaaTeam.seo)
    if (bySlug) return bySlug
  }

  const normShort = normalizeName(ncaaTeam.short)
  const normFull = normalizeName(ncaaTeam.full)
  const normSeo = normalizeName(ncaaTeam.seo.replace(/-/g, ' '))

  function nameMatches(t: DbTeam): boolean {
    const dbNorm = normalizeName(t.name)
    if (!dbNorm) return false
    if (dbNorm === normShort || dbNorm === normSeo) return true
    // containment either direction (e.g. "michigan" in "michigan wolverines")
    if (normFull && (normFull.indexOf(dbNorm) !== -1 || dbNorm.indexOf(normShort) !== -1)) return true
    if (normShort && (normShort.indexOf(dbNorm) !== -1 || dbNorm.indexOf(normShort) !== -1)) return true
    return false
  }

  // 2. Seed-constrained match (at most ~4 teams share a seed)
  if (ncaaTeam.seed) {
    const seedPool = dbTeams.filter(t => t.seed === ncaaTeam.seed)
    const hits = seedPool.filter(nameMatches)
    if (hits.length === 1) return hits[0]
  }

  // 3. Name-only match (must be unambiguous)
  const hits = dbTeams.filter(nameMatches)
  if (hits.length === 1) return hits[0]

  return null
}
