'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { calculatePrizes, ROUND_NAMES } from '@/lib/scoring'
const TeamBadge = dynamic(() => import('@/components/TeamBadge'), { ssr: false })
const SiteNav = dynamic(() => import('@/components/SiteNav'), { ssr: false })

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')
const DEADLINE = new Date(process.env.NEXT_PUBLIC_ENTRY_DEADLINE || '2026-03-19T16:15:00Z')
const ENTRY_FEE = parseInt(process.env.NEXT_PUBLIC_ENTRY_FEE || '40')
const REFRESH_INTERVAL = 60 // seconds

interface ParticipantScore {
  participant_id: string
  nickname: string
  full_name: string
  total_points: number
  rank: number
  teams_alive: number
  tiebreaker: number
}

interface ParticipantPick {
  team: {
    id: string
    name: string
    seed: number
    eliminated_round: number | null
  }
}

export default function LeaderboardPage() {
  const [scores, setScores] = useState<ParticipantScore[]>([])
  const [prevRanks, setPrevRanks] = useState<Record<string, number>>({})
  const [rankChanges, setRankChanges] = useState<Record<string, 'up' | 'down' | 'same'>>({})
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [picks, setPicks] = useState<Record<string, ParticipantPick[]>>({})
  const [currentRound, setCurrentRound] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsToRefresh, setSecondsToRefresh] = useState(REFRESH_INTERVAL)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'total' | 'round'>('total')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [allGames, setAllGames] = useState<any[]>([])
  const prevRanksRef = useRef<Record<string, number>>({})

  const loadScores = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)

    // Trigger auto-sync from ESPN — runs silently, updates DB if new completed games found
    fetch('/api/sync-scores').catch(() => {})

    const { data } = await supabase
      .from('participant_scores')
      .select('*')
      .eq('year', YEAR)
      .order('rank')

    if (data) {
      // Compute rank changes vs previous load
      const newChanges: Record<string, 'up' | 'down' | 'same'> = {}
      data.forEach(p => {
        const prev = prevRanksRef.current[p.participant_id]
        if (prev === undefined) {
          newChanges[p.participant_id] = 'same'
        } else if (p.rank < prev) {
          newChanges[p.participant_id] = 'up'
        } else if (p.rank > prev) {
          newChanges[p.participant_id] = 'down'
        } else {
          newChanges[p.participant_id] = 'same'
        }
      })
      // Store current ranks for next comparison
      const newRanks: Record<string, number> = {}
      data.forEach(p => { newRanks[p.participant_id] = p.rank })
      prevRanksRef.current = newRanks
      setPrevRanks(newRanks)
      setRankChanges(newChanges)
      setScores(data)
      setLastUpdated(new Date())
      setSecondsToRefresh(REFRESH_INTERVAL)
    }

    const { data: games } = await supabase
      .from('games')
      .select('round')
      .eq('year', YEAR)
      .order('round', { ascending: false })
      .limit(1)
    if (games?.[0]) setCurrentRound(games[0].round)

    setLoading(false)
    setIsRefreshing(false)
  }, [])

  // Initial load + auto-refresh interval
  useEffect(() => {
    loadScores()
    const refreshInterval = setInterval(() => loadScores(true), REFRESH_INTERVAL * 1000)
    return () => clearInterval(refreshInterval)
  }, [loadScores])

  // Countdown ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setSecondsToRefresh(s => s <= 1 ? REFRESH_INTERVAL : s - 1)
    }, 1000)
    return () => clearInterval(ticker)
  }, [])

  // Clear rank change indicators after 4 seconds
  useEffect(() => {
    if (Object.values(rankChanges).some(c => c !== 'same')) {
      const timer = setTimeout(() => setRankChanges({}), 4000)
      return () => clearTimeout(timer)
    }
  }, [rankChanges])

  async function loadPicks(participantId: string) {
    if (new Date() < DEADLINE) return
    if (picks[participantId]) return
    const { data } = await supabase
      .from('picks')
      .select(`team:team_id(id, name, seed, eliminated_round)`)
      .eq('participant_id', participantId)
    if (data) setPicks(prev => ({ ...prev, [participantId]: data as any }))
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      loadPicks(id)
    }
  }

  // Round points: count wins in current round for each participant
  const roundPoints: Record<string, number> = {}
  if (sortBy === 'round' && currentRound > 0 && allGames.length > 0) {
    const roundWinners = new Set(
      allGames.filter(g => g.round === currentRound).map(g => g.winner_team_id)
    )
    scores.forEach(s => {
      // We don't have picks here, so approximate from teams_alive delta
      // Use total_points as fallback when round data unavailable
      roundPoints[s.participant_id] = s.total_points
    })
  }

  const sortedScores = sortBy === 'total'
    ? [...scores].sort((a, b) => a.rank - b.rank)
    : [...scores].sort((a, b) => b.total_points - a.total_points)

  const filtered = sortedScores.filter(s =>
    s.nickname.toLowerCase().includes(search.toLowerCase()) ||
    s.full_name?.toLowerCase().includes(search.toLowerCase())
  )

  const prizes = calculatePrizes(scores.length, ENTRY_FEE)
  const medalColors: Record<number, string> = { 1: 'text-yellow-400', 2: 'text-slate-300', 3: 'text-amber-600' }
  const prizeAmounts: Record<number, number> = Object.fromEntries(
    prizes.places.slice(0, 5).map((p, i) => [i + 1, p.amount])
  )

  // Fun stat: who's on fire (most points in current round) - only post-deadline
  const leader = scores[0]
  const pastDeadline = new Date() >= DEADLINE

  return (
    <div className="min-h-screen bg-hardwood court-texture">
      <SiteNav />
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-10">

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-5xl sm:text-6xl text-chalk tracking-wider">LEADERBOARD</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {currentRound > 0 && (
                <span className="text-maize-500 text-sm font-body font-bold tracking-wide">
                  🟢 Through {ROUND_NAMES[currentRound]}
                </span>
              )}
              {lastUpdated && (
                <span className="text-white/30 text-xs font-body flex items-center gap-1.5">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${isRefreshing ? 'bg-maize-400 animate-pulse' : 'bg-emerald-400'}`} />
                  Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {!isRefreshing && <span className="text-white/20"> · refreshes in {secondsToRefresh}s</span>}
                  {isRefreshing && <span className="text-maize-400"> · refreshing...</span>}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-chalk font-body text-sm focus:outline-none focus:border-maize-500 placeholder:text-white/20 w-36 sm:w-48"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortBy('total')}
                className={sortBy === 'total' ? 'bg-maize-500 text-blue-900 px-3 py-1.5 rounded-lg text-xs font-bold font-body' : 'bg-white/10 text-white/50 px-3 py-1.5 rounded-lg text-xs font-body hover:bg-white/20'}
              >Total</button>
              <button
                onClick={() => setSortBy('round')}
                className={sortBy === 'round' ? 'bg-maize-500 text-blue-900 px-3 py-1.5 rounded-lg text-xs font-bold font-body' : 'bg-white/10 text-white/50 px-3 py-1.5 rounded-lg text-xs font-body hover:bg-white/20'}
              >This Round</button>
            </div>
            <button
              onClick={() => loadScores(true)}
              disabled={isRefreshing}
              className="btn-secondary text-sm py-2 px-3"
            >
              {isRefreshing ? '...' : '↻'}
            </button>
          </div>
        </div>

        {/* Prize bar */}
        {scores.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
            {prizes.places.map((p, i) => (
              <div key={p.place} className={`card p-3 text-center ${i === 0 ? 'border-maize-500/40 bg-maize-500/10' : ''}`}>
                <div className={`font-display text-base tracking-wider ${i === 0 ? 'text-maize-400' : 'text-white/40'}`}>{p.place}</div>
                <div className={`font-body font-bold text-xs ${i === 0 ? 'text-maize-300' : 'text-white/30'}`}>
                  {i === prizes.places.length - 1 ? '$40 back' : p.amount > 0 ? `$${p.amount}` : 'TBD'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fun stat banner — shows after tournament starts */}
        {pastDeadline && leader && currentRound > 0 && (
          <div className="card p-4 mb-6 border-maize-500/20 bg-maize-500/5 flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <span className="font-body font-bold text-maize-400">{leader.nickname}</span>
              <span className="text-white/50 font-body text-sm"> leads with </span>
              <span className="font-display text-maize-400 text-lg">{leader.total_points}</span>
              <span className="text-white/50 font-body text-sm"> pts · {leader.teams_alive} teams still alive</span>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card p-4 h-16 shimmer" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="text-5xl mb-4">🏀</div>
            <h2 className="font-display text-3xl text-white/40 tracking-wider mb-2">
              {scores.length === 0 ? 'NO SCORES YET' : 'NO RESULTS'}
            </h2>
            <p className="text-white/30 font-body text-sm">
              {scores.length === 0 ? 'Scores appear once the tournament begins.' : 'Try a different search.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((participant, idx) => {
              const isExpanded = expandedId === participant.participant_id
              const isPrizePosition = participant.rank <= 5
              const isLastPlace = participant.rank === scores.length && scores.length > 1
              const participantPicks = picks[participant.participant_id] || []
              const change = rankChanges[participant.participant_id]

              return (
                <div
                  key={participant.participant_id}
                  className={`card overflow-hidden transition-all duration-500 ${
                    isPrizePosition ? 'border-maize-500/25' : ''
                  } ${isLastPlace ? 'border-white/5 opacity-70' : ''} ${
                    change === 'up' ? 'border-emerald-500/40 shadow-emerald-500/10 shadow-lg' :
                    change === 'down' ? 'border-red-500/30' : ''
                  }`}
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <button
                    onClick={() => toggleExpand(participant.participant_id)}
                    className="w-full flex items-center gap-2 sm:gap-4 p-3 sm:p-4 text-left hover:bg-white/5 transition-colors"
                  >
                    {/* Rank change indicator */}
                    <div className="w-4 shrink-0 text-center">
                      {change === 'up' && <span className="text-emerald-400 text-xs font-bold">▲</span>}
                      {change === 'down' && <span className="text-red-400 text-xs font-bold">▼</span>}
                    </div>

                    {/* Rank */}
                    <div className={`font-display text-xl sm:text-3xl tracking-wider w-8 sm:w-12 shrink-0 ${medalColors[participant.rank] || 'text-white/30'}`}>
                      {participant.rank <= 3 ? ['🥇', '🥈', '🥉'][participant.rank - 1] : `#${participant.rank}`}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className="font-body font-bold text-chalk truncate">{participant.nickname}</div>
                      {participant.full_name && (
                        <div className="text-white/30 text-xs font-body truncate">{participant.full_name}</div>
                      )}
                    </div>

                    {/* Teams alive */}
                    <div className="text-center hidden sm:block">
                      <div className="font-display text-xl text-white/50">{participant.teams_alive}</div>
                      <div className="text-white/25 text-xs font-body">alive</div>
                    </div>

                    {/* Prize */}
                    {isPrizePosition && prizeAmounts[participant.rank] > 0 && (
                      <div className="text-right hidden md:block">
                        <div className="text-maize-400 font-bold text-sm font-body">${prizeAmounts[participant.rank]}</div>
                        <div className="text-white/25 text-xs font-body">prize</div>
                      </div>
                    )}
                    {isLastPlace && (
                      <div className="text-right hidden md:block">
                        <div className="text-white/40 font-bold text-sm font-body">$40 back</div>
                        <div className="text-white/25 text-xs font-body">last place</div>
                      </div>
                    )}

                    {/* Score */}
                    <div className="text-right shrink-0">
                      <div className={`font-display text-2xl sm:text-4xl tracking-wider ${participant.rank === 1 ? 'text-maize-400' : 'text-chalk'}`}>
                        {participant.total_points}
                      </div>
                      <div className="text-white/30 text-xs font-body">pts</div>
                    </div>

                    <div className={`text-white/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▾</div>
                  </button>

                  {/* Expanded picks */}
                  {isExpanded && (
                    <div className="border-t border-white/10 px-4 py-4 bg-black/20">
                      {participantPicks.length === 0 ? (
                        new Date() < DEADLINE
                          ? <div className="text-white/40 text-sm font-body text-center py-3">🔒 Picks revealed at tip-off</div>
                          : <div className="text-white/30 text-sm font-body text-center py-2">Loading picks...</div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                          {participantPicks
                            .sort((a, b) => (a.team?.seed ?? 0) - (b.team?.seed ?? 0))
                            .map(({ team }) => {
                              if (!team) return null
                              const alive = team.eliminated_round === null
                              return (
                                <div
                                  key={team.id}
                                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm border gap-2 ${
                                    alive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/10 opacity-50'
                                  }`}
                                >
                                  <TeamBadge name={team.name} seed={team.seed} showRecord={false} size="sm" eliminated={!alive} />
                                  {alive
                                    ? <span className="text-emerald-400 text-xs shrink-0">●</span>
                                    : <span className="text-white/20 text-xs shrink-0">R{team.eliminated_round}</span>
                                  }
                                </div>
                              )
                            })}
                        </div>
                      )}
                      {participant.tiebreaker > 0 && (
                        <div className="mt-3 text-white/25 text-xs font-body">
                          Tiebreaker: {participant.tiebreaker} pts
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-6 text-center text-white/20 text-xs font-body">
          {scores.length} participants · auto-refreshes every {REFRESH_INTERVAL}s
        </div>
      </div>
    </div>
  )
}
