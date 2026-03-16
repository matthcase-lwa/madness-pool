// 2026 NCAA Tournament Bracket Structure
// All matchups verified from Yahoo Sports / CBS Sports / NBC Sports bracket reveals
// Source: https://sports.yahoo.com/mens-college-basketball/breaking-news/article/march-madness-bracket-revealed-2026-ncaa-mens-tournament-announced-with-duke-as-no-1-overall-seed-220224455.html

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
  region: string
  top: BracketTeam | null
  bottom: BracketTeam | null
  topScore?: number
  bottomScore?: number
  status?: 'pre' | 'live' | 'final'
  statusDetail?: string
  winnerId?: 'top' | 'bottom'
  isPlayIn?: boolean
}

// ─── VERIFIED BRACKET ────────────────────────────────────────────────────────
// East:    Duke(1) Arizona(1)→West Michigan(1)→Midwest Florida(1)→South
//
// EAST REGION — Duke #1 overall seed
// 1 Duke vs 16 Siena
// 8 Ohio State vs 9 TCU
// 5 St. John's vs 12 Northern Iowa
// 4 Kansas vs 13 Cal Baptist
// 6 Louisville vs 11 South Florida
// 3 Michigan State vs 14 North Dakota State
// 7 UCLA vs 10 UCF
// 2 UConn vs 15 Furman
//
// WEST REGION — Arizona #2 overall seed
// 1 Arizona vs 16 LIU
// 8 Villanova vs 9 Utah State
// 5 Wisconsin vs 12 High Point
// 4 Arkansas vs 13 Hawaii
// 6 BYU vs 11 Texas/NC State (First Four play-in)
// 3 Gonzaga vs 14 Kennesaw State
// 7 Miami (FL) vs 10 Missouri
// 2 Purdue vs 15 Queens
//
// MIDWEST REGION — Michigan #3 overall seed
// 1 Michigan vs 16 UMBC/Howard (First Four play-in)
// 8 Georgia vs 9 Saint Louis
// 5 Texas Tech vs 12 Akron
// 4 Alabama vs 13 Hofstra
// 6 Tennessee vs 11 SMU/Miami(OH) (First Four play-in)
// 3 Virginia vs 14 Wright State
// 7 Kentucky vs 10 Santa Clara
// 2 Iowa State vs 15 Tennessee State
//
// SOUTH REGION — Florida #4 overall seed
// 1 Florida vs 16 Prairie View A&M/Lehigh (First Four play-in)
// 8 Clemson vs 9 Iowa
// 5 Vanderbilt vs 12 McNeese
// 4 Nebraska vs 13 Troy
// 6 North Carolina vs 11 VCU
// 3 Illinois vs 14 Penn
// 7 Saint Mary's vs 10 Texas A&M
// 2 Houston vs 15 Idaho

export const BRACKET_2026: BracketGame[] = [
  // ══════════════════════════════════════════
  // EAST REGION
  // ══════════════════════════════════════════
  { id: 'E1', round: 1, region: 'East', top: { name: 'Duke',          seed: 1,  espnId: 150  }, bottom: { name: 'Siena',            seed: 16, espnId: 2561 } },
  { id: 'E2', round: 1, region: 'East', top: { name: 'Ohio State',    seed: 8,  espnId: 194  }, bottom: { name: 'TCU',              seed: 9,  espnId: 2628 } },
  { id: 'E3', round: 1, region: 'East', top: { name: "St. John's",    seed: 5,  espnId: 2599 }, bottom: { name: 'Northern Iowa',    seed: 12, espnId: 2271 } },
  { id: 'E4', round: 1, region: 'East', top: { name: 'Kansas',        seed: 4,  espnId: 2305 }, bottom: { name: 'Cal Baptist',      seed: 13, espnId: 2856 } },
  { id: 'E5', round: 1, region: 'East', top: { name: 'Louisville',    seed: 6,  espnId: 97   }, bottom: { name: 'South Florida',    seed: 11, espnId: 58   } },
  { id: 'E6', round: 1, region: 'East', top: { name: 'Michigan State',seed: 3,  espnId: 127  }, bottom: { name: 'North Dakota State',seed: 14, espnId: 2449 } },
  { id: 'E7', round: 1, region: 'East', top: { name: 'UCLA',          seed: 7,  espnId: 26   }, bottom: { name: 'UCF',              seed: 10, espnId: 2116 } },
  { id: 'E8', round: 1, region: 'East', top: { name: 'UConn',         seed: 2,  espnId: 41   }, bottom: { name: 'Furman',           seed: 15, espnId: 231  } },
  { id: 'E9',  round: 2, region: 'East', top: null, bottom: null },
  { id: 'E10', round: 2, region: 'East', top: null, bottom: null },
  { id: 'E11', round: 2, region: 'East', top: null, bottom: null },
  { id: 'E12', round: 2, region: 'East', top: null, bottom: null },
  { id: 'E13', round: 3, region: 'East', top: null, bottom: null },
  { id: 'E14', round: 3, region: 'East', top: null, bottom: null },
  { id: 'E15', round: 4, region: 'East', top: null, bottom: null },

  // ══════════════════════════════════════════
  // WEST REGION — Arizona #2 overall seed
  // ══════════════════════════════════════════
  { id: 'W1', round: 1, region: 'West', top: { name: 'Arizona',       seed: 1,  espnId: 12   }, bottom: { name: 'LIU',             seed: 16, espnId: 2736 } },
  { id: 'W2', round: 1, region: 'West', top: { name: 'Villanova',     seed: 8,  espnId: 222  }, bottom: { name: 'Utah State',      seed: 9,  espnId: 328  } },
  { id: 'W3', round: 1, region: 'West', top: { name: 'Wisconsin',     seed: 5,  espnId: 275  }, bottom: { name: 'High Point',      seed: 12, espnId: 2428 } },
  { id: 'W4', round: 1, region: 'West', top: { name: 'Arkansas',      seed: 4,  espnId: 8    }, bottom: { name: 'Hawaii',          seed: 13, espnId: 62   } },
  { id: 'W5', round: 1, region: 'West', top: { name: 'BYU',           seed: 6,  espnId: 252  }, bottom: { name: 'Texas',           seed: 11, espnId: 251, }, isPlayIn: true },
  { id: 'W6', round: 1, region: 'West', top: { name: 'Gonzaga',       seed: 3,  espnId: 2250 }, bottom: { name: 'Kennesaw State',  seed: 14, espnId: 2674 } },
  { id: 'W7', round: 1, region: 'West', top: { name: 'Miami (FL)',     seed: 7,  espnId: 2390 }, bottom: { name: 'Missouri',        seed: 10, espnId: 142  } },
  { id: 'W8', round: 1, region: 'West', top: { name: 'Purdue',        seed: 2,  espnId: 2509 }, bottom: { name: 'Queens',          seed: 15, espnId: 2885 } },
  { id: 'W9',  round: 2, region: 'West', top: null, bottom: null },
  { id: 'W10', round: 2, region: 'West', top: null, bottom: null },
  { id: 'W11', round: 2, region: 'West', top: null, bottom: null },
  { id: 'W12', round: 2, region: 'West', top: null, bottom: null },
  { id: 'W13', round: 3, region: 'West', top: null, bottom: null },
  { id: 'W14', round: 3, region: 'West', top: null, bottom: null },
  { id: 'W15', round: 4, region: 'West', top: null, bottom: null },

  // ══════════════════════════════════════════
  // MIDWEST REGION — Michigan #3 overall seed
  // ══════════════════════════════════════════
  { id: 'M1', round: 1, region: 'Midwest', top: { name: 'Michigan',    seed: 1,  espnId: 130  }, bottom: { name: 'UMBC',            seed: 16, espnId: 2430 }, isPlayIn: true },
  { id: 'M2', round: 1, region: 'Midwest', top: { name: 'Georgia',     seed: 8,  espnId: 61   }, bottom: { name: 'Saint Louis',     seed: 9,  espnId: 139  } },
  { id: 'M3', round: 1, region: 'Midwest', top: { name: 'Texas Tech',  seed: 5,  espnId: 2641 }, bottom: { name: 'Akron',           seed: 12, espnId: 2006 } },
  { id: 'M4', round: 1, region: 'Midwest', top: { name: 'Alabama',     seed: 4,  espnId: 333  }, bottom: { name: 'Hofstra',         seed: 13, espnId: 2363 } },
  { id: 'M5', round: 1, region: 'Midwest', top: { name: 'Tennessee',   seed: 6,  espnId: 2633 }, bottom: { name: 'SMU',             seed: 11, espnId: 2567 }, isPlayIn: true },
  { id: 'M6', round: 1, region: 'Midwest', top: { name: 'Virginia',    seed: 3,  espnId: 258  }, bottom: { name: 'Wright State',    seed: 14, espnId: 2739 } },
  { id: 'M7', round: 1, region: 'Midwest', top: { name: 'Kentucky',    seed: 7,  espnId: 96   }, bottom: { name: 'Santa Clara',     seed: 10, espnId: 327  } },
  { id: 'M8', round: 1, region: 'Midwest', top: { name: 'Iowa State',  seed: 2,  espnId: 66   }, bottom: { name: 'Tennessee State', seed: 15, espnId: 2634 } },
  { id: 'M9',  round: 2, region: 'Midwest', top: null, bottom: null },
  { id: 'M10', round: 2, region: 'Midwest', top: null, bottom: null },
  { id: 'M11', round: 2, region: 'Midwest', top: null, bottom: null },
  { id: 'M12', round: 2, region: 'Midwest', top: null, bottom: null },
  { id: 'M13', round: 3, region: 'Midwest', top: null, bottom: null },
  { id: 'M14', round: 3, region: 'Midwest', top: null, bottom: null },
  { id: 'M15', round: 4, region: 'Midwest', top: null, bottom: null },

  // ══════════════════════════════════════════
  // SOUTH REGION — Florida #4 overall seed
  // ══════════════════════════════════════════
  { id: 'S1', round: 1, region: 'South', top: { name: 'Florida',      seed: 1,  espnId: 57   }, bottom: { name: 'Prairie View A&M',seed: 16, espnId: 2440 }, isPlayIn: true },
  { id: 'S2', round: 1, region: 'South', top: { name: 'Clemson',      seed: 8,  espnId: 228  }, bottom: { name: 'Iowa',            seed: 9,  espnId: 2294 } },
  { id: 'S3', round: 1, region: 'South', top: { name: 'Vanderbilt',   seed: 5,  espnId: 238  }, bottom: { name: 'McNeese',         seed: 12, espnId: 2381 } },
  { id: 'S4', round: 1, region: 'South', top: { name: 'Nebraska',     seed: 4,  espnId: 158  }, bottom: { name: 'Troy',            seed: 13, espnId: 2653 } },
  { id: 'S5', round: 1, region: 'South', top: { name: 'North Carolina',seed: 6, espnId: 153  }, bottom: { name: 'VCU',             seed: 11, espnId: 2670 } },
  { id: 'S6', round: 1, region: 'South', top: { name: 'Illinois',     seed: 3,  espnId: 356  }, bottom: { name: 'Penn',            seed: 14, espnId: 219  } },
  { id: 'S7', round: 1, region: 'South', top: { name: "Saint Mary's", seed: 7,  espnId: 2608 }, bottom: { name: 'Texas A&M',       seed: 10, espnId: 245  } },
  { id: 'S8', round: 1, region: 'South', top: { name: 'Houston',      seed: 2,  espnId: 248  }, bottom: { name: 'Idaho',           seed: 15, espnId: 70   } },
  { id: 'S9',  round: 2, region: 'South', top: null, bottom: null },
  { id: 'S10', round: 2, region: 'South', top: null, bottom: null },
  { id: 'S11', round: 2, region: 'South', top: null, bottom: null },
  { id: 'S12', round: 2, region: 'South', top: null, bottom: null },
  { id: 'S13', round: 3, region: 'South', top: null, bottom: null },
  { id: 'S14', round: 3, region: 'South', top: null, bottom: null },
  { id: 'S15', round: 4, region: 'South', top: null, bottom: null },

  // ══════════════════════════════════════════
  // FINAL FOUR + CHAMPIONSHIP
  // ══════════════════════════════════════════
  { id: 'FF1',  round: 5, region: 'Final Four',    top: null, bottom: null }, // East vs South
  { id: 'FF2',  round: 5, region: 'Final Four',    top: null, bottom: null }, // Midwest vs West
  { id: 'CHAMP',round: 6, region: 'Championship',  top: null, bottom: null },
]

export const REGION_COLORS: Record<string, string> = {
  East:         'text-blue-400 border-blue-500/30 bg-blue-500/5',
  South:        'text-orange-400 border-orange-500/30 bg-orange-500/5',
  Midwest:      'text-maize-400 border-maize-500/30 bg-maize-500/5',
  West:         'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
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
