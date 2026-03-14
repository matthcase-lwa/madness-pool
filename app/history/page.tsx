'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface HistoricalEntry {
  year: number
  nickname: string
  full_name: string
  total_points: number
  final_rank: number
  teams_picked: string[]
}

interface PlayerStats {
  nickname: string
  full_name: string
  years: number[]
  totalPoints: number
  avgPoints: number
  bestRank: number
  bestYear: number
  worstRank: number
  wins: number // times finished 1st
  top5: number
  lastPlaces: number
  teamFrequency: Record<string, number>
  yearlyScores: { year: number; points: number; rank: number }[]
  funFacts: string[]
}

function generateFunFacts(stats: PlayerStats, allStats: PlayerStats[]): string[] {
  const facts: string[] = []
  const entries = stats.years.length

  // Participation
  if (entries === 1) facts.push(`🆕 First year in the pool!`)
  else if (entries >= 8) facts.push(`🏛️ A true veteran — ${entries} years in the pool`)
  else facts.push(`${entries} years of Madness`)

  // Best finish
  if (stats.wins > 0) facts.push(`🏆 ${stats.wins === 1 ? 'Won it all once' : `Won it all ${stats.wins} times`}!`)
  else if (stats.bestRank <= 3) facts.push(`🥈 Best finish: #${stats.bestRank} in ${stats.bestYear}`)
  else if (stats.bestRank <= 5) facts.push(`Best finish: #${stats.bestRank} in ${stats.bestYear}`)

  // Last places
  if (stats.lastPlaces > 0) facts.push(`🐢 ${stats.lastPlaces === 1 ? 'Finished last once' : `Finished last ${stats.lastPlaces} times`} — but got their $40 back!`)

  // Scoring trend
  if (entries >= 3) {
    const recentAvg = stats.yearlyScores.slice(-2).reduce((s, y) => s + y.points, 0) / 2
    const earlyAvg = stats.yearlyScores.slice(0, 2).reduce((s, y) => s + y.points, 0) / 2
    if (recentAvg > earlyAvg + 5) facts.push(`📈 Getting better with age! Avg ${Math.round(recentAvg)} pts recently`)
    else if (recentAvg < earlyAvg - 5) facts.push(`📉 Early years were stronger (avg ${Math.round(earlyAvg)} pts vs ${Math.round(recentAvg)} recently)`)
  }

  // Favorite teams
  const topTeams = Object.entries(stats.teamFrequency)
    .sort((a, b) => b[1] - a[1])
    .filter(([, count]) => count >= 2)

  if (topTeams.length > 0) {
    const [team, count] = topTeams[0]
    facts.push(`❤️ Can't quit ${team} — picked them ${count} out of ${entries} years`)
  }

  // Avg rank compared to pool
  const avgRankAll = allStats.reduce((s, p) => s + (p.yearlyScores.reduce((a, y) => a + y.rank, 0) / p.yearlyScores.length), 0) / allStats.length
  const playerAvgRank = stats.yearlyScores.reduce((s, y) => s + y.rank, 0) / stats.yearlyScores.length
  if (playerAvgRank < avgRankAll - 5) facts.push(`💪 Consistently above average — career avg rank #${Math.round(playerAvgRank)}`)

  return facts.slice(0, 4)
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoricalEntry[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'avgPoints' | 'wins' | 'years' | 'bestRank'>('avgPoints')
  const [years, setYears] = useState<number[]>([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('historical_results')
        .select('*')
        .order('year')

      if (!data || data.length === 0) {
        setLoading(false)
        return
      }

      setHistory(data)

      const uniqueYears = [...new Set(data.map(d => d.year))].sort()
      setYears(uniqueYears)

      // Compute per-player stats
      const playerMap: Record<string, PlayerStats> = {}

      data.forEach(entry => {
        if (!playerMap[entry.nickname]) {
          playerMap[entry.nickname] = {
            nickname: entry.nickname,
            full_name: entry.full_name,
            years: [],
            totalPoints: 0,
            avgPoints: 0,
            bestRank: Infinity,
            bestYear: 0,
            worstRank: 0,
            wins: 0,
            top5: 0,
            lastPlaces: 0,
            teamFrequency: {},
            yearlyScores: [],
            funFacts: [],
          }
        }

        const p = playerMap[entry.nickname]
        p.years.push(entry.year)
        p.totalPoints += entry.total_points
        p.yearlyScores.push({ year: entry.year, points: entry.total_points, rank: entry.final_rank })

        if (entry.final_rank < p.bestRank) {
          p.bestRank = entry.final_rank
          p.bestYear = entry.year
        }
        if (entry.final_rank > p.worstRank) p.worstRank = entry.final_rank
        if (entry.final_rank === 1) p.wins++
        if (entry.final_rank <= 5) p.top5++

        // Count team frequency
        entry.teams_picked?.forEach((team: string) => {
          p.teamFrequency[team] = (p.teamFrequency[team] || 0) + 1
        })
      })

      // Find last place per year
      uniqueYears.forEach(year => {
        const yearEntries = data.filter(d => d.year === year)
        const maxRank = Math.max(...yearEntries.map(e => e.final_rank))
        yearEntries.filter(e => e.final_rank === maxRank).forEach(e => {
          if (playerMap[e.nickname]) playerMap[e.nickname].lastPlaces++
        })
      })

      const statsArray = Object.values(playerMap).map(p => ({
        ...p,
        avgPoints: Math.round(p.totalPoints / p.years.length),
      }))

      // Generate fun facts
      statsArray.forEach(p => {
        p.funFacts = generateFunFacts(p, statsArray)
      })

      setPlayerStats(statsArray)
      setLoading(false)
    }
    load()
  }, [])

  const sorted = [...playerStats]
    .filter(p =>
      p.nickname.toLowerCase().includes(search.toLowerCase()) ||
      p.full_name?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'avgPoints') return b.avgPoints - a.avgPoints
      if (sortBy === 'wins') return b.wins - a.wins || b.top5 - a.top5
      if (sortBy === 'years') return b.years.length - a.years.length
      if (sortBy === 'bestRank') return a.bestRank - b.bestRank
      return 0
    })

  const selected = playerStats.find(p => p.nickname === selectedPlayer)

  return (
    <div className="min-h-screen bg-hardwood court-texture">
      <nav className="border-b border-white/8 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-display text-xl tracking-widest text-chalk">
            🏀 MADNESS POOL
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/enter" className="nav-link">Enter Pool</Link>
            <Link href="/leaderboard" className="nav-link">Leaderboard</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-6xl text-chalk tracking-wider">HALL OF HISTORY</h1>
          <p className="text-white/40 font-body mt-2">
            {years.length > 0
              ? `${years.length} years of Madness · ${years[0]}–${years[years.length - 1]}`
              : 'Historical data from past pools'}
          </p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="card p-6 h-40 shimmer" />
            ))}
          </div>
        ) : playerStats.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="text-5xl mb-4">📊</div>
            <h2 className="font-display text-3xl text-white/40 tracking-wider mb-2">NO HISTORY YET</h2>
            <p className="text-white/30 font-body text-sm max-w-sm mx-auto">
              Historical data from past years hasn't been loaded yet.
              Use the admin dashboard to import past results.
            </p>
            <Link href="/admin" className="btn-secondary inline-block mt-6 text-sm">
              Go to Admin →
            </Link>
          </div>
        ) : (
          <>
            {/* Highlight cards */}
            <div className="grid md:grid-cols-3 gap-4 mb-10">
              {/* Most wins */}
              {(() => {
                const champ = playerStats.filter(p => p.wins > 0).sort((a, b) => b.wins - a.wins)[0]
                return champ ? (
                  <div className="card p-5 border-yellow-500/30 bg-yellow-500/5">
                    <div className="text-yellow-400 text-xs font-body tracking-widest uppercase mb-1">Most Championships</div>
                    <div className="font-display text-3xl text-chalk tracking-wider">{champ.nickname}</div>
                    <div className="text-yellow-400 font-bold font-body mt-1">🏆 {champ.wins} title{champ.wins > 1 ? 's' : ''}</div>
                  </div>
                ) : null
              })()}

              {/* Highest avg */}
              {(() => {
                const top = [...playerStats].filter(p => p.years.length >= 2).sort((a, b) => b.avgPoints - a.avgPoints)[0]
                return top ? (
                  <div className="card p-5 border-court-500/30 bg-court-500/5">
                    <div className="text-court-400 text-xs font-body tracking-widest uppercase mb-1">Highest Avg Score</div>
                    <div className="font-display text-3xl text-chalk tracking-wider">{top.nickname}</div>
                    <div className="text-court-400 font-bold font-body mt-1">📈 {top.avgPoints} pts/year</div>
                  </div>
                ) : null
              })()}

              {/* Most loyal */}
              {(() => {
                const loyal = [...playerStats].sort((a, b) => b.years.length - a.years.length)[0]
                return loyal ? (
                  <div className="card p-5 border-emerald-500/30 bg-emerald-500/5">
                    <div className="text-emerald-400 text-xs font-body tracking-widest uppercase mb-1">Most Loyal</div>
                    <div className="font-display text-3xl text-chalk tracking-wider">{loyal.nickname}</div>
                    <div className="text-emerald-400 font-bold font-body mt-1">🗓️ {loyal.years.length} years</div>
                  </div>
                ) : null
              })()}
            </div>

            {/* Search + Sort controls */}
            <div className="flex flex-wrap gap-3 mb-6">
              <input
                type="text"
                placeholder="Search player..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-white/8 border border-white/15 rounded-lg px-4 py-2 text-chalk font-body text-sm focus:outline-none focus:border-court-500 placeholder:text-white/20"
              />
              <div className="flex gap-2">
                {[
                  { key: 'avgPoints', label: 'Avg Score' },
                  { key: 'wins', label: 'Wins' },
                  { key: 'years', label: 'Years Played' },
                  { key: 'bestRank', label: 'Best Finish' },
                ].map(s => (
                  <button
                    key={s.key}
                    onClick={() => setSortBy(s.key as any)}
                    className={`px-3 py-2 rounded-lg text-sm font-body transition-all ${sortBy === s.key ? 'bg-court-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Player grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map(player => (
                <button
                  key={player.nickname}
                  onClick={() => setSelectedPlayer(selectedPlayer === player.nickname ? null : player.nickname)}
                  className={`card-hover p-5 text-left transition-all ${selectedPlayer === player.nickname ? 'border-court-500/50 bg-court-500/10' : ''}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-body font-bold text-chalk">{player.nickname}</div>
                      {player.full_name && <div className="text-white/30 text-xs font-body">{player.full_name}</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-display text-3xl text-court-400 tracking-wider">{player.avgPoints}</div>
                      <div className="text-white/30 text-xs font-body">avg pts</div>
                    </div>
                  </div>

                  {/* Mini stats */}
                  <div className="flex gap-3 text-xs font-body text-white/40 mb-3">
                    <span>{player.years.length} yrs</span>
                    {player.wins > 0 && <span className="text-yellow-400">🏆 {player.wins}x champ</span>}
                    <span>Best: #{player.bestRank}</span>
                    {player.lastPlaces > 0 && <span className="text-white/25">🐢 {player.lastPlaces}x last</span>}
                  </div>

                  {/* Fun facts */}
                  {player.funFacts.length > 0 && (
                    <div className="space-y-1">
                      {player.funFacts.slice(0, 2).map((fact, i) => (
                        <div key={i} className="text-xs text-white/50 font-body italic">{fact}</div>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Expanded player detail */}
            {selected && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setSelectedPlayer(null)}>
                <div className="card max-w-xl w-full p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="font-display text-4xl text-chalk tracking-wider">{selected.nickname}</h2>
                      {selected.full_name && <p className="text-white/40 font-body">{selected.full_name}</p>}
                    </div>
                    <button onClick={() => setSelectedPlayer(null)} className="text-white/30 hover:text-white/70 text-2xl">✕</button>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                      { label: 'Years', value: selected.years.length },
                      { label: 'Avg Score', value: `${selected.avgPoints}` },
                      { label: 'Best Rank', value: `#${selected.bestRank}` },
                      { label: 'Championships', value: selected.wins },
                      { label: 'Top 5 Finishes', value: selected.top5 },
                      { label: 'Last Places', value: selected.lastPlaces },
                    ].map(s => (
                      <div key={s.label} className="bg-white/5 rounded-lg p-3 text-center">
                        <div className="font-display text-3xl text-court-400 tracking-wider">{s.value}</div>
                        <div className="text-white/30 text-xs font-body mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Fun facts */}
                  {selected.funFacts.length > 0 && (
                    <div className="card p-4 mb-6">
                      <h3 className="font-display text-lg text-court-400 tracking-wider mb-3">FUN FACTS</h3>
                      <div className="space-y-2">
                        {selected.funFacts.map((f, i) => (
                          <div key={i} className="text-sm text-white/70 font-body">{f}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Year by year */}
                  <div>
                    <h3 className="font-display text-lg text-court-400 tracking-wider mb-3">YEAR BY YEAR</h3>
                    <div className="space-y-2">
                      {selected.yearlyScores.sort((a, b) => b.year - a.year).map(y => (
                        <div key={y.year} className="flex items-center justify-between py-2 px-3 bg-white/4 rounded-lg">
                          <span className="font-body font-bold text-chalk">{y.year}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-white/50 text-sm font-body">#{y.rank}</span>
                            <span className="font-display text-2xl text-court-400 tracking-wider">{y.points}</span>
                            <span className="text-white/30 text-xs font-body">pts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top teams */}
                  {Object.keys(selected.teamFrequency).length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-display text-lg text-court-400 tracking-wider mb-3">FAVORITE TEAMS</h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(selected.teamFrequency)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 8)
                          .map(([team, count]) => (
                            <span key={team} className={`px-3 py-1 rounded-full text-sm font-body ${count >= 3 ? 'bg-court-500/30 text-court-300 border border-court-500/40' : 'bg-white/8 text-white/50'}`}>
                              {team} {count > 1 ? `×${count}` : ''}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
