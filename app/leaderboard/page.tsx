'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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

interface GameRecord {
  round: number
  winner_team_id: string
  loser_team_id: string
  margin: number
}

export default function LeaderboardPage() {
  const [scores, setScores] = useState<ParticipantScore[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [picks, setPicks] = useState<Record<string, ParticipantPick[]>>({})
  const [games, setGames] = useState<GameRecord[]>([])
  const [currentRound, setCurrentRound] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('total')
  const [rankChanges, setRankChanges] = useState<Record<string, number>>({})
  const [cinderellaIds, setCinderellaIds] = useState<Set<string>>(new Set())

  // Track previous ranks across refreshes
  const prevRanksRef = useRef<Record<string, number>>({})

  const loadScores = useCallback(async () => {
    try {
      const { data: scoresData } = await supabase
        .from('participant_scores')
        .select('*')
        .eq('year', YEAR)
        .order('rank')

      if (scoresData) {
        // Compute rank changes vs previous snapshot
        const changes: Record<string, number> = {}
        for (const s of scoresData) {
          const prev = prevRanksRef.current[s.participant_id]
          if (prev !== undefined && prev !== s.rank) {
            changes[s.participant_id] = prev - s.rank // positive = moved up
          }
        }
        setRankChanges(changes)

        // Snapshot current ranks for next comparison
        const snapshot: Record<string, number> = {}
        for (const s of scoresData) snapshot[s.participant_id] = s.rank
        prevRanksRef.current = snapshot

        setScores(scoresData)
        setLastUpdated(new Date())
      }

      const { data: gamesData } = await supabase
        .from('games')
        .select('round, winner_team_id, loser_team_id, margin')
        .eq('year', YEAR)

      if (gamesData && gamesData.length > 0) {
        setGames(gamesData)
        let maxRound = 0
        for (let i = 0; i < gamesData.length; i++) {
          if (gamesData[i].round > maxRound) maxRound = gamesData[i].round
        }
        setCurrentRound(maxRound)
      }
      // Cinderella alert: who still has a seed 10+ alive?
      const { data: cinData } = await supabase
        .from('picks')
        .select('participant_id, team:team_id(seed, eliminated_round)')
        .eq('year', YEAR)
      if (cinData) {
        const ids = new Set<string>()
        for (const p of cinData) {
          const team = p.team as any
          if (team && team.seed >= 10 && team.eliminated_round === null) {
            ids.add(p.participant_id)
          }
        }
        setCinderellaIds(ids)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadScores()
    const interval = setInterval(loadScores, 60000)
    return () => clearInterval(interval)
  }, [loadScores])

  async function loadPicks(participantId: string) {
    if (new Date() < DEADLINE) return
    if (picks[participantId]) return
    const { data } = await supabase
      .from('picks')
      .select('team:team_id(id, name, seed, eliminated_round)')
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

  function getTeamPoints(teamId: string, seed: number): number {
    let pts = 0
    for (let i = 0; i < games.length; i++) {
      const g = games[i]
      if (g.winner_team_id !== teamId) continue
      const base = g.round >= 1 && g.round <= 6 ? g.round : 0
      const underdog = seed >= 9 ? 3 : 0
      const marginBonus = Math.floor((g.margin || 0) / 10)
      pts += base + underdog + marginBonus
    }
    return pts
  }

  function getRoundPoints(teamId: string, seed: number, round: number): number {
    let pts = 0
    for (let i = 0; i < games.length; i++) {
      const g = games[i]
      if (g.winner_team_id !== teamId || g.round !== round) continue
      const base = g.round >= 1 && g.round <= 6 ? g.round : 0
      const underdog = seed >= 9 ? 3 : 0
      pts += base + underdog + Math.floor((g.margin || 0) / 10)
    }
    return pts
  }

  // Teams that have played in the current round
  const teamsPlayedThisRound = new Set<string>()
  for (let i = 0; i < games.length; i++) {
    if (games[i].round === currentRound) {
      teamsPlayedThisRound.add(games[i].winner_team_id)
      teamsPlayedThisRound.add(games[i].loser_team_id)
    }
  }

  // Teams that won in the current round
  const teamsWonThisRound = new Set<string>()
  for (let i = 0; i < games.length; i++) {
    if (games[i].round === currentRound) {
      teamsWonThisRound.add(games[i].winner_team_id)
    }
  }

  // Who scored most this round (for "hot" badge)
  const roundPointsById: Record<string, number> = {}

  const sorted = sortBy === 'total'
    ? scores.slice().sort((a, b) => a.rank - b.rank)
    : scores.slice().sort((a, b) => b.total_points - a.total_points)

  const filtered = sorted.filter(s =>
    s.nickname.toLowerCase().includes(search.toLowerCase()) ||
    (s.full_name && s.full_name.toLowerCase().includes(search.toLowerCase()))
  )

  const prizes = calculatePrizes(scores.length || 77, ENTRY_FEE)
  const prizeAmounts: Record<number, number> = {}
  prizes.places.slice(0, 5).forEach((p, i) => { prizeAmounts[i + 1] = p.amount })

  const medalColors: Record<number, string> = {
    1: 'text-yellow-400',
    2: 'text-slate-300',
    3: 'text-amber-600',
  }

  const leaderPoints = scores.length > 0 ? scores[0].total_points : 0

  return (
    <div className="min-h-screen bg-hardwood court-texture">
      <SiteNav />

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-6xl text-chalk tracking-wider">LEADERBOARD</h1>
            <div className="flex items-center gap-4 mt-2">
              {currentRound > 0 && (
                <span className="text-maize-500 text-sm font-body font-bold tracking-wide">
                  {'🟢 After ' + ROUND_NAMES[currentRound]}
                </span>
              )}
              {lastUpdated && (
                <span className="text-white/30 text-xs font-body">
                  {'Updated ' + lastUpdated.toLocaleTimeString()}
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
              <button
                onClick={() => setSortBy('total')}
                className={sortBy === 'total' ? 'bg-maize-500 text-blue-900 px-3 py-1.5 rounded-lg text-xs font-bold' : 'bg-white/10 text-white/50 px-3 py-1.5 rounded-lg text-xs hover:bg-white/20'}
              >Total</button>
              <button
                onClick={() => setSortBy('round')}
                className={sortBy === 'round' ? 'bg-maize-500 text-blue-900 px-3 py-1.5 rounded-lg text-xs font-bold' : 'bg-white/10 text-white/50 px-3 py-1.5 rounded-lg text-xs hover:bg-white/20'}
              >This Round</button>
            </div>
            <button onClick={loadScores} className="btn-secondary text-sm py-2 px-4">
              ↻ Refresh
            </button>
          </div>
        </div>

        {scores.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-8">
            {prizes.places.map((p, i) => (
              <div key={p.place} className={'card p-3 text-center' + (i === 0 ? ' border-maize-500/40 bg-maize-500/10' : '')}>
                <div className={'font-display text-lg tracking-wider ' + (i === 0 ? 'text-maize-400' : 'text-white/40')}>{p.place}</div>
                <div className={'font-body font-bold text-xs ' + (i === 0 ? 'text-maize-400' : 'text-white/40')}>
                  {i === prizes.places.length - 1 ? '$40 back' : '$' + p.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0,1,2,3,4,5,6,7].map(i => (
              <div key={i} className="card p-4 h-16 shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="text-5xl mb-4">🏀</div>
            <h2 className="font-display text-3xl text-white/40 tracking-wider mb-2">
              {scores.length === 0 ? 'NO SCORES YET' : 'NO RESULTS'}
            </h2>
            <p className="text-white/30 font-body text-sm">
              {scores.length === 0 ? 'Scores will appear once games are recorded.' : 'Try a different search.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((participant, idx) => {
              const isExpanded = expandedId === participant.participant_id
              const isPrizePosition = participant.rank <= 5
              const isLastPlace = participant.rank === scores.length
              const participantPicks = picks[participant.participant_id] || []
              const medalColor = medalColors[participant.rank] || 'text-white/30'
              const rankLabel = participant.rank <= 3 ? ['🥇', '🥈', '🥉'][participant.rank - 1] : '#' + participant.rank
              const rankChange = rankChanges[participant.participant_id]
              const gapToLeader = participant.rank === 1 ? 0 : leaderPoints - participant.total_points

              return (
                <div
                  key={participant.participant_id}
                  className={'card overflow-hidden transition-all duration-300' + (isPrizePosition ? ' border-maize-500/25' : '') + (isLastPlace ? ' border-white/5' : '')}
                >
                  <button
                    onClick={() => toggleExpand(participant.participant_id)}
                    className="w-full flex items-center gap-2 sm:gap-4 p-3 sm:p-4 text-left hover:bg-white/5 transition-colors"
                  >
                    {/* Rank + change indicator */}
                    <div className="shrink-0 w-12 sm:w-16 flex flex-col items-center">
                      <div className={'font-display text-xl sm:text-3xl tracking-wider ' + medalColor}>
                        {rankLabel}
                      </div>
                      {rankChange !== undefined && rankChange !== 0 ? (
                        <div className={'text-xs font-bold font-body ' + (rankChange > 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {rankChange > 0 ? '↑' + rankChange : '↓' + Math.abs(rankChange)}
                        </div>
                      ) : null}
                    </div>

                    {/* Name + cinderella badge */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-body font-bold text-chalk truncate">{participant.nickname}</div>
                        {cinderellaIds.has(participant.participant_id) ? (
                          <span className="text-xs bg-pink-500/20 text-pink-300 border border-pink-500/30 px-1.5 py-0.5 rounded font-body shrink-0" title="Has a Cinderella (seed 10+) still alive!">🏃 Cinderella</span>
                        ) : null}
                      </div>
                      {participant.full_name ? (
                        <div className="text-white/30 text-xs font-body truncate">{participant.full_name}</div>
                      ) : null}
                    </div>

                    {/* Teams alive summary - dots */}
                    <div className="hidden sm:flex flex-col items-center gap-1">
                      <div className="font-display text-xl text-white/50">{participant.teams_alive}</div>
                      <div className="text-white/25 text-xs font-body">alive</div>
                    </div>

                    {/* Gap to leader */}
                    {gapToLeader > 0 ? (
                      <div className="text-right hidden md:block">
                        <div className="text-white/30 font-body text-xs">{'-' + gapToLeader + ' pts'}</div>
                        <div className="text-white/20 text-xs font-body">from #1</div>
                      </div>
                    ) : null}

                    {isPrizePosition && prizeAmounts[participant.rank] ? (
                      <div className="text-right hidden md:block">
                        <div className="text-maize-400 font-bold text-sm font-body">{'$' + prizeAmounts[participant.rank].toLocaleString()}</div>
                        <div className="text-white/25 text-xs font-body">prize</div>
                      </div>
                    ) : null}

                    {isLastPlace && scores.length > 1 ? (
                      <div className="text-right hidden md:block">
                        <div className="text-white/40 font-bold text-sm font-body">Entry back</div>
                        <div className="text-white/25 text-xs font-body">last place</div>
                      </div>
                    ) : null}

                    <div className="text-right shrink-0">
                      <div className={'font-display text-2xl sm:text-4xl tracking-wider ' + (participant.rank === 1 ? 'text-maize-400' : 'text-chalk')}>
                        {participant.total_points}
                      </div>
                      <div className="text-white/30 text-xs font-body">pts</div>
                    </div>

                    <div className={'text-white/30 transition-transform duration-200' + (isExpanded ? ' rotate-180' : '')}>▾</div>
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-white/10 px-4 py-4 bg-black/20">
                      {participantPicks.length === 0 ? (
                        new Date() < DEADLINE
                          ? <div className="text-white/40 text-sm font-body text-center py-3">🔒 Picks hidden until tip-off</div>
                          : <div className="text-white/30 text-sm font-body text-center py-2">Loading picks...</div>
                      ) : (
                        <>
                          {/* Team status legend */}
                          {currentRound > 0 && (
                            <div className="flex gap-3 mb-3 text-xs font-body text-white/30">
                              <span className="flex items-center gap-1"><span className="text-emerald-400">✓</span> Won R{currentRound}</span>
                              <span className="flex items-center gap-1"><span className="text-amber-400">⏳</span> Yet to play</span>
                              <span className="flex items-center gap-1"><span className="text-white/20">✗</span> Eliminated</span>
                            </div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                            {participantPicks.map(pickItem => {
                              const team = pickItem.team
                              if (!team) return null
                              const eliminated = team.eliminated_round !== null
                              const wonThisRound = teamsWonThisRound.has(team.id)
                              const playedThisRound = teamsPlayedThisRound.has(team.id)
                              const yetToPlay = !eliminated && currentRound > 0 && !playedThisRound
                              const pts = getTeamPoints(team.id, team.seed)
                              const roundPts = currentRound > 0 ? getRoundPoints(team.id, team.seed, currentRound) : 0

                              let borderClass = 'bg-white/5 border-white/10'
                              let statusIcon = null
                              if (eliminated) {
                                borderClass = 'bg-white/3 border-white/5 opacity-50'
                                statusIcon = <span className="text-white/20 text-xs">✗</span>
                              } else if (wonThisRound) {
                                borderClass = 'bg-emerald-500/10 border-emerald-500/20'
                                statusIcon = <span className="text-emerald-400 text-xs">✓</span>
                              } else if (yetToPlay) {
                                borderClass = 'bg-amber-500/5 border-amber-500/15'
                                statusIcon = <span className="text-amber-400 text-xs">⏳</span>
                              }

                              return (
                                <div key={team.id} className={'flex items-center justify-between px-3 py-2 rounded-lg text-sm border ' + borderClass}>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {statusIcon}
                                    <TeamBadge
                                      name={team.name}
                                      seed={team.seed}
                                      showRecord={true}
                                      size="sm"
                                      eliminated={eliminated}
                                    />
                                  </div>
                                  <div className="text-right shrink-0 ml-2">
                                    {pts > 0 ? <div className="text-maize-400 text-xs font-bold">{pts + ' pts'}</div> : null}
                                    {roundPts > 0 ? <div className="text-emerald-400 text-xs">{'+' + roundPts + ' R' + currentRound}</div> : null}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}
                      {participant.tiebreaker ? (
                        <div className="mt-3 text-white/30 text-xs font-body">
                          {'Tiebreaker: ' + participant.tiebreaker + ' total pts'}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-8 text-center text-white/20 text-xs font-body">
          {scores.length + ' participants'}
        </div>
      </div>
    </div>
  )
}
