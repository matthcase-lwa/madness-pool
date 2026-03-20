'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { calculatePrizes, ROUND_NAMES } from '@/lib/scoring'
const ParticipantCount = dynamic(() => import('@/components/ParticipantCount'), { ssr: false })
const NavCTA = dynamic(() => import('@/components/NavCTA'), { ssr: false })
const TeamBadge = dynamic(() => import('@/components/TeamBadge'), { ssr: false })
const SiteNav = dynamic(() => import('@/components/SiteNav'), { ssr: false })

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')
const DEADLINE = new Date(process.env.NEXT_PUBLIC_ENTRY_DEADLINE || '2026-03-19T16:15:00Z')
const ENTRY_FEE = parseInt(process.env.NEXT_PUBLIC_ENTRY_FEE || '40')

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
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [picks, setPicks] = useState<Record<string, ParticipantPick[]>>({})
  const [currentRound, setCurrentRound] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('total')

  const loadScores = useCallback(async () => {
    const { data } = await supabase
      .from('participant_scores')
      .select('*')
      .eq('year', YEAR)
      .order('rank')

    if (data) {
      setScores(data)
      setLastUpdated(new Date())
    }

    // Get current round from games
    const { data: games } = await supabase
      .from('games')
      .select('round')
      .eq('year', YEAR)
      .order('round', { ascending: false })
      .limit(1)

    if (games?.[0]) setCurrentRound(games[0].round)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadScores()
    // Refresh scores from DB every 60 seconds
    const refreshInterval = setInterval(loadScores, 60000)
    // Trigger ESPN sync every 3 minutes (piggybacks on leaderboard views)
    const syncInterval = setInterval(async () => {
      try {
        await fetch('/api/sync-scores', {
          headers: { 'Authorization': 'Bearer ' + (process.env.NEXT_PUBLIC_SYNC_TOKEN || 'madness-sync-2026') }
        })
        // Reload scores after sync in case new games came in
        loadScores()
      } catch {}
    }, 180000)
    return () => { clearInterval(refreshInterval); clearInterval(syncInterval) }
  }, [loadScores])

  async function loadPicks(participantId: string) {
    if (new Date() < DEADLINE) return // Picks hidden until tip-off
    if (picks[participantId]) return
    const { data } = await supabase
      .from('picks')
      .select(`team:team_id(id, name, seed, eliminated_round)`)
      .eq('participant_id', participantId)

    if (data) {
      setPicks(prev => ({ ...prev, [participantId]: data as any }))
    }
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      loadPicks(id)
    }
  }

  const sorted = sortBy === 'total'
    ? [...scores].sort((a, b) => a.rank - b.rank)
    : [...scores].sort((a, b) => b.total_points - a.total_points)

  const filtered = sorted.filter(s =>
    s.nickname.toLowerCase().includes(search.toLowerCase()) ||
    s.full_name?.toLowerCase().includes(search.toLowerCase())
  )

  const prizes = calculatePrizes(scores.length, ENTRY_FEE)

  const medalColors: Record<number, string> = {
    1: 'text-yellow-400',
    2: 'text-slate-300',
    3: 'text-amber-600',
  }

  const prizeAmounts: Record<number, number> = Object.fromEntries(
    prizes.places.slice(0, 5).map((p, i) => [i + 1, p.amount])
  )

  return (
    <div className="min-h-screen bg-hardwood court-texture">
      <SiteNav />

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-6xl text-chalk tracking-wider">LEADERBOARD</h1>
            <div className="flex items-center gap-4 mt-2">
              {currentRound > 0 && (
                <span className="text-maize-500 text-sm font-body font-bold tracking-wide">
                  🟢 After {ROUND_NAMES[currentRound]}
                </span>
              )}
              {lastUpdated && (
                <span className="text-white/30 text-xs font-body">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search player..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-chalk font-body text-sm focus:outline-none focus:border-maize-500 placeholder:text-white/20 w-48"
            />
            <div className="flex items-center gap-1">
              <button onClick={() => setSortBy('total')} className={sortBy === 'total' ? 'bg-maize-500 text-blue-900 px-3 py-1.5 rounded-lg text-xs font-bold' : 'bg-white/10 text-white/50 px-3 py-1.5 rounded-lg text-xs hover:bg-white/20'}>Total</button>
              <button onClick={() => setSortBy('round')} className={sortBy === 'round' ? 'bg-maize-500 text-blue-900 px-3 py-1.5 rounded-lg text-xs font-bold' : 'bg-white/10 text-white/50 px-3 py-1.5 rounded-lg text-xs hover:bg-white/20'}>This Round</button>
            </div>
            <button
              onClick={loadScores}
              className="btn-secondary text-sm py-2 px-4"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Prize summary */}
        {scores.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-8">
            {prizes.places.map((p, i) => (
              <div key={p.place} className={`card p-3 text-center ${i === 0 ? 'border-maize-500/40 bg-maize-500/10' : ''}`}>
                <div className={`font-display text-lg tracking-wider ${i === 0 ? 'text-maize-400' : 'text-white/40'}`}>{p.place}</div>
                <div className={`font-body font-bold text-xs ${i === 0 ? 'text-maize-400' : 'text-white/40'}`}>{i === prizes.places.length - 1 ? 'Entry back' : 'TBD'}</div>
              </div>
            ))}
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
              {scores.length === 0
                ? 'Scores will appear once the tournament begins.'
                : 'Try a different search.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((participant, idx) => {
              const isExpanded = expandedId === participant.participant_id
              const isPrizePosition = participant.rank <= 5
              const isLastPlace = participant.rank === scores.length
              const participantPicks = picks[participant.participant_id] || []

              return (
                <div
                  key={participant.participant_id}
                  className={`card overflow-hidden transition-all duration-300 ${isPrizePosition ? 'border-maize-500/25' : ''} ${isLastPlace ? 'border-white/5' : ''}`}
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  {/* Main row */}
                  <button
                    onClick={() => toggleExpand(participant.participant_id)}
                    className="w-full flex items-center gap-2 sm:gap-4 p-3 sm:p-4 text-left hover:bg-white/5 transition-colors"
                  >
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

                    {/* Prize amount */}
                    {isPrizePosition && prizeAmounts[participant.rank] && (
                      <div className="text-right hidden md:block">
                        <div className="text-maize-400 font-bold text-sm font-body">Prize TBD</div>
                        <div className="text-white/25 text-xs font-body">current prize</div>
                      </div>
                    )}
                    {isLastPlace && scores.length > 1 && (
                      <div className="text-right hidden md:block">
                        <div className="text-white/40 font-bold text-sm font-body">Entry back</div>
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

                    {/* Expand chevron */}
                    <div className={`text-white/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▾</div>
                  </button>

                  {/* Expanded picks */}
                  {isExpanded && (
                    <div className="border-t border-white/10 px-4 py-4 bg-black/20">
                      {participantPicks.length === 0 ? (
                        new Date() < DEADLINE
                          ? <div className="text-white/40 text-sm font-body text-center py-3">🔒 Picks hidden until tip-off</div>
                          : <div className="text-white/30 text-sm font-body text-center py-2">Loading picks...</div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                          {participantPicks.map(({ team }) => {
                            if (!team) return null
                            const alive = team.eliminated_round === null
                            return (
                              <div
                                key={team.id}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm border ${
                                  alive
                                    ? 'bg-emerald-500/10 border-emerald-500/20'
                                    : 'bg-white/5 border-white/10'
                                }`}
                              >
                                <TeamBadge
                                  name={team.name}
                                  seed={team.seed}
                                  showRecord={true}
                                  size="sm"
                                  eliminated={!alive}
                                />
                                {alive && <span className="text-emerald-400 text-xs ml-2">●</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {participant.tiebreaker && (
                        <div className="mt-3 text-white/30 text-xs font-body">
                          Tiebreaker: {participant.tiebreaker} total pts
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-8 text-center text-white/20 text-xs font-body">
          {scores.length} participants
        </div>
      </div>
    </div>
  )
}
