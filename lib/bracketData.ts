// 2026 NCAA Tournament Bracket Structure
// All first-round matchups confirmed from ESPN bracket reveal

export interface BracketTeam {
  name: string
  seed: number
  espnId?: number
  score?: number
  winner?: boolean
  eliminated?: boolean
}

export interface BracketGame {
  id: string
  round: number // 1=R64, 2=R32, 3=S16, 4=E8, 5=F4, 6=Championship
  region: string // 'East' | 'West' | 'Midwest' | 'South' | 'Final Four'
  top: BracketTeam | null
  bottom: BracketTeam | null
  topScore?: number
  bottomScore?: number
  status?: 'pre' | 'live' | 'final'
  statusDetail?: string
  winnerId?: 'top' | 'bottom'
  // For play-in games
  isPlayIn?: boolean
}

// Round 1 matchups — confirmed from ESPN Selection Sunday reveal
export const BRACKET_2026: BracketGame[] = [
  // ══════════════════════════════════════════
  // EAST REGION
  // ══════════════════════════════════════════
  { id: 'E1', round: 1, region: 'East', top: { name: 'Duke', seed: 1, espnId: 150 }, bottom: { name: 'Siena', seed: 16, espnId: 2561 } },
  { id: 'E2', round: 1, region: 'East', top: { name: 'Ohio State', seed: 8, espnId: 194 }, bottom: { name: 'TCU', seed: 9, espnId: 2628 } },
  { id: 'E3', round: 1, region: 'East', top: { name: 'St. John\'s', seed: 5, espnId: 2599 }, bottom: { name: 'Northern Iowa', seed: 12, espnId: 2271 } },
  { id: 'E4', round: 1, region: 'East', top: { name: 'Kansas', seed: 4, espnId: 2305 }, bottom: { name: 'Cal Baptist', seed: 13, espnId: 2856 } },
  { id: 'E5', round: 1, region: 'East', top: { name: 'Louisville', seed: 6, espnId: 97 }, bottom: { name: 'South Florida', seed: 11, espnId: 58 } },
  { id: 'E6', round: 1, region: 'East', top: { name: 'Michigan State', seed: 3, espnId: 127 }, bottom: { name: 'North Dakota State', seed: 14, espnId: 2449 } },
  { id: 'E7', round: 1, region: 'East', top: { name: 'UCLA', seed: 7, espnId: 26 }, bottom: { name: 'UCF', seed: 10, espnId: 2116 } },
  { id: 'E8', round: 1, region: 'East', top: { name: 'UConn', seed: 2, espnId: 41 }, bottom: { name: 'Furman', seed: 15, espnId: 231 } },

  // East R2 (TBD)
  { id: 'E9',  round: 2, region: 'East', top: null, bottom: null },
  { id: 'E10', round: 2, region: 'East', top: null, bottom: null },
  { id: 'E11', round: 2, region: 'East', top: null, bottom: null },
  { id: 'E12', round: 2, region: 'East', top: null, bottom: null },

  // East S16
  { id: 'E13', round: 3, region: 'East', top: null, bottom: null },
  { id: 'E14', round: 3, region: 'East', top: null, bottom: null },

  // East E8
  { id: 'E15', round: 4, region: 'East', top: null, bottom: null },

  // ══════════════════════════════════════════
  // SOUTH REGION
  // ══════════════════════════════════════════
  { id: 'S1', round: 1, region: 'South', top: { name: 'Florida', seed: 1, espnId: 57 }, bottom: { name: 'Prairie View A&M', seed: 16, espnId: 2440, eliminated: false } },
  { id: 'S2', round: 1, region: 'South', top: { name: 'Clemson', seed: 8, espnId: 228 }, bottom: { name: 'Iowa', seed: 9, espnId: 2294 } },
  { id: 'S3', round: 1, region: 'South', top: { name: 'Vanderbilt', seed: 5, espnId: 238 }, bottom: { name: 'McNeese', seed: 12, espnId: 2381 } },
  { id: 'S4', round: 1, region: 'South', top: { name: 'Nebraska', seed: 4, espnId: 158 }, bottom: { name: 'Troy', seed: 13, espnId: 2653 } },
  { id: 'S5', round: 1, region: 'South', top: { name: 'North Carolina', seed: 6, espnId: 153 }, bottom: { name: 'VCU', seed: 11, espnId: 2670 } },
  { id: 'S6', round: 1, region: 'South', top: { name: 'Illinois', seed: 3, espnId: 356 }, bottom: { name: 'Penn', seed: 14, espnId: 219 } },
  { id: 'S7', round: 1, region: 'South', top: { name: 'Saint Mary\'s', seed: 7, espnId: 2608 }, bottom: { name: 'Texas A&M', seed: 10, espnId: 245 } },
  { id: 'S8', round: 1, region: 'South', top: { name: 'Houston', seed: 2, espnId: 248 }, bottom: { name: 'Idaho', seed: 15, espnId: 70 } },

  // South R2-E8 (TBD)
  { id: 'S9',  round: 2, region: 'South', top: null, bottom: null },
  { id: 'S10', round: 2, region: 'South', top: null, bottom: null },
  { id: 'S11', round: 2, region: 'South', top: null, bottom: null },
  { id: 'S12', round: 2, region: 'South', top: null, bottom: null },
  { id: 'S13', round: 3, region: 'South', top: null, bottom: null },
  { id: 'S14', round: 3, region: 'South', top: null, bottom: null },
  { id: 'S15', round: 4, region: 'South', top: null, bottom: null },

  // ══════════════════════════════════════════
  // MIDWEST REGION
  // ══════════════════════════════════════════
  { id: 'M1', round: 1, region: 'Midwest', top: { name: 'Michigan', seed: 1, espnId: 130 }, bottom: { name: 'UMBC', seed: 16, espnId: 2430 } },
  { id: 'M2', round: 1, region: 'Midwest', top: { name: 'Georgia', seed: 8, espnId: 61 }, bottom: { name: 'St. Louis', seed: 9, espnId: 139 } },
  { id: 'M3', round: 1, region: 'Midwest', top: { name: 'Kentucky', seed: 5, espnId: 96 }, bottom: { name: 'Akron', seed: 12, espnId: 2006 } },
  { id: 'M4', round: 1, region: 'Midwest', top: { name: 'Alabama', seed: 4, espnId: 333 }, bottom: { name: 'Hofstra', seed: 13, espnId: 2363 } },
  { id: 'M5', round: 1, region: 'Midwest', top: { name: 'Tennessee', seed: 6, espnId: 2633 }, bottom: { name: 'Texas', seed: 11, espnId: 251 } },
  { id: 'M6', round: 1, region: 'Midwest', top: { name: 'Virginia', seed: 3, espnId: 258 }, bottom: { name: 'Wright State', seed: 14, espnId: 2739 } },
  { id: 'M7', round: 1, region: 'Midwest', top: { name: 'Miami (FL)', seed: 7, espnId: 2390 }, bottom: { name: 'Santa Clara', seed: 10, espnId: 327 } },
  { id: 'M8', round: 1, region: 'Midwest', top: { name: 'Iowa State', seed: 2, espnId: 66 }, bottom: { name: 'Tennessee State', seed: 15, espnId: 2634 } },

  // Midwest R2-E8 (TBD)
  { id: 'M9',  round: 2, region: 'Midwest', top: null, bottom: null },
  { id: 'M10', round: 2, region: 'Midwest', top: null, bottom: null },
  { id: 'M11', round: 2, region: 'Midwest', top: null, bottom: null },
  { id: 'M12', round: 2, region: 'Midwest', top: null, bottom: null },
  { id: 'M13', round: 3, region: 'Midwest', top: null, bottom: null },
  { id: 'M14', round: 3, region: 'Midwest', top: null, bottom: null },
  { id: 'M15', round: 4, region: 'Midwest', top: null, bottom: null },

  // ══════════════════════════════════════════
  // WEST REGION
  // ══════════════════════════════════════════
  { id: 'W1', round: 1, region: 'West', top: { name: 'Arizona', seed: 1, espnId: 12 }, bottom: { name: 'LIU', seed: 16, espnId: 2736 } },
  { id: 'W2', round: 1, region: 'West', top: { name: 'Utah State', seed: 8, espnId: 328 }, bottom: { name: 'Baylor', seed: 9, espnId: 239 } },
  { id: 'W3', round: 1, region: 'West', top: { name: 'Texas Tech', seed: 5, espnId: 2641 }, bottom: { name: 'High Point', seed: 12, espnId: 2363 } },
  { id: 'W4', round: 1, region: 'West', top: { name: 'Arkansas', seed: 4, espnId: 8 }, bottom: { name: 'Kennesaw State', seed: 14, espnId: 2674 } },
  { id: 'W5', round: 1, region: 'West', top: { name: 'Missouri', seed: 6, espnId: 142 }, bottom: { name: 'Texas', seed: 11, espnId: 251 } },
  { id: 'W6', round: 1, region: 'West', top: { name: 'Gonzaga', seed: 3, espnId: 2250 }, bottom: { name: 'Queens', seed: 14, espnId: 2885 } },
  { id: 'W7', round: 1, region: 'West', top: { name: 'NC State', seed: 10, espnId: 152 }, bottom: { name: 'Purdue', seed: 2, espnId: 2509 } },
  { id: 'W8', round: 1, region: 'West', top: { name: 'Purdue', seed: 2, espnId: 2509 }, bottom: { name: 'NC State', seed: 10, espnId: 152 } },

  // West R2-E8 (TBD)
  { id: 'W9',  round: 2, region: 'West', top: null, bottom: null },
  { id: 'W10', round: 2, region: 'West', top: null, bottom: null },
  { id: 'W11', round: 2, region: 'West', top: null, bottom: null },
  { id: 'W12', round: 2, region: 'West', top: null, bottom: null },
  { id: 'W13', round: 3, region: 'West', top: null, bottom: null },
  { id: 'W14', round: 3, region: 'West', top: null, bottom: null },
  { id: 'W15', round: 4, region: 'West', top: null, bottom: null },

  // ══════════════════════════════════════════
  // FINAL FOUR + CHAMPIONSHIP
  // ══════════════════════════════════════════
  { id: 'FF1', round: 5, region: 'Final Four', top: null, bottom: null }, // East vs South
  { id: 'FF2', round: 5, region: 'Final Four', top: null, bottom: null }, // Midwest vs West
  { id: 'CHAMP', round: 6, region: 'Championship', top: null, bottom: null },
]

export const REGION_COLORS: Record<string, string> = {
  East: 'text-blue-400 border-blue-500/30 bg-blue-500/5',
  South: 'text-orange-400 border-orange-500/30 bg-orange-500/5',
  Midwest: 'text-maize-400 border-maize-500/30 bg-maize-500/5',
  West: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
  'Final Four': 'text-purple-400 border-purple-500/30 bg-purple-500/5',
  Championship: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5',
}

export const ROUND_LABELS: Record<number, string> = {
  1: 'Round of 64',
  2: 'Round of 32',
  3: 'Sweet 16',
  4: 'Elite 8',
  5: 'Final Four',
  6: 'Championship',
}
