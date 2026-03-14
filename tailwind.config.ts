// ============================================
// SCORING ENGINE
// Mirrors the Excel formula logic exactly
// ============================================

export const ROUND_NAMES = ['', 'Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8', 'Final Four', 'Championship']
export const ROUND_SHORT = ['', 'R64', 'R32', 'S16', 'E8', 'F4', 'Champ']

// Base points for winning in each round
export const ROUND_BASE_POINTS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
}

// Bonus points for reaching each round (in addition to win points)
export const ROUND_BONUS_POINTS: Record<number, number> = {
  1: 0,
  2: 0,
  3: 1, // +1 for Sweet 16
  4: 2, // +2 for Elite 8
  5: 3, // +3 for Final Four
  6: 4, // +4 for Final 2
  // Championship win gets +5 (handled separately)
}

export interface Game {
  id: string
  round: number
  winner_team_id: string
  loser_team_id: string
  winner_score: number
  loser_score: number
  margin: number
}

export interface Team {
  id: string
  name: string
  seed: number
  eliminated_round: number | null
}

export function calculateTeamPoints(team: Team, games: Game[]): {
  total: number
  breakdown: { round: number; base: number; underdog: number; margin: number; total: number }[]
} {
  const wins = games.filter(g => g.winner_team_id === team.id)
  const breakdown = []
  let total = 0

  for (const game of wins) {
    const base = ROUND_BASE_POINTS[game.round] ?? 0
    const underdog = team.seed >= 9 ? 3 : 0
    const marginBonus = Math.floor(game.margin / 10)
    const roundTotal = base + underdog + marginBonus

    breakdown.push({
      round: game.round,
      base,
      underdog,
      margin: marginBonus,
      total: roundTotal,
    })

    total += roundTotal
  }

  // Championship win bonus
  const champWin = wins.find(g => g.round === 6)
  if (champWin) {
    total += 5
    const existing = breakdown.find(b => b.round === 6)
    if (existing) existing.total += 5
  }

  return { total, breakdown }
}

// Validate team selection rules
export interface TeamSelection {
  teamId: string
  seed: number
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateSelections(selections: TeamSelection[]): ValidationResult {
  const errors: string[] = []

  if (selections.length !== 8) {
    errors.push(`Must select exactly 8 teams (you have ${selections.length})`)
  }

  const seed1 = selections.filter(s => s.seed === 1)
  if (seed1.length !== 1) {
    errors.push(`Must pick exactly 1 #1 seed (you have ${seed1.length})`)
  }

  const seeds234 = selections.filter(s => s.seed >= 2 && s.seed <= 4)
  if (seeds234.length !== 3) {
    errors.push(`Must pick exactly 3 teams seeded #2, #3, or #4 (you have ${seeds234.length})`)
  }

  const seeds5plus = selections.filter(s => s.seed >= 5)
  if (seeds5plus.length !== 4) {
    errors.push(`Must pick exactly 4 teams seeded #5 or lower (you have ${seeds5plus.length})`)
  }

  return { valid: errors.length === 0, errors }
}

// Prize calculations
export function calculatePrizes(totalParticipants: number, entryFee: number = 40) {
  const pool = totalParticipants * entryFee
  const lastPlace = 40
  const prizePool = pool - lastPlace

  return {
    pool,
    places: [
      { place: '1st', amount: Math.round(prizePool * 0.50), pct: '50%' },
      { place: '2nd', amount: Math.round(prizePool * 0.25), pct: '25%' },
      { place: '3rd', amount: Math.round(prizePool * 0.13), pct: '13%' },
      { place: '4th', amount: Math.round(prizePool * 0.08), pct: '8%' },
      { place: '5th', amount: Math.round(prizePool * 0.04), pct: '4%' },
      { place: 'Last', amount: lastPlace, pct: 'their $40 back' },
    ],
  }
}

// Fun stats generator for historical data
export interface HistoricalEntry {
  year: number
  nickname: string
  total_points: number
  final_rank: number
  teams_picked: string[]
}

export function generateFunFacts(nickname: string, history: HistoricalEntry[]): string[] {
  const facts: string[] = []
  const entries = history.filter(h => h.nickname === nickname)

  if (entries.length === 0) return facts

  // Years participated
  facts.push(`Has played in ${entries.length} of the last ${Math.max(...history.map(h => h.year)) - Math.min(...history.map(h => h.year)) + 1} years`)

  // Best finish
  const bestRank = Math.min(...entries.map(e => e.final_rank))
  const bestYear = entries.find(e => e.final_rank === bestRank)?.year
  if (bestRank <= 5) facts.push(`Best finish: ${bestRank === 1 ? '🏆 WON IT ALL' : `#${bestRank}`} in ${bestYear}!`)

  // Favorite teams (picked most often)
  const teamCounts: Record<string, number> = {}
  entries.forEach(e => e.teams_picked?.forEach(t => {
    teamCounts[t] = (teamCounts[t] || 0) + 1
  }))
  const favTeam = Object.entries(teamCounts).sort((a, b) => b[1] - a[1])[0]
  if (favTeam && favTeam[1] >= 2) {
    facts.push(`Loyal to ${favTeam[0]} — picked them ${favTeam[1]} times`)
  }

  // Average score
  const avgPoints = Math.round(entries.reduce((s, e) => s + e.total_points, 0) / entries.length)
  facts.push(`Career average: ${avgPoints} pts/year`)

  return facts
}
