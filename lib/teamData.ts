// 2026 NCAA Tournament team metadata — fully verified March 15 2026
// ESPN logo URL: https://a.espncdn.com/i/teamlogos/ncaa/500/{espnId}.png

export interface TeamMeta {
  name: string
  record: string
  espnId: number | null
}

export const TEAM_META: Record<string, TeamMeta> = {
  // ── EAST ──────────────────────────────────────────────
  'Duke':                { name: 'Duke',               record: '32-2',  espnId: 150  },
  'UConn':               { name: 'UConn',              record: '29-5',  espnId: 41   },
  'Michigan State':      { name: 'Michigan State',     record: '25-7',  espnId: 127  },
  'Kansas':              { name: 'Kansas',             record: '23-10', espnId: 2305 },
  "St. John's":          { name: "St. John's",         record: '28-6',  espnId: 2599 },
  'Louisville':          { name: 'Louisville',         record: '23-10', espnId: 97   },
  'UCLA':                { name: 'UCLA',               record: '23-11', espnId: 26   },
  'Ohio State':          { name: 'Ohio State',         record: '24-8',  espnId: 194  },
  'TCU':                 { name: 'TCU',                record: '22-11', espnId: 2628 },
  'UCF':                 { name: 'UCF',                record: '21-11', espnId: 2116 },
  'South Florida':       { name: 'South Florida',      record: '25-8',  espnId: 58   },
  'Northern Iowa':       { name: 'Northern Iowa',      record: '23-12', espnId: 2271 },
  'Cal Baptist':         { name: 'Cal Baptist',        record: '25-8',  espnId: 2856 },
  'North Dakota State':  { name: 'North Dakota State', record: '27-7',  espnId: 2449 },
  'Furman':              { name: 'Furman',             record: '22-12', espnId: 231  },
  'Siena':               { name: 'Siena',              record: '23-11', espnId: 2561 },

  // ── WEST ──────────────────────────────────────────────
  'Arizona':             { name: 'Arizona',            record: '32-2',  espnId: 12   },
  'Purdue':              { name: 'Purdue',             record: '27-8',  espnId: 2509 },
  'Gonzaga':             { name: 'Gonzaga',            record: '27-7',  espnId: 2250 },
  'Arkansas':            { name: 'Arkansas',           record: '23-12', espnId: 8    },
  'Wisconsin':           { name: 'Wisconsin',          record: '22-10', espnId: 275  },
  'BYU':                 { name: 'BYU',                record: '23-10', espnId: 252  },
  'Miami (FL)':          { name: 'Miami (FL)',         record: '22-11', espnId: 2390 },
  'Villanova':           { name: 'Villanova',          record: '22-11', espnId: 222  },
  'Utah State':          { name: 'Utah State',         record: '28-5',  espnId: 328  },
  'Missouri':            { name: 'Missouri',           record: '22-11', espnId: 142  },
  'Texas':               { name: 'Texas',              record: '18-14', espnId: 251  },
  'NC State':            { name: 'NC State',           record: '20-13', espnId: 152  },
  'High Point':          { name: 'High Point',         record: '24-10', espnId: 2428 },
  'Hawaii':              { name: 'Hawaii',             record: '22-12', espnId: 62   },
  'Kennesaw State':      { name: 'Kennesaw State',     record: '23-11', espnId: 2674 },
  'Queens':              { name: 'Queens',             record: '29-5',  espnId: 2885 },
  'LIU':                 { name: 'LIU',                record: '21-12', espnId: 2736 },

  // ── MIDWEST ───────────────────────────────────────────
  'Michigan':            { name: 'Michigan',           record: '31-3',  espnId: 130  },
  'Iowa State':          { name: 'Iowa State',         record: '27-7',  espnId: 66   },
  'Virginia':            { name: 'Virginia',           record: '24-9',  espnId: 258  },
  'Alabama':             { name: 'Alabama',            record: '21-13', espnId: 333  },
  'Texas Tech':          { name: 'Texas Tech',         record: '24-9',  espnId: 2641 },
  'Tennessee':           { name: 'Tennessee',          record: '24-9',  espnId: 2633 },
  'Kentucky':            { name: 'Kentucky',           record: '22-13', espnId: 96   },
  'Georgia':             { name: 'Georgia',            record: '19-14', espnId: 61   },
  'Saint Louis':         { name: 'Saint Louis',        record: '22-11', espnId: 139  },
  'Santa Clara':         { name: 'Santa Clara',        record: '24-9',  espnId: 327  },
  'SMU':                 { name: 'SMU',                record: '20-13', espnId: 2567 },
  'Miami (OH)':          { name: 'Miami (OH)',         record: '31-1',  espnId: 193  },
  'Akron':               { name: 'Akron',              record: '22-12', espnId: 2006 },
  'Hofstra':             { name: 'Hofstra',            record: '25-9',  espnId: 2363 },
  'Wright State':        { name: 'Wright State',       record: '24-11', espnId: 2739 },
  'Tennessee State':     { name: 'Tennessee State',    record: '20-13', espnId: 2634 },
  'UMBC':                { name: 'UMBC',               record: '23-10', espnId: 2430 },
  'Howard':              { name: 'Howard',             record: '18-16', espnId: 2710 },

  // ── SOUTH ─────────────────────────────────────────────
  'Florida':             { name: 'Florida',            record: '26-7',  espnId: 57   },
  'Houston':             { name: 'Houston',            record: '28-6',  espnId: 248  },
  'Illinois':            { name: 'Illinois',           record: '24-9',  espnId: 356  },
  'Nebraska':            { name: 'Nebraska',           record: '22-11', espnId: 158  },
  'Vanderbilt':          { name: 'Vanderbilt',         record: '27-5',  espnId: 238  },
  'North Carolina':      { name: 'North Carolina',     record: '22-12', espnId: 153  },
  "Saint Mary's":        { name: "Saint Mary's",       record: '27-6',  espnId: 2608 },
  'Clemson':             { name: 'Clemson',            record: '22-11', espnId: 228  },
  'Iowa':                { name: 'Iowa',               record: '21-12', espnId: 2294 },
  'Texas A&M':           { name: 'Texas A&M',          record: '21-12', espnId: 245  },
  'VCU':                 { name: 'VCU',                record: '28-5',  espnId: 2670 },
  'McNeese':             { name: 'McNeese',            record: '27-6',  espnId: 2381 },
  'Troy':                { name: 'Troy',               record: '23-11', espnId: 2653 },
  'Penn':                { name: 'Penn',               record: '22-9',  espnId: 219  },
  'Idaho':               { name: 'Idaho',              record: '24-9',  espnId: 70   },
  'Prairie View A&M':    { name: 'Prairie View A&M',   record: '18-14', espnId: 2440 },
  'Lehigh':              { name: 'Lehigh',             record: '21-12', espnId: 322  },
}

export function getLogoUrl(teamName: string): string | null {
  const meta = TEAM_META[teamName]
  if (!meta?.espnId) return null
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${meta.espnId}.png`
}

export function getRecord(teamName: string): string {
  return TEAM_META[teamName]?.record ?? ''
}
